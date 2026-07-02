import { PageGlyphs } from "@/components/PageGlyphs";
import { Reveal } from "@/components/Reveal";
import { CardHead } from "@/components/glass/CardHead";
import { FoldCard } from "@/components/glass/FoldCard";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { TRUSTED_COOKIE, verifyTrustedDevice } from "@/lib/device";
import { createClient } from "@/lib/supabase/server";
import { Hourglass, Orbit } from "lucide-react";
import { cookies } from "next/headers";
import { CapsuleCard } from "./CapsuleCard";
import { SealForm } from "./SealForm";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "abre amanhã", "abre em 12 dias", "abre em ~4 meses" — pro card de viajando. */
function untilLabel(opens: Date, nowMs: number): string {
  const days = Math.ceil((opens.getTime() - nowMs) / 86_400_000);
  if (days <= 0) return "abre hoje";
  if (days === 1) return "abre amanhã";
  if (days < 60) return `abre em ${days} dias`;
  return `abre em ~${Math.round(days / 30)} meses`;
}

export default async function CapsulasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const cookieStore = await cookies();
  const trusted = await verifyTrustedDevice(cookieStore.get(TRUSTED_COOKIE)?.value, userId);

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // Duas queries de propósito: as SELADAS descem SEM content (nem cifrado o
  // conteúdo viaja antes da hora); só as que chegaram trazem a carta.
  const [{ data: keys }, { data: meta }, { data: arrivedContent }] = await Promise.all([
    supabase
      .from("diary_keys")
      .select("pin_wrap, recovery_wrap, code_wrap")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("time_capsules")
      .select("id, title, sealed_at, opens_at, opened_at")
      .eq("user_id", userId)
      .order("opens_at", { ascending: true }),
    supabase
      .from("time_capsules")
      .select("id, content")
      .eq("user_id", userId)
      .lte("opens_at", nowIso),
  ]);

  const zkOn = !!(keys?.pin_wrap && keys?.recovery_wrap && keys?.code_wrap);
  const all = meta ?? [];
  const contentById = new Map((arrivedContent ?? []).map((c) => [c.id, c.content]));

  const traveling = all.filter((c) => new Date(c.opens_at).getTime() > nowMs);
  const arrived = all
    .filter((c) => new Date(c.opens_at).getTime() <= nowMs)
    .map((c) => ({ ...c, content: contentById.get(c.id) ?? "" }))
    // Mais recém-chegadas primeiro; já abertas por último.
    .sort((a, b) => {
      if (!!a.opened_at !== !!b.opened_at) return a.opened_at ? 1 : -1;
      return new Date(b.opens_at).getTime() - new Date(a.opens_at).getTime();
    });

  return (
    <>
      <PageGlyphs variant="editorial" />
      <Reveal>
        <GradientHeader
          icon={Orbit}
          eyebrow="Cartas pro futuro"
          title="Cápsulas do tempo"
          subtitle="Escreva agora. Leia quando o universo devolver."
        />
      </Reveal>

      <div className="mx-auto w-full max-w-3xl space-y-4">
        {arrived.length > 0 ? (
          <div className="space-y-4">
            {arrived.map((c, i) => (
              <Reveal key={c.id} delay={i * 70}>
                <CapsuleCard
                  id={c.id}
                  title={c.title}
                  sealedAt={c.sealed_at}
                  opensAt={c.opens_at}
                  openedAt={c.opened_at}
                  content={c.content}
                />
              </Reveal>
            ))}
          </div>
        ) : null}

        <Reveal delay={arrived.length > 0 ? 140 : 0}>
          <FoldCard index={1}>
            <CardHead icon={Orbit} title="Jogar pro universo" />
            <p className="mb-4 text-sm" style={{ color: "var(--color-fg-muted)" }}>
              Escreva uma carta — uma intenção, uma promessa, um recado pra quem você vai ser — e
              sele por um tempo. Ninguém abre antes da data. Nem você.
            </p>
            <SealForm editable={trusted} zkOn={zkOn} />
          </FoldCard>
        </Reveal>

        {traveling.length > 0 ? (
          <Reveal delay={200}>
            <FoldCard index={2}>
              <CardHead icon={Hourglass} title="Viajando" />
              <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                {traveling.map((c) => {
                  const opens = new Date(c.opens_at);
                  return (
                    <li key={c.id} className="flex items-baseline justify-between gap-3 py-2.5">
                      <span className="min-w-0 truncate text-sm font-medium">
                        {c.title.trim() || "Sem título"}
                      </span>
                      <span className="shrink-0 text-xs" style={{ color: "var(--color-fg-muted)" }}>
                        {untilLabel(opens, nowMs)} · {dateFmt.format(opens)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </FoldCard>
          </Reveal>
        ) : null}
      </div>
    </>
  );
}
