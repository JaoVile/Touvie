import { GlassCard } from "@/components/glass/GlassCard";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { getUserClaims } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoteEditor } from "./NoteEditor";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function NotePage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const userId = (await getUserClaims())!.sub;

  const { data: note } = await supabase
    .from("notes")
    .select("id, title, content, tags, pinned, updated_at")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!note) notFound();

  const date = new Date(note.updated_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      <GradientHeader
        emoji="📝"
        title={note.title || "Nota sem título"}
        subtitle={`Editada em ${date}`}
        action={
          <Link
            href="/notas"
            className="text-sm hover:opacity-80"
            style={{ color: "var(--color-accent)" }}
          >
            ← Notas
          </Link>
        }
      />
      <GlassCard>
        <NoteEditor note={note} />
      </GlassCard>
    </>
  );
}
