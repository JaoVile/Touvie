// Helpers de dieta: macros, tipos de refeição e seed da tabela TACO (PT-BR).

export type MealType = "breakfast" | "lunch" | "snack" | "dinner" | "pre" | "post" | "other";

export const MEAL_TYPE_ORDER: MealType[] = [
  "breakfast",
  "snack",
  "lunch",
  "pre",
  "post",
  "dinner",
  "other",
];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Café da manhã",
  lunch: "Almoço",
  snack: "Lanche",
  dinner: "Jantar",
  pre: "Pré-treino",
  post: "Pós-treino",
  other: "Outro",
};

export interface Macros {
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
}

export const ZERO_MACROS: Macros = { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0, fiber_g: 0 };

// Macros calculados a partir do peso em gramas e do alimento (per-100g).
export function macrosFor(
  food: {
    kcal_per_100g: number;
    protein_g: number;
    carb_g: number;
    fat_g: number;
    fiber_g: number;
  },
  grams: number,
): Macros {
  const k = grams / 100;
  return {
    kcal: round1(food.kcal_per_100g * k),
    protein_g: round1(food.protein_g * k),
    carb_g: round1(food.carb_g * k),
    fat_g: round1(food.fat_g * k),
    fiber_g: round1(food.fiber_g * k),
  };
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein_g: acc.protein_g + m.protein_g,
      carb_g: acc.carb_g + m.carb_g,
      fat_g: acc.fat_g + m.fat_g,
      fiber_g: acc.fiber_g + m.fiber_g,
    }),
    ZERO_MACROS,
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function formatGrams(g: number): string {
  if (g === 0) return "0 g";
  if (g < 10) return `${g.toFixed(1)} g`;
  return `${Math.round(g)} g`;
}

// kcal por grama de cada macro (Atwater)
export const KCAL_PER_GRAM = { protein: 4, carb: 4, fat: 9 } as const;

// Percentual de kcal vindo de cada macro
export function macroPercents(m: Macros) {
  const fromP = m.protein_g * KCAL_PER_GRAM.protein;
  const fromC = m.carb_g * KCAL_PER_GRAM.carb;
  const fromF = m.fat_g * KCAL_PER_GRAM.fat;
  const total = fromP + fromC + fromF;
  if (total === 0) return { protein: 0, carb: 0, fat: 0 };
  return {
    protein: Math.round((fromP / total) * 100),
    carb: Math.round((fromC / total) * 100),
    fat: Math.round((fromF / total) * 100),
  };
}

// ---------------------------------------------------------------
// SEED TACO — subset curado de alimentos comuns no Brasil (per 100g cozido).
// Valores aproximados baseados na Tabela Brasileira de Composição de Alimentos
// (TACO/Unicamp). Não é tabela completa — usa essa pra começar e ajusta no
// catálogo depois.
// ---------------------------------------------------------------
export interface SeedFood {
  name: string;
  kcal_per_100g: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
  serving_g?: number;
}

export const TACO_SEED: SeedFood[] = [
  // Cereais e tubérculos
  {
    name: "Arroz branco cozido",
    kcal_per_100g: 128,
    protein_g: 2.5,
    carb_g: 28.1,
    fat_g: 0.2,
    fiber_g: 1.6,
    serving_g: 100,
  },
  {
    name: "Arroz integral cozido",
    kcal_per_100g: 124,
    protein_g: 2.6,
    carb_g: 25.8,
    fat_g: 1.0,
    fiber_g: 2.7,
    serving_g: 100,
  },
  {
    name: "Aveia em flocos crua",
    kcal_per_100g: 394,
    protein_g: 13.9,
    carb_g: 66.6,
    fat_g: 8.5,
    fiber_g: 9.1,
    serving_g: 30,
  },
  {
    name: "Pão francês",
    kcal_per_100g: 300,
    protein_g: 8.0,
    carb_g: 58.6,
    fat_g: 3.1,
    fiber_g: 2.3,
    serving_g: 50,
  },
  {
    name: "Pão integral",
    kcal_per_100g: 253,
    protein_g: 9.4,
    carb_g: 49.9,
    fat_g: 3.0,
    fiber_g: 6.9,
    serving_g: 50,
  },
  {
    name: "Tapioca",
    kcal_per_100g: 240,
    protein_g: 0.2,
    carb_g: 59.0,
    fat_g: 0.1,
    fiber_g: 0.0,
    serving_g: 60,
  },
  {
    name: "Batata doce cozida",
    kcal_per_100g: 77,
    protein_g: 0.6,
    carb_g: 18.4,
    fat_g: 0.1,
    fiber_g: 2.2,
    serving_g: 150,
  },
  {
    name: "Batata inglesa cozida",
    kcal_per_100g: 52,
    protein_g: 1.2,
    carb_g: 11.9,
    fat_g: 0.0,
    fiber_g: 1.3,
    serving_g: 150,
  },
  {
    name: "Mandioca cozida",
    kcal_per_100g: 125,
    protein_g: 0.6,
    carb_g: 30.1,
    fat_g: 0.3,
    fiber_g: 1.6,
    serving_g: 100,
  },

  // Leguminosas
  {
    name: "Feijão preto cozido",
    kcal_per_100g: 77,
    protein_g: 4.5,
    carb_g: 14.0,
    fat_g: 0.5,
    fiber_g: 8.4,
    serving_g: 100,
  },
  {
    name: "Feijão carioca cozido",
    kcal_per_100g: 76,
    protein_g: 4.8,
    carb_g: 13.6,
    fat_g: 0.5,
    fiber_g: 8.5,
    serving_g: 100,
  },
  {
    name: "Lentilha cozida",
    kcal_per_100g: 93,
    protein_g: 6.3,
    carb_g: 16.3,
    fat_g: 0.5,
    fiber_g: 7.9,
    serving_g: 100,
  },
  {
    name: "Grão de bico cozido",
    kcal_per_100g: 121,
    protein_g: 8.4,
    carb_g: 17.8,
    fat_g: 2.1,
    fiber_g: 7.6,
    serving_g: 100,
  },

  // Proteínas
  {
    name: "Peito de frango grelhado",
    kcal_per_100g: 159,
    protein_g: 32.0,
    carb_g: 0.0,
    fat_g: 3.5,
    fiber_g: 0.0,
    serving_g: 150,
  },
  {
    name: "Coxa de frango assada",
    kcal_per_100g: 215,
    protein_g: 26.0,
    carb_g: 0.0,
    fat_g: 11.6,
    fiber_g: 0.0,
    serving_g: 150,
  },
  {
    name: "Patinho cozido",
    kcal_per_100g: 219,
    protein_g: 35.9,
    carb_g: 0.0,
    fat_g: 7.3,
    fiber_g: 0.0,
    serving_g: 150,
  },
  {
    name: "Carne moída magra cozida",
    kcal_per_100g: 220,
    protein_g: 24.0,
    carb_g: 0.0,
    fat_g: 13.0,
    fiber_g: 0.0,
    serving_g: 100,
  },
  {
    name: "Tilápia grelhada",
    kcal_per_100g: 128,
    protein_g: 26.0,
    carb_g: 0.0,
    fat_g: 2.7,
    fiber_g: 0.0,
    serving_g: 150,
  },
  {
    name: "Salmão grelhado",
    kcal_per_100g: 208,
    protein_g: 22.1,
    carb_g: 0.0,
    fat_g: 12.3,
    fiber_g: 0.0,
    serving_g: 120,
  },
  {
    name: "Atum em água (lata)",
    kcal_per_100g: 116,
    protein_g: 26.5,
    carb_g: 0.0,
    fat_g: 0.8,
    fiber_g: 0.0,
    serving_g: 80,
  },
  {
    name: "Ovo de galinha cozido",
    kcal_per_100g: 143,
    protein_g: 13.0,
    carb_g: 1.1,
    fat_g: 9.5,
    fiber_g: 0.0,
    serving_g: 50,
  },

  // Laticínios
  {
    name: "Leite integral",
    kcal_per_100g: 61,
    protein_g: 3.2,
    carb_g: 4.7,
    fat_g: 3.3,
    fiber_g: 0.0,
    serving_g: 200,
  },
  {
    name: "Leite desnatado",
    kcal_per_100g: 35,
    protein_g: 3.4,
    carb_g: 4.9,
    fat_g: 0.2,
    fiber_g: 0.0,
    serving_g: 200,
  },
  {
    name: "Iogurte natural integral",
    kcal_per_100g: 51,
    protein_g: 4.1,
    carb_g: 1.9,
    fat_g: 3.0,
    fiber_g: 0.0,
    serving_g: 170,
  },
  {
    name: "Whey protein (média)",
    kcal_per_100g: 400,
    protein_g: 80.0,
    carb_g: 10.0,
    fat_g: 5.0,
    fiber_g: 0.0,
    serving_g: 30,
  },
  {
    name: "Queijo minas frescal",
    kcal_per_100g: 264,
    protein_g: 17.4,
    carb_g: 3.2,
    fat_g: 20.2,
    fiber_g: 0.0,
    serving_g: 30,
  },
  {
    name: "Requeijão cremoso",
    kcal_per_100g: 257,
    protein_g: 9.6,
    carb_g: 3.0,
    fat_g: 23.0,
    fiber_g: 0.0,
    serving_g: 20,
  },

  // Frutas
  {
    name: "Banana prata",
    kcal_per_100g: 89,
    protein_g: 1.3,
    carb_g: 23.8,
    fat_g: 0.1,
    fiber_g: 2.0,
    serving_g: 100,
  },
  {
    name: "Maçã com casca",
    kcal_per_100g: 56,
    protein_g: 0.3,
    carb_g: 15.2,
    fat_g: 0.4,
    fiber_g: 1.3,
    serving_g: 130,
  },
  {
    name: "Mamão papaya",
    kcal_per_100g: 40,
    protein_g: 0.5,
    carb_g: 10.4,
    fat_g: 0.1,
    fiber_g: 1.8,
    serving_g: 150,
  },
  {
    name: "Morango",
    kcal_per_100g: 30,
    protein_g: 0.9,
    carb_g: 6.8,
    fat_g: 0.3,
    fiber_g: 1.7,
    serving_g: 100,
  },
  {
    name: "Abacate",
    kcal_per_100g: 96,
    protein_g: 1.2,
    carb_g: 6.0,
    fat_g: 8.4,
    fiber_g: 6.3,
    serving_g: 100,
  },

  // Vegetais
  {
    name: "Brócolis cozido",
    kcal_per_100g: 25,
    protein_g: 2.1,
    carb_g: 4.4,
    fat_g: 0.3,
    fiber_g: 3.4,
    serving_g: 100,
  },
  {
    name: "Couve-flor cozida",
    kcal_per_100g: 23,
    protein_g: 1.9,
    carb_g: 4.1,
    fat_g: 0.3,
    fiber_g: 2.0,
    serving_g: 100,
  },
  {
    name: "Cenoura cozida",
    kcal_per_100g: 30,
    protein_g: 0.8,
    carb_g: 6.7,
    fat_g: 0.2,
    fiber_g: 2.6,
    serving_g: 100,
  },

  // Gorduras / oleaginosas
  {
    name: "Azeite de oliva",
    kcal_per_100g: 884,
    protein_g: 0.0,
    carb_g: 0.0,
    fat_g: 100.0,
    fiber_g: 0.0,
    serving_g: 10,
  },
  {
    name: "Castanha do Pará",
    kcal_per_100g: 643,
    protein_g: 14.5,
    carb_g: 15.1,
    fat_g: 63.5,
    fiber_g: 7.9,
    serving_g: 15,
  },
  {
    name: "Amendoim torrado",
    kcal_per_100g: 544,
    protein_g: 22.5,
    carb_g: 20.3,
    fat_g: 43.9,
    fiber_g: 8.0,
    serving_g: 30,
  },
  {
    name: "Pasta de amendoim integral",
    kcal_per_100g: 588,
    protein_g: 24.0,
    carb_g: 16.0,
    fat_g: 50.0,
    fiber_g: 6.0,
    serving_g: 20,
  },
];
