"use client";

import { todayBRTISO } from "@/lib/datetime";
import { useRef, useState, useTransition } from "react";
import { saveMeasurement } from "./actions";

export function MeasurementForm() {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(fd: FormData) {
    setError(undefined);
    start(async () => {
      const res = await saveMeasurement(fd);
      if (res?.error) setError(res.error);
      else formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={submit} className="space-y-2 text-xs">
      <Field name="measured_on" type="date" defaultValue={todayBRTISO()} required label="Data" />
      <Field name="weight_kg" type="number" step="0.1" placeholder="Ex: 78.4" label="Peso (kg)" />
      <div className="grid grid-cols-2 gap-2">
        <Field name="waist_cm" type="number" step="0.5" placeholder="cm" label="Cintura" />
        <Field name="chest_cm" type="number" step="0.5" placeholder="cm" label="Peito" />
        <Field name="arm_cm" type="number" step="0.5" placeholder="cm" label="Braço" />
        <Field name="thigh_cm" type="number" step="0.5" placeholder="cm" label="Coxa" />
      </div>
      <Field
        name="bodyfat_pct"
        type="number"
        step="0.1"
        placeholder="%"
        label="% gordura (opcional)"
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
        {pending ? "Salvando…" : "Registrar"}
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
