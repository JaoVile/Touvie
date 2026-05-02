import { GlassCard } from "@/components/glass/GlassCard";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { createClient } from "@/lib/supabase/server";
import { GoalsPanel } from "./GoalsPanel";
import { TasksPanel } from "./TasksPanel";

export const dynamic = "force-dynamic";

export default async function MetasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user!.id;

  const [goalsRes, tasksRes] = await Promise.all([
    supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .order("status", { ascending: true })
      .order("sort_order"),
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("done", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false }),
  ]);

  const goals = goalsRes.data ?? [];
  const tasks = tasksRes.data ?? [];

  return (
    <>
      <GradientHeader
        emoji="🎯"
        title="Metas & Tarefas"
        subtitle="O que você quer conquistar, e o que precisa fazer hoje pra chegar lá."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <h2 className="mb-3 font-semibold">🎯 Metas</h2>
          <GoalsPanel goals={goals} />
        </GlassCard>
        <GlassCard>
          <h2 className="mb-3 font-semibold">✅ Tarefas</h2>
          <TasksPanel tasks={tasks} goals={goals} />
        </GlassCard>
      </div>
    </>
  );
}
