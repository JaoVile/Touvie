"use client";

import { FoldCard } from "@/components/glass/FoldCard";
import { decryptEntry, isEncrypted, loadSessionDEK } from "@/lib/diary-crypto";
import { LockKeyhole, MailOpen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteCapsule, openCapsule } from "./actions";

interface Props {
  id: string;
  title: string;
  sealedAt: string;
  opensAt: string;
  openedAt: string | null;
  content: string;
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Uma cápsula que JÁ CHEGOU: abrir (decifrando se preciso), reler, excluir. */
export function CapsuleCard({ id, title, sealedAt, opensAt, openedAt, content }: Props) {
  const router = useRouter();
  const [plain, setPlain] = useState<string>();
  const [needsKey, setNeedsKey] = useState(false);
  const [err, setErr] = useState<string>();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const wasOpened = !!openedAt;
  const travelDays = Math.max(
    1,
    Math.round((new Date(opensAt).getTime() - new Date(sealedAt).getTime()) / 86_400_000),
  );

  async function reveal() {
    setErr(undefined);
    setNeedsKey(false);
    let text = content;
    if (isEncrypted(content)) {
      const dek = loadSessionDEK();
      if (!dek) {
        setNeedsKey(true);
        return;
      }
      try {
        text = await decryptEntry(content, dek);
      } catch {
        setErr("Não consegui decifrar — destranque o diário de novo e tente outra vez.");
        return;
      }
    }
    setPlain(text);
    // Marca como aberta em segundo plano; a leitura não depende do servidor.
    if (!wasOpened) openCapsule(id).catch(() => {});
  }

  async function remove() {
    setBusy(true);
    const res = await deleteCapsule(id);
    if (res.error) {
      setErr(res.error);
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <FoldCard>
      <div className="mb-1 flex items-center gap-2">
        <MailOpen size={16} style={{ color: "var(--color-accent)" }} />
        <h2 className="min-w-0 truncate text-sm font-semibold">{title.trim() || "Sem título"}</h2>
      </div>
      <p className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
        Selada em {dateFmt.format(new Date(sealedAt))} · viajou {travelDays}{" "}
        {travelDays === 1 ? "dia" : "dias"} · chegou em {dateFmt.format(new Date(opensAt))}
      </p>

      {plain !== undefined ? (
        <>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{plain}</p>
          <div className="mt-4 flex items-center gap-2">
            {confirmingDelete ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={remove}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  style={{ background: "var(--color-danger)" }}
                >
                  {busy ? "Excluindo…" : "Confirmar exclusão"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-lg border px-3 py-1.5 text-xs hover:opacity-80"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="rounded-lg border px-3 py-1.5 text-xs hover:opacity-80"
                style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
              >
                Excluir
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="mt-3">
          <button
            type="button"
            onClick={reveal}
            className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white"
            style={{ background: "var(--gradient-brand)" }}
          >
            {wasOpened ? "Reler" : "Abrir"}
          </button>
          {needsKey ? (
            <p
              className="mt-2 flex items-center gap-1.5 text-xs"
              style={{ color: "var(--color-fg-muted)" }}
            >
              <LockKeyhole size={13} />
              Esta carta está cifrada —{" "}
              <Link href="/diario" className="underline">
                destranque o diário
              </Link>{" "}
              e volte aqui.
            </p>
          ) : null}
          {err ? (
            <p className="mt-2 text-xs" style={{ color: "var(--color-danger)" }}>
              {err}
            </p>
          ) : null}
        </div>
      )}
    </FoldCard>
  );
}
