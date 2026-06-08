import { PageGlyphs } from "@/components/PageGlyphs";
import { Reveal } from "@/components/Reveal";
import { FoldCard } from "@/components/glass/FoldCard";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { weekStartISO } from "@/lib/datetime";
import { TRUSTED_COOKIE, verifyTrustedDevice } from "@/lib/device";
import { DIARY_COOKIE, verifyDiaryToken } from "@/lib/pin";
import { createClient } from "@/lib/supabase/server";
import { Lock, NotebookPen } from "lucide-react";
import { cookies } from "next/headers";
import { DiaryEditor } from "./DiaryEditor";
import { PinGate } from "./PinGate";
import { PinSetupForm } from "./PinSetupForm";
import { WeekList } from "./WeekList";

export const dynamic = "force-dynamic";

type SP = Promise<{ w?: string }>;

export default async function DiarioPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const weekStart = sp?.w && /^\d{4}-\d{2}-\d{2}$/.test(sp.w) ? sp.w : weekStartISO();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const cookieStore = await cookies();
  const trusted = await verifyTrustedDevice(cookieStore.get(TRUSTED_COOKIE)?.value, userId);

  const { data: profile } = await supabase
    .from("profiles")
    .select("pin_hash")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.pin_hash) {
    return (
      <>
        <PageGlyphs variant="editorial" />
        <Reveal>
          <GradientHeader
            icon={Lock}
            eyebrow="Privado · PIN"
            title="Diário"
            subtitle="Configure um PIN antes de começar a escrever."
          />
        </Reveal>
        <Reveal delay={120}>
          <FoldCard>
            {trusted ? (
              <PinSetupForm />
            ) : (
              <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
                Configure o PIN no <strong>notebook</strong> primeiro. O celular fica somente
                leitura.
              </p>
            )}
          </FoldCard>
        </Reveal>
      </>
    );
  }

  const unlocked = await verifyDiaryToken(cookieStore.get(DIARY_COOKIE)?.value, userId);

  if (!unlocked) {
    return (
      <>
        <PageGlyphs variant="editorial" />
        <Reveal>
          <GradientHeader
            icon={Lock}
            eyebrow="Privado · Bloqueado"
            title="Diário"
            subtitle="Digite o PIN para acessar."
          />
        </Reveal>
        <Reveal delay={120}>
          <PinGate />
        </Reveal>
      </>
    );
  }

  const { data: entries } = await supabase
    .from("journal_entries")
    .select("week_start, content, updated_at, mood_score, mood_emoji")
    .eq("user_id", userId)
    .order("week_start", { ascending: false });

  const all = entries ?? [];
  const current = all.find((e) => e.week_start === weekStart) ?? null;
  const past = all.filter((e) => e.week_start !== weekStart);

  return (
    <>
      <PageGlyphs variant="editorial" />
      <Reveal>
        <GradientHeader
          icon={NotebookPen}
          eyebrow="Privado · Semana"
          title="Diário"
          subtitle="Escreva como se já tivesse acontecido."
        />
      </Reveal>
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Reveal className="h-full">
          <DiaryEditor
            weekStart={weekStart}
            initialContent={current?.content ?? ""}
            initialSavedAt={current?.updated_at ?? null}
            initialMoodScore={current?.mood_score ?? null}
            initialMoodEmoji={current?.mood_emoji ?? null}
            editable={trusted}
          />
        </Reveal>
        <Reveal className="h-full" delay={80}>
          <WeekList currentWeekStart={weekStart} entries={past} />
        </Reveal>
      </div>
    </>
  );
}
