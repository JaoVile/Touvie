"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteAccount } from "./actions";

export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [isPending, start] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (typed !== "DELETAR") return;
    start(async () => {
      const res = await deleteAccount();
      if (res.error) {
        setError(res.error);
        return;
      }
      router.push("/login");
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-lg border px-4 py-1.5 text-sm hover:opacity-80"
        style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}
      >
        Deletar conta e todos os dados
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-3" style={{ borderColor: "var(--color-danger)" }}>
      <p className="text-sm font-medium" style={{ color: "var(--color-danger)" }}>
        ⚠️ Ação irreversível — todos os seus dados serão apagados permanentemente.
      </p>
      <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
        Digite <strong>DELETAR</strong> para confirmar:
      </p>
      <input
        type="text"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder="DELETAR"
        className="w-full rounded-lg border px-3 py-1.5 text-sm"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      />
      {error && <p className="text-xs" style={{ color: "var(--color-danger)" }}>{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={typed !== "DELETAR" || isPending}
          className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: "var(--color-danger)" }}
        >
          {isPending ? "Deletando…" : "Confirmar exclusão"}
        </button>
        <button
          type="button"
          onClick={() => { setConfirming(false); setTyped(""); setError(""); }}
          className="rounded-lg border px-4 py-1.5 text-sm hover:opacity-80"
          style={{ borderColor: "var(--color-border)" }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
