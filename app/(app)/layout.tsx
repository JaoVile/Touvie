import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:pb-10" style={{ paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}>
        {children}
      </main>
    </div>
  );
}
