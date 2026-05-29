"use client";

import { useState, useTransition } from "react";
import { TimePicker } from "@/components/TimePicker";
import { EmojiPicker } from "./EmojiPicker";
import { saveDailyBlock } from "./actions";

interface Props {
  defaultValues?: {
    id?: string;
    time_slot?: string;
    title?: string;
    emoji?: string | null;
    notes?: string | null;
  };
  onDone?: () => void;
}

export function DailyForm({ defaultValues, onDone }: Props) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    setError(undefined);
    start(async () => {
      const res = await saveDailyBlock(fd);
      if (res?.error) setError(res.error);
      else onDone?.();
    });
  }

  return (
    <form action={submit} className="space-y-3 text-sm">
      {defaultValues?.id ? <input type="hidden" name="id" value={defaultValues.id} /> : null}
      <div className="grid grid-cols-[110px_64px_1fr] gap-2">
        <TimePicker name="time_slot" defaultValue={defaultValues?.time_slot?.slice(0, 5) ?? "07:00"} />
        <EmojiPicker name="emoji" defaultValue={defaultValues?.emoji ?? ""} />
        <input
          type="text"
          name="title"
          placeholder="Ex: Academia…"
          required
          maxLength={120}
          defaultValue={defaultValues?.title ?? ""}
          className={inputCls}
          style={inputStyle}
        />
      </div>
      <textarea
        name="notes"
        placeholder="Notas (opcional)"
        rows={2}
        defaultValue={defaultValues?.notes ?? ""}
        className={inputCls}
        style={inputStyle}
      />
      {error ? <p style={{ color: "var(--color-danger)" }}>{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--gradient-brand)" }}
      >
        {pending ? "Salvando..." : defaultValues?.id ? "Atualizar" : "Adicionar"}
      </button>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border px-3 py-2 outline-none transition focus:ring-2";
const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};
