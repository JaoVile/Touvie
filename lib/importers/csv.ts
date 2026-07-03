// CSV importers for Nubank (credit card) and Mercado Pago (account)

export type ParsedTx = {
  occurred_on: string; // YYYY-MM-DD
  description: string;
  amount_cents: number;
  kind: "income" | "expense";
  external_ref: string;
};

// ─── Categorization ────────────────────────────────────────────────

const KEYWORD_MAP: Array<{ words: string[]; cat: string }> = [
  {
    words: [
      "supermercado",
      "mercado",
      "atacadao",
      "carrefour",
      "pao de acucar",
      "assai",
      "hortifruti",
      "sacolao",
      "feira",
    ],
    cat: "Mercado",
  },
  {
    words: [
      "ifood",
      "rappi",
      "uber eats",
      "ubereats",
      "james",
      "restaurante",
      "lanchonete",
      "padaria",
      "pizzaria",
      "sushi",
      "mcdonald",
      "mc donald",
      "burger",
      "subway",
      "kfc",
      "bob's",
      "bobs",
      "giraffas",
      "outback",
      "churrascaria",
      "espetinho",
      "porcao",
      "acai",
    ],
    cat: "Alimentação",
  },
  {
    words: [
      "uber",
      "99pop",
      "99taxi",
      "cabify",
      "posto ",
      "gasolina",
      "combustivel",
      "estacionamento",
      "metro",
      "passagem",
      "latam",
      "gol ",
      "azul ",
    ],
    cat: "Transporte",
  },
  {
    words: [
      "netflix",
      "spotify",
      "disney",
      "amazon prime",
      "hbo",
      "paramount",
      "youtube premium",
      "apple one",
      "microsoft 365",
      "google one",
      "dropbox",
      "adobe",
      "canva",
      "notion",
      "chatgpt",
      "openai",
      "github",
      "vercel",
      "cursor",
    ],
    cat: "Assinaturas",
  },
  {
    words: [
      "aluguel",
      "condominio",
      "iptu",
      "enel",
      "cpfl",
      "cemig",
      "coelba",
      "sabesp",
      "copasa",
      "internet",
      "claro",
      "vivo",
      "tim ",
      " oi ",
      "net ",
    ],
    cat: "Moradia",
  },
  {
    words: [
      "farmacia",
      "drogasil",
      "droga raia",
      "ultrafarma",
      "panvel",
      "hospital",
      "clinica",
      "medico",
      "dentista",
      "academia",
      "smartfit",
      "biolab",
      "fleury",
      "laboratorio",
      "unimed",
      "amil",
      "plano de saude",
    ],
    cat: "Saúde",
  },
  {
    words: [
      "cinema",
      "teatro",
      "show ",
      "clube",
      "steam",
      "playstation",
      "xbox",
      "nintendo",
      "ingresso",
      "sympla",
      "eventbrite",
      "balada",
      "parque",
    ],
    cat: "Lazer",
  },
  {
    words: [
      "escola",
      "faculdade",
      "curso",
      "udemy",
      "alura",
      "coursera",
      "duolingo",
      "hotmart",
      "livraria",
      "amazon kindle",
    ],
    cat: "Educação",
  },
];

export function guessCategory(description: string): string | null {
  const low = ` ${description.toLowerCase()} `;
  for (const { words, cat } of KEYWORD_MAP) {
    if (words.some((w) => low.includes(w))) return cat;
  }
  return null;
}

// ─── Helpers ───────────────────────────────────────────────────────

function parseBRL(raw: string): number {
  // "1.234,56" → 123456  |  "50,90" → 5090  |  "-50,90" → -5090
  const clean = raw.trim().replace(/\./g, "").replace(",", ".");
  return Math.round(Number.parseFloat(clean) * 100);
}

function splitCsv(line: string): string[] {
  // handles semicolon or comma separated, strips BOM and quotes
  const sep = line.includes(";") ? ";" : ",";
  return line.split(sep).map((c) => c.replace(/^"|"$/g, "").trim());
}

function hash(s: string): string {
  // simple djb2-like hash for external_ref (no crypto needed — just dedup key)
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

// ─── Nubank ────────────────────────────────────────────────────────
// Format: DATA;DESCRICAO;VALOR  (YYYY-MM-DD, "50,00", expenses positive)

export function parseNubank(text: string): ParsedTx[] {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  const results: ParsedTx[] = [];
  // Contador por chave (data|desc|valor) pra desambiguar linhas idênticas —
  // ver nota no external_ref abaixo.
  const seen = new Map<string, number>();

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsv(lines[i]);
    if (cols.length < 3) continue;

    const [rawDate, rawDesc, rawVal] = cols;
    const date = rawDate?.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) continue;

    // Strip "2024-02-08 - " prefix and " (1/3)" suffix from description
    const desc = (rawDesc ?? "")
      .replace(/^\d{4}-\d{2}-\d{2}\s*-\s*/, "")
      .replace(/\s*\(\d+\/\d+\)$/, "")
      .trim();

    const cents = parseBRL(rawVal ?? "0");
    if (!cents || !desc) continue;

    // Fatura do Nubank: gastos vêm positivos. Valores negativos são estornos/
    // créditos (reduzem a fatura), então entram como income pra netar certo —
    // antes virava despesa e inflava os gastos.
    const kind: "income" | "expense" = cents < 0 ? "income" : "expense";

    // external_ref precisa ser único por LINHA: duas compras idênticas no mesmo
    // dia (mesmo valor e descrição) não podem colidir num único hash, senão a
    // segunda some como "duplicata". Um contador por chave resolve e continua
    // estável ao re-importar o mesmo arquivo (mesma ordem → mesmos índices).
    const key = `${date}|${desc}|${cents}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);

    results.push({
      occurred_on: date,
      description: desc,
      amount_cents: Math.abs(cents),
      kind,
      external_ref: `nu:${hash(`${key}|${n}`)}`,
    });
  }

  return results;
}

// ─── Mercado Pago ──────────────────────────────────────────────────
// Format: Data;Descrição;Valor;Tipo;...  (positive = income, negative = expense)

const stripDiacritics = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "");

export function parseMercadoPago(text: string): ParsedTx[] {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length < 2) return [];

  // Alguns relatórios do MP trazem linhas de título/metadados antes do
  // cabeçalho real, então procuramos a primeira linha que tenha colunas de
  // data E valor em vez de assumir que é a linha 0.
  let headerIdx = -1;
  let header: string[] = [];
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const h = splitCsv(lines[i]).map(stripDiacritics);
    const hasDate = h.some((c) => c.includes("data") || c.includes("date"));
    const hasVal = h.some(
      (c) => c.includes("valor") || c.includes("value") || c.includes("quantia"),
    );
    if (hasDate && hasVal) {
      headerIdx = i;
      header = h;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const dateIdx = header.findIndex((h) => h.includes("data") || h.includes("date"));
  const descIdx = header.findIndex(
    (h) => h.includes("descri") || h.includes("detalhe") || h.includes("detail"),
  );
  const valIdx = header.findIndex(
    (h) => h.includes("valor") || h.includes("value") || h.includes("quantia"),
  );

  if (dateIdx < 0 || valIdx < 0) return [];

  const results: ParsedTx[] = [];
  const seen = new Map<string, number>();

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCsv(lines[i]);
    if (cols.length < 2) continue;

    // Date: "2024-03-15" or "15/03/2024" or "2024-03-15T10:30:00"
    let rawDate = (cols[dateIdx] ?? "").trim().slice(0, 10);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
      const [d, m, y] = rawDate.split("/");
      rawDate = `${y}-${m}-${d}`;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) continue;

    const desc = descIdx >= 0 ? (cols[descIdx] ?? "").trim() : "Mercado Pago";
    const cents = parseBRL(cols[valIdx] ?? "0");
    if (!cents) continue;

    // Mesma desambiguação por linha do Nubank: evita que dois movimentos
    // idênticos no mesmo dia colidam no mesmo external_ref.
    const key = `${rawDate}|${desc}|${cents}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);

    results.push({
      occurred_on: rawDate,
      description: desc || "Mercado Pago",
      amount_cents: Math.abs(cents),
      kind: cents >= 0 ? "income" : "expense",
      external_ref: `mp:${hash(`${key}|${n}`)}`,
    });
  }

  return results;
}

// ─── Auto-detect ───────────────────────────────────────────────────

export function detectAndParse(text: string): {
  source: "nubank" | "mercadopago" | "unknown";
  rows: ParsedTx[];
} {
  const clean = text.replace(/^﻿/, ""); // strip UTF-8 BOM
  const lines = clean.split("\n").filter(Boolean);
  const firstLine = lines[0]?.toUpperCase() ?? "";
  const cols = firstLine.split(";");

  // Nubank: exactly 3 semicolon columns — DATA ; DESCRICAO ; VALOR
  if (cols.length === 3 && cols[0]?.includes("DATA") && cols[2]?.includes("VALOR")) {
    return { source: "nubank", rows: parseNubank(clean) };
  }

  // Mercado Pago: cabeçalho com data + valor e mais de 3 colunas, possivelmente
  // depois de um preâmbulo — varre as primeiras linhas em vez de só a linha 0.
  const looksMP = lines.slice(0, 15).some((l) => {
    const up = l.toUpperCase();
    return (
      up.split(/[;,]/).length > 3 &&
      (up.includes("DATA") || up.includes("DATE")) &&
      /VALOR|VALUE|QUANTIA/.test(up)
    );
  });
  if (looksMP) {
    const rows = parseMercadoPago(clean);
    if (rows.length > 0) return { source: "mercadopago", rows };
  }

  // Fallback: try each parser and return whichever yields rows
  const nuRows = parseNubank(clean);
  if (nuRows.length > 0) return { source: "nubank", rows: nuRows };
  const mpRows = parseMercadoPago(clean);
  if (mpRows.length > 0) return { source: "mercadopago", rows: mpRows };
  return { source: "unknown", rows: [] };
}
