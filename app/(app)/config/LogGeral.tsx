import { EVENT_COLORS, EVENT_LABELS, STATUS_COLORS, fmtRelative, fmtSource } from "@/lib/log-fmt";
import { createClient } from "@/lib/supabase/server";
import type { AppLog } from "../notificacoes/actions";

export async function LogGeral() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("app_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const logs = (data ?? []) as AppLog[];

  if (logs.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
        Nenhum evento registrado ainda.
      </p>
    );
  }

  return (
    <div className="max-h-96 space-y-1.5 overflow-y-auto">
      {logs.map((log) => (
        <div
          key={log.id}
          className="flex items-start gap-2 rounded-lg p-2 text-sm"
          style={{ background: "var(--color-surface)" }}
        >
          <span
            className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
            style={{ background: EVENT_COLORS[log.event_type] ?? "#666" }}
          >
            {EVENT_LABELS[log.event_type] ?? log.event_type}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{fmtSource(log.source)}</span>
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px]"
                style={{
                  background: `${STATUS_COLORS[log.status]}33`,
                  color: STATUS_COLORS[log.status],
                }}
              >
                {log.status}
              </span>
            </div>
            {log.message_preview && (
              <p className="mt-0.5 truncate text-xs opacity-60">{log.message_preview}</p>
            )}
          </div>
          <span className="shrink-0 text-[10px] opacity-40">{fmtRelative(log.created_at)}</span>
        </div>
      ))}
    </div>
  );
}
