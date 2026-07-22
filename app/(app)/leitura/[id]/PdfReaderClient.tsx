"use client";

import dynamic from "next/dynamic";
import type { Highlight } from "./PdfReader";

// `ssr:false` só pode viver num Client Component — o `[id]/page.tsx` é async
// Server Component, por isso o `dynamic` fica isolado aqui.
const PdfReader = dynamic(() => import("./PdfReader").then((m) => m.PdfReader), { ssr: false });

export function PdfReaderClient(props: {
  url: string;
  title: string;
  bookId: string;
  initialPage: number;
  highlights: Highlight[];
}) {
  return <PdfReader {...props} />;
}
