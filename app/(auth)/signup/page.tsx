import { TouvieEmblem } from "@/components/brand/TouvieEmblem";
import { TouvieWordmark } from "@/components/brand/TouvieWordmark";
import { GlassCard } from "@/components/glass/GlassCard";
import Link from "next/link";
import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {/* Palco ambiente: halos dourados fracos atrás do card (ver globals). */}
      <div aria-hidden="true" className="login-halo" />
      <GlassCard className="relative w-full max-w-md p-8 pt-5">
        <div className="mb-7 text-center">
          <h1 className="sr-only">Touvie — criar conta</h1>
          <TouvieEmblem size={200} alt="" className="mx-auto -mt-2" />
          <TouvieWordmark height={40} alt="" className="mx-auto -mt-5" />
          <p
            className="mt-4 text-sm"
            style={{ color: "var(--color-fg-muted)", letterSpacing: "0.02em" }}
          >
            Crie sua conta. Seu sistema, sua vida.
          </p>
        </div>
        <SignupForm />
        <p className="mt-5 text-center text-sm" style={{ color: "var(--color-fg-muted)" }}>
          Já tem conta?{" "}
          <Link href="/login" className="underline" style={{ color: "var(--color-fg)" }}>
            Entrar
          </Link>
        </p>
      </GlassCard>
    </main>
  );
}
