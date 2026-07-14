import { listSessions } from "@/app/(app)/toube/sessions-actions";
import { NextResponse } from "next/server";

// Lista de conversas do usuário — pro painel flutuante e a sidebar.
export async function GET() {
  try {
    return NextResponse.json({ sessions: await listSessions() });
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}
