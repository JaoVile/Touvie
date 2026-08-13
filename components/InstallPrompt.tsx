"use client";

import {
  canInstall,
  isIOSSafari,
  isStandalone,
  promptInstall,
  startInstallCapture,
  subscribe,
} from "@/lib/pwa-install";
import { cn } from "@/lib/utils";
import { Download, Share, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Chave da dispensa. Dispensou uma vez, o BANNER não volta a incomodar — mas o
 * convite continua disponível em Config → Instalar o app. A dispensa é sobre
 * exibição, não sobre poder instalar.
 */
const DISMISS_KEY = "touvie:install-dismissed";

export function InstallPrompt() {
  const t = useTranslations("install");
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true); // pessimista até checar

  // Em Config o banner é ruído: a própria tela tem a seção "Instalar o app" no
  // fim do avançado. Convidar quem já está no lugar do convite é insistência.
  const inConfig = pathname?.startsWith("/config") ?? false;

  useEffect(() => {
    // Captura SEMPRE, mesmo dispensado: o evento vem uma vez só por
    // carregamento, e o botão do /config depende dele.
    startInstallCapture();
    if (isStandalone()) return;

    setDismissed(Boolean(localStorage.getItem(DISMISS_KEY)));
    if (isIOSSafari()) setIosHint(true);

    setReady(canInstall());
    return subscribe(() => setReady(canInstall()));
  }, []);

  if (inConfig) return null;
  if (dismissed) return null;
  if (!ready && !iosHint) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  async function install() {
    await promptInstall();
    dismiss();
  }

  return (
    <section
      className={cn(
        "fixed inset-x-3 z-40 rounded-2xl border border-white/10 bg-slate-900/95 p-4",
        "shadow-lg backdrop-blur supports-[backdrop-filter]:bg-slate-900/80",
        "bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-4 sm:max-w-sm",
      )}
      aria-label={t("title")}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 rounded-xl bg-white/10 p-2">
          {iosHint ? (
            <Share className="h-5 w-5 text-white" aria-hidden />
          ) : (
            <Download className="h-5 w-5 text-white" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm text-white">{t("title")}</p>
          <p className="mt-1 text-slate-300 text-xs leading-relaxed">
            {iosHint ? t("iosBody") : t("body")}
          </p>
          {!iosHint && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={install}
                className="rounded-lg bg-white px-3 py-1.5 font-medium text-slate-900 text-xs"
              >
                {t("install")}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg px-3 py-1.5 text-slate-300 text-xs hover:text-white"
              >
                {t("dismiss")}
              </button>
            </div>
          )}
        </div>
        {iosHint && (
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("dismiss")}
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    </section>
  );
}
