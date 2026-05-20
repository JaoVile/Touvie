import { CircleText } from "@/components/CircleText";
import { FoldCard } from "@/components/glass/FoldCard";

/**
 * Sandbox — circular text trials. Renders all three placement options in
 * realistic mini-contexts so the look can be judged side-by-side before
 * promoting any of them to the dashboard. Delete this route once we pick
 * (or don't).
 */
export default function CircleTextSandbox() {
  return (
    <div className="space-y-16 py-6">
      <header>
        <p
          className="eyebrow"
          style={{ color: "var(--color-accent)" }}
        >
          Sandbox · texto curvado
        </p>
        <h1 className="display mt-2 text-h1 sm:text-display">3 modos · escolha o(s) que ficar(em)</h1>
        <p className="mt-3 max-w-2xl" style={{ color: "var(--color-fg-muted)" }}>
          Cada bloco usa o mesmo componente <code>&lt;CircleText&gt;</code> em um contexto realista
          (hero, eyebrow de seção, arc sobre nome). Compare e me diz qual rola.
        </p>
      </header>

      {/* ── MODO 1 — Selo giratório no hero ──────────────────────── */}
      <section>
        <ModeLabel n={1} title="Selo giratório no hero">
          Pequeno círculo girando devagar, ao lado do "Boa tarde". Funciona como assinatura visual /
          marca rítmica. Texto completo numa volta.
        </ModeLabel>
        <FoldCard>
          <div className="flex items-center gap-6 p-2">
            <CircleText
              text="TOUVIE · DIÁRIO · ROTINA · METAS · FINANÇAS · "
              radius={56}
              spin
              spinDuration={20}
              fontSize={9.5}
              letterSpacing="0.32em"
              style={{ color: "var(--color-accent)" }}
            />
            <div>
              <p
                className="eyebrow"
                style={{ color: "var(--color-fg-subtle)" }}
              >
                Hero
              </p>
              <h2 className="display mt-1 text-display">Boa tarde, Jao Vile</h2>
              <p className="mt-2 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                Hoje · 19/05 · Seg
              </p>
            </div>
          </div>
        </FoldCard>
      </section>

      {/* ── MODO 2 — Eyebrow em arco das seções ──────────────────── */}
      <section>
        <ModeLabel n={2} title="Eyebrow em arco das seções">
          Substitui o label uppercase reto acima de cada card por um arco de 180°. Mais discreto,
          mas espalhado: aparece em todos os cards. Apliquei em dois pra você sentir o ritmo.
        </ModeLabel>
        <div className="grid gap-5 sm:grid-cols-2">
          <FoldCard>
            <div className="flex flex-col items-center pb-3 text-center">
              <CircleText
                text="ROTINA · STREAKS · HÁBITOS"
                radius={70}
                arc="top"
                fontSize={9}
                letterSpacing="0.36em"
                style={{ color: "var(--color-accent)" }}
              />
              <h2 className="display mt-2 text-h2">📅 Hoje</h2>
            </div>
            <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
              Marque os hábitos do dia · streak atual: 12 dias
            </p>
          </FoldCard>

          <FoldCard>
            <div className="flex flex-col items-center pb-3 text-center">
              <CircleText
                text="METAS · OBJETIVOS · TRILHAS"
                radius={70}
                arc="top"
                fontSize={9}
                letterSpacing="0.36em"
                style={{ color: "var(--color-accent)" }}
              />
              <h2 className="display mt-2 text-h2">🎯 Ativas</h2>
            </div>
            <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
              Você tem 3 metas em andamento.
            </p>
          </FoldCard>
        </div>
      </section>

      {/* ── MODO 3 — Arco sobre o nome do usuário ─────────────────── */}
      <section>
        <ModeLabel n={3} title="Arco sobre o nome do usuário">
          O "Boa tarde" vira um arco coroando o nome. Foca o nome — mais teatral, mais editorial.
          Funciona pra hero, não escala pro resto da UI.
        </ModeLabel>
        <FoldCard>
          <div className="flex flex-col items-center py-6 text-center">
            <CircleText
              text="· BOA TARDE ·"
              radius={150}
              arc="top"
              fontSize={13}
              letterSpacing="0.5em"
              style={{ color: "var(--color-accent)" }}
            />
            <h2 className="display -mt-2 text-display sm:text-hero">
              <span className="display-i gradient-text-anim">Jao Vile</span>
            </h2>
            <p className="mt-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
              Hoje · 19/05 · Seg
            </p>
          </div>
        </FoldCard>
      </section>

      {/* ── Helpers de tuning ─────────────────────────────────────── */}
      <section>
        <ModeLabel n={4} title="Variantes pra tuning (sem contexto)">
          Pra você ver o componente isolado e me dar ajustes de raio, fonte, spacing.
        </ModeLabel>
        <div className="grid gap-6 sm:grid-cols-3">
          <Tile label="full · radius 50 · spin 14s">
            <CircleText
              text="· EM ALGUM LUGAR · NO TOUVIE · "
              radius={50}
              spin
              spinDuration={14}
              fontSize={8.5}
              letterSpacing="0.3em"
              style={{ color: "var(--color-accent)" }}
            />
          </Tile>
          <Tile label="top · radius 80 · 12px · 0.4em">
            <CircleText
              text="FAÇA UMA META · COMECE HOJE"
              radius={80}
              arc="top"
              fontSize={12}
              letterSpacing="0.4em"
              style={{ color: "var(--color-accent)" }}
            />
          </Tile>
          <Tile label="full · radius 90 · 14px · spin 28s">
            <CircleText
              text="✦ TOUVIE EST. 2026 · "
              radius={90}
              spin
              spinDuration={28}
              fontSize={14}
              letterSpacing="0.32em"
              style={{ color: "var(--color-accent)" }}
            />
          </Tile>
        </div>
      </section>
    </div>
  );
}

function ModeLabel({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <p className="eyebrow" style={{ color: "var(--color-fg-subtle)" }}>
        Modo {n}
      </p>
      <h3 className="display mt-1 text-h2">{title}</h3>
      <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--color-fg-muted)" }}>
        {children}
      </p>
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-xl border p-4"
      style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
    >
      <div className="flex h-44 items-center justify-center">{children}</div>
      <code className="text-[10px]" style={{ color: "var(--color-fg-subtle)" }}>
        {label}
      </code>
    </div>
  );
}
