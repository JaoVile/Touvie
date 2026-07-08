import { readFile } from "node:fs/promises";
import path from "node:path";
import { Reveal } from "@/components/Reveal";
import { CardHead } from "@/components/glass/CardHead";
import { FoldCard } from "@/components/glass/FoldCard";
import { TEXTURES } from "@/lib/soundscape";
import { Disc3 } from "lucide-react";

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
        <ul className="grid gap-2">
          {credits.map((c) => (
            <li
              key={`${c.key}-${c.variant ?? 0}`}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--color-border)" }}
            >
              <span className="min-w-0 break-words">
                <span className="font-medium">
                  {NAME.get(c.key) ?? c.key}
                  {c.variant ? ` · var ${c.variant}` : ""}
                </span>
                <span style={{ color: "var(--color-fg-subtle)" }}> · {c.title}</span>
              </span>
              <span
                className="flex flex-wrap items-center gap-2 text-xs"
                style={{ color: "var(--color-fg-muted)" }}
              >
                <span className="break-words">{c.author}</span>
                <span
                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ background: "var(--color-border)" }}
                >
                  {c.license}
                </span>
                <a
                  href={c.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 underline"
                >
                  fonte
                </a>
              </span>
            </li>
          ))}
        </ul>
      </FoldCard>
    </Reveal>
  );
}
