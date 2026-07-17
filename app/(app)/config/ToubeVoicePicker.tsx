"use client";

import { TOUBE_VOICES, toubeVoice } from "@/lib/toube-voice";
import { Check, Play } from "lucide-react";
import { useEffect, useState } from "react";

// As frases passam pelo sanitize da voz, então "Toube"/"Touvie" já saem com a
// pronúncia corrigida (Toubi/Tuvi).
const AMOSTRA: Record<string, string> = {
  pt: "Oi! Eu sou o Toube, seu parceiro aqui no Touvie. Bora organizar o seu dia?",
  en: "Hi! I'm Toube, your partner here in Touvie. Let's organize your day!",
  // Multilíngues: a amostra mistura os dois idiomas pra mostrar a MESMA voz nos dois.
  multi:
    "Oi! Eu sou o Toube, seu parceiro aqui no Touvie. And I can also speak English with this same voice!",
};
const CONFIRMA: Record<string, string> = {
  pt: "Pronto! Agora eu falo com esta voz.",
  en: "Done! I'll speak with this voice from now on.",
  multi: "Pronto! Agora eu falo com esta voz.",
};
const GRUPOS = [
  { lang: "pt", titulo: "Português" },
  { lang: "multi", titulo: "Multilíngue (pt + en, mesma voz)" },
  { lang: "en", titulo: "English" },
] as const;

/**
 * Provador de voz do Toube: toca uma amostra de cada voz instalada (▶) e a
 * escolhida vira a voz do assistente (persistida no navegador). Motores locais:
 * Piper (leve) e Kokoro (mais natural — 1ª audição demora uns segundos enquanto
 * o modelo carrega; o aquecimento no mount encurta isso).
 */
export function ToubeVoicePicker() {
  // Começa no default e sincroniza no cliente (localStorage) — evita mismatch.
  const [current, setCurrent] = useState<string>(TOUBE_VOICES[0].id);
  useEffect(() => {
    setCurrent(toubeVoice.voice);
  }, []);

  function choose(id: string, lang: string) {
    toubeVoice.setVoice(id);
    setCurrent(id);
    // Confirmação NA voz nova — a pessoa já sai ouvindo como ficou.
    void toubeVoice.speak(CONFIRMA[lang] ?? CONFIRMA.pt, { force: true, voice: id });
  }

  return (
    <div className="grid gap-4">
      {GRUPOS.filter((g) => TOUBE_VOICES.some((v) => v.lang === g.lang)).map((g) => (
        <div key={g.lang}>
          <p
            className="mb-2 text-[10px] font-medium uppercase tracking-wide"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            {g.titulo}
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {TOUBE_VOICES.filter((v) => v.lang === g.lang).map((v) => {
              const active = v.id === current;
              return (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
                  style={{
                    borderColor: active
                      ? "var(--color-accent)"
                      : "color-mix(in srgb, var(--color-border) 70%, transparent)",
                    background: active
                      ? "color-mix(in srgb, var(--color-accent) 7%, transparent)"
                      : "transparent",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => choose(v.id, v.lang)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    title={`Usar a voz ${v.label}`}
                  >
                    <span className="font-medium">{v.label}</span>
                    <span className="text-[10px]" style={{ color: "var(--color-fg-subtle)" }}>
                      {v.credit ? `voz: ${v.credit} · ` : ""}
                      {v.engine === "edge"
                        ? "estúdio · online"
                        : v.engine === "kokoro"
                          ? "natural"
                          : "leve"}
                    </span>
                    {active ? (
                      <span
                        className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide"
                        style={{ color: "var(--color-accent)" }}
                      >
                        <Check className="size-3" />
                        em uso
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void toubeVoice.speak(AMOSTRA[v.lang] ?? AMOSTRA.pt, {
                        force: true,
                        voice: v.id,
                      })
                    }
                    title={`Ouvir amostra da voz ${v.label}`}
                    className="shrink-0 rounded-md p-1.5 transition-colors hover:bg-[var(--color-card)]"
                    style={{ color: "var(--color-fg-muted)" }}
                  >
                    <Play className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
