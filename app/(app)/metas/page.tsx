import { PageGlyphs } from "@/components/PageGlyphs";
import { Reveal } from "@/components/Reveal";
import { CardHead } from "@/components/glass/CardHead";
import { FoldCard } from "@/components/glass/FoldCard";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { Col, Grid } from "@/components/grid/Grid";
import { getUserClaims } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { ListChecks, Target } from "lucide-react";
import { GoalsPanel } from "./GoalsPanel";
import { TasksPanel } from "./TasksPanel";

export const dynamic = "force-dynamic";

export default async function MetasPage() {
  const supabase = await createClient();
  const userId = (await getUserClaims())!.sub;

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
      <PageGlyphs variant="goals" />

      <Reveal>
        <GradientHeader
          icon={Target}
          eyebrow="Foco · 2026"
          title="Metas & Tarefas"
          subtitle="O que você quer conquistar, e o que precisa fazer hoje pra chegar lá."
        />
      </Reveal>

      <Grid>
        <Col span={7} spanSm={6} reveal>
          <FoldCard>
            <CardHead icon={Target} title="Metas" />
            <GoalsPanel goals={goals} />
          </FoldCard>
        </Col>
        <Col span={5} spanSm={6} reveal delay={80}>
          <FoldCard>
            <CardHead icon={ListChecks} title="Tarefas" />
            <TasksPanel tasks={tasks} goals={goals} />
          </FoldCard>
        </Col>
      </Grid>
    </>
  );
}
