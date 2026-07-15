import { readFile } from "node:fs/promises";
import path from "node:path";
import { Reveal } from "@/components/Reveal";
import { CardHead } from "@/components/glass/CardHead";
import { FoldCard } from "@/components/glass/FoldCard";
import { variantId } from "@/lib/sound-disabled";
import { TEXTURES } from "@/lib/soundscape";
import { Disc3 } from "lucide-react";
import { NowPlayingProbe } from "./NowPlayingProbe";
import { SoundCreditRow } from "./SoundCreditRow";

type Credit = {
  key: string;
  variant?: number;
  title: string;
  author: string;
  license: string;
  source: string;
};

async function loadCredits(): Promise<Credit[]> {
  try {
    const raw = await readFile(
      path.join(process.cwd(), "public", "sounds", "manifest.json"),
      "utf8",
    );
    const manifest = JSON.parse(raw) as { sounds?: Credit[] };
    return manifest.sounds ?? [];
  } catch {
    return []; // manifest ainda não gerado (rode scripts/fetch-sounds.mjs)
  }
}

const NAME = new Map<string, string>(TEXTURES.map((t) => [t.key, t.name]));

/** Card de atribuição dos sons (CC0/CC-BY). Não renderiza nada se vazio. */
export async function SoundCredits() {
  const credits = await loadCredits();
  if (credits.length === 0) return null;

  // ids das variantes agrupados por textura — o switch usa pra saber quem são os
  // "irmãos" e impedir desligar a última de cada textura.
  const siblings = new Map<string, string[]>();
  for (const c of credits) {
    const arr = siblings.get(c.key) ?? [];
    arr.push(variantId(c.key, c.variant));
    siblings.set(c.key, arr);
  }

  return (
    <Reveal>
      <FoldCard>
        <CardHead icon={Disc3} title="Créditos de áudio" />
        <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
          Os sons ambientes vêm do{" "}
          <a
            href="https://freesound.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Freesound
          </a>{" "}
          sob licenças CC0 / CC-BY. Obrigado aos autores 🙏
        </p>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {credits.map((c) => (
            <SoundCreditRow
              key={`${c.key}-${c.variant ?? 0}`}
              credit={c}
              name={NAME.get(c.key) ?? c.key}
              siblingIds={siblings.get(c.key) ?? [variantId(c.key, c.variant)]}
            />
          ))}
        </ul>
        <NowPlayingProbe />
      </FoldCard>
    </Reveal>
  );
}
