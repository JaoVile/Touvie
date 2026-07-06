import { Nav } from "@/components/Nav";
import { ScrollProgress } from "@/components/ScrollProgress";
import { SideLabel } from "@/components/SideLabel";
import { SoundscapeLayer } from "@/components/SoundscapeLayer";
import { FocusQuest } from "@/components/focus-quest/FocusQuest";
import { startOfTodayBRTUTC } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Foco do dia (opt-in). Query isolada: se a coluna/tabela não existir
  // (migração 0025 pendente), a feature simplesmente não aparece.
  const focusEnabled = await Promise.resolve(
    supabase.from("profiles").select("focus_quest_enabled").eq("id", user.id).maybeSingle(),
  )
    .then((r) => r.data?.focus_quest_enabled ?? false)
    .catch(() => false);

  let todayQuest = null;
  if (focusEnabled) {
    todayQuest = await Promise.resolve(
      supabase
        .from("focus_quests")
        .select("id, text, prompt, started_at, completed_at")
        .eq("user_id", user.id)
        .gte("started_at", startOfTodayBRTUTC())
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    )
      .then((r) => r.data ?? null)
      .catch(() => null);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SoundscapeLayer />
      {focusEnabled && <FocusQuest initial={todayQuest} />}
      <ScrollProgress />
      <SideLabel />
      <Nav />
      <main
        className="mx-auto w-full max-w-7xl flex-1 px-4 pt-12 sm:px-6"
        style={{ paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      >
        {children}
      </main>
    </div>
  );
}
