import { logEvent } from "@/lib/logger";
import { DIARY_COOKIE, diaryCookieOptions, signDiaryToken, verifyPin } from "@/lib/pin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const MAX_ATTEMPTS = 3;
const LOCKOUT_MINUTES = 15;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let pin = "";
  try {
    const body = (await req.json()) as { pin?: unknown };
    pin = typeof body.pin === "string" ? body.pin : "";
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  if (!/^\d{4,8}$/.test(pin)) {
    return NextResponse.json({ error: "PIN inválido" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("pin_hash, pin_attempts, pin_locked_until")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.pin_hash) {
    return NextResponse.json({ error: "PIN não configurado" }, { status: 400 });
  }

  // Check lockout
  if (profile.pin_locked_until) {
    const lockedUntil = new Date(profile.pin_locked_until);
    if (lockedUntil > new Date()) {
      const remaining = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Muitas tentativas. Tente novamente em ${remaining} min.` },
        { status: 429 },
      );
    }
  }

  const admin = createAdminClient();
  const ok = await verifyPin(pin, profile.pin_hash);

  if (!ok) {
    const attempts = (profile.pin_attempts ?? 0) + 1;
    const locked = attempts >= MAX_ATTEMPTS;
    await admin
      .from("profiles")
      .update({
        pin_attempts: locked ? 0 : attempts,
        pin_locked_until: locked
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
          : null,
      })
      .eq("id", user.id);

    logEvent({ userId: user.id, eventType: "api", source: "diary/unlock", status: "error", messagePreview: "PIN incorreto" });

    const msg = locked
      ? `PIN bloqueado por ${LOCKOUT_MINUTES} min após ${MAX_ATTEMPTS} tentativas.`
      : `PIN incorreto. ${MAX_ATTEMPTS - attempts} tentativa${MAX_ATTEMPTS - attempts === 1 ? "" : "s"} restante${MAX_ATTEMPTS - attempts === 1 ? "" : "s"}.`;
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  // Reset attempts on success
  await admin.from("profiles").update({ pin_attempts: 0, pin_locked_until: null }).eq("id", user.id);

  const token = await signDiaryToken(user.id);
  const cookieStore = await cookies();
  cookieStore.set(DIARY_COOKIE, token, diaryCookieOptions());

  logEvent({ userId: user.id, eventType: "api", source: "diary/unlock", status: "success", messagePreview: "Diário desbloqueado" });

  return NextResponse.json({ ok: true });
}
