import { TRUSTED_COOKIE, verifyTrustedDevice } from "@/lib/device";
import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest, NextResponse } from "next/server";

const MUTATING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);
const PUBLIC_ROUTES = ["/login", "/signup", "/auth/callback", "/landpage"];
const SYSTEM_PREFIXES = ["/api/cron/", "/api/telegram/"];
// Auth-only flows that may be invoked from untrusted devices (e.g. PIN gate on celular)
const TRUST_BYPASS_PREFIXES = ["/api/diary/"];

export async function middleware(request: NextRequest) {
  let response: NextResponse;
  let user: Awaited<ReturnType<typeof updateSession>>["user"];

  try {
    ({ response, user } = await updateSession(request));
  } catch (err) {
    console.error("[middleware] updateSession failed:", err);
    return NextResponse.next();
  }
  const { pathname } = request.nextUrl;

  if (SYSTEM_PREFIXES.some((p) => pathname.startsWith(p))) {
    return response;
  }

  const isPublic = PUBLIC_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Root decides by auth: anonymous visitors get the landing (rewrite keeps
  // the URL at "/"), signed-in users fall through to the (app) dashboard.
  if (!user && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/landpage";
    return NextResponse.rewrite(url);
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Trusted-device guard — production only. In local dev the notebook
  // is implicitly trusted, so Server Actions aren't blocked by 403.
  if (process.env.NODE_ENV === "production" && user && MUTATING_METHODS.has(request.method)) {
    const trustBypass = TRUST_BYPASS_PREFIXES.some((p) => pathname.startsWith(p));
    if (!trustBypass) {
      const cookie = request.cookies.get(TRUSTED_COOKIE)?.value;
      const ok = await verifyTrustedDevice(cookie, user.id);
      if (!ok) {
        return new NextResponse(
          JSON.stringify({
            error: "read_only_device",
            message:
              "Este dispositivo não está autorizado a editar. Faça login no notebook e clique em 'Confiar neste dispositivo'.",
          }),
          { status: 403, headers: { "content-type": "application/json" } },
        );
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|offline\\.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
