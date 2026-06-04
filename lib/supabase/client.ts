import { createBrowserClient } from "@supabase/ssr";
// generic <Database> omitido — ver nota em ./server.ts (skew ssr 0.6 ↔ supabase-js 2.104).

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
