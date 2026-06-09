import { AntesDepois } from "@/components/landing/AntesDepois";
import { CTA } from "@/components/landing/CTA";
import { Diferenciais } from "@/components/landing/Diferenciais";
import { Divider } from "@/components/landing/Divider";
import { FAQ } from "@/components/landing/FAQ";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { Manifesto } from "@/components/landing/Manifesto";
import { Modulos } from "@/components/landing/Modulos";
import { Numeros } from "@/components/landing/Numeros";
import { UmDia } from "@/components/landing/UmDia";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Touvie — seu life OS pessoal",
  description: "Rotina, finanças, treino, diário e mais — um sistema que te conhece.",
};

/**
 * Landing do Touvie (preview em /conceito). Narrativa completa em scroll:
 * hero → manifesto → antes/depois → módulos → um dia → diferenciais → números
 * → FAQ → CTA → footer, com filetes de ouro marcando a cadência entre capítulos.
 */
export default function ConceitoPage() {
  return (
    <main id="top">
      <Hero />
      <Manifesto />
      <AntesDepois />
      <Divider />
      <Modulos />
      <Divider />
      <UmDia />
      <Divider />
      <Diferenciais />
      <Divider />
      <Numeros />
      <Divider />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}
