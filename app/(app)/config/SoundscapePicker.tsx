"use client";

import {
  DEFAULT_SOUND,
  FREQUENCIES,
  type IconName,
  JOURNEYS,
  type JourneyKey,
  SCENES,
  type Scene,
  type SoundState,
  type SoundscapeKey,
  TEXTURES,
  type TextureKey,
  journeyGuidedSeconds,
  journeyStageAt,
  readSoundState,
  sameTextures,
  writeSoundState,
} from "@/lib/soundscape";
import { cn } from "@/lib/utils";
import {
  AudioLines,
  AudioWaveform,
  Bed,
  BookOpen,
  Brain,
  ChevronDown,
  CloudRain,
  Coffee,
  Flame,
  Guitar,
  HeartPulse,
  Leaf,
  type LucideIcon,
  Moon,
  MoonStar,
  Music2,
  Piano,
  Sunrise,
  Target,
  Trees,
  Waves,
  Wind,
} from "lucide-react";
import { useEffect, useState } from "react";

// Nome do ícone (na data) → componente Lucide. Monocromático, herda currentColor.
const ICONS: Record<IconName, LucideIcon> = {
  waves: Waves,
  target: Target,
  moon: Moon,
  "moon-star": MoonStar,
  bed: Bed,
  "cloud-rain": CloudRain,
  "audio-lines": AudioLines,
  "audio-waveform": AudioWaveform,
  trees: Trees,
  wind: Wind,
  flame: Flame,
  music: Music2,
  guitar: Guitar,
  piano: Piano,
  "heart-pulse": HeartPulse,
  sunrise: Sunrise,
  leaf: Leaf,
  coffee: Coffee,
  brain: Brain,
  book: BookOpen,
};

function Glyph({
  name,
  className,
  style,
}: {
  name: IconName;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Ico = ICONS[name];
  return <Ico className={className} style={style} aria-hidden strokeWidth={1.6} />;
}

const FREQ_NAME = new Map(FREQUENCIES.map((f) => [f.key, f.name]));

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function VolumeSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mt-3 flex items-center gap-3">
      <span className="w-16 text-xs" style={{ color: "var(--color-fg-muted)" }}>
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`Volume — ${label}`}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full"
        style={{ accentColor: "var(--color-accent)", background: "var(--color-border)" }}
      />
      <span
        className="w-9 text-right text-xs tabular-nums"
        style={{ color: "var(--color-fg-subtle)" }}
      >
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

export function SoundscapePicker() {
  const [state, setState] = useState<SoundState>(DEFAULT_SOUND);

  // Hidrata do localStorage só no cliente (evita mismatch de SSR).
  useEffect(() => {
    setState(readSoundState());
  }, []);

  const update = (patch: Partial<SoundState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      writeSoundState(next); // persiste + avisa o SoundscapeLayer (mixa ao vivo)
      return next;
    });
  };

  // Frequência manual: toggle; escolher encerra qualquer jornada.
  const pickFreq = (mode: SoundscapeKey) =>
    update({
      freqMode: state.freqMode === mode ? null : mode,
      journey: null,
      journeyStartedAt: null,
    });

  // Jornada: clicar na ativa para; outra (re)inicia do zero. Zera a freq manual.
  const pickJourney = (key: JourneyKey) =>
    update(
      state.journey === key
        ? { journey: null, journeyStartedAt: null }
        : { journey: key, journeyStartedAt: Date.now(), freqMode: null },
    );

  const toggleTexture = (key: TextureKey) =>
    update({
      textures: state.textures.includes(key)
        ? state.textures.filter((t) => t !== key)
        : [...state.textures, key],
    });

  // Cena pronta: monta a mistura inteira de uma vez. Clicar na ativa desliga tudo.
  const matchesScene = (sc: Scene) => {
    const freqOk = sc.journey
      ? state.journey === sc.journey
      : !state.journey && state.freqMode === (sc.freqMode ?? null);
    return freqOk && sameTextures(state.textures, sc.textures);
  };
  const applyScene = (sc: Scene) => {
    if (matchesScene(sc)) {
      update({ ...DEFAULT_SOUND });
      return;
    }
    update({
      freqMode: sc.journey ? null : (sc.freqMode ?? null),
      journey: sc.journey ?? null,
      journeyStartedAt: sc.journey ? Date.now() : null,
      textures: sc.textures,
      freqVolume: sc.freqVolume ?? 0.5,
      textureVolume: sc.textureVolume ?? 0.5,
      // Cena não define volume por som — começa tudo no default (1).
      textureVolumes: {},
    });
  };

  // Relógio ao vivo só enquanto há jornada (pra mostrar o estágio atual).
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!state.journey) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state.journey]);

  const activeFreq = FREQUENCIES.find((f) => f.key === state.freqMode);
  const ambient = TEXTURES.filter((t) => t.group === "ambiente");
  const instruments = TEXTURES.filter((t) => t.group === "instrumento");
  // Ambiente natural (chuva/mar/floresta/vento) fica DE CARA; os ruídos
  // utilitários (rosa/marrom) descem pro Avançado — são mais "ferramenta".
  const naturalAmbient = ambient.filter((t) => !t.key.startsWith("ruido"));
  const noises = ambient.filter((t) => t.key.startsWith("ruido"));
  // Texturas ligadas (na ordem do catálogo) — pra os sliders de volume por som.
  const activeTextures = TEXTURES.filter((t) => state.textures.includes(t.key));

  const activeJourney = JOURNEYS.find((j) => j.key === state.journey);
  const journeyElapsed =
    activeJourney && state.journeyStartedAt ? (now - state.journeyStartedAt) / 1000 : 0;
  const journeyStage = activeJourney ? journeyStageAt(activeJourney, journeyElapsed) : -1;
  const journeyArrived = activeJourney ? journeyStage === activeJourney.stages.length - 1 : false;

  const cardCls = (active: boolean) =>
    cn("rounded-lg border p-3 text-left transition", active ? "ring-2" : "hover:opacity-90");
  const cardStyle = (active: boolean) =>
    ({
      background: "var(--color-card)",
      borderColor: active ? "var(--color-accent)" : "var(--color-border)",
      "--tw-ring-color": "var(--color-accent)",
    }) as React.CSSProperties;
  const chip = (active: boolean) =>
    cn(
      "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition",
      active ? "ring-2" : "hover:opacity-90",
    );
  const iconColor = (active: boolean) => (active ? "var(--color-accent)" : "var(--color-fg-muted)");
  const sectionLabel = "mb-2 text-xs font-semibold uppercase tracking-wide";
  const subLabel = "mb-2 text-xs";

  // Chips de textura (ambiente / instrumentos / ruídos) — mesma forma pra todos.
  const renderChips = (list: typeof TEXTURES) => (
    <div className="flex flex-wrap gap-2">
      {list.map((t) => {
        const active = state.textures.includes(t.key);
        return (
          <button
            type="button"
            key={t.key}
            onClick={() => toggleTexture(t.key)}
            title={t.desc}
            aria-pressed={active}
            className={chip(active)}
            style={cardStyle(active)}
          >
            <Glyph name={t.icon} className="h-4 w-4" style={{ color: iconColor(active) }} />
            {t.name}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="grid gap-6 min-w-0">
      {/* ── Atmosferas: atalhos curados numa linha compacta (rolagem horizontal) ── */}
      <section className="min-w-0">
        <h4 className={sectionLabel} style={{ color: "var(--color-fg-muted)" }}>
          Atmosferas
        </h4>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {SCENES.map((sc) => {
            const active = matchesScene(sc);
            return (
              <button
                type="button"
                key={sc.key}
                onClick={() => applyScene(sc)}
                aria-pressed={active}
                title={sc.desc}
                className={cn(chip(active), "shrink-0 whitespace-nowrap")}
                style={cardStyle(active)}
              >
                <Glyph name={sc.icon} className="h-4 w-4" style={{ color: iconColor(active) }} />
                {sc.name}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
          Um toque monta a mistura inteira. O som começa no seu 1º clique na tela.
        </p>
      </section>

      {/* ── Monte o seu: o som ambiente é o core — fica de cara ── */}
      <section className="min-w-0">
        <h4 className={sectionLabel} style={{ color: "var(--color-fg-muted)" }}>
          Monte o seu
        </h4>
        <h5 className={subLabel} style={{ color: "var(--color-fg-subtle)" }}>
          Ambiente
        </h5>
        {renderChips(naturalAmbient)}
        <h5 className={cn(subLabel, "mt-4")} style={{ color: "var(--color-fg-subtle)" }}>
          Instrumentos
        </h5>
        {renderChips(instruments)}
        <VolumeSlider
          label="Geral"
          value={state.textureVolume}
          onChange={(v) => update({ textureVolume: v })}
        />
        {/* Volume por som: um slider por textura ATIVA, multiplica o master "Geral". */}
        {activeTextures.length > 0 ? (
          <div className="mt-4">
            <h5 className={subLabel} style={{ color: "var(--color-fg-subtle)" }}>
              Volume por som
            </h5>
            {activeTextures.map((t) => (
              <VolumeSlider
                key={t.key}
                label={t.name}
                value={state.textureVolumes?.[t.key] ?? 1}
                onChange={(v) =>
                  update({ textureVolumes: { ...state.textureVolumes, [t.key]: v } })
                }
              />
            ))}
          </div>
        ) : null}
      </section>

      {/* ── Frequência, jornadas, ruídos, modo profundo ── */}
      <section className="min-w-0">
        <div className="grid gap-6">
          {/* Frequência guia + seu volume (pausada enquanto uma jornada conduz) */}
          <div
            aria-disabled={!!state.journey}
            style={{
              opacity: state.journey ? 0.45 : 1,
              pointerEvents: state.journey ? "none" : "auto",
            }}
          >
            <h5 className={sectionLabel} style={{ color: "var(--color-fg-muted)" }}>
              Frequência {state.journey ? "· pausada na jornada" : "guia"}
            </h5>
            <div className="grid gap-2 sm:grid-cols-2">
              {FREQUENCIES.map((f) => {
                const active = state.freqMode === f.key;
                return (
                  <button
                    type="button"
                    key={f.key}
                    onClick={() => pickFreq(f.key)}
                    disabled={!!state.journey}
                    className={cn(cardCls(active), "flex items-start gap-3")}
                    style={cardStyle(active)}
                  >
                    <Glyph name={f.icon} className="mt-0.5 h-[18px] w-[18px] shrink-0" />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span className="break-words">{f.name}</span>
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                          style={{
                            background: "var(--color-border)",
                            color: "var(--color-fg-muted)",
                          }}
                        >
                          {f.wave}
                        </span>
                      </span>
                      <span className="block text-xs" style={{ color: "var(--color-fg-subtle)" }}>
                        {f.desc}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {activeFreq?.warn ? (
              <p className="mt-2 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
                {activeFreq.warn}
              </p>
            ) : null}
            <VolumeSlider
              label="Volume"
              value={state.freqVolume}
              onChange={(v) => update({ freqVolume: v })}
            />
          </div>

          {/* Guiadas: a frequência migra sozinha no tempo (princípio ISO) */}
          <div>
            <h5 className={sectionLabel} style={{ color: "var(--color-fg-muted)" }}>
              Guiadas
            </h5>
            <div className="grid gap-2 sm:grid-cols-2">
              {JOURNEYS.map((j) => {
                const active = state.journey === j.key;
                return (
                  <button
                    type="button"
                    key={j.key}
                    onClick={() => pickJourney(j.key)}
                    aria-pressed={active}
                    className={cn(cardCls(active), "flex items-start gap-3")}
                    style={cardStyle(active)}
                  >
                    <Glyph name={j.icon} className="mt-0.5 h-[18px] w-[18px] shrink-0" />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span className="break-words">{j.name}</span>
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums"
                          style={{
                            background: "var(--color-border)",
                            color: "var(--color-fg-muted)",
                          }}
                        >
                          {fmt(journeyGuidedSeconds(j))}
                        </span>
                      </span>
                      <span className="block text-xs" style={{ color: "var(--color-fg-subtle)" }}>
                        {j.desc}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {activeJourney ? (
              <div
                className="mt-3 rounded-lg border p-3 text-sm"
                style={{ borderColor: "var(--color-accent)", background: "var(--color-card)" }}
              >
                <p className="font-medium">
                  {journeyArrived ? "Chegou" : "Conduzindo"} ·{" "}
                  <span style={{ color: "var(--color-accent)" }}>
                    {FREQ_NAME.get(activeJourney.stages[journeyStage].freq)}
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {activeJourney.stages.map((st, i) => (
                    <span
                      key={st.freq}
                      className="rounded-full px-2 py-0.5 text-xs transition"
                      style={{
                        background:
                          i <= journeyStage ? "var(--color-accent)" : "var(--color-border)",
                        color: i <= journeyStage ? "var(--color-bg)" : "var(--color-fg-muted)",
                        opacity: i === journeyStage ? 1 : i < journeyStage ? 0.7 : 0.6,
                      }}
                    >
                      {FREQ_NAME.get(st.freq)}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
                  {journeyArrived
                    ? "Mantém este estado até você parar."
                    : `Decorrido ${fmt(journeyElapsed)} de ${fmt(journeyGuidedSeconds(activeJourney))} guiados.`}
                </p>
              </div>
            ) : null}
          </div>

          {/* Ruídos utilitários (rosa / marrom) */}
          <div>
            <h5 className={sectionLabel} style={{ color: "var(--color-fg-muted)" }}>
              Ruídos
            </h5>
            {renderChips(noises)}
          </div>

          {/* Modo profundo: tom isócrono opt-in (off por padrão) */}
          <div
            className="flex items-start justify-between gap-4 rounded-lg border p-3"
            style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
          >
            <div className="min-w-0">
              <h5 className="text-sm font-medium">Modo profundo</h5>
              <p className="mt-0.5 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
                Soma o tom isócrono (pulso de entrainment) por cima do som — mais intenso e
                funcional, mas pode incomodar quem é sensível. Desligado, a frequência é só o pad
                quente, com respiração suave.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={state.deepMode}
              aria-label="Modo profundo"
              onClick={() => update({ deepMode: !state.deepMode })}
              className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition"
              style={{
                background: state.deepMode ? "var(--color-accent)" : "var(--color-border)",
              }}
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full transition-all"
                style={{
                  left: state.deepMode ? "1.5rem" : "0.125rem",
                  background: "var(--color-bg)",
                }}
              />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
