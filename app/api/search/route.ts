import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ transactions: [], diary: [] });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const term = `%${q}%`;

  const [txRes, diaryRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, description, amount_cents, kind, occurred_on, finance_categories(name, emoji)")
      .eq("user_id", user.id)
      .ilike("description", term)
      .order("occurred_on", { ascending: false })
      .limit(10),
    supabase
      .from("journal_entries")
      .select("week_start, content, mood_emoji")
      .eq("user_id", user.id)
      .ilike("content", term)
      .order("week_start", { ascending: false })
      .limit(10),
  ]);

  return NextResponse.json({
    transactions: txRes.data ?? [],
    diary: diaryRes.data ?? [],
  });
}
