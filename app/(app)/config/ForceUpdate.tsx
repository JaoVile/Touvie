"use client";

import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * O Ctrl+Shift+R que o Android não tem.
 *
 * Apaga os caches do service worker, desregistra o SW e recarrega — força o
 * navegador a buscar tudo do zero. Existe porque, quando um SW se comporta mal,
 * o celular não oferece jeito de recarregar ignorando cache.
 *
 * Mexe SÓ em cache: não toca em cookie nem em localStorage, então a sessão e as
 * preferências sobrevivem. Dado do usuário nem entra na conta — mora no
 * Supabase, não no navegador.
 */
export function ForceUpdate() {
  const t = useTranslations("config.forceUpdate");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      // Falhou limpar? Recarrega assim mesmo — é o que a pessoa pediu, e a
      // recarga sozinha já resolve boa parte dos casos.
    } finally {
      window.location.reload();
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-medium text-sm disabled:opacity-60"
      style={{ borderColor: "var(--color-border)", color: "var(--color-fg)" }}
    >
      <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden />
      {busy ? t("running") : t("action")}
    </button>
  );
}
