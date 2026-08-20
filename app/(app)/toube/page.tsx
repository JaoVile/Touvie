import { PageGlyphs } from "@/components/PageGlyphs";
import { Reveal } from "@/components/Reveal";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { getUserClaims } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { Dumbbell, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { Message } from "./ToubeConversation";
import { ToubeSessions } from "./ToubeSessions";

export const dynamic = "force-dynamic";

export default async function ToubePage() {
  const t = await getTranslations("toube");
  const supabase = await createClient();
  const userId = (await getUserClaims())!.sub;

  // Sessão ativa: a mais recente DA WEB, ou cria uma se o usuário não tem
  // nenhuma. Filtro por source evita cair no fio do Telegram (webhook bumpa
  // updated_at a cada mensagem — ver migration 0039).
  let { data: sess } = await supabase
    .from("toube_sessions")
    .select("id, summary")
    .eq("user_id", userId)
    .eq("source", "web")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sess) {
    const { data: created } = await supabase
      .from("toube_sessions")
      .insert({ user_id: userId, source: "web" })
      .select("id, summary")
      .single();
    sess = created;
  }
  const sessionId = sess?.id ?? "";

  const [{ data: rows }, { data: sessions }] = await Promise.all([
    supabase
      .from("toube_messages")
      .select("id, role, content")
      .eq("user_id", userId)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    supabase
      .from("toube_sessions")
      .select("id, title, updated_at")
      .eq("user_id", userId)
      .eq("source", "web")
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);

  const initial = (rows ?? []) as Message[];

  return (
    <>
      <PageGlyphs variant="editorial" />

      <Reveal>
        <GradientHeader
          icon={Sparkles}
          eyebrow={t("pageEyebrow")}
          title="Toube"
          subtitle={t("pageSubtitle")}
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
            {t("planosCardTitle")}
          </span>
          <span className="block truncate text-xs" style={{ color: "var(--color-fg-muted)" }}>
            {t("planosCardDesc")}
          </span>
        </span>
        <span aria-hidden className="text-lg" style={{ color: "var(--color-accent)" }}>
          →
        </span>
      </Link>

      <ToubeSessions
        sessions={sessions ?? []}
        activeId={sessionId}
        initial={initial}
        initialSummary={sess?.summary ?? null}
      />
    </>
  );
}
