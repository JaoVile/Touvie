import { signOutAction } from "@/app/(auth)/login/actions";
import { Reveal } from "@/components/Reveal";
import { CardHead } from "@/components/glass/CardHead";
import { FoldCard } from "@/components/glass/FoldCard";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { TRUSTED_COOKIE, verifyTrustedDevice } from "@/lib/device";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_THEME } from "@/lib/themes";
import {
  AudioLines,
  KeyRound,
  Languages,
  Lock,
  Music,
  Palette,
  ScrollText,
  Send,
  Settings,
  ShieldCheck,
  Target,
  User,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { AccessCodeForm } from "./AccessCodeForm";
import { CursorToggle } from "./CursorToggle";
import { DeleteAccountButton } from "./DeleteAccountButton";
import { FocusQuestToggle } from "./FocusQuestToggle";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { LogGeral } from "./LogGeral";
import { ProfileSection } from "./ProfileSection";
import { QualityPicker } from "./QualityPicker";
import { SoundCredits } from "./SoundCredits";
import { SoundscapePicker } from "./SoundscapePicker";
import { StarsToggle } from "./StarsToggle";
import { TelegramSection } from "./TelegramSection";
import { ThemePicker } from "./ThemePicker";
import { TrailColorPicker } from "./TrailColorPicker";
import { TrailSizePicker } from "./TrailSizePicker";

export const dynamic = "force-dynamic";

/* Cascade delay between the stacked setting cards. */
const STAGGER_MS = 70;

export default async function ConfigPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [profile, names, writePin, focusPref, locale, t] = await Promise.all([
    supabase
      .from("profiles")
      .select("theme, telegram_chat_id, locale")
      .eq("id", user!.id)
      .maybeSingle()
      .then((r) => r.data),
    // Separate query so a missing 0013 migration degrades only the
    // profile names — not the theme / PIN / telegram config below.
    supabase
      .from("profiles")
      .select("full_name, display_name")
      .eq("id", user!.id)
      .maybeSingle()
      .then((r) => r.data),
    // Idem: a 0017 (write_pin_hash) pode não ter rodado ainda — isola pra
    // não derrubar o resto da config.
    supabase
      .from("profiles")
      .select("write_pin_hash")
      .eq("id", user!.id)
      .maybeSingle()
      .then((r) => r.data),
    // Foco do dia — isolado: 0025 pode não ter rodado.
    supabase
      .from("profiles")
      .select("focus_quest_enabled")
      .eq("id", user!.id)
      .maybeSingle()
      .then((r) => r.data),
    getLocale(),
    getTranslations("focoDoDia"),
  ]);

  const theme = profile?.theme ?? DEFAULT_THEME;
  const hasWriteCode = !!writePin?.write_pin_hash;
  const focusEnabled = focusPref?.focus_quest_enabled ?? false;
  const cookieStore = await cookies();
  const trustedDevice = await verifyTrustedDevice(cookieStore.get(TRUSTED_COOKIE)?.value, user!.id);

  // Index drives both the editorial corner figure and the reveal stagger.
  let i = 0;
  const idx = () => ++i;

  return (
    <>
      {/* Container largo o suficiente p/ os cards ladearem em 2 colunas no desktop
          (preenche a tela em vez de uma coluna solitária), mas centralizado e não
          esticado até a borda. ~1024px. */}
      <div className="mx-auto w-full max-w-5xl">
        <Reveal>
          <GradientHeader
            icon={Settings}
            eyebrow="Preferências · App"
            title="Configurações"
            subtitle="Personalize o app do seu jeito."
            watermark
          />
        </Reveal>

        {/* items-start: cada card tem a própria altura (não estica p/ igualar o par). */}
        <div className="grid items-start gap-4 md:grid-cols-2">
          <Reveal delay={0 * STAGGER_MS}>
            <FoldCard index={idx()}>
              <CardHead icon={User} title="Perfil" />
              <p className="mb-4 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                Seu nome, o apelido que aparece no dashboard, e os dados de acesso.
              </p>
              <ProfileSection
                fullName={names?.full_name ?? ""}
                displayName={names?.display_name ?? ""}
                email={user?.email ?? ""}
              />
            </FoldCard>
          </Reveal>

          <Reveal delay={1 * STAGGER_MS}>
            <FoldCard index={idx()}>
              <CardHead icon={Palette} title="Tema visual" />
              <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--color-fg-muted)" }}>
                Qualidade visual
              </h3>
              <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                Controle mestre dos efeitos. Na 1ª vez é escolhido automaticamente pelo seu
                dispositivo; sua escolha aqui fica salva. <strong>Desempenho</strong> deixa o app
                bem mais fluido em máquinas modestas.
              </p>
              <QualityPicker />
              <div className="mt-6">
                <h3
                  className="mb-2 text-sm font-semibold"
                  style={{ color: "var(--color-fg-muted)" }}
                >
                  Tema
                </h3>
                <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                  Troca o visual do app. Mais presets podem ser adicionados criando arquivos em{" "}
                  <code>app/themes/</code>.
                </p>
                <ThemePicker currentTheme={theme} />
              </div>
              <div className="mt-6">
                <h3
                  className="mb-3 text-sm font-semibold"
                  style={{ color: "var(--color-fg-muted)" }}
                >
                  Céu de estrelas{" "}
                  <span style={{ color: "var(--color-fg-subtle)" }}>· só em Completo</span>
                </h3>
                <StarsToggle />
              </div>
            </FoldCard>
          </Reveal>

          <Reveal delay={2 * STAGGER_MS}>
            <FoldCard index={idx()}>
              <CardHead icon={Music} title="Fita rítmica" />
              <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                Rastro de pauta musical que segue o cursor (ativo só na qualidade{" "}
                <strong>Completo</strong>). Desligue aqui se preferir um cursor comum.
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

          <Reveal delay={3 * STAGGER_MS}>
            <FoldCard index={idx()}>
              <CardHead icon={AudioLines} title="Som de fundo" />
              <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                Atmosferas que tocam enquanto você usa o app — uma camada de frequência que guia o
                estado mental, com texturas reais por cima. Se deixar ligado, volta ligado.
              </p>
              <SoundscapePicker />
            </FoldCard>
          </Reveal>

          <SoundCredits />

          <Reveal delay={3 * STAGGER_MS}>
            <FoldCard index={idx()}>
              <CardHead icon={Lock} title="Diário privado" />
              <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
                A privacidade do diário mora dentro do próprio{" "}
                <Link href="/diario" className="underline">
                  diário
                </Link>
                : lá você ativa o modo privado, troca o PIN ou desliga. Quando ativo, as anotações
                são cifradas no seu aparelho antes de sair dele — nem o servidor consegue lê-las.
              </p>
            </FoldCard>
          </Reveal>

          <Reveal delay={4 * STAGGER_MS}>
            <FoldCard index={idx()}>
              <CardHead icon={KeyRound} title="Código de acesso" />
              <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                Libera recursos de edição restritos neste dispositivo. Defina um código de 4 a 8
                dígitos e digite-o em cada aparelho que você quiser autorizar.
              </p>
              <AccessCodeForm hasCode={hasWriteCode} trusted={trustedDevice} />
            </FoldCard>
          </Reveal>

          <Reveal delay={5 * STAGGER_MS}>
            <FoldCard index={idx()}>
              <CardHead icon={Send} title="Telegram" />
              <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                Lembretes às 08:00 e 20:00 (BRT). Crons rodam só em produção (Vercel).
              </p>
              <TelegramSection chatId={profile?.telegram_chat_id ?? null} />
            </FoldCard>
          </Reveal>

          <Reveal delay={6 * STAGGER_MS}>
            <FoldCard index={idx()}>
              <CardHead icon={ScrollText} title="Log Geral" />
              <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                Últimos 100 eventos do sistema — crons, webhooks e APIs.
              </p>
              <LogGeral />
            </FoldCard>
          </Reveal>

          <Reveal delay={7 * STAGGER_MS}>
            <FoldCard index={idx()}>
              <CardHead icon={Languages} title="Idioma" />
              <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                Escolha o idioma da interface.
              </p>
              <LocaleSwitcher currentLocale={locale} />
            </FoldCard>
          </Reveal>

          <Reveal delay={8 * STAGGER_MS}>
            <FoldCard index={idx()}>
              <CardHead icon={Target} title={t("configTitle")} />
              <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
                {t("configDesc")}
              </p>
              <FocusQuestToggle initial={focusEnabled} />
            </FoldCard>
          </Reveal>

          <Reveal delay={9 * STAGGER_MS}>
            <FoldCard index={idx()}>
              <CardHead icon={ShieldCheck} title="Conta" />
              <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
                Logado como <strong>{user?.email}</strong>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="rounded-lg border px-4 py-1.5 text-sm hover:opacity-80"
                    style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
                  >
                    Sair
                  </button>
                </form>
                <DeleteAccountButton />
              </div>
            </FoldCard>
          </Reveal>
        </div>
      </div>
    </>
  );
}
