const REMOTE_METHOD_PREFIX_RE = /^Error invoking remote method ['"][^'"]+['"]:\s*/i;
const ERROR_PREFIX_RE = /^Error:\s*/i;

const WAREHOUSE_ERROR_LABELS: Record<string, string> = {
  access_token_expired: "Сессия истекла. Войдите заново.",
  access_token_invalid: "Сессия недействительна. Войдите заново.",
  not_found: "Заказ не найден.",
  "no active picking session": "Нет активной сессии сборки.",
  picking_already_finished: "Этот заказ уже завершён и не может быть запущен заново.",
  "queue_id is required": "Не удалось определить заказ для операции.",
  "reason_code is required": "Укажите причину.",
  "reason_code is required for partial finish": "Укажите причину частичной сборки.",
  unauthorized: "Требуется авторизация.",
  unknown_code: "Этот код не относится к текущей сборке.",
  "warehouse access token missing": "Нет токена доступа. Войдите заново.",
  "warehouse realtime disconnected": "Потеряно соединение с сервером.",
  "warehouse socket auth required": "Требуется авторизация.",
  picked_qty_exceeds_ordered_qty: "Этот товар уже отсканирован в полном количестве.",
};

export function extractRemoteErrorMessage(value: unknown): string {
  const source =
    value instanceof Error
      ? value.message || String(value)
      : value && typeof value === "object" && typeof (value as { message?: unknown }).message === "string"
        ? String((value as { message: string }).message)
        : String(value ?? "");

  let message = source.trim();
  let prev = "";
  while (message && message !== prev) {
    prev = message;
    message = message.replace(REMOTE_METHOD_PREFIX_RE, "").replace(ERROR_PREFIX_RE, "").trim();
  }

  return message || "Неизвестная ошибка.";
}

export function formatWarehouseError(value: unknown): string {
  const raw = extractRemoteErrorMessage(value);
  return WAREHOUSE_ERROR_LABELS[raw.toLowerCase()] || raw;
}

export function formatWarehouseScanError(code: string, value: unknown): string {
  return `Код "${String(code || "").trim()}": ${formatWarehouseError(value)}`;
}

export function normalizeWarehouseScanErrorText(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const match = text.match(/^Код\s+"?(.+?)"?\s*:\s*(.+)$/);
  if (!match) return text;

  const [, code, message] = match;
  return formatWarehouseScanError(code, message);
}
