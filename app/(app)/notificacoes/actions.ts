"use server";

import { ALL_DEFAULTS } from "@/lib/notification-defaults";
import { createClient } from "@/lib/supabase/server";
import { deleteWebhook, getWebhookInfo, setWebhook } from "@/lib/telegram";
import { revalidatePath } from "next/cache";

// ─── Logs ─────────────────────────────────────────────────────────────────────

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("app_logs")
    .select("*")
    .gte("created_at", periodStart(period))
    .order("created_at", { ascending: false })
    .limit(500);

  return (data ?? []) as AppLog[];
}

// ─── Templates ────────────────────────────────────────────────────────────────

export type NotificationTemplate = {
  id: string;
  key: string;
  name: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function getTemplates(): Promise<NotificationTemplate[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("notification_templates")
    .select("*")
    .order("key");

  return (data ?? []) as NotificationTemplate[];
}

export async function updateTemplate(id: string, content: string, name: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  await supabase
    .from("notification_templates")
    .update({ content, name, updated_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/notificacoes");
}

export async function toggleTemplate(id: string, isActive: boolean): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  await supabase
    .from("notification_templates")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/notificacoes");
}

export async function seedTemplates(): Promise<{ created: number; skipped: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: existing } = await supabase
    .from("notification_templates")
    .select("key");

  const existingKeys = new Set((existing ?? []).map((r: { key: string }) => r.key));
  const toInsert = ALL_DEFAULTS.filter((t) => !existingKeys.has(t.key));

  if (toInsert.length > 0) {
    await supabase.from("notification_templates").insert(
      toInsert.map((t) => ({ key: t.key, name: t.name, content: t.content })),
    );
  }

  revalidatePath("/notificacoes");
  return { created: toInsert.length, skipped: existingKeys.size };
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

export type WebhookStatus = {
  url: string;
  pending_update_count: number;
  last_error_message?: string;
};

export async function getWebhookStatus(): Promise<WebhookStatus | null> {
  try {
    const info = await getWebhookInfo();
    return {
      url: info.url,
      pending_update_count: info.pending_update_count,
      last_error_message: info.last_error_message,
    };
  } catch {
    return null;
  }
}

export async function registerWebhook(): Promise<{ ok: boolean; url: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://touvie.vercel.app");
  const webhookUrl = `${appUrl}/api/telegram/webhook`;

  try {
    await setWebhook(webhookUrl);
    return { ok: true, url: webhookUrl };
  } catch (err) {
    return { ok: false, url: webhookUrl, error: String(err) };
  }
}

export async function unregisterWebhook(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  try {
    await deleteWebhook();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
