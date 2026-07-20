"use client";

import { DatePicker } from "@/components/DatePicker";
import { todayBRTISO } from "@/lib/datetime";
import { useRef, useState, useTransition } from "react";
import { saveMeasurement } from "./actions";

interface DefaultValues {
  id?: string;
  measured_on?: string;
  weight_kg?: number | null;
  waist_cm?: number | null;
  chest_cm?: number | null;
  arm_cm?: number | null;
  thigh_cm?: number | null;
  bodyfat_pct?: number | null;
  notes?: string | null;
}

interface Props {
  defaultValues?: DefaultValues;
  onDone?: () => void;
}

function numStr(v: number | null | undefined): string | undefined {
  return v != null ? String(v) : undefined;
}

export function MeasurementForm({ defaultValues, onDone }: Props) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const editing = Boolean(defaultValues?.id);

  function submit(fd: FormData) {
    setError(undefined);
    start(async () => {
      const res = await saveMeasurement(fd);
      if (res?.error) setError(res.error);
      else if (onDone) onDone();
      else formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={submit} className="space-y-2 text-xs">
      {defaultValues?.id ? <input type="hidden" name="id" value={defaultValues.id} /> : null}
      <div className="block">
        <span className="text-[10px]" style={{ color: "var(--color-fg-subtle)" }}>
          Data
        </span>
        <div className="mt-0.5">
          <DatePicker
            name="measured_on"
            defaultValue={defaultValues?.measured_on ?? todayBRTISO()}
            compact
          />
        </div>
      </div>
      <Field
        name="weight_kg"
        type="number"
        step="0.1"
        placeholder="Ex: 78.4"
        label="Peso (kg)"
        defaultValue={numStr(defaultValues?.weight_kg)}
      />
      <div className="grid grid-cols-2 gap-2">
        <Field
          name="waist_cm"
          type="number"
          step="0.5"
          placeholder="cm"
          label="Cintura"
          defaultValue={numStr(defaultValues?.waist_cm)}
        />
        <Field
          name="chest_cm"
          type="number"
          step="0.5"
          placeholder="cm"
          label="Peito"
          defaultValue={numStr(defaultValues?.chest_cm)}
        />
        <Field
          name="arm_cm"
          type="number"
          step="0.5"
          placeholder="cm"
          label="Braço"
          defaultValue={numStr(defaultValues?.arm_cm)}
        />
        <Field
          name="thigh_cm"
          type="number"
          step="0.5"
          placeholder="cm"
          label="Coxa"
          defaultValue={numStr(defaultValues?.thigh_cm)}
        />
      </div>
      <Field
        name="bodyfat_pct"
        type="number"
        step="0.1"
        placeholder="%"
        label="% gordura (opcional)"
        defaultValue={numStr(defaultValues?.bodyfat_pct)}
      />
      <label className="block">
        <span className="text-[10px]" style={{ color: "var(--color-fg-subtle)" }}>
          Notas
        </span>
        <textarea
          name="notes"
          rows={2}
          placeholder="Como você está se sentindo, condições da medição…"
          maxLength={500}
          defaultValue={defaultValues?.notes ?? ""}
          className={`${inputCls} mt-0.5 resize-y`}
          style={inputStyle}
        />
      </label>
      {error ? (
        <p className="text-[11px]" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--gradient-brand)" }}
      >
        {pending ? "Salvando…" : editing ? "Atualizar" : "Registrar"}
      </button>
    </form>
  );
}

function Field({
  name,
  type,
  step,
  placeholder,
  defaultValue,
  required,
  label,
}: {
  name: string;
  type: string;
  step?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  label: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px]" style={{ color: "var(--color-fg-subtle)" }}>
        {label}
      </span>
      <input
        type={type}
        name={name}
        step={step}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        className={`${inputCls} mt-0.5`}
        style={inputStyle}
      />
    </label>
  );
}

const inputCls = "w-full rounded border px-2 py-1.5 outline-none";
const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};
