import { Reveal } from "@/components/Reveal";
import { FoldCard } from "@/components/glass/FoldCard";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { createClient } from "@/lib/supabase/server";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PdfReader } from "./PdfReader";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function LeituraReaderPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const { data: book } = await supabase
    .from("reading_books")
    .select("id, title, author, file_path")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!book) notFound();

  // URL assinada de curta duração — o bucket é privado.
  const { data: signed } = await supabase.storage
    .from("books")
    .createSignedUrl(book.file_path, 60 * 60);

  return (
    <>
      <Reveal>
        <GradientHeader
          icon={BookOpen}
          title={book.title || "Sem título"}
          subtitle={book.author ?? "Leitura"}
          action={
            <Link href="/leitura" className="text-sm" style={{ color: "var(--color-accent)" }}>
              ← Biblioteca
            </Link>
          }
        />
      </Reveal>

      <Reveal delay={80}>
        {signed?.signedUrl ? (
          <PdfReader url={signed.signedUrl} title={book.title} />
        ) : (
          <FoldCard>
            <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
              Não consegui abrir este arquivo agora. Tente recarregar a página.
            </p>
          </FoldCard>
        )}
      </Reveal>
    </>
  );
}
