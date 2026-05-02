import { signOutAction } from "@/app/(auth)/login/actions";
import { GlassCard } from "@/components/glass/GlassCard";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_THEME } from "@/lib/themes";
import { getLocale } from "next-intl/server";
import Link from "next/link";
import { DeleteAccountButton } from "./DeleteAccountButton";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { LogGeral } from "./LogGeral";
import { PinChangeForm } from "./PinChangeForm";
import { TelegramSection } from "./TelegramSection";
import { ThemePicker } from "./ThemePicker";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [profile, locale] = await Promise.all([
    supabase
      .from("profiles")
      .select("theme, telegram_chat_id, pin_hash, locale")
      .eq("id", user!.id)
      .maybeSingle()
      .then((r) => r.data),
    getLocale(),
  ]);

  const theme = profile?.theme ?? DEFAULT_THEME;
  const hasPin = !!profile?.pin_hash;

  return (
    <>
      <GradientHeader emoji="⚙️" title="Configurações" subtitle="Personalize o app do seu jeito." />
      <div className="grid gap-4">
        <GlassCard>
          <h2 className="mb-3 font-semibold">🎨 Tema visual</h2>
          <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
            Troca o visual do app. Mais presets podem ser adicionados criando arquivos em{" "}
            <code>app/themes/</code>.
          </p>
          <ThemePicker currentTheme={theme} />
        </GlassCard>

        <GlassCard>
          <h2 className="mb-3 font-semibold">🔒 PIN do Diário</h2>
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
        </GlassCard>

        <GlassCard>
          <h2 className="mb-3 font-semibold">💬 Telegram</h2>
          <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
            Lembretes às 08:00 e 20:00 (BRT). Crons rodam só em produção (Vercel).
          </p>
          <TelegramSection chatId={profile?.telegram_chat_id ?? null} />
        </GlassCard>

        <GlassCard>
          <h2 className="mb-3 font-semibold">📋 Log Geral</h2>
          <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
            Últimos 100 eventos do sistema — crons, webhooks e APIs.
          </p>
          <LogGeral />
        </GlassCard>

        <GlassCard>
          <h2 className="mb-3 font-semibold">🌐 Idioma</h2>
          <p className="mb-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
            Escolha o idioma da interface.
          </p>
          <LocaleSwitcher currentLocale={locale} />
        </GlassCard>

        <GlassCard>
          <h2 className="mb-3 font-semibold">🔐 Conta</h2>
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
        </GlassCard>
      </div>
    </>
  );
}
