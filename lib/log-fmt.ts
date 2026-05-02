export const EVENT_COLORS: Record<string, string> = {
  cron: "#8b5cf6",
  webhook: "#06b6d4",
  api: "#10b981",
  system: "#f59e0b",
};

export const EVENT_LABELS: Record<string, string> = {
  cron: "Cron",
  webhook: "Webhook",
  api: "API",
  system: "Sistema",
};

export const STATUS_COLORS: Record<string, string> = {
  success: "#10b981",
  error: "#ef4444",
  warning: "#f59e0b",
};

export function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function fmtSource(source: string): string {
  return source.split("/").pop() ?? source;
}
