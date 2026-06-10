import { CursorTrail } from "@/components/CursorTrail";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { ScrollProgress } from "@/components/ScrollProgress";
import { SideLabel } from "@/components/SideLabel";
import type { ReactNode } from "react";

/**
 * Shell público (landing). Espelha o que o app autenticado tem de "ambiente"
 * — o cursor-fita que toca dó-ré-mi e a barra de progresso de scroll — mas
 * sem Nav nem gate de auth. É o que faltava pro cursor-assinatura aparecer
 * fora do app (antes ele só montava em (app)/layout).
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CursorTrail />
      <ScrollProgress />
      <SideLabel label="TOUVIE" />
      <LandingHeader />
      {children}
    </>
  );
}
