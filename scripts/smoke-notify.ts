// Smoke manual: node --env-file=.env.local --import ./scripts/dev-alias.mjs scripts/smoke-notify.ts
//
// Verifica o LEQUE: com quais preferências a notificação sai por qual canal.
// Não depende de push nem de Telegram reais — o usuário de teste não tem
// assinatura nem chat vinculado, então o esperado é sempre "nada saiu"; o que
// se prova é que a decisão foi tomada certo e que "sem destino" vira log.
import { notifyUser } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";

const admin = createAdminClient();

const fail = (msg: string): never => {
  console.error(`FALHOU: ${msg}`);
  process.exit(1);
};

const { data: users, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
if (listErr) fail(`listUsers: ${listErr.message}`);
const u = users?.users.find((x) => x.email === "teste@touvie.app");
if (!u) fail("usuário de teste teste@touvie.app não existe");

const { data: original, error: origErr } = await admin
  .from("profiles")
  .select("notify_push, notify_telegram")
  .eq("id", u!.id)
  .single();
if (origErr || !original) fail(`leitura das preferências originais: ${origErr?.message}`);

async function comPrefs(push: boolean, telegram: boolean) {
  const { error } = await admin
    .from("profiles")
    .update({ notify_push: push, notify_telegram: telegram })
    .eq("id", u!.id);
  if (error) fail(`update prefs (push=${push}, telegram=${telegram}): ${error.message}`);
  return notifyUser(admin, u!.id, { text: "smoke", url: "/" });
}

async function restaurar() {
  await admin
    .from("profiles")
    .update({
      notify_push: original!.notify_push,
      notify_telegram: original!.notify_telegram,
    })
    .eq("id", u!.id);
}

let falhas = 0;
try {
  for (const [push, telegram] of [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ] as const) {
    const r = await comPrefs(push, telegram);
    const ok = r.push === 0 && r.telegram === false; // sem assinatura e sem chat_id
    if (!ok) falhas++;
    console.log(`push=${push} telegram=${telegram} → ${JSON.stringify(r)} ${ok ? "✓" : "✗"}`);
  }
} finally {
  // Restaura o estado original — inclusive se algo acima falhar/lançar —
  // senão o próximo teste herda a preferência.
  await restaurar();
}

console.log(falhas === 0 ? "\nOK: leque decidiu certo nos 4 casos." : `\nFALHOU: ${falhas}`);
process.exit(falhas === 0 ? 0 : 1);
