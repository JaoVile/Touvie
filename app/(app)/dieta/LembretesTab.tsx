import { ReminderComposer, type ReminderSuggestion } from "@/components/reminders/ReminderComposer";

// Moldes de contexto da Dieta — clicar preenche a mensagem do lembrete.
const DIET_SUGGESTIONS: ReminderSuggestion[] = [
  { emoji: "💧", message: "Hora de beber 400ml de água" },
  { emoji: "🍽️", message: "Registrar sua refeição de agora" },
  { emoji: "🥗", message: "Bater a meta de proteína do dia" },
  { emoji: "⚖️", message: "Anotar seu peso de hoje" },
];

export function LembretesTab() {
  return <ReminderComposer area="dieta" suggestions={DIET_SUGGESTIONS} />;
}
