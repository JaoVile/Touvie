import { CardHead } from "@/components/glass/CardHead";
import { FoldCard } from "@/components/glass/FoldCard";
import { ListChecks } from "lucide-react";
import { CardLink, EmptyState } from "./shared";

export type Task = {
  id: string;
  title: string;
  done: boolean;
  due_date: string | null;
};

export function TasksCard({ tasks }: { tasks: Task[] }) {
  return (
    <FoldCard variant="spine" index={3}>
      <CardHead icon={ListChecks} title="Próximas tarefas" />
      {tasks.length === 0 ? (
        <EmptyState href="/metas" label="Criar tarefa">
          Nenhuma tarefa pendente.
        </EmptyState>
      ) : (
        <ul className="space-y-2.5 text-sm">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span style={{ color: "var(--color-fg-subtle)" }}>○</span>
                <span className="truncate">{t.title}</span>
              </span>
              {t.due_date ? (
                <span
                  className="shrink-0 font-mono text-xs"
                  style={{ color: "var(--color-fg-subtle)" }}
                >
                  {t.due_date.slice(5)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <CardLink href="/metas">Gerenciar</CardLink>
    </FoldCard>
  );
}
