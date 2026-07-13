import { PageGlyphs } from "@/components/PageGlyphs";
import { Reveal } from "@/components/Reveal";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { createClient } from "@/lib/supabase/server";
import { Dumbbell, Sparkles } from "lucide-react";
import Link from "next/link";
import { type Message, ToubeChat } from "./ToubeChat";

export const dynamic = "force-dynamic";

export default async function ToubePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const { data: rows } = await supabase
    .from("toube_messages")
    .select("id, role, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const initial = (rows ?? []) as Message[];

  return (
    <>
      <PageGlyphs variant="editorial" />

      <Reveal>
        <GradientHeader
          icon={Sparkles}
          eyebrow="Assistente · IA"
          title="Toube"
          subtitle="Converse, pense em voz alta, peça um empurrão."
        />
      </Reveal>

      <Link
        href="/toube/planos"
        className="mx-auto mb-4 flex w-fit items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium"
        style={{ borderColor: "var(--color-border)", color: "var(--color-accent)" }}
      >
        <Dumbbell className="size-4" />
        Montar um plano de treino
      </Link>

      <ToubeChat initial={initial} />
    </>
  );
}
