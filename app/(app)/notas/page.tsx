import { GlassCard } from "@/components/glass/GlassCard";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { createNote } from "./actions";

export const dynamic = "force-dynamic";

export default async function NotasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user!.id;

  const { data: notes } = await supabase
    .from("notes")
    .select("id, title, content, tags, pinned, updated_at")
    .eq("user_id", userId)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  const all = notes ?? [];
  const pinned = all.filter((n) => n.pinned);
  const rest = all.filter((n) => !n.pinned);

  return (
    <>
      <GradientHeader emoji="📝" title="Notas" subtitle="Pensamentos, referências e ideias." />

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
          {all.length} nota{all.length !== 1 ? "s" : ""}
          {pinned.length > 0 ? ` · ${pinned.length} fixada${pinned.length !== 1 ? "s" : ""}` : ""}
        </p>
        <form action={createNote}>
          <button
            type="submit"
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
            style={{ background: "var(--gradient-brand)" }}
          >
            + Nova nota
          </button>
        </form>
      </div>

      {all.length === 0 ? (
        <GlassCard>
          <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
            Nenhuma nota ainda. Clique em "Nova nota" para começar.
          </p>
        </GlassCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pinned.length > 0
            ? pinned.map((n) => <NoteCard key={n.id} note={n} />)
            : null}
          {rest.map((n) => <NoteCard key={n.id} note={n} />)}
        </div>
      )}
    </>
  );
}

function NoteCard(props: {
  note: { id: string; title: string; content: string; tags: string[]; pinned: boolean; updated_at: string };
}) {
  const { note: n } = props;
  const preview = n.content.trim().slice(0, 120);
  const date = new Date(n.updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  return (
    <Link href={`/notas/${n.id}`}>
      <div
        className="h-full rounded-lg border p-4 transition hover:opacity-80"
        style={{
          background: "var(--color-card)",
          borderColor: n.pinned ? "var(--color-accent)" : "var(--color-border)",
        }}
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <p className="font-semibold text-sm truncate">
            {n.pinned ? <span className="mr-1">📌</span> : null}
            {n.title || <span style={{ color: "var(--color-fg-muted)" }}>Sem título</span>}
          </p>
          <span className="shrink-0 text-xs" style={{ color: "var(--color-fg-subtle)" }}>{date}</span>
        </div>
        {preview ? (
          <p className="text-xs leading-relaxed line-clamp-3" style={{ color: "var(--color-fg-muted)" }}>
            {preview}
          </p>
        ) : null}
        {n.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {n.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-full px-1.5 py-0.5 text-[10px]"
                style={{ background: "var(--color-border)", color: "var(--color-fg-muted)" }}>
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
