"use client";

import {
  canInstall,
  isStandalone,
  promptInstall,
  startInstallCapture,
  subscribe,
} from "@/lib/pwa-install";
import { Check, Download, Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

/**
 * Instalar o app, permanentemente disponível.
 *
 * Diferente do banner, este NÃO respeita a dispensa: é o lugar pra quem disse
 * "agora não" e depois mudou de ideia. Também é a única saída pra navegadores
 * que não disparam `beforeinstallprompt` (Safari no iOS sempre; Samsung
 * Internet 27+ por decisão deles) — ali a instrução manual é tudo que existe.
 */
export function InstallApp() {
  const t = useTranslations("config.installApp");
  const [state, setState] = useState<"checking" | "installed" | "ready" | "manual">("checking");

  useEffect(() => {
    startInstallCapture();

    const sync = () => {
      if (isStandalone()) return setState("installed");
      if (canInstall()) return setState("ready");
      // Sem evento: ou é iOS (a Apple não expõe API nenhuma), ou é um browser
      // que não implementa `beforeinstallprompt`. Nos dois casos a instrução
      // manual é o único caminho — por isso não ramifica por sistema aqui.
      return setState("manual");
    };

    sync();
    return subscribe(sync);
  }, []);

  if (state === "checking") return null;

  if (state === "installed") {
    return (
      <p
        className="inline-flex items-center gap-2 text-sm"
        style={{ color: "var(--color-fg-muted)" }}
      >
        <Check className="h-4 w-4" aria-hidden />
        {t("installed")}
      </p>
    );
  }

  if (state === "manual") {
    return (
      <p
        className="inline-flex items-start gap-2 text-sm"
        style={{ color: "var(--color-fg-muted)" }}
      >
        <Share className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{t("manual")}</span>
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => promptInstall()}
      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-medium text-sm"
      style={{ borderColor: "var(--color-border)", color: "var(--color-fg)" }}
    >
      <Download className="h-4 w-4" aria-hidden />
      {t("action")}
    </button>
  );
}
