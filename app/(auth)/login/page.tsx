import { CircleText } from "@/components/CircleText";
import { GlassCard } from "@/components/glass/GlassCard";
import { LoginForm } from "./LoginForm";

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { next, error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <GlassCard className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          {/* Spinning seal — Pinyon "T" monogram (the Touvie wordmark
             distilled) sits centred inside the slow rotation. */}
          <div className="relative mx-auto mb-2 inline-flex">
            <CircleText
              text="· EM ALGUM LUGAR · NO TOUVIE · "
              radius={50}
              spin
              spinDuration={14}
              fontSize={8.5}
              letterSpacing="0.3em"
              style={{ color: "var(--color-accent)" }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex select-none items-center justify-center leading-none gradient-text-anim"
              style={{
                fontFamily: "var(--font-pinyon), cursive",
                fontSize: "3.75rem",
                // Pinyon's "T" leans right and has a big bottom-left
                // swash; bounding-box centering puts the visual mass
                // right of centre. Nudge LEFT to compensate and DOWN so
                // the crossbar lines up with the seal centre.
                transform: "rotate(-6deg) translate(-1.1rem, 0.5rem)",
                filter:
                  "drop-shadow(0 1px 0 rgba(0,0,0,0.22)) drop-shadow(0 0 14px var(--color-accent))",
              }}
            >
              T
            </span>
          </div>
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
