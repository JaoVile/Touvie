"use server";

import { TRUSTED_COOKIE, signTrustedDevice, trustedCookieOptions } from "@/lib/device";
import { hashPin, normalizeRecovery } from "@/lib/pin";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

const signupSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha tem no mínimo 6 caracteres"),
  fullName: z.string().trim().min(1, "Informe seu nome").max(80),
  // Palavra-chave de recuperação — normalizada (trim/minúsculas) antes do hash.
  recovery: z.string().trim().min(6, "Palavra-chave tem no mínimo 6 caracteres").max(120),
  trustDevice: z.boolean().default(true),
});

export async function signupAction(formData: FormData): Promise<{ error?: string } | never> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    recovery: formData.get("recovery"),
    trustDevice: formData.get("trustDevice") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const { email, password, fullName, recovery, trustDevice } = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error || !data.user) {
    return { error: error?.message ?? "Não foi possível criar a conta" };
  }

  // Sem confirmação de email, o signUp já devolve sessão e o usuário entra
  // direto. Se vier sem sessão, é porque "Confirm email" está LIGADO no
  // Supabase — avisamos pra checar o email (e o dono deve desligar isso).
  if (!data.session) {
    return {
      error:
        "Conta criada, mas é preciso confirmar o email antes de entrar. " +
        "Verifique sua caixa de entrada.",
    };
  }

  // O perfil é criado pelo trigger handle_new_user; aqui gravamos o nome e o
  // hash da palavra-chave de recuperação. display_name recebe o 1º nome como
  // padrão amigável pro dashboard (o usuário pode trocar em /config).
  const firstName = fullName.split(/\s+/)[0] ?? fullName;
  const recoveryHash = await hashPin(normalizeRecovery(recovery));
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({ full_name: fullName, display_name: firstName, recovery_hash: recoveryHash })
    .eq("id", data.user.id);
  if (profileErr) {
    return { error: `Conta criada, mas falhou ao salvar o perfil: ${profileErr.message}` };
  }

  if (trustDevice) {
    const cookieStore = await cookies();
    const token = await signTrustedDevice(data.user.id);
    cookieStore.set(TRUSTED_COOKIE, token, trustedCookieOptions());
  }

  redirect("/");
}
