"use client";

import { useCallback, useEffect, useRef } from "react";
import { saveReadingProgress } from "../actions";

export function useReadingProgress(bookId: string) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ page: number; total?: number } | null>(null);

  const flush = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    void saveReadingProgress(bookId, p.page, p.total);
  }, [bookId]);

  const save = useCallback(
    (page: number, totalPages?: number) => {
      pending.current = { page, total: totalPages };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 1500);
    },
    [flush],
  );

  // Garante o último save ao sair da página.
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      flush();
    };
  }, [flush]);

  return { save };
}
