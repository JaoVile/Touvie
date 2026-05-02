"use client";

import { useTransition } from "react";
import { archiveCategory } from "./actions";

interface Props {
  category: {
    id: string;
    name: string;
    emoji: string | null;
    color: string | null;
  };
}

export function CategoryRow({ category }: Props) {
  const [pending, start] = useTransition();

  function remove() {
    if (!confirm(`Arquivar "${category.name}"? Lançamentos antigos mantêm a categoria.`)) return;
    start(async () => {
      await archiveCategory(category.id);
    });
  }

  return (
    <li
      className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs"
      style={{ background: "var(--color-card)" }}
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-3 w-3 rounded-full"
          style={{ background: category.color ?? "transparent" }}
        />
        <span>
          {category.emoji ? `${category.emoji} ` : ""}
          {category.name}
        </span>
      </span>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="rounded px-1 hover:opacity-80 disabled:opacity-40"
        style={{ color: "var(--color-fg-subtle)" }}
        aria-label={`Arquivar ${category.name}`}
      >
        ×
      </button>
    </li>
  );
}
