"use client";

import { cn } from "@/lib/utils";
import { Download, Share, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

/** Chave da dispensa. Dispensou uma vez, não volta a incomodar. */
const DISMISS_KEY = "touvie:install-dismissed";

/**
 * O evento que o Chrome dispara quando o app é instalável. Não está no lib.dom
 * do TS (é proposta, não padrão), então o tipo mora aqui.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Já está rodando instalado? Aí não há o que convidar. */
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari no iOS não implementa display-mode; expõe esta flag não-padrão.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * iOS é heurística de user-agent, e é assim porque a Apple não oferece
 * alternativa: o Safari NÃO dispara `beforeinstallprompt` nem expõe qualquer
 * API de instalação. Sem detectar o sistema, o usuário de iPhone simplesmente
 * nunca descobre que dá pra instalar.
 * Frágil por natureza — se a Apple mexer na string do UA, isto para de casar e
 * o banner some no iOS (falha silenciosa, não quebra nada).
 */
function isIOSSafari(): boolean {
  const ua = window.navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ se apresenta como Macintosh; o toque é o que separa.
    (ua.includes("Macintosh") && "ontouchend" in document);
  if (!iOS) return false;
  // Chrome/Firefox no iOS (crios/fxios) usam o mesmo motor mas não têm o
  // fluxo de "Adicionar à Tela de Início" — só o Safari tem.
  return !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

export function InstallPrompt() {
  const t = useTranslations("install");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    if (isIOSSafari()) {
      setIosHint(true);
      return;
    }

    const onPrompt = (e: Event) => {
      // Sem o preventDefault o Chrome mostra o próprio mini-infobar e o nosso
      // banner vira redundante.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    // Instalou por fora do banner (menu do browser): some com o convite.
    const onInstalled = () => setDeferred(null);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!deferred && !iosHint) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDeferred(null);
    setIosHint(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    // Aceitando ou recusando, o evento é de uso único — o Chrome só manda outro
    // numa visita futura. Guardar a dispensa evita reoferecer na mesma sessão.
    await deferred.userChoice.catch(() => null);
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
