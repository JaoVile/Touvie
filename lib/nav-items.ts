import {
  Bell,
  BookOpen,
  CalendarDays,
  Dumbbell,
  House,
  Lock,
  type LucideIcon,
  Salad,
  Settings,
  Sparkles,
  StickyNote,
  Target,
  Wallet,
} from "lucide-react";

/**
 * Fonte da verdade dos módulos do app.
 *
 * Vive aqui — e não dentro do `Nav.tsx` — porque o seletor da barra
 * (`config/NavCustomizer.tsx`) precisa da MESMA lista. Duas listas separadas
 * divergem no dia em que alguém adiciona um módulo e esquece a outra.
 *
 * `labelKey` é a chave dentro do namespace `nav` das mensagens.
 */
export type NavItemDef = { href: string; labelKey: string; Icon: LucideIcon };

/** Quantos módulos cabem na barra inferior do celular. */
export const NAV_PRIMARY_SLOTS = 4;

/** `/config` mora fora da lista: é fixo na barra, então não é escolhível. */
export const NAV_CONFIG: NavItemDef = { href: "/config", labelKey: "config", Icon: Settings };

/** Os 11 módulos que a pessoa pode pôr na barra de baixo. */
export const NAV_ITEMS: NavItemDef[] = [
  { href: "/", labelKey: "today", Icon: House },
  { href: "/financas", labelKey: "finances", Icon: Wallet },
  { href: "/treino", labelKey: "training", Icon: Dumbbell },
  { href: "/dieta", labelKey: "diet", Icon: Salad },
  { href: "/toube", labelKey: "toube", Icon: Sparkles },
  { href: "/rotina", labelKey: "routine", Icon: CalendarDays },
  { href: "/metas", labelKey: "goals", Icon: Target },
  { href: "/diario", labelKey: "diary", Icon: Lock },
  { href: "/notas", labelKey: "notes", Icon: StickyNote },
  { href: "/leitura", labelKey: "reading", Icon: BookOpen },
  { href: "/notificacoes", labelKey: "notifications", Icon: Bell },
];

/** Os 4 de sempre — default do banco e rede de segurança do runtime. */
export const NAV_PRIMARY_DEFAULT = ["/", "/financas", "/treino", "/dieta"];

const KNOWN = new Set(NAV_ITEMS.map((i) => i.href));

/**
 * Sanitiza a preferência vinda do banco. Preferência corrompida (módulo que não
 * existe mais, tamanho errado, repetida) não pode virar barra quebrada — cai no
 * padrão, que sempre funciona.
 */
export function resolvePrimary(pref: string[] | null | undefined): string[] {
  if (!pref || pref.length !== NAV_PRIMARY_SLOTS) return NAV_PRIMARY_DEFAULT;
  const unique = [...new Set(pref)];
  if (unique.length !== NAV_PRIMARY_SLOTS) return NAV_PRIMARY_DEFAULT;
  if (!unique.every((h) => KNOWN.has(h))) return NAV_PRIMARY_DEFAULT;
  return unique;
}

/** Valida o que veio do cliente antes de gravar. */
export function isValidPrimary(pref: unknown): pref is string[] {
  if (!Array.isArray(pref) || pref.length !== NAV_PRIMARY_SLOTS) return false;
  if (!pref.every((h) => typeof h === "string" && KNOWN.has(h))) return false;
  return new Set(pref).size === NAV_PRIMARY_SLOTS;
}
