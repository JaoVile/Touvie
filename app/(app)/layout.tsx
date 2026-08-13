import { FloatingToube } from "@/components/FloatingToube";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Nav } from "@/components/Nav";
import { ScrollProgress } from "@/components/ScrollProgress";
import { SideLabel } from "@/components/SideLabel";
import { SoundscapeLayer } from "@/components/SoundscapeLayer";
import { FocusQuest } from "@/components/focus-quest/FocusQuest";
import { startOfTodayBRTUTC } from "@/lib/datetime";
import { getUserClaims } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  // getClaims (JWT verificado localmente, cacheado) em vez de getUser (RT de rede):
  // o middleware já revalidou a sessão neste request, então aqui é só o guard.
  const claims = await getUserClaims();
  if (!claims) redirect("/login");
  const userId = claims.sub;

  // Preferências do perfil numa query só (o layout roda em toda navegação
  // logada — não vale gastar dois round-trips). Se a coluna não existir
  // (migração pendente), cada feature cai no seu padrão em vez de quebrar.
  const prefs = await Promise.resolve(
    supabase
      .from("profiles")
      .select("focus_quest_enabled, nav_primary")
      .eq("id", userId)
      .maybeSingle(),
  )
    .then((r) => r.data)
    .catch(() => null);
  const focusEnabled = prefs?.focus_quest_enabled ?? false;
  const navPrimary = prefs?.nav_primary ?? null;

  let todayQuest = null;
  if (focusEnabled) {
    todayQuest = await Promise.resolve(
      supabase
        .from("focus_quests")
        .select("id, text, prompt, started_at, completed_at")
        .eq("user_id", userId)
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
      <Nav primary={navPrimary} />
      <main
        className="mx-auto w-full max-w-7xl flex-1 px-4 pt-12 sm:px-6"
        style={{ paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      >
        {children}
      </main>
      <FloatingToube />
      <InstallPrompt />
    </div>
  );
}
