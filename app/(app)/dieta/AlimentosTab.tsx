import { GlassCard } from "@/components/glass/GlassCard";
import { createClient } from "@/lib/supabase/server";
import { FoodForm } from "./FoodForm";
import { FoodRow } from "./FoodRow";
import { SeedTacoButton } from "./SeedTacoButton";

interface Props {
  userId: string;
}

interface Food {
  id: string;
  name: string;
  kcal_per_100g: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
  serving_g: number | null;
}

export async function AlimentosTab({ userId }: Props) {
  const supabase = await createClient();

  const { data: foodsData } = await supabase
    .from("foods")
    .select("id, name, kcal_per_100g, protein_g, carb_g, fat_g, fiber_g, serving_g")
    .eq("user_id", userId)
    .order("name");
  const foods = (foodsData ?? []) as Food[];

  return (
    <div className="grid gap-4">
      <GlassCard>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">📋 Catálogo</h2>
          {foods.length === 0 ? <SeedTacoButton /> : null}
        </div>
        <p className="mb-3 text-xs" style={{ color: "var(--color-fg-muted)" }}>
          Valores por <strong>100g</strong>. Se um alimento não tiver fibra, deixa 0. Edite via DB
          se precisar de mais detalhe — schema é simples.
        </p>

        {foods.length === 0 ? (
          <p className="text-xs italic" style={{ color: "var(--color-fg-subtle)" }}>
            Catálogo vazio. Use "Carregar TACO" pra trazer ~38 alimentos comuns em PT-BR (cereais,
            leguminosas, proteínas, frutas, vegetais, gorduras), ou cadastre o seu abaixo.
          </p>
        ) : (
          <ul className="space-y-1">
            {foods.map((f) => (
              <FoodRow key={f.id} food={f} />
            ))}
          </ul>
        )}
      </GlassCard>

      <GlassCard>
        <h2 className="mb-3 text-sm font-semibold">+ Novo alimento</h2>
        <FoodForm />
      </GlassCard>
    </div>
  );
}
