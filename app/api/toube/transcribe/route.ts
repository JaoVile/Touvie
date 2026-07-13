import { groqTranscribe } from "@/lib/groq";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Áudio do chat → texto (Whisper no Groq). O binário é processado e descartado —
// nada é armazenado; o que persiste é a mensagem que a pessoa revisar e enviar.
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let file: File;
  try {
    const form = await req.formData();
    const f = form.get("audio");
    if (!(f instanceof File)) return NextResponse.json({ error: "Sem áudio." }, { status: 400 });
    file = f;
  } catch {
    return NextResponse.json({ error: "Upload inválido." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Áudio grande demais (máx 8MB)." }, { status: 422 });
  }

  try {
    const text = await groqTranscribe(file, file.name || "audio.webm");
    if (!text) {
      return NextResponse.json({ error: "Não entendi o áudio — tenta de novo." }, { status: 422 });
    }
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json(
      { error: "Não consegui ouvir agora. Tenta de novo." },
      { status: 502 },
    );
  }
}
