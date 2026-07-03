import { IntroVeil } from "@/components/IntroVeil";
import { ScrollProgress } from "@/components/ScrollProgress";
import { SideLabel } from "@/components/SideLabel";
import { LandingHeader } from "@/components/landing/LandingHeader";
import type { ReactNode } from "react";

/**
 * Shell público (landing). Espelha o que o app autenticado tem de "ambiente"
 * — a barra de progresso de scroll e o SideLabel — sem Nav nem gate de auth.
 * (O cursor-fita mora no root layout: assinatura do site inteiro.)
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <IntroVeil />
      <ScrollProgress />
      <SideLabel label="TOUVIE" />
      <LandingHeader />
      {children}
    </>
  );
}
