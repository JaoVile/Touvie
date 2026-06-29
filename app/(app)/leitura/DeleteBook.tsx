"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { deleteBook } from "./actions";

export function DeleteBook({ id, title }: { id: string; title: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-label={`Excluir ${title || "livro"}`}
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Excluir "${title || "este livro"}"? Não dá pra desfazer.`)) return;
        startTransition(() => {
          void deleteBook(id);
        });
      }}
      className="shrink-0 rounded-md p-1.5 transition hover:opacity-80 disabled:opacity-50"
      style={{ color: "var(--color-fg-subtle)" }}
    >
      <Trash2 className="h-4 w-4" aria-hidden strokeWidth={1.6} />
    </button>
  );
}
