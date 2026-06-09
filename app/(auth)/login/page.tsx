import { TouvieLogo } from "@/components/brand/TouvieLogo";
import { GlassCard } from "@/components/glass/GlassCard";
import { LoginForm } from "./LoginForm";

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { next, error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <GlassCard className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <h1 className="sr-only">Touvie — entrar</h1>
          {/* alt="" — decorativo: o <h1> sr-only acima já anuncia a marca. */}
          <TouvieLogo size={150} animated priority alt="" className="mx-auto" />
          <p className="mt-2 text-sm" style={{ color: "var(--color-fg-muted)" }}>
            Seu sistema. Sua vida. Todo dia.
          </p>
        </div>
        <LoginForm next={next} initialError={error} />
      </GlassCard>
    </main>
  );
}
