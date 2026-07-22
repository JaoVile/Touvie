import { groqChat } from "@/lib/groq";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MODES = {
  resumir: "Resuma esta página de livro em português, em 3 a 5 frases claras. Só o essencial.",
  explicar:
    "Explique o conteúdo desta página de livro em português simples, didático e curto, como para alguém leigo no assunto.",
} as const;
type Mode = keyof typeof MODES | "perguntar";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let text = "";
  let mode: Mode = "resumir";
  let question = "";
  try {
    const body = (await req.json()) as { text?: unknown; mode?: unknown; question?: unknown };
    text = String(body.text ?? "").slice(0, 8000);
    mode = String(body.mode ?? "resumir") as Mode;
    question = String(body.question ?? "").slice(0, 500);
  } catch {
    return NextResponse.json({ error: "json inválido" }, { status: 400 });
  }
  if (!text.trim()) return NextResponse.json({ error: "sem texto" }, { status: 400 });

  const instruction =
    mode === "perguntar"
      ? `Responda em português à pergunta do leitor usando SOMENTE o conteúdo desta página. Se a resposta não estiver na página, diga isso. Pergunta: ${question}`
      : (MODES[mode as keyof typeof MODES] ?? MODES.resumir);

  let answer = "";
  try {
    const res = await groqChat({
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content:
            "Você é o Toube, assistente de leitura. Responde direto, em português, em markdown simples.",
        },
        { role: "user", content: `${instruction}\n\n--- PÁGINA ---\n${text}` },
      ],
    });
    answer = res.choices?.[0]?.message?.content?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "O Toube está fora do ar agora." }, { status: 503 });
  }
  if (!answer) return NextResponse.json({ error: "sem resposta" }, { status: 502 });
  return NextResponse.json({ answer });
}
