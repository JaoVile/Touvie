"use server";

import { createClient } from "@/lib/supabase/server";

export type AppLog = {
  id: string;
  user_id: string | null;
  created_at: string;
  event_type: "cron" | "webhook" | "api" | "system";
  source: string;
  status: "success" | "error" | "warning";
  message_preview: string | null;
  metadata: Record<string, unknown> | null;
};

export type LogPeriod = "hoje" | "semana" | "mes";

function periodStart(period: LogPeriod): string {
  const now = new Date();
  if (period === "hoje") {
    // Midnight BRT = 03:00 UTC
    const base = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 3, 0, 0),
    );
    if (now.getUTCHours() < 3) base.setUTCDate(base.getUTCDate() - 1);
    return base.toISOString();
  }
  const d = new Date(now);
  d.setDate(d.getDate() - (period === "semana" ? 7 : 30));
  return d.toISOString();
}

export async function getLogs(period: LogPeriod): Promise<AppLog[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("app_logs")
    .select("*")
    .gte("created_at", periodStart(period))
    .order("created_at", { ascending: false })
    .limit(500);

  return (data ?? []) as AppLog[];
}
