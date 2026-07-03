"use client";

import { useState, useTransition } from "react";
import { connectTelegram, disconnectTelegram, sendTelegramTest } from "./actions";

interface Props {
  chatId: string | null;
}

export function TelegramSection({ chatId }: Props) {
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();
  const [botUsername, setBotUsername] = useState<string | undefined>(undefined);
  const [linkToken, setLinkToken] = useState<string | undefined>(undefined);
  const [pending, start] = useTransition();
  const connected = !!chatId;

  function clear() {
    setError(undefined);
    setInfo(undefined);
  }

  function connect() {
    clear();
    start(async () => {
      const res = await connectTelegram();
      if (res.error) setError(res.error);
      else {
        setBotUsername(res.botUsername);
        setLinkToken(res.linkToken);
        setInfo(
          "Webhook conectado. Toque no botão abaixo pra abrir o bot já com seu código de vínculo (válido por 15 min).",
        );
      }
    });
  }

  function test() {
    clear();
    start(async () => {
      const res = await sendTelegramTest();
      if (res.error) setError(res.error);
      else setInfo("✓ Mensagem de teste enviada");
    });
  }

  function disconnect() {
    if (!confirm("Desconectar o bot? Você não recebe mais lembretes.")) return;
    clear();
    start(async () => {
      const res = await disconnectTelegram();
      if (res.error) setError(res.error);
      else setInfo("Desconectado");
    });
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: connected ? "var(--color-success)" : "var(--color-fg-subtle)" }}
        />
        <span style={{ color: "var(--color-fg-muted)" }}>
          {connected ? (
            <>
              Conectado · chat_id <code className="text-xs">{chatId}</code>
            </>
          ) : (
            "Não conectado"
          )}
        </span>
      </div>

      {!connected ? (
        <div className="space-y-2 text-xs" style={{ color: "var(--color-fg-muted)" }}>
          <p>
            <strong>Como ativar:</strong>
          </p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>
              Crie um bot via{" "}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                @BotFather
              </a>{" "}
              e copie o token
            </li>
            <li>
              Adicione <code>TELEGRAM_BOT_TOKEN</code> e <code>TELEGRAM_WEBHOOK_SECRET</code> no{" "}
              <code>.env.local</code> (e no Vercel)
            </li>
            <li>Clique em "Conectar bot" abaixo</li>
            <li>
              Abra o bot no Telegram e envie <code>/start</code>
            </li>
          </ol>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={connect}
          disabled={pending}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--gradient-brand)" }}
        >
          {pending ? "…" : connected ? "Reconfigurar webhook" : "Conectar bot"}
        </button>
        <button
          type="button"
          onClick={test}
          disabled={pending || !connected}
          className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          style={{ borderColor: "var(--color-border)", color: "var(--color-fg)" }}
        >
          Enviar teste
        </button>
        {connected ? (
          <button
            type="button"
            onClick={disconnect}
            disabled={pending}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
            style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}
          >
            Desconectar
          </button>
        ) : null}
      </div>

      {info ? (
        <p className="text-xs" style={{ color: "var(--color-success)" }}>
          {info}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}
      {botUsername && linkToken ? (
        <a
          href={`https://t.me/${botUsername}?start=${linkToken}`}
          target="_blank"
          rel="noreferrer"
          className="inline-block rounded px-2 py-1 text-xs underline"
          style={{ color: "var(--color-accent)" }}
        >
          Abrir @{botUsername} e vincular →
        </a>
      ) : null}
    </div>
  );
}
