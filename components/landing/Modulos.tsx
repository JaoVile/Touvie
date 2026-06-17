import { CardHead } from "@/components/glass/CardHead";
import { FoldCard } from "@/components/glass/FoldCard";
import { Col, Grid } from "@/components/grid/Grid";
import {
  CalendarCheck2,
  Dumbbell,
  type LucideIcon,
  NotebookPen,
  Salad,
  Sparkles,
  StickyNote,
  Target,
  Wallet,
} from "lucide-react";
import { SectionHeading } from "./SectionHeading";

const MODULES: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: CalendarCheck2, title: "Rotina", desc: "Hábitos diários e blocos da semana, marcados num toque." },
  { icon: Target, title: "Metas", desc: "Objetivos e tarefas com prazo — o que importa, à vista." },
  { icon: Wallet, title: "Finanças", desc: "Lançamentos, contas a pagar, caixinhas e gráficos." },
  { icon: Dumbbell, title: "Treino", desc: "Programas, séries, PRs e progressão de carga." },
  { icon: NotebookPen, title: "Diário", desc: "Escrita protegida por PIN — só sua, de verdade." },
  { icon: Salad, title: "Dieta", desc: "Refeições, macros e medidas acompanhadas no tempo." },
  { icon: StickyNote, title: "Notas", desc: "Ideias e listas fixáveis, sempre à mão." },
  { icon: Sparkles, title: "Vie", desc: "Seu agente de IA — pergunte qualquer coisa sobre o seu mundo." },
];

/**
 * Seção 3 — Os Módulos. A prova de "amplo": grid editorial de fold-cards
 * numerados, um por frente da vida. Reaproveita FoldCard + CardHead pra ler
 * exatamente como os cards do app.
 */
export function Modulos() {
  return (
    <section id="modulos" className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-28">
      <SectionHeading
        index="02"
        eyebrow="Os módulos"
        title={
          <>
            Tudo num <span className="display-i gradient-text">lugar só</span>.
          </>
        }
        lead="Oito frentes da sua vida, sob a mesma linguagem — sem trocar de app, sem perder o fio."
      />
      <Grid className="mt-12">
        {MODULES.map((m, i) => (
          <Col key={m.title} span={3} spanSm={3} reveal delay={i * 70}>
            <FoldCard index={i + 1} className="h-full">
              <CardHead icon={m.icon} title={m.title} />
              <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
                {m.desc}
              </p>
            </FoldCard>
          </Col>
        ))}
      </Grid>
    </section>
  );
}
