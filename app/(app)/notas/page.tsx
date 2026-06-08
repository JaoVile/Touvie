import { Magnetic } from "@/components/Magnetic";
import { PageGlyphs } from "@/components/PageGlyphs";
import { Reveal } from "@/components/Reveal";
import { FoldCard } from "@/components/glass/FoldCard";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { createClient } from "@/lib/supabase/server";
import { NotebookPen, Pin } from "lucide-react";
import Link from "next/link";
import { createNote } from "./actions";

export const dynamic = "force-dynamic";

/* Stagger feel for the note grid — capped so a big archive doesn't crawl. */
const STAGGER_MS = 70;
const STAGGER_CAP = 6;

export default async function NotasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const { data: notes } = await supabase
    .from("notes")
    .select("id, title, content, tags, pinned, updated_at")
    .eq("user_id", userId)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  // Already ordered pinned-first by the query.
  const all = notes ?? [];
  const pinnedCount = all.filter((n) => n.pinned).length;

  return (
    <>
      <PageGlyphs variant="editorial" />

      <Reveal>
        <GradientHeader
          icon={NotebookPen}
          eyebrow="Arquivo · Ideias"
          title="Notas"
          subtitle="Pensamentos, referências e ideias."
          action={
            <Magnetic strength={0.35} radius={70}>
              <form action={createNote}>
                <button
                  type="submit"
                  className="group/lnk flex items-center gap-1 text-eyebrow font-semibold uppercase tracking-[0.1em] transition-colors"
                  style={{ color: "var(--color-accent)" }}
                >
                  <span className="link-underline">Nova nota</span>
                  <span className="transition-transform group-hover/lnk:translate-x-0.5">→</span>
                </button>
              </form>
            </Magnetic>
          }
        />
      </Reveal>

      <Reveal delay={80}>
        <p className="mb-4 text-sm" style={{ color: "var(--color-fg-muted)" }}>
          {all.length} nota{all.length !== 1 ? "s" : ""}
          {pinnedCount > 0 ? ` · ${pinnedCount} fixada${pinnedCount !== 1 ? "s" : ""}` : ""}
        </p>
      </Reveal>

      {all.length === 0 ? (
        <Reveal delay={120}>
          <FoldCard>
            <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
              Nenhuma nota ainda. Clique em "Nova nota" para começar.
            </p>
          </FoldCard>
        </Reveal>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {all.map((n, i) => (
            <NoteCard key={n.id} note={n} delay={Math.min(i, STAGGER_CAP) * STAGGER_MS} />
          ))}
        </div>
      )}
    </>
  );
}

function NoteCard(props: {
  note: {
    id: string;
    title: string;
    content: string;
    tags: string[];
    pinned: boolean;
    updated_at: string;
  };
  delay: number;
}) {
  const { note: n, delay } = props;
  const preview = n.content.trim().slice(0, 120);
  const date = new Date(n.updated_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });

  return (
    <Reveal delay={delay} className="h-full">
      <Link href={`/notas/${n.id}`} className="block h-full">
        <FoldCard variant={n.pinned ? "bookmark" : undefined}>
          <div className="mb-1 flex items-start justify-between gap-2">
            <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold">
              {n.pinned ? (
                <Pin
                  size={13}
                  strokeWidth={2}
                  className="shrink-0"
                  style={{ color: "var(--color-accent)" }}
                />
              ) : null}
              {n.title || <span style={{ color: "var(--color-fg-muted)" }}>Sem título</span>}
            </p>
            <span className="shrink-0 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
              {date}
            </span>
          </div>
          {preview ? (
            <p
              className="text-xs leading-relaxed line-clamp-3"
              style={{ color: "var(--color-fg-muted)" }}
            >
              {preview}
            </p>
          ) : null}
          {n.tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {n.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full px-1.5 py-0.5 text-[10px]"
                  style={{ background: "var(--color-border)", color: "var(--color-fg-muted)" }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
        </FoldCard>
      </Link>
    </Reveal>
  );
}
