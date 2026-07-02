import { PageGlyphs } from "@/components/PageGlyphs";
import { Reveal } from "@/components/Reveal";
import { FoldCard } from "@/components/glass/FoldCard";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { createClient } from "@/lib/supabase/server";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { DeleteBook } from "./DeleteBook";
import { UploadBook } from "./UploadBook";

export const dynamic = "force-dynamic";

const STAGGER_MS = 70;
const STAGGER_CAP = 6;

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function LeituraPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const { data: books } = await supabase
    .from("reading_books")
    .select("id, title, author, file_size_bytes, updated_at, current_page")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  const all = books ?? [];

  return (
    <>
      <PageGlyphs variant="editorial" />

      <Reveal>
        <GradientHeader
          icon={BookOpen}
          eyebrow="Biblioteca · Leitura"
          title="Leitura"
          subtitle="Seus livros em PDF, pra ler enquanto usa o app."
        />
      </Reveal>

      <Reveal delay={80}>
        <div className="mb-5">
          <UploadBook />
        </div>
      </Reveal>

      <Reveal delay={120}>
        <p className="mb-4 text-sm" style={{ color: "var(--color-fg-muted)" }}>
          {all.length} livro{all.length !== 1 ? "s" : ""} na sua biblioteca
        </p>
      </Reveal>

      {all.length === 0 ? (
        <Reveal delay={160}>
          <FoldCard>
            <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
              Nenhum livro ainda. Envie um PDF acima pra começar a ler.
            </p>
          </FoldCard>
        </Reveal>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {all.map((b, i) => (
            <BookCard key={b.id} book={b} delay={Math.min(i, STAGGER_CAP) * STAGGER_MS} />
          ))}
        </div>
      )}
    </>
  );
}

function BookCard(props: {
  book: {
    id: string;
    title: string;
    author: string | null;
    file_size_bytes: number;
    updated_at: string;
    current_page: number;
  };
  delay: number;
}) {
  const { book: b, delay } = props;
  const date = new Date(b.updated_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });

  return (
    <Reveal delay={delay} className="h-full">
      <FoldCard variant="spine">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/leitura/${b.id}`} className="block min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {b.title || <span style={{ color: "var(--color-fg-muted)" }}>Sem título</span>}
            </p>
            {b.author ? (
              <p className="truncate text-xs" style={{ color: "var(--color-fg-muted)" }}>
                {b.author}
              </p>
            ) : null}
            <p className="mt-2 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
              {fmtSize(b.file_size_bytes)} · {date}
              {b.current_page > 1 ? ` · pág. ${b.current_page}` : ""}
            </p>
          </Link>
          <DeleteBook id={b.id} title={b.title} />
        </div>
      </FoldCard>
    </Reveal>
  );
}
