function safeUpper(s: string | null | undefined): string {
  return String(s || "").toUpperCase();
}

export function formatSum(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("ru-RU").format(n);
  } catch {
    return String(n);
  }
}

export function statusLabel(s: string): string {
  switch (safeUpper(s)) {
    case "TO_PICK":
      return "К сборке";
    case "PICKING":
      return "В сборке";
    case "PICKED":
      return "Собран";
    case "PARTIALLY_PICKED":
      return "Частично собран";
    case "PICK_FAILED":
      return "Ошибка";
    default:
      return s || "—";
  }
}

export function statusBadgeVariant(s: string): "default" | "secondary" | "destructive" {
  const up = safeUpper(s);
  if (up === "PICKED") return "default";
  if (up === "PARTIALLY_PICKED") return "secondary";
  if (up === "PICK_FAILED") return "destructive";
  if (up === "PICKING") return "secondary";
  return "secondary";
}

export function percent(picked: number, ordered: number): number {
  const o = Number(ordered);
  const p = Number(picked);
  if (!Number.isFinite(o) || o <= 0) return 0;
  if (!Number.isFinite(p) || p <= 0) return 0;
  return Math.max(0, Math.min(100, (p / o) * 100));
}

