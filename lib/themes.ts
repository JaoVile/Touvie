export type ThemeId = "glass-purple" | "dark-minimal" | "notion-clean";

export const THEMES: Array<{
  id: ThemeId;
  name: string;
  description: string;
  mode: "dark" | "light";
}> = [
  {
    id: "glass-purple",
    name: "Glass Purple",
    description: "Gradiente roxo→rosa com cards translúcidos (glassmorphism).",
    mode: "dark",
  },
  {
    id: "dark-minimal",
    name: "Dark Minimal",
    description: "Fundo preto, acento verde, tipografia limpa estilo Linear.",
    mode: "dark",
  },
  {
    id: "notion-clean",
    name: "Notion Clean",
    description: "Fundo claro, serifada, foco em conteúdo — estilo Notion.",
    mode: "light",
  },
];

export const DEFAULT_THEME: ThemeId = "glass-purple";

export function isValidTheme(x: unknown): x is ThemeId {
  return typeof x === "string" && THEMES.some((t) => t.id === x);
}
