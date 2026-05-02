import { createAdminClient } from "./supabase/admin";

export type LogEventType = "cron" | "webhook" | "api" | "system";
export type LogStatus = "success" | "error" | "warning";

export interface LogEventOpts {
  userId?: string | null;
  eventType: LogEventType;
  source: string;
  status: LogStatus;
  messagePreview?: string;
  metadata?: Record<string, unknown>;
}

// Fire-and-forget — never awaited so it never blocks a response.
export function logEvent(opts: LogEventOpts): void {
  const admin = createAdminClient();
  const preview = opts.messagePreview
    ?.replace(/<[^>]+>/g, "") // strip HTML tags
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);

  void (async () => {
    try {
      await admin.from("app_logs").insert({
        user_id: opts.userId ?? null,
        event_type: opts.eventType,
        source: opts.source,
        status: opts.status,
        message_preview: preview ?? null,
        metadata: opts.metadata ?? null,
      });
    } catch (e) {
      console.error("[logEvent]", e);
    }
  })();
}
