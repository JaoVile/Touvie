import { DIARY_COOKIE } from "@/lib/pin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(DIARY_COOKIE);
  return NextResponse.json({ ok: true });
}
