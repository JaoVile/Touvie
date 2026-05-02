"use client";

import { useState, useTransition } from "react";
import { deleteGoal, saveGoal, setGoalStatus } from "./actions";

interface Goal {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: "active" | "done" | "paused" | "dropped";
  parent_goal_id: string | null;
}

export function GoalsPanel({ goals }: { goals: Goal[] }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const active = goals.filter((g) => g.status === "active");
  const done = goals.filter((g) => g.status === "done");

  return (
    <div className="space-y-3 text-sm">
      {adding ? (
        <GoalForm onDone={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full rounded-lg border border-dashed px-3 py-2 text-sm hover:opacity-80"
          style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
        >
          + Nova meta
        </button>
      )}

      <ul className="space-y-2">
        {active.length === 0 && !adding ? (
          <li className="text-xs italic" style={{ color: "var(--color-fg-subtle)" }}>
            Nenhuma meta ativa.
          </li>
        ) : null}
        {active.map((g) => (
          <GoalRow
            key={g.id}
            goal={g}
            isEditing={editing === g.id}
            onEdit={() => setEditing(g.id)}
            onCancelEdit={() => setEditing(null)}
          />
        ))}
      </ul>

      {done.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs" style={{ color: "var(--color-fg-subtle)" }}>
            ✓ {done.length} concluída{done.length > 1 ? "s" : ""}
          </summary>
          <ul className="mt-2 space-y-1">
            {done.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between text-xs line-through"
                style={{ color: "var(--color-fg-subtle)" }}
              >
                <span>{g.title}</span>
                <button
                  type="button"
                  onClick={() => setGoalStatus(g.id, "active")}
                  style={{ color: "var(--color-accent)" }}
                >
                  reativar
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function GoalRow({
  goal,
  isEditing,
  onEdit,
  onCancelEdit,
}: {
  goal: Goal;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
}) {
  const [pending, start] = useTransition();
  if (isEditing) {
    return (
      <li className="rounded-lg border p-3" style={{ borderColor: "var(--color-border)" }}>
        <GoalForm defaultValues={goal} onDone={onCancelEdit} />
        <button
          type="button"
          onClick={onCancelEdit}
          className="mt-2 text-xs"
          style={{ color: "var(--color-fg-muted)" }}
        >
          cancelar
        </button>
      </li>
    );
  }
  return (
    <li
      className="rounded-lg border p-3"
      style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{goal.title}</p>
          {goal.description ? (
            <p className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
              {goal.description}
            </p>
          ) : null}
          {goal.target_date ? (
            <p className="mt-1 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
              até {goal.target_date}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-1 text-xs">
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => setGoalStatus(goal.id, "done"))}
            style={{ color: "var(--color-success)" }}
          >
            ✓ feito
          </button>
          <button type="button" onClick={onEdit} style={{ color: "var(--color-accent)" }}>
            editar
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirm("Apagar meta?")) return;
              start(() => deleteGoal(goal.id));
            }}
            style={{ color: "var(--color-danger)" }}
          >
            apagar
          </button>
        </div>
      </div>
    </li>
  );
}

function GoalForm({ defaultValues, onDone }: { defaultValues?: Partial<Goal>; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string>();
  function submit(fd: FormData) {
    setErr(undefined);
    start(async () => {
      const res = await saveGoal(fd);
      if (res?.error) setErr(res.error);
      else onDone();
    });
  }
  return (
    <form action={submit} className="space-y-2">
      {defaultValues?.id ? <input type="hidden" name="id" value={defaultValues.id} /> : null}
      <input
        name="title"
        placeholder="Meta (ex: correr 5km sem parar)"
        required
        maxLength={200}
        defaultValue={defaultValues?.title ?? ""}
        className={inputCls}
        style={inputStyle}
      />
      <textarea
        name="description"
        placeholder="Descrição (opcional)"
        rows={2}
        defaultValue={defaultValues?.description ?? ""}
        className={inputCls}
        style={inputStyle}
      />
      <div className="flex items-center gap-2 text-xs">
        <span style={{ color: "var(--color-fg-muted)" }}>Até:</span>
        <input
          type="date"
          name="target_date"
          defaultValue={defaultValues?.target_date ?? ""}
          className={inputCls}
          style={inputStyle}
        />
      </div>
      {err ? <p style={{ color: "var(--color-danger)" }}>{err}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded px-3 py-1.5 font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--gradient-brand)" }}
      >
        {pending ? "..." : "Salvar"}
      </button>
    </form>
  );
}

const inputCls = "w-full rounded border px-3 py-1.5 text-sm outline-none";
const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};
