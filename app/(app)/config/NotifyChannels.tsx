"use client";

import { isIOSSafari, isStandalone } from "@/lib/pwa-install";
import { cn } from "@/lib/utils";
import { AlertTriangle, Bell, Loader2, Smartphone, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  removePushSubscription,
  savePushSubscription,
  sendTestNotification,
  updateNotifyChannels,
} from "./actions";

type Estado = "assinado" | "pode-assinar" | "negado" | "ios-instalar" | "sem-suporte";

/**
 * `serviceWorker.ready` nunca rejeita nem expira sozinho — se o registro
 * falhou (aba privada, SW desregistrado, erro engolido em
 * `ServiceWorkerRegister`), a Promise fica pendurada pra sempre e o spinner
 * nunca sai da tela. Esse teto dá uma saída.
 */
const READY_TIMEOUT_MS = 5_000;

/**
 * Guarda única do timeout acima — usada tanto na montagem quanto em
 * `unsubscribeThisDevice`, pra não dar pra um dos dois lugares esquecer o
 * teto e voltar a pendurar sem saída (foi exatamente isso que aconteceu:
 * `unsubscribeThisDevice` chamava `serviceWorker.ready` direto, sem essa
 * guarda, e travava "Remover"/"Enviar teste" pra sempre nas mesmas condições
 * do Finding 4).
 */
async function readyOrNull(): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), READY_TIMEOUT_MS)),
  ]);
}

type Device = {
  id: string;
  endpoint: string;
  user_agent: string | null;
  created_at: string;
};

interface Props {
  devices: Device[];
  initialPush: boolean;
  initialTelegram: boolean;
}

/**
 * Decide o estado da tela — a ordem importa. "iOS sem instalar" vem ANTES de
 * "sem suporte": o Safari não expõe `PushManager` fora do app instalado, então
 * cairia em "sem suporte" e a pessoa nunca saberia que bastava instalar.
 */
function decidirEstado(jaAssinado: boolean): Estado {
  if (typeof window === "undefined") return "sem-suporte";
  if (isIOSSafari() && !isStandalone()) return "ios-instalar";
  if (!("Notification" in window) || !("PushManager" in window)) return "sem-suporte";
  if (Notification.permission === "denied") return "negado";
  return jaAssinado ? "assinado" : "pode-assinar";
}

/** Rótulo curto pro user-agent bruto — só o essencial pra reconhecer o aparelho. */
function shortUA(ua: string | null): string {
  if (!ua) return "—";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return ua.slice(0, 40);
}

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50"
      style={{ background: checked ? "var(--color-accent)" : "var(--color-border)" }}
    >
      <span
        className={cn(
          "inline-block h-4.5 w-4.5 transform rounded-full bg-white transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}

export function NotifyChannels({ devices, initialPush, initialTelegram }: Props) {
  const t = useTranslations("config.notifyChannels");
  const tInstall = useTranslations("config.installApp");

  const [estado, setEstado] = useState<Estado>("sem-suporte");
  const [checking, setChecking] = useState(true);
  const [myDeviceId, setMyDeviceId] = useState<string | null>(null);
  const [deviceList, setDeviceList] = useState(devices);

  const [pushOn, setPushOn] = useState(initialPush);
  const [telegramOn, setTelegramOn] = useState(initialTelegram);
  const [channelsBusy, setChannelsBusy] = useState(false);

  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string>();
  const [testInfo, setTestInfo] = useState<string>();
  const [testWarning, setTestWarning] = useState<string>();
  const [pending, start] = useTransition();

  // Evita reconciliar duas vezes em StrictMode/remounts.
  const reconciled = useRef(false);

  // Descobre se ESTE aparelho já tem inscrição ativa comparando o endpoint do
  // navegador com a lista vinda do servidor — não "qualquer aparelho da conta".
  // Se o navegador tiver uma inscrição que o servidor não conhece (janela do
  // delete-então-insert em savePushSubscription), re-registra em silêncio: sem
  // isso o aparelho fica mudo até alguém notar e mexer de novo.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só roda uma vez no mount — `devices` é a lista inicial vinda do server, reexecutar a cada mudança local reabriria a reconciliação à toa.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
        if (!cancelled) {
          setEstado(decidirEstado(false));
          setChecking(false);
        }
        return;
      }

      try {
        const reg = await readyOrNull();
        if (cancelled) return;
        if (!reg) {
          setEstado(decidirEstado(false));
          setChecking(false);
          return;
        }

        const sub = await reg.pushManager.getSubscription();
        if (cancelled) return;

        if (!sub) {
          setEstado(decidirEstado(false));
          setChecking(false);
          return;
        }

        const known = devices.find((d) => d.endpoint === sub.endpoint);
        if (known) {
          setMyDeviceId(known.id);
          setEstado(decidirEstado(true));
          setChecking(false);
          return;
        }

        // Reconciliação silenciosa: sem toast, sem spinner. Só marca
        // "assinado" se o servidor CONFIRMAR a escrita — se ela falhar, a
        // tela não pode afirmar que está ativado sem nenhuma saída.
        if (!reconciled.current) {
          reconciled.current = true;
          const json = sub.toJSON();
          if (json.keys?.p256dh && json.keys?.auth) {
            let res: { ok?: boolean; error?: string; id?: string };
            try {
              res = await savePushSubscription({
                endpoint: sub.endpoint,
                p256dh: json.keys.p256dh,
                auth: json.keys.auth,
                userAgent: navigator.userAgent,
              });
            } catch (e) {
              res = { error: e instanceof Error ? e.message : "Falha ao reconciliar" };
            }
            if (cancelled) return;
            if (res.ok && res.id) {
              setMyDeviceId(res.id);
              setDeviceList((cur) => [
                {
                  id: res.id as string,
                  endpoint: sub.endpoint,
                  user_agent: navigator.userAgent,
                  created_at: new Date().toISOString(),
                },
                ...cur,
              ]);
              setEstado("assinado");
            } else {
              setEstado("pode-assinar");
            }
            setChecking(false);
            return;
          }
        }

        // Sem chaves válidas pra reconciliar (ou a reconciliação já foi
        // tentada nesta montagem): sem confirmação do servidor, não afirma
        // "assinado" — a saída segura é o botão de ativar.
        if (cancelled) return;
        setEstado("pode-assinar");
        setChecking(false);
      } catch {
        if (!cancelled) {
          setEstado(decidirEstado(false));
          setChecking(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function subscribe() {
    setError(undefined);
    setSubscribing(true);
    try {
      // Diferente de `unsubscribeThisDevice`: no estouro daqui não dá pra
      // seguir (não existe "assinar sem service worker") — cai num erro
      // visível e volta pra "pode-assinar", com o botão ali pra tentar de
      // novo, em vez de deixar "Ativar no app" desabilitado pra sempre.
      const reg = await readyOrNull();
      if (!reg) {
        setError(t("enableFailed"));
        setEstado("pode-assinar");
        return;
      }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
      const json = sub.toJSON();
      if (!json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Assinatura sem chaves");
      }
      const res = await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent,
      });
      if (res.error || !res.id) {
        setError(res.error ?? "Não consegui confirmar no servidor");
      } else {
        setMyDeviceId(res.id);
        setDeviceList((cur) => [
          {
            id: res.id as string,
            endpoint: sub.endpoint,
            user_agent: navigator.userAgent,
            created_at: new Date().toISOString(),
          },
          ...cur,
        ]);
        setEstado("assinado");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não consegui ativar");
    } finally {
      setSubscribing(false);
    }
  }

  /**
   * Só chamado quando `id === myDeviceId`. Sem isso, a próxima montagem
   * acha o endpoint deste navegador fora da lista do servidor — a MESMA
   * condição que a reconciliação silenciosa existe pra curar — e re-registra
   * o aparelho removido sozinho.
   *
   * Usa `readyOrNull()` (com teto de 5s) em vez de `serviceWorker.ready`
   * direto: nas mesmas condições em que o registro nunca fica pronto (SW
   * desregistrado, registro que falhou em silêncio), `remove()` PRECISA
   * seguir pro delete do servidor mesmo assim — travar "Remover" e "Enviar
   * teste" pra sempre (o `pending` do `useTransition` que os desabilita)
   * seria o mesmo botão morto do Finding 4, só que reintroduzido aqui. O
   * pior caso vira uma inscrição órfã no navegador, que a reconciliação da
   * próxima montagem resolve.
   */
  async function unsubscribeThisDevice() {
    try {
      const reg = await readyOrNull();
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    } catch {
      // Segue mesmo se falhar no navegador — a linha no servidor ainda é
      // removida abaixo, que é o que garante não receber push nenhum.
    }
  }

  /**
   * O try/catch aqui não é zelo: se a Server Action LANÇA (celular sem sinal,
   * 403 do middleware), a rejeição sobe pelo `startTransition` em vez de o
   * callback terminar, e o `pending` que desabilita "Remover" e "Enviar teste"
   * fica preso — os dois botões morrem sem mensagem nenhuma. Engolir o erro é
   * o que faz a transição fechar; por isso não existe `finally` separado, o
   * "ocupado" some justamente ao voltarmos daqui normalmente.
   */
  function remove(id: string) {
    start(async () => {
      try {
        if (id === myDeviceId) {
          await unsubscribeThisDevice();
        }
        const res = await removePushSubscription(id);
        if (res.error) {
          setError(res.error);
          return;
        }
        setDeviceList((cur) => cur.filter((d) => d.id !== id));
        if (id === myDeviceId) {
          setMyDeviceId(null);
          setEstado("pode-assinar");
        }
      } catch {
        // A lista fica como estava — nada foi removido de fato no servidor.
        setError(t("enableFailed"));
      }
    });
  }

  function toggle(channel: "push" | "telegram", value: boolean) {
    const nextPush = channel === "push" ? value : pushOn;
    const nextTelegram = channel === "telegram" ? value : telegramOn;
    const prevPush = pushOn;
    const prevTelegram = telegramOn;
    setPushOn(nextPush);
    setTelegramOn(nextTelegram);
    setChannelsBusy(true);
    start(async () => {
      try {
        const res = await updateNotifyChannels(nextPush, nextTelegram);
        if (res.error) {
          setPushOn(prevPush);
          setTelegramOn(prevTelegram);
          setError(res.error);
        }
      } catch {
        // Antes, o `setChannelsBusy(false)` morava só no caminho feliz: uma
        // action que LANÇA deixava os dois interruptores desabilitados PRA
        // SEMPRE, exibindo um valor que o banco nunca gravou. O `finally`
        // abaixo é o que garante a saída; aqui só desfazemos o otimismo.
        setPushOn(prevPush);
        setTelegramOn(prevTelegram);
        setError(t("enableFailed"));
      } finally {
        setChannelsBusy(false);
      }
    });
  }

  function sendTest() {
    setError(undefined);
    setTestInfo(undefined);
    setTestWarning(undefined);
    start(async () => {
      // Mesmo motivo do `remove()`: sem o catch, uma action que lança prende o
      // `pending` e mata "Enviar teste" e "Remover" juntos, em silêncio.
      try {
        const res = await sendTestNotification();
        if (res.error) {
          setError(res.error);
          return;
        }
        const push = res.push ?? 0;
        const telegram = !!res.telegram;
        // notifyUser devolve {push:0, telegram:false} SEM erro quando não há
        // canal ligado ou nenhum aparelho registrado — pintar "Enviado." nesse
        // caso seria mentir. Só é sucesso se algo de fato saiu por algum canal.
        if (push === 0 && !telegram) {
          setTestWarning(t("testNone"));
          return;
        }
        setTestInfo(t("testResult", { push, telegram: telegram ? "true" : "false" }));
      } catch {
        setError(t("enableFailed"));
      }
    });
  }

  const noneOn = !pushOn && !telegramOn;

  return (
    <div className="space-y-4 text-sm">
      <p style={{ color: "var(--color-fg-muted)" }}>{t("description")}</p>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">{t("push")}</span>
          <Switch
            checked={pushOn}
            onChange={(v) => toggle("push", v)}
            disabled={channelsBusy}
            label={t("push")}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">{t("telegram")}</span>
          <Switch
            checked={telegramOn}
            onChange={(v) => toggle("telegram", v)}
            disabled={channelsBusy}
            label={t("telegram")}
          />
        </div>
      </div>

      {noneOn ? (
        <div
          className="flex items-start gap-2 rounded-lg border p-3 text-sm"
          style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{t("noneWarning")}</span>
        </div>
      ) : null}

      <div className="border-t pt-3" style={{ borderColor: "var(--color-border)" }}>
        {checking ? (
          <p className="flex items-center gap-2 text-xs" style={{ color: "var(--color-fg-muted)" }}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {t("checking")}
          </p>
        ) : estado === "assinado" ? (
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2" style={{ color: "var(--color-success)" }}>
              <Bell className="h-4 w-4" aria-hidden />
              {t("enabled")}
            </span>
            {myDeviceId ? (
              <button
                type="button"
                onClick={() => remove(myDeviceId)}
                disabled={pending}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}
              >
                {t("remove")}
              </button>
            ) : null}
          </div>
        ) : estado === "pode-assinar" ? (
          <button
            type="button"
            onClick={subscribe}
            disabled={subscribing}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--gradient-brand)" }}
          >
            {subscribing ? "…" : t("enable")}
          </button>
        ) : estado === "negado" ? (
          <div className="space-y-1" style={{ color: "var(--color-fg-muted)" }}>
            <p>{t("denied")}</p>
            <p className="text-xs">{t("deniedHow")}</p>
          </div>
        ) : estado === "ios-instalar" ? (
          <div className="space-y-2" style={{ color: "var(--color-fg-muted)" }}>
            <p>{t("iosNeedsInstall")}</p>
            <a href="#instalar-app" className="text-xs underline underline-offset-4">
              {tInstall("title")}
            </a>
          </div>
        ) : (
          <p style={{ color: "var(--color-fg-muted)" }}>{t("unsupported")}</p>
        )}
      </div>

      {deviceList.length > 0 ? (
        <div className="border-t pt-3" style={{ borderColor: "var(--color-border)" }}>
          <h4
            className="mb-2 text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--color-fg-muted)" }}
          >
            {t("devices")}
          </h4>
          <ul className="space-y-1.5">
            {deviceList.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 text-xs">
                <span
                  className="flex items-center gap-1.5"
                  style={{ color: "var(--color-fg-muted)" }}
                >
                  <Smartphone className="h-3.5 w-3.5" aria-hidden />
                  {shortUA(d.user_agent)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(d.id)}
                  disabled={pending}
                  aria-label={`${t("remove")} — ${shortUA(d.user_agent)}`}
                  className="rounded-md p-1 transition-colors hover:bg-[var(--color-card)] disabled:opacity-40"
                  style={{ color: "var(--color-fg-muted)" }}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-t pt-3" style={{ borderColor: "var(--color-border)" }}>
        <button
          type="button"
          onClick={sendTest}
          disabled={pending}
          className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          style={{ borderColor: "var(--color-border)", color: "var(--color-fg)" }}
        >
          {t("test")}
        </button>
        {testInfo ? (
          <p className="mt-1.5 text-xs" style={{ color: "var(--color-success)" }}>
            {testInfo}
          </p>
        ) : null}
        {testWarning ? (
          <p className="mt-1.5 text-xs" style={{ color: "var(--color-danger)" }}>
            {testWarning}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
