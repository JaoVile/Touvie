import { groqVision } from "@/lib/groq";
import { extractFromPdf } from "@/lib/planos-source";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Anexo do chat → texto que o Toube consegue "ver": imagem vira descrição
// (Llama 4 Scout, visão), PDF vira texto extraído, .txt/.md entra direto.
// O binário é processado e descartado — nada é armazenado.
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_CHARS = 6000;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let file: File;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (!(f instanceof File)) return NextResponse.json({ error: "Sem arquivo." }, { status: 400 });
    file = f;
  } catch {
    return NextResponse.json({ error: "Upload inválido." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo grande demais (máx 8MB)." }, { status: 422 });
  }

  const mime = file.type || "";
  try {
    if (mime.startsWith("image/")) {
      const buf = Buffer.from(await file.arrayBuffer());
      const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
      const text = await groqVision(dataUrl);
      return NextResponse.json({ kind: "imagem", text: text.slice(0, MAX_CHARS) });
    }
    if (mime === "application/pdf") {
      const { text } = await extractFromPdf(await file.arrayBuffer());
      return NextResponse.json({ kind: "pdf", text: text.slice(0, MAX_CHARS) });
    }
    if (mime.startsWith("text/") || /\.(txt|md)$/i.test(file.name)) {
      const text = (await file.text()).trim();
      if (!text) return NextResponse.json({ error: "Arquivo vazio." }, { status: 422 });
      return NextResponse.json({ kind: "texto", text: text.slice(0, MAX_CHARS) });
    }
    return NextResponse.json(
      { error: "Formato não suportado — manda imagem, PDF ou texto." },
      { status: 422 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    // Mensagens amigáveis do extractFromPdf passam; o resto vira genérica.
    const friendly = /PDF|legenda|texto/.test(msg) ? msg : "Não consegui ler o anexo agora.";
    return NextResponse.json({ error: friendly }, { status: 422 });
  }
}
