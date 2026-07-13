"use client";

// Wrapper fino: o miolo do chat vive em ToubeConversation (compartilhado com o
// painel flutuante — components/FloatingToube.tsx). Mantém o import da página.
import { type Message, ToubeConversation } from "./ToubeConversation";

export type { Message };

export function ToubeChat({ initial }: { initial: Message[] }) {
  return <ToubeConversation initial={initial} variant="page" />;
}
