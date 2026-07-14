import { PageGlyphs } from "@/components/PageGlyphs";
import { Reveal } from "@/components/Reveal";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { createClient } from "@/lib/supabase/server";
import { Dumbbell, Sparkles } from "lucide-react";
import Link from "next/link";
import { type Message, ToubeChat } from "./ToubeChat";

export const dynamic = "force-dynamic";

export default async function ToubePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  // Sessão ativa: a mais recente, ou cria uma se o usuário não tem nenhuma.
  let { data: sess } = await supabase
    .from("toube_sessions")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sess) {
    const { data: created } = await supabase
      .from("toube_sessions")
      .insert({ user_id: userId })
      .select("id")
      .single();
    sess = created;
  }
  const sessionId = sess?.id ?? "";

  const { data: rows } = await supabase
    .from("toube_messages")
    .select("id, role, content")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const initial = (rows ?? []) as Message[];

  return (
    <>
      <PageGlyphs variant="editorial" />

      <Reveal>
        <GradientHeader
          icon={Sparkles}
          eyebrow="Assistente · IA"
          title="Toube"
          subtitle="Converse, pense em voz alta, peça um empurrão."
        />
      </Reveal>

      <Link
        href="/toube/planos"
        className="mx-auto mb-5 flex w-full max-w-2xl items-center gap-4 rounded-2xl border p-4 transition-transform hover:scale-[1.01]"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
      >
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ background: "var(--gradient-brand)" }}
        >
          <Dumbbell className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold" style={{ color: "var(--color-fg)" }}>
            Planos de treino
          </span>
          <span className="block truncate text-xs" style={{ color: "var(--color-fg-muted)" }}>
            Monta teu treino conversando — cola um vídeo ou PDF e ele estrutura tudo
          </span>
        </span>
        <span aria-hidden className="text-lg" style={{ color: "var(--color-accent)" }}>
          →
        </span>
      </Link>

      <ToubeChat initial={initial} sessionId={sessionId} />
    </>
  );
}
