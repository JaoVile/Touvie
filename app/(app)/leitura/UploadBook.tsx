"use client";

import { cn } from "@/lib/utils";
import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { addBook } from "./actions";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB — teto saudável pra um PDF de livro.

type Status = "idle" | "uploading" | "error";

export function UploadBook() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (file.type !== "application/pdf") {
      setStatus("error");
      setError("Só aceitamos arquivos PDF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus("error");
      setError("Arquivo grande demais (máx. 50 MB).");
      return;
    }

    setStatus("uploading");
    // Import dinâmico: o cliente browser do Supabase (~50-69KB: auth+storage+
    // postgrest+realtime) só é baixado no 1º upload, saindo do first-load da /leitura.
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setStatus("error");
      setError("Sessão expirada — entre de novo.");
      return;
    }

    const path = `${user.id}/${crypto.randomUUID()}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("books")
      .upload(path, file, { contentType: "application/pdf", upsert: false });
    if (upErr) {
      setStatus("error");
      setError(`Falha no upload: ${upErr.message}`);
      return;
    }

    // Título inicial = nome do arquivo sem a extensão.
    const title = file.name.replace(/\.pdf$/i, "").trim() || "Sem título";
    const res = await addBook({
      title,
      file_path: path,
      file_name: file.name,
      file_size_bytes: file.size,
    });

    if (res.error) {
      // Desfaz o upload órfão se a gravação dos metadados falhar.
      await supabase.storage.from("books").remove([path]);
      setStatus("error");
      setError(res.error);
      return;
    }

    setStatus("idle");
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  const busy = status === "uploading";

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm font-medium transition",
          busy ? "opacity-70" : "hover:opacity-90",
        )}
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden strokeWidth={1.6} />
            Enviando…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" aria-hidden strokeWidth={1.6} />
            Enviar um PDF
          </>
        )}
      </button>
      {error ? (
        <p className="mt-2 text-xs" style={{ color: "var(--color-danger, #ef4444)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
