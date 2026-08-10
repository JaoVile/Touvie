"use client";

import { Check, Copy } from "lucide-react";
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
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const connected = !!chatId;

  // O deep link `?start=CÓDIGO` só é enviado sozinho quando a conversa com o bot
  // está vazia. Quem já trocou qualquer mensagem antes clica no link, o chat abre
  // e NADA é enviado — o vínculo trava sem erro visível. Por isso o comando fica
  // exposto aqui pra copiar e colar à mão.
  const startCommand = linkToken ? `/start ${linkToken}` : null;

  async function copyCommand() {
    if (!startCommand) return;
    try {
      await navigator.clipboard.writeText(startCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não consegui copiar — selecione o comando acima e copie à mão.");
    }
  }

  function clear() {
    setError(undefined);
    setInfo(undefined);
    setCopied(false);
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
              Copie o comando <code>/start …</code> que aparecer e cole na conversa com o bot.{" "}
              <strong>
                <code>/start</code> sozinho não vincula
              </strong>{" "}
              — o código é de uso único e vale 15 min.
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

      {startCommand ? (
        <div
          className="space-y-2 rounded-lg border p-3"
          style={{ borderColor: "var(--color-border)", background: "var(--color-bg-elevated)" }}
        >
          <p className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
            Se o botão acima abrir o chat <strong>sem enviar nada</strong> — acontece quando você já
            conversou com o bot antes — copie o comando e cole lá:
          </p>
          <div className="flex items-center gap-2">
            <code
              className="flex-1 overflow-x-auto whitespace-nowrap rounded px-2 py-1.5 text-xs"
              style={{ background: "var(--color-bg)", color: "var(--color-fg)" }}
            >
              {startCommand}
            </code>
            <button
              type="button"
              onClick={copyCommand}
              className="flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
              style={{
                borderColor: copied ? "var(--color-success)" : "var(--color-border)",
                color: copied ? "var(--color-success)" : "var(--color-fg)",
              }}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
