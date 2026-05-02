import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function GlassCard({ className, children, ...rest }: GlassCardProps) {
  return (
    <div className={cn("glass p-5", className)} {...rest}>
      {children}
    </div>
  );
}
