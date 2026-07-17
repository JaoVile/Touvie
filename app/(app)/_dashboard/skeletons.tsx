import { FoldCard } from "@/components/glass/FoldCard";

/**
 * Fallbacks de <Suspense> do dashboard. Reusam o chrome real (FoldCard glass +
 * index/variant e o cabeçalho de header) pra que a casca não sofra layout shift
 * quando a seção streama — só o miolo troca de placeholder pulsante pro conteúdo.
 * Mesma linguagem visual de `app/(app)/loading.tsx`.
 */

function Bar({ w, h = "0.75rem" }: { w: string; h?: string }) {
  return (
    <span
      className="block rounded"
      style={{ width: w, height: h, background: "var(--color-border)" }}
    />
  );
}

function HeadRow() {
  return (
    <div className="card-head mb-4 flex items-center gap-2.5">
      <span
        className="h-8 w-8 shrink-0 rounded-[0.6rem]"
        style={{ background: "var(--color-card)" }}
      />
      <Bar w="8rem" h="0.7rem" />
    </div>
  );
}

function ListRows({ count }: { count: number }) {
  const widths = ["78%", "64%", "72%", "58%", "68%", "50%"];
  return (
    <ul className="space-y-2.5">
      {widths.slice(0, count).map((w) => (
        <li key={w} className="flex items-center justify-between gap-3">
          <Bar w={w} />
          <Bar w="2.5rem" h="0.7rem" />
        </li>
      ))}
    </ul>
  );
}

export function RoutineSkeleton() {
  return (
    <FoldCard index={1}>
      <div className="animate-pulse">
        <HeadRow />
        <ListRows count={6} />
        <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--color-border)" }}>
          <div className="mb-1.5 flex items-center justify-between">
            <Bar w="9rem" h="0.7rem" />
            <Bar w="2rem" h="0.7rem" />
          </div>
          <div
            className="h-2 w-full rounded-full"
            style={{ background: "var(--color-border)", opacity: 0.6 }}
          />
        </div>
        <div className="mt-auto flex justify-end pt-4">
          <Bar w="7rem" h="0.7rem" />
        </div>
      </div>
    </FoldCard>
  );
}

export function GoalsSkeleton() {
  return (
    <FoldCard variant="bookmark" index={2}>
      <div className="animate-pulse">
        <HeadRow />
        <ListRows count={4} />
        <div className="mt-auto flex justify-end pt-4">
          <Bar w="5rem" h="0.7rem" />
        </div>
      </div>
    </FoldCard>
  );
}

export function TasksSkeleton() {
  return (
    <FoldCard variant="spine" index={3}>
      <div className="animate-pulse">
        <HeadRow />
        <ListRows count={5} />
        <div className="mt-auto flex justify-end pt-4">
          <Bar w="5rem" h="0.7rem" />
        </div>
      </div>
    </FoldCard>
  );
}

export function FinanceSkeleton() {
  return (
    <FoldCard index={4}>
      <div className="animate-pulse">
        <HeadRow />
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Bar w="4rem" />
            <Bar w="5rem" />
          </div>
          <div className="flex items-center justify-between">
            <Bar w="4rem" />
            <Bar w="5rem" />
          </div>
          <div
            className="flex items-center justify-between border-t pt-2"
            style={{ borderColor: "var(--color-border)" }}
          >
            <Bar w="3rem" />
            <Bar w="5rem" />
          </div>
        </div>
        <div className="mt-auto flex justify-end pt-4">
          <Bar w="6rem" h="0.7rem" />
        </div>
      </div>
    </FoldCard>
  );
}

/**
 * Fallback do Hero — mesmo esqueleto de cabeçalho de `loading.tsx` (eyebrow ·
 * título · subtítulo) coroando a régua de 3 stats em glass, na mesma altura.
 */
export function HeroSkeleton() {
  return (
    <header className="relative mb-16 flex animate-pulse flex-col items-center pb-10 pt-16 text-center">
      <div
        className="h-[3.25rem] w-64 max-w-[70%] rounded-lg sm:h-[4.75rem]"
        style={{ background: "var(--color-card)" }}
      />
      <div className="mt-6 flex items-center gap-3">
        <span className="h-px w-10" style={{ background: "var(--color-border)" }} />
        <div className="h-4 w-52 rounded" style={{ background: "var(--color-border)" }} />
        <span className="h-px w-10" style={{ background: "var(--color-border)" }} />
      </div>
      <dl className="glass mt-10 flex w-full overflow-hidden">
        {["a", "b", "c"].map((k, i) => (
          <div
            key={k}
            className="flex-1 space-y-2 px-4 py-3.5 sm:px-6"
            style={i > 0 ? { borderLeft: "1px solid var(--color-border)" } : undefined}
          >
            <div className="h-2.5 w-20 rounded" style={{ background: "var(--color-border)" }} />
            <div className="h-5 w-16 rounded" style={{ background: "var(--color-card)" }} />
          </div>
        ))}
      </dl>
    </header>
  );
}
