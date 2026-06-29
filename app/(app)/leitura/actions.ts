"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  return { supabase, userId: user.id };
}

// O upload do binário acontece no cliente (direto pro Storage, sob RLS) pra não
// esbarrar no limite de body das server actions. Aqui só gravamos os metadados —
// e validamos que o caminho está dentro da pasta do próprio usuário.
const addSchema = z.object({
  title: z.string().min(1).max(200),
  author: z.string().max(200).optional().nullable(),
  file_path: z.string().min(1).max(400),
  file_name: z.string().max(300),
  file_size_bytes: z.number().int().nonnegative(),
});

export async function addBook(input: {
  title: string;
  author?: string | null;
  file_path: string;
  file_name: string;
  file_size_bytes: number;
}): Promise<{ id?: string; error?: string }> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };

  const { supabase, userId } = await requireUser();
  // Defesa extra: o caminho TEM que começar pela pasta do usuário ("{uid}/…").
  if (!parsed.data.file_path.startsWith(`${userId}/`)) {
    return { error: "Caminho de arquivo inválido." };
  }

  const { data, error } = await supabase
    .from("reading_books")
    .insert({
      user_id: userId,
      title: parsed.data.title,
      author: parsed.data.author ?? null,
      file_path: parsed.data.file_path,
      file_name: parsed.data.file_name,
      file_size_bytes: parsed.data.file_size_bytes,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Erro ao salvar o livro." };
  revalidatePath("/leitura");
  return { id: data.id };
}

export async function renameBook(
  id: string,
  input: { title: string; author: string },
): Promise<{ ok?: boolean; error?: string }> {
  const title = input.title.trim();
  if (!title || title.length > 200) return { error: "Título inválido." };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("reading_books")
    .update({ title, author: input.author.trim() || null })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/leitura");
  return { ok: true };
}

export async function deleteBook(id: string): Promise<never> {
  const { supabase, userId } = await requireUser();
  // Pega o caminho antes de apagar a linha, pra remover o arquivo do Storage.
  const { data: book } = await supabase
    .from("reading_books")
    .select("file_path")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  await supabase.from("reading_books").delete().eq("id", id).eq("user_id", userId);
  if (book?.file_path) {
    await supabase.storage.from("books").remove([book.file_path]);
  }
  revalidatePath("/leitura");
  redirect("/leitura");
}
