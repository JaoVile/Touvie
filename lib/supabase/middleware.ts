import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getClaims() em vez de getUser(): verifica o JWT LOCALMENTE (o projeto usa chaves
  // assimétricas ES256 — sem ES/RS cairia em getUser), eliminando o round-trip ao
  // Auth server em TODA request. O refresh de sessão é PRESERVADO: getClaims →
  // getSession → __loadSession renova o token expirado (_callRefreshToken) e grava
  // os cookies novos pelo setAll acima; a JWKS fica em cache global (10 min/processo).
  // Trade-off: identidade fica stale até o token expirar (~1h) — mesma escolha já
  // adotada nas 16 páginas (getUserClaims). Ações sensíveis seguem em getUser().
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  const user = sub ? { id: sub } : null;

  return { response, user };
}
