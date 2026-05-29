import { Lock, NotebookPen, Search, Wallet } from "lucide-react";
import { PageGlyphs } from "@/components/PageGlyphs";
import { Reveal } from "@/components/Reveal";
import { CardHead } from "@/components/glass/CardHead";
import { FoldCard } from "@/components/glass/FoldCard";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { SearchBar } from "@/components/SearchBar";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";

/** Small muted count chip for a result-section header. */
function CountBadge({ n }: { n: number }) {
  return (
    <span className="ml-auto font-mono text-xs" style={{ color: "var(--color-fg-subtle)" }}>
      {n}
    </span>
  );
}

export const dynamic = "force-dynamic";

type SP = Promise<{ q?: string }>;

export default async function BuscaPage({ searchParams }: { searchParams: SP }) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  return (
    <>
      <PageGlyphs variant="system" />

      <Reveal>
        <GradientHeader
          icon={Search}
          eyebrow="Encontrar · App"
          title="Busca"
          subtitle="Encontre qualquer coisa no app."
        />
      </Reveal>

      <FoldCard className="mb-4">
        <Suspense>
          <SearchBar autoFocus={!query} />
        </Suspense>
      </FoldCard>

      {query.length >= 2 ? (
        <Suspense fallback={<LoadingResults />}>
          <Results query={query} />
        </Suspense>
      ) : query.length === 1 ? (
        <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
          Digite pelo menos 2 caracteres para buscar.
        </p>
      ) : (
        <SearchHints />
      )}
    </>
  );
}

async function Results({ query }: { query: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const term = `%${query}%`;

  const [txRes, diaryRes, notesRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, description, amount_cents, kind, occurred_on, finance_categories(name, emoji)")
      .eq("user_id", user.id)
      .ilike("description", term)
      .order("occurred_on", { ascending: false })
      .limit(10),
    supabase
      .from("journal_entries")
      .select("week_start, content, mood_emoji")
      .eq("user_id", user.id)
      .ilike("content", term)
      .order("week_start", { ascending: false })
      .limit(10),
    supabase
      .from("notes")
      .select("id, title, content, tags, updated_at")
      .eq("user_id", user.id)
      .or(`title.ilike.${term},content.ilike.${term}`)
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);

  const txs = txRes.data ?? [];
  const diary = diaryRes.data ?? [];
  const notesList = notesRes.data ?? [];
  const total = txs.length + diary.length + notesList.length;

  if (total === 0) {
    return (
      <Reveal>
        <FoldCard>
          <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
            Nenhum resultado para <strong>"{query}"</strong>.
          </p>
        </FoldCard>
      </Reveal>
    );
  }

  return (
    <div className="space-y-4">
      <Reveal>
        <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
          {total} resultado{total !== 1 ? "s" : ""} para <strong>"{query}"</strong>
        </p>
      </Reveal>

      {txs.length > 0 ? (
        <Reveal delay={80}>
        <FoldCard>
          <CardHead icon={Wallet} title="Transações" badge={<CountBadge n={txs.length} />} />
          <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {txs.map((t) => {
              const cat = t.finance_categories as unknown as { name: string; emoji: string | null } | null;
              return (
                <li key={t.id}>
                  <Link
                    href="/financas?t=lancamentos"
                    className="flex items-center justify-between gap-3 py-2.5 transition hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        <Highlight text={t.description ?? "—"} query={query} />
                      </p>
                      <p className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
                        {t.occurred_on}
                        {cat ? ` · ${cat.emoji ?? ""} ${cat.name}` : ""}
                      </p>
                    </div>
                    <span
                      className="shrink-0 font-mono text-sm font-semibold"
                      style={{ color: t.kind === "income" ? "var(--color-success)" : "var(--color-danger)" }}
                    >
                      {t.kind === "income" ? "+" : "−"}{formatBRL(t.amount_cents)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </FoldCard>
        </Reveal>
      ) : null}

      {notesList.length > 0 ? (
        <Reveal delay={160}>
        <FoldCard>
          <CardHead icon={NotebookPen} title="Notas" badge={<CountBadge n={notesList.length} />} />
          <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {notesList.map((n) => {
              const preview = extractPreview(n.title + " " + n.content, query);
              return (
                <li key={n.id}>
                  <Link href={`/notas/${n.id}`} className="flex items-start gap-3 py-2.5 transition hover:opacity-80">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        <Highlight text={n.title || "Sem título"} query={query} />
                      </p>
                      <p className="mt-0.5 text-xs italic" style={{ color: "var(--color-fg-muted)" }}>
                        …<Highlight text={preview} query={query} />…
                      </p>
                      {n.tags.length > 0 ? (
                        <div className="mt-1 flex gap-1">
                          {n.tags.slice(0, 3).map((t: string) => (
                            <span key={t} className="rounded-full px-1.5 py-0.5 text-[10px]"
                              style={{ background: "var(--color-border)", color: "var(--color-fg-muted)" }}>
                              #{t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs" style={{ color: "var(--color-fg-subtle)" }}>→</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </FoldCard>
        </Reveal>
      ) : null}

      {diary.length > 0 ? (
        <Reveal delay={240}>
        <FoldCard>
          <CardHead icon={Lock} title="Diário" badge={<CountBadge n={diary.length} />} />
          <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {diary.map((e) => {
              const preview = extractPreview(e.content, query);
              return (
                <li key={e.week_start}>
                  <Link
                    href={`/diario?w=${e.week_start}`}
                    className="flex items-start gap-3 py-2.5 transition hover:opacity-80"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {e.mood_emoji ? <span className="mr-1.5">{e.mood_emoji}</span> : null}
                        Semana de {formatWeekLabel(e.week_start)}
                      </p>
                      <p className="mt-0.5 text-xs italic" style={{ color: "var(--color-fg-muted)" }}>
                        …<Highlight text={preview} query={query} />…
                      </p>
                    </div>
                    <span className="shrink-0 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </FoldCard>
        </Reveal>
      ) : null}
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "var(--color-accent)", color: "white", borderRadius: "2px", padding: "0 2px" }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function extractPreview(content: string, query: string): string {
  const idx = content.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return content.slice(0, 80);
  const start = Math.max(0, idx - 30);
  const end = Math.min(content.length, idx + query.length + 50);
  return content.slice(start, end);
}

function formatWeekLabel(weekStart: string): string {
  const [, m, d] = weekStart.split("-");
  const months = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return `${parseInt(d)} de ${months[parseInt(m) - 1]}`;
}

function LoadingResults() {
  return (
    <FoldCard>
      <p className="text-sm animate-pulse" style={{ color: "var(--color-fg-muted)" }}>
        Buscando…
      </p>
    </FoldCard>
  );
}

function SearchHints() {
  return (
    <Reveal>
      <FoldCard>
        <p className="mb-3 text-sm font-medium" style={{ color: "var(--color-fg-muted)" }}>
          O que você pode buscar:
        </p>
        <ul className="space-y-1.5 text-sm" style={{ color: "var(--color-fg-muted)" }}>
          <li>💰 Descrição de transações — ex: <em>"iFood"</em>, <em>"Nubank"</em></li>
          <li>🔒 Conteúdo do diário — ex: <em>"meta"</em>, <em>"gratidão"</em></li>
        </ul>
      </FoldCard>
    </Reveal>
  );
}
