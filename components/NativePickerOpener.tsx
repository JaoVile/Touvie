"use client";

import { useEffect } from "react";

const PICKER_SELECTOR =
  'input[type="date"],input[type="time"],input[type="datetime-local"],input[type="month"],input[type="week"]';

/**
 * Makes native date/time inputs open their picker when you click anywhere on
 * the field — not just the tiny calendar/clock indicator. Mounted once in the
 * root layout, it delegates a single document-level click and calls
 * `showPicker()` (a transient user gesture, which the click provides).
 *
 * Mirrors how the custom EmojiPicker and native <select> already open from a
 * click anywhere on the control, so every "click → opens a chooser" behaves
 * the same way across the app.
 */
export function NativePickerOpener() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const input = target?.closest?.(PICKER_SELECTOR) as HTMLInputElement | null;
      if (!input || input.disabled || input.readOnly) return;
      // The native indicator opens the picker itself; calling showPicker()
      // again while it's opening can throw — swallow it.
      try {
        input.showPicker?.();
      } catch {
        /* picker already open / not supported — ignore */
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
