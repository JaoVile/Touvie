import { signOutAction } from "@/app/(auth)/login/actions";
import { Reveal } from "@/components/Reveal";
import { CardHead } from "@/components/glass/CardHead";
import { FoldCard } from "@/components/glass/FoldCard";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { TRUSTED_COOKIE, verifyTrustedDevice } from "@/lib/device";
import { getUserClaims } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_THEME } from "@/lib/themes";
import {
  AudioLines,
  History,
  KeyRound,
  Languages,
  Lock,
  Music,
  Palette,
  RefreshCw,
  ScrollText,
  Send,
  Settings,
  ShieldCheck,
  Target,
  User,
  Volume2,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { AccessCodeForm } from "./AccessCodeForm";
import { CursorToggle } from "./CursorToggle";
import { DeleteAccountButton } from "./DeleteAccountButton";
import { FocusQuestToggle } from "./FocusQuestToggle";
import { ForceUpdate } from "./ForceUpdate";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { LogGeral } from "./LogGeral";
import { NavCustomizer } from "./NavCustomizer";
import { ProfileSection } from "./ProfileSection";
import { QualityPicker } from "./QualityPicker";
import { SoundCredits } from "./SoundCredits";
import { SoundscapePicker } from "./SoundscapePicker";
import { StarsToggle } from "./StarsToggle";
import { TelegramSection } from "./TelegramSection";
import { ThemePicker } from "./ThemePicker";
import { ToubeHistoryManager } from "./ToubeHistoryManager";
import { ToubeVoicePicker } from "./ToubeVoicePicker";
import { TrailColorPicker } from "./TrailColorPicker";
import { TrailSizePicker } from "./TrailSizePicker";

export const dynamic = "force-dynamic";

/* Cascade delay between the stacked setting cards. */
const STAGGER_MS = 70;

export default async function ConfigPage(props: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const resolvedParams = props.searchParams ? await props.searchParams : {};
  const currentTab = resolvedParams.tab || "geral";

  const supabase = await createClient();
  const claims = await getUserClaims();
  const userId = claims!.sub;
  const [profile, names, writePin, focusPref, locale, t, tConfig, toubeSessions, toubeMsgs] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("theme, telegram_chat_id, locale, nav_primary")
        .eq("id", userId)
        .maybeSingle()
        .then((r) => r.data),
      supabase
        .from("profiles")
        .select("full_name, display_name")
        .eq("id", userId)
        .maybeSingle()
        .then((r) => r.data),
      supabase
        .from("profiles")
        .select("write_pin_hash")
        .eq("id", userId)
        .maybeSingle()
        .then((r) => r.data),
      supabase
        .from("profiles")
        .select("focus_quest_enabled")
        .eq("id", userId)
        .maybeSingle()
        .then((r) => r.data),
      getLocale(),
      getTranslations("focoDoDia"),
      getTranslations("config"),
      supabase
        .from("toube_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .then((r) => r.count ?? 0),
      supabase
        .from("toube_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .then((r) => r.count ?? 0),
    ]);

  const theme = profile?.theme ?? DEFAULT_THEME;
  const hasWriteCode = !!writePin?.write_pin_hash;
  const focusEnabled = focusPref?.focus_quest_enabled ?? false;
  const cookieStore = await cookies();
  const trustedDevice = await verifyTrustedDevice(cookieStore.get(TRUSTED_COOKIE)?.value, userId);

  let i = 0;
  const idx = () => ++i;

  const TABS = [
    { id: "geral", label: "Geral", icon: User },
    { id: "aparencia", label: "Aparência", icon: Palette },
    { id: "audio", label: "Áudio", icon: AudioLines },
    { id: "seguranca", label: "Segurança", icon: ShieldCheck },
    { id: "avancado", label: "Avançado", icon: Settings },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <Reveal>
        <GradientHeader
          icon={Settings}
          eyebrow="Preferências · App"
          title="Configurações"
          subtitle="Personalize o app do seu jeito."
          watermark
        />
      </Reveal>

      <div className="mt-8 flex flex-col items-start gap-8 md:flex-row">
        <aside className="w-full shrink-0 md:sticky md:top-24 md:w-56">
          <nav className="flex gap-2 overflow-x-auto pb-4 md:flex-col md:overflow-x-visible md:pb-0 hide-scrollbar">
            {TABS.map((tab) => {
              const active = currentTab === tab.id;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.id}
                  href={`/config?tab=${tab.id}`}
                  className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors md:shrink ${
                    active
                      ? "bg-[var(--color-accent)] text-[var(--color-bg)]"
                      : "text-[var(--color-fg-muted)] hover:bg-[var(--color-card)] hover:text-[var(--color-fg)]"
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="grid items-start gap-4 md:grid-cols-2">
            {currentTab === "geral" && (
              <>
                <Reveal className="min-w-0" delay={0 * STAGGER_MS}>
                  <FoldCard index={idx()} className="min-w-0">
                    <CardHead icon={User} title="Perfil" />
                    <p className="mb-4 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                      Altere as informações públicas da sua conta.
                    </p>
                    <ProfileSection
                      fullName={names?.full_name ?? ""}
                      displayName={names?.display_name ?? ""}
                      email={claims?.email ?? ""}
                    />
                  </FoldCard>
                </Reveal>

                <div className="grid gap-4 min-w-0">
                  <Reveal className="min-w-0" delay={1 * STAGGER_MS}>
                    <FoldCard index={idx()} className="min-w-0">
                      <CardHead icon={Target} title={t("configTitle")} />
                      <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                        {t("configDesc")}
                      </p>
                      <FocusQuestToggle initial={focusEnabled} />
                    </FoldCard>
                  </Reveal>

                  <Reveal className="min-w-0" delay={2 * STAGGER_MS}>
                    <FoldCard index={idx()} className="min-w-0">
                      <CardHead icon={Languages} title="Idioma" />
                      <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                        Idioma da interface.
                      </p>
                      <LocaleSwitcher currentLocale={locale} />
                    </FoldCard>
                  </Reveal>
                </div>
              </>
            )}

            {currentTab === "aparencia" && (
              <>
                <Reveal className="min-w-0" delay={0 * STAGGER_MS}>
                  <FoldCard index={idx()} className="min-w-0">
                    <CardHead icon={Palette} title="Tema visual" />
                    <h3
                      className="mb-2 text-sm font-semibold"
                      style={{ color: "var(--color-fg-muted)" }}
                    >
                      Qualidade visual
                    </h3>
                    <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                      Nível de efeitos visuais e animações.
                    </p>
                    <QualityPicker />
                    <div className="mt-6">
                      <h3
                        className="mb-2 font-semibold text-sm"
                        style={{ color: "var(--color-fg-muted)" }}
                      >
                        {tConfig("navBar.title")}
                      </h3>
                      <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                        {tConfig("navBar.description")}
                      </p>
                      <NavCustomizer current={profile?.nav_primary ?? null} />
                    </div>
                    <div className="mt-6">
                      <h3
                        className="mb-2 text-sm font-semibold"
                        style={{ color: "var(--color-fg-muted)" }}
                      >
                        Tema
                      </h3>
                      <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                        Escolha as cores da interface.
                      </p>
                      <ThemePicker currentTheme={theme} />
                    </div>
                    <div className="mt-6">
                      <h3
                        className="mb-3 text-sm font-semibold"
                        style={{ color: "var(--color-fg-muted)" }}
                      >
                        Céu de estrelas
                      </h3>
                      <StarsToggle />
                    </div>
                  </FoldCard>
                </Reveal>

                <Reveal className="min-w-0" delay={1 * STAGGER_MS}>
                  <FoldCard index={idx()} className="min-w-0">
                    <CardHead icon={Music} title="Fita rítmica" />
                    <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                      Rastro musical interativo no cursor.
                    </p>
                    <CursorToggle />
                    <div className="mt-6">
                      <h3
                        className="mb-3 text-sm font-semibold"
                        style={{ color: "var(--color-fg-muted)" }}
                      >
                        Tamanho
                      </h3>
                      <TrailSizePicker />
                    </div>
                    <div className="mt-6">
                      <h3
                        className="mb-3 text-sm font-semibold"
                        style={{ color: "var(--color-fg-muted)" }}
                      >
                        Cor da fita
                      </h3>
                      <TrailColorPicker />
                    </div>
                  </FoldCard>
                </Reveal>
              </>
            )}

            {currentTab === "audio" && (
              <div className="grid gap-4 min-w-0" style={{ gridColumn: "1 / -1" }}>
                <Reveal className="min-w-0" delay={0 * STAGGER_MS}>
                  <FoldCard index={idx()} className="min-w-0">
                    <CardHead icon={AudioLines} title="Som de fundo" />
                    <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                      Atmosferas sonoras para guiar seu foco.
                    </p>
                    <SoundscapePicker />
                  </FoldCard>
                </Reveal>

                <Reveal className="min-w-0" delay={1 * STAGGER_MS}>
                  <FoldCard index={idx()} className="min-w-0">
                    <CardHead icon={Volume2} title="Voz do Toube" />
                    <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                      A voz que lê as respostas do assistente — toca a amostra e escolhe.
                    </p>
                    <ToubeVoicePicker />
                  </FoldCard>
                </Reveal>

                <div className="min-w-0">
                  <SoundCredits />
                </div>
              </div>
            )}

            {currentTab === "seguranca" && (
              <>
                <Reveal className="min-w-0" delay={0 * STAGGER_MS}>
                  <FoldCard index={idx()} className="min-w-0">
                    <CardHead icon={Lock} title="Diário privado" />
                    <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
                      Gerencie seu modo privado, PIN e criptografia dentro do{" "}
                      <Link href="/diario" className="underline">
                        próprio diário
                      </Link>
                      .
                    </p>
                  </FoldCard>
                </Reveal>

                <Reveal className="min-w-0" delay={1 * STAGGER_MS}>
                  <FoldCard index={idx()} className="min-w-0">
                    <CardHead icon={KeyRound} title="Código de acesso" />
                    <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                      Autorize este dispositivo para edição de recursos restritos.
                    </p>
                    <AccessCodeForm hasCode={hasWriteCode} trusted={trustedDevice} />
                  </FoldCard>
                </Reveal>

                <Reveal className="min-w-0" delay={2 * STAGGER_MS}>
                  <FoldCard index={idx()} className="min-w-0">
                    <CardHead icon={ShieldCheck} title="Conta" />
                    <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
                      Logado como <strong>{claims?.email}</strong>
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={signOutAction}>
                        <button
                          type="submit"
                          className="rounded-lg border px-4 py-1.5 text-sm hover:opacity-80"
                          style={{
                            borderColor: "var(--color-border)",
                            color: "var(--color-fg-muted)",
                          }}
                        >
                          Sair
                        </button>
                      </form>
                      <DeleteAccountButton />
                    </div>
                  </FoldCard>
                </Reveal>
              </>
            )}

            {currentTab === "avancado" && (
              <>
                <Reveal className="min-w-0" delay={0 * STAGGER_MS}>
                  <FoldCard index={idx()} className="min-w-0">
                    <CardHead icon={Send} title="Telegram" />
                    <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                      Receba lembretes da sua rotina.
                    </p>
                    <TelegramSection chatId={profile?.telegram_chat_id ?? null} />
                  </FoldCard>
                </Reveal>

                <Reveal className="min-w-0" delay={1 * STAGGER_MS}>
                  <FoldCard index={idx()} className="min-w-0">
                    <CardHead icon={ScrollText} title="Log Geral" />
                    <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                      Registro de eventos do sistema.
                    </p>
                    <LogGeral />
                  </FoldCard>
                </Reveal>

                <Reveal className="min-w-0" delay={2 * STAGGER_MS}>
                  <FoldCard index={idx()} className="min-w-0">
                    <CardHead icon={History} title={tConfig("histIa.title")} />
                    <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                      {tConfig("histIa.description")}
                    </p>
                    <ToubeHistoryManager sessions={toubeSessions} messages={toubeMsgs} />
                  </FoldCard>
                </Reveal>

                <Reveal className="min-w-0" delay={3 * STAGGER_MS}>
                  <FoldCard index={idx()} className="min-w-0">
                    <CardHead icon={RefreshCw} title={tConfig("forceUpdate.title")} />
                    <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                      {tConfig("forceUpdate.description")}
                    </p>
                    <ForceUpdate />
                  </FoldCard>
                </Reveal>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
