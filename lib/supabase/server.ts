import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
// NOTA: o generic <Database> NÃO é threadado aqui de propósito. O
// @supabase/ssr@0.6.1 foi compilado contra a assinatura antiga do
// SupabaseClient; com supabase-js@2.104 (assinatura nova) o schema colapsa
// pra `never` e toda query vira erro. Pra tipar este client, suba
// @supabase/ssr p/ ^0.10 + supabase-js p/ ^2.105 (peer alinhado). O tipo
// Database em ./types já existe e está plugado no admin client.

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component; middleware refreshes the session.
          }
        },
      },
    },
  );
}
