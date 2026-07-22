import { groqOcr } from "@/lib/groq";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_IMAGE_CHARS = 3_000_000; // ~2MB de dataURL base64

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let bookId = "";
  let page = 0;
  let image = "";
  try {
    const body = (await req.json()) as { bookId?: unknown; page?: unknown; image?: unknown };
    bookId = String(body.bookId ?? "");
    page = Number(body.page ?? 0);
    image = String(body.image ?? "");
  } catch {
    return NextResponse.json({ error: "json inválido" }, { status: 400 });
  }
  if (!bookId || !Number.isInteger(page) || page < 1) {
    return NextResponse.json({ error: "parâmetros inválidos" }, { status: 400 });
  }

  // Dono do livro? (RLS já filtra o select; confirma pra dar 404 claro.)
  const { data: book } = await supabase
    .from("reading_books")
    .select("id")
    .eq("id", bookId)
    .maybeSingle();
  if (!book) return NextResponse.json({ error: "livro não encontrado" }, { status: 404 });

  // Cache hit → não paga a chamada de visão.
  const { data: cached } = await supabase
    .from("reading_page_text")
    .select("text")
    .eq("book_id", bookId)
    .eq("page", page)
    .maybeSingle();
  if (cached?.text) return NextResponse.json({ text: cached.text, cached: true });

  if (!image.startsWith("data:image/") || image.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ error: "imagem inválida" }, { status: 422 });
  }

  let text = "";
  try {
    text = await groqOcr(image);
  } catch {
    return NextResponse.json({ error: "OCR indisponível agora." }, { status: 503 });
  }

  await supabase
    .from("reading_page_text")
    .upsert(
      { user_id: user.id, book_id: bookId, page, text, source: "ocr" },
      { onConflict: "book_id,page" },
    );

  return NextResponse.json({ text, cached: false });
}
