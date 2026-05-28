import { CursorTrail } from "@/components/CursorTrail";
import { Nav } from "@/components/Nav";
import { ScrollProgress } from "@/components/ScrollProgress";
import { SideLabel } from "@/components/SideLabel";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <CursorTrail />
      <ScrollProgress />
      <SideLabel />
      <Nav />
      <main
        className="mx-auto w-full max-w-7xl flex-1 px-4 pt-12 sm:px-6"
        style={{ paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      >
        {children}
      </main>
    </div>
  );
}
