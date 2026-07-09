"use client";

import {
  DISABLED_EVENT,
  PREVIEW_EVENT,
  readDisabled,
  toggleDisabled,
  variantId,
} from "@/lib/sound-disabled";
import type { TextureKey } from "@/lib/soundscape";
import { Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";

type Credit = {
  key: string;
  variant?: number;
  title: string;
  author: string;
  license: string;
  source: string;
};

/**
 * Uma linha da lista de Créditos, agora curável: ▶ ouve o take isolado (via engine,
 * loudness real) e o switch tira/põe a variante no shuffle. Some do shuffle → linha
 * esmaecida. Arquivo único (sem irmãos) não tem switch. Impede desligar a última.
 */
export function SoundCreditRow({
  credit,
  name,
  siblingIds,
}: {
  credit: Credit;
  name: string;
  siblingIds: string[];
}) {
  const id = variantId(credit.key, credit.variant);
  const canToggle = siblingIds.length > 1;
  const [off, setOff] = useState(false);
  const [lastEnabled, setLastEnabled] = useState(false);

  useEffect(() => {
    const sync = () => {
      const set = readDisabled();
      const isOff = set.has(id);
      const enabled = siblingIds.filter((s) => !set.has(s)).length;
      setOff(isOff);
      setLastEnabled(!isOff && enabled <= 1);
    };
    sync();
    window.addEventListener(DISABLED_EVENT, sync);
    return () => window.removeEventListener(DISABLED_EVENT, sync);
  }, [id, siblingIds]);

  const preview = () => {
    window.dispatchEvent(
      new CustomEvent(PREVIEW_EVENT, {
        detail: { key: credit.key as TextureKey, variant: credit.variant },
      }),
    );
  };

  return (
    <li
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border px-3 py-2 text-sm transition-opacity"
      style={{ borderColor: "var(--color-border)", opacity: off ? 0.45 : 1 }}
    >
      <span className="min-w-0 break-words">
        <span className="font-medium">
          {name}
          {credit.variant ? ` · var ${credit.variant}` : ""}
        </span>
        <span style={{ color: "var(--color-fg-subtle)" }}> · {credit.title}</span>
        {off ? (
          <span
            className="ml-1 text-[10px] font-medium uppercase tracking-wide"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            · fora do shuffle
          </span>
        ) : null}
      </span>
      <span
        className="flex flex-wrap items-center gap-2 text-xs"
        style={{ color: "var(--color-fg-muted)" }}
      >
        <span className="break-words">{credit.author}</span>
        <span
          className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
          style={{ background: "var(--color-border)" }}
        >
          {credit.license}
        </span>
        <a
          href={credit.source}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 underline"
        >
          fonte
        </a>
        <button
          type="button"
          onClick={preview}
          aria-label={`Ouvir ${name}${credit.variant ? ` variação ${credit.variant}` : ""}`}
          title="Ouvir este take"
          className="shrink-0 rounded-md p-1 transition-colors hover:bg-[var(--color-card)]"
        >
          <Play className="h-3.5 w-3.5" />
        </button>
        {canToggle ? (
          <button
            type="button"
            onClick={() => toggleDisabled(id, siblingIds)}
            role="switch"
            aria-checked={!off}
            aria-disabled={lastEnabled}
            title={
              lastEnabled
                ? "Cada textura precisa de pelo menos 1 take"
                : off
                  ? "Ligar no shuffle"
                  : "Tirar do shuffle"
            }
            className="shrink-0 rounded-md p-1 transition-colors hover:bg-[var(--color-card)]"
            style={{
              opacity: lastEnabled ? 0.4 : 1,
              cursor: lastEnabled ? "not-allowed" : "pointer",
            }}
          >
            {off ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        ) : null}
      </span>
    </li>
  );
}
