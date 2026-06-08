"use server";

import { TRUSTED_COOKIE, signTrustedDevice, trustedCookieOptions } from "@/lib/device";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha tem no mínimo 6 caracteres"),
  trustDevice: z.boolean().default(false),
  next: z.string().optional(),
});

export async function loginAction(formData: FormData): Promise<{ error?: string } | never> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    trustDevice: formData.get("trustDevice") === "on",
    next: formData.get("next")?.toString(),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return { error: error?.message ?? "Não foi possível fazer login" };
  }

  if (parsed.data.trustDevice) {
    const cookieStore = await cookies();
    const token = await signTrustedDevice(data.user.id);
    cookieStore.set(TRUSTED_COOKIE, token, trustedCookieOptions());
  }

  redirect(parsed.data.next || "/");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(TRUSTED_COOKIE);
  redirect("/login");
}
