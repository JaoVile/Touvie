import type { Database } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Quem está escrevendo e com qual client. O client pode ser o de cookie
 * (`lib/supabase/server.ts`, respeita RLS) ou o admin (`lib/supabase/admin.ts`,
 * bypassa RLS) — por isso TODO core filtra `user_id` explicitamente em vez de
 * confiar no RLS.
 */
export type ToubeCtx = {
  supabase: SupabaseClient<Database>;
  userId: string;
};
