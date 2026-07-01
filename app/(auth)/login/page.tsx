import { IntroVeil } from "@/components/IntroVeil";
import { TouvieEmblem } from "@/components/brand/TouvieEmblem";
import { TouvieWordmark } from "@/components/brand/TouvieWordmark";
import { GlassCard } from "@/components/glass/GlassCard";
import Link from "next/link";
import { LoginForm } from "./LoginForm";

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { next, error } = await searchParams;
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <IntroVeil />
      {/* Palco ambiente: halos dourados fracos atrás do card (ver globals). */}
      <div aria-hidden="true" className="login-halo" />
      <GlassCard className="relative w-full max-w-md p-8 pt-5">
        <div className="mb-7 text-center">
          <h1 className="sr-only">Touvie — entrar</h1>
          {/* alt="" — decorativo: o <h1> sr-only acima já anuncia a marca.
              O emblema VIVO (auréola balançando, notas dançando) + o wordmark
              emanando — as duas camadas da assinatura, animadas. O palco do
              emblema é quadrado (área de giro); os -mt descontam o respiro
              do palco pra composição ficar íntima sem o arco tocar o texto. */}
          <TouvieEmblem size={252} alt="" className="mx-auto -mt-4" />
          <TouvieWordmark height={46} alt="" className="mx-auto -mt-7" />
          <p
            className="mt-4 text-sm"
            style={{ color: "var(--color-fg-muted)", letterSpacing: "0.02em" }}
          >
            Seu sistema. Sua vida. Todo dia.
          </p>
        </div>
        <LoginForm next={next} initialError={error} />
        <p className="mt-5 text-center text-sm" style={{ color: "var(--color-fg-muted)" }}>
          Ainda não tem conta?{" "}
          <Link href="/signup" className="underline" style={{ color: "var(--color-fg)" }}>
            Criar conta
          </Link>
        </p>
      </GlassCard>
    </main>
  );
}
