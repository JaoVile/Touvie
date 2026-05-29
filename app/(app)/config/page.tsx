import { signOutAction } from "@/app/(auth)/login/actions";
import {
  Languages,
  Lock,
  Music,
  Palette,
  ScrollText,
  Send,
  Settings,
  ShieldCheck,
  User,
} from "lucide-react";
import { PageGlyphs } from "@/components/PageGlyphs";
import { Reveal } from "@/components/Reveal";
import { CardHead } from "@/components/glass/CardHead";
import { FoldCard } from "@/components/glass/FoldCard";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_THEME } from "@/lib/themes";
import { getLocale } from "next-intl/server";
import Link from "next/link";
import { DeleteAccountButton } from "./DeleteAccountButton";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { LogGeral } from "./LogGeral";
import { PinChangeForm } from "./PinChangeForm";
import { ProfileSection } from "./ProfileSection";
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
  const [profile, names, locale] = await Promise.all([
    supabase
      .from("profiles")
      .select("theme, telegram_chat_id, pin_hash, locale")
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
    getLocale(),
  ]);

  const theme = profile?.theme ?? DEFAULT_THEME;
  const hasPin = !!profile?.pin_hash;

  // Index drives both the editorial corner figure and the reveal stagger.
  let i = 0;
  const idx = () => ++i;

  return (
    <>
      <PageGlyphs variant="system" />

      <Reveal>
        <GradientHeader
          icon={Settings}
          eyebrow="Preferências · App"
          title="Configurações"
          subtitle="Personalize o app do seu jeito."
        />
      </Reveal>

      <div className="grid gap-4">
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
            <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
              Troca o visual do app. Mais presets podem ser adicionados criando arquivos em{" "}
              <code>app/themes/</code>.
            </p>
            <ThemePicker currentTheme={theme} />
          </FoldCard>
        </Reveal>

        <Reveal delay={2 * STAGGER_MS}>
          <FoldCard index={idx()}>
            <CardHead icon={Music} title="Fita rítmica" />
            <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
              Aumenta o rastro musical que segue o cursor — a fita e as notas
              ficam maiores.
            </p>
            <TrailSizePicker />
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--color-fg-muted)" }}>
                Cor da fita
              </h3>
              <TrailColorPicker />
            </div>
          </FoldCard>
        </Reveal>

        <Reveal delay={3 * STAGGER_MS}>
          <FoldCard index={idx()}>
            <CardHead icon={Lock} title="PIN do Diário" />
            {hasPin ? (
              <PinChangeForm />
            ) : (
              <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
                Você ainda não configurou um PIN. Vá em{" "}
                <Link href="/diario" className="underline">
                  /diario
                </Link>{" "}
                pra criar.
              </p>
            )}
          </FoldCard>
        </Reveal>

        <Reveal delay={4 * STAGGER_MS}>
          <FoldCard index={idx()}>
            <CardHead icon={Send} title="Telegram" />
            <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
              Lembretes às 08:00 e 20:00 (BRT). Crons rodam só em produção (Vercel).
            </p>
            <TelegramSection chatId={profile?.telegram_chat_id ?? null} />
          </FoldCard>
        </Reveal>

        <Reveal delay={5 * STAGGER_MS}>
          <FoldCard index={idx()}>
            <CardHead icon={ScrollText} title="Log Geral" />
            <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
              Últimos 100 eventos do sistema — crons, webhooks e APIs.
            </p>
            <LogGeral />
          </FoldCard>
        </Reveal>

        <Reveal delay={6 * STAGGER_MS}>
          <FoldCard index={idx()}>
            <CardHead icon={Languages} title="Idioma" />
            <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
              Escolha o idioma da interface.
            </p>
            <LocaleSwitcher currentLocale={locale} />
          </FoldCard>
        </Reveal>

        <Reveal delay={7 * STAGGER_MS}>
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
    </>
  );
}
