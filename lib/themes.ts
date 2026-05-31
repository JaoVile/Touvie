export type ThemeId = "royal" | "glass-purple" | "dark-minimal" | "personalize";

/** The build-your-own theme: a neutral base the user repaints token by token. */
export const PERSONALIZE_THEME: ThemeId = "personalize";

export const THEMES: Array<{
  id: ThemeId;
  name: string;
  description: string;
  mode: "dark" | "light";
}> = [
  {
    id: "royal",
    name: "Royal Navy",
    description: "Azul marinho profundo com detalhes dourados — divino, editorial.",
    mode: "dark",
  },
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
    id: "personalize",
    name: "Personalizar",
    description: "Crie o seu — base clara bonita, e ajuste cada cor do app.",
    mode: "light",
  },
];

export const DEFAULT_THEME: ThemeId = "royal";

export function isValidTheme(x: unknown): x is ThemeId {
  return typeof x === "string" && THEMES.some((t) => t.id === x);
}
