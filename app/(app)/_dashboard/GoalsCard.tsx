import { CircleText } from "@/components/CircleText";
import { CardHead } from "@/components/glass/CardHead";
import { FoldCard } from "@/components/glass/FoldCard";
import { Target } from "lucide-react";
import { CardLink, EmptyState } from "./shared";

export type Goal = { id: string; title: string };

export function GoalsCard({ goals }: { goals: Goal[] }) {
  return (
    <FoldCard variant="bookmark" index={2}>
      <CardHead icon={Target} title="Metas ativas" />
      {goals.length === 0 ? (
        <div className="flex flex-col items-center pb-1 pt-2 text-center">
          <CircleText
            text="FAÇA UMA META · COMECE HOJE"
            radius={80}
            arc="top"
            fontSize={11}
            letterSpacing="0.4em"
            style={{ color: "var(--color-accent)" }}
          />
          <div className="-mt-2">
            <EmptyState href="/metas" label="Criar meta">
              Nenhuma meta ativa.
            </EmptyState>
          </div>
        </div>
      ) : (
        <ul className="space-y-2.5 text-sm">
          {goals.slice(0, 5).map((g) => (
            <li key={g.id} className="flex items-center gap-2">
              <span style={{ color: "var(--color-accent)" }}>→</span>
              <span className="truncate">{g.title}</span>
            </li>
          ))}
        </ul>
      )}
      <CardLink href="/metas">Ver todas</CardLink>
    </FoldCard>
  );
}
