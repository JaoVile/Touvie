import { Col, Grid } from "@/components/grid/Grid";
import { Suspense } from "react";
import { Ticker } from "./_dashboard/Ticker";
import {
  FinanceSection,
  GoalsSection,
  HeroSection,
  RoutineSection,
  TasksSection,
} from "./_dashboard/sections";
import {
  FinanceSkeleton,
  GoalsSkeleton,
  HeroSkeleton,
  RoutineSkeleton,
  TasksSkeleton,
} from "./_dashboard/skeletons";

export const dynamic = "force-dynamic";

/**
 * Dashboard com streaming por seção: a casca (Ticker + grade) é estática e
 * aparece na hora; cada bloco entra num <Suspense> próprio, então os cards
 * rápidos (Metas/Tarefas) pintam sem esperar as consultas lentas (rotina +
 * 90 dias de completions). O Hero agrega hábitos/consistência/saldo, então
 * espera rotina + completions + transações — mas parte dos MESMOS agregados
 * cacheados das seções (ver `_dashboard/data.ts`), sem duplicar query nem cálculo.
 */
export default function DashboardPage() {
  return (
    <>
      <Suspense fallback={<HeroSkeleton />}>
        <HeroSection />
      </Suspense>
      <Ticker />
      <Grid>
        <Suspense
          fallback={
            <Col span={7} spanSm={6}>
              <RoutineSkeleton />
            </Col>
          }
        >
          <RoutineSection />
        </Suspense>
        <Suspense
          fallback={
            <Col span={5} spanSm={3}>
              <GoalsSkeleton />
            </Col>
          }
        >
          <GoalsSection />
        </Suspense>
        <Suspense
          fallback={
            <Col span={5} spanSm={3}>
              <TasksSkeleton />
            </Col>
          }
        >
          <TasksSection />
        </Suspense>
        <Suspense
          fallback={
            <Col span={7} spanSm={6}>
              <FinanceSkeleton />
            </Col>
          }
        >
          <FinanceSection />
        </Suspense>
      </Grid>
    </>
  );
}
