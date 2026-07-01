import { PageGlyphs } from "@/components/PageGlyphs";
import { Reveal } from "@/components/Reveal";
import { FoldCard } from "@/components/glass/FoldCard";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { weekStartISO } from "@/lib/datetime";
import { TRUSTED_COOKIE, verifyTrustedDevice } from "@/lib/device";
import { createClient } from "@/lib/supabase/server";
import { NotebookPen, ShieldCheck } from "lucide-react";
import { cookies } from "next/headers";
import { DiaryEditor } from "./DiaryEditor";
import { PrivateDiaryActivate } from "./PrivateDiaryActivate";
import { PrivateDiaryView } from "./PrivateDiaryView";
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

  const [{ data: keys }, { data: entries }] = await Promise.all([
    supabase
      .from("diary_keys")
      .select("pin_wrap, recovery_wrap, code_wrap")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("journal_entries")
      .select("week_start, content, updated_at, mood_score, mood_emoji")
      .eq("user_id", userId)
      .order("week_start", { ascending: false }),
  ]);

  const all = entries ?? [];
  const privateOn = !!(keys?.pin_wrap && keys?.recovery_wrap && keys?.code_wrap);

  // Modo privado (zero-knowledge): tudo cifrado; destrancar/decifrar no cliente.
  if (privateOn) {
    return (
      <>
        <PageGlyphs variant="editorial" />
        <Reveal>
          <GradientHeader
            icon={NotebookPen}
            eyebrow="Privado · Cifrado"
            title="Diário"
            subtitle="Só você tem a chave."
          />
        </Reveal>
        <Reveal delay={80}>
          <PrivateDiaryView
            weekStart={weekStart}
            editable={trusted}
            wraps={{
              // biome-ignore lint/style/noNonNullAssertion: privateOn garante os três não-nulos
              pin_wrap: keys!.pin_wrap!,
              // biome-ignore lint/style/noNonNullAssertion: idem
              recovery_wrap: keys!.recovery_wrap!,
              // biome-ignore lint/style/noNonNullAssertion: idem
              code_wrap: keys!.code_wrap!,
            }}
            entries={all}
          />
        </Reveal>
      </>
    );
  }

  // Diário aberto (texto puro) — PIN é OPCIONAL. Oferece ativar o modo privado.
  const current = all.find((e) => e.week_start === weekStart) ?? null;
  const past = all.filter((e) => e.week_start !== weekStart);

  return (
    <>
      <PageGlyphs variant="editorial" />
      <Reveal>
        <GradientHeader
          icon={NotebookPen}
          eyebrow="Semana"
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
      <Reveal className="mt-4 block" delay={160}>
        <FoldCard>
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck size={16} style={{ color: "var(--color-accent)" }} />
            <h2 className="text-sm font-semibold">Diário privado</h2>
          </div>
          <PrivateDiaryActivate
            editable={trusted}
            entries={all.map((e) => ({ week_start: e.week_start, content: e.content }))}
          />
        </FoldCard>
      </Reveal>
    </>
  );
}
