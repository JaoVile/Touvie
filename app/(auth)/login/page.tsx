import { GlassCard } from "@/components/glass/GlassCard";
import { LoginForm } from "./LoginForm";

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { next, error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <GlassCard className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mb-2 text-4xl">✨</div>
          <h1 className="text-2xl font-bold gradient-text">Rotina</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-fg-muted)" }}>
            Seu sistema. Sua vida. Todo dia.
          </p>
        </div>
        <LoginForm next={next} initialError={error} />
      </GlassCard>
    </main>
  );
}
