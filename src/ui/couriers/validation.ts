export function formatUzPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  const hasCountryPrefix = value.trimStart().startsWith("+998") || (digits.length >= 12 && digits.startsWith("998"));
  const local = (hasCountryPrefix ? digits.slice(3) : digits).slice(0, 9);
  const groups = [local.slice(0, 2), local.slice(2, 5), local.slice(5, 7), local.slice(7, 9)].filter(Boolean);
  return local || hasCountryPrefix ? `+998 ${groups.join(" ")}`.trimEnd() : "";
}

export function normalizeUzPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  const hasCountryPrefix = value.trimStart().startsWith("+998") || (digits.length === 12 && digits.startsWith("998"));
  const local = hasCountryPrefix ? digits.slice(3) : digits;
  return /^\d{9}$/.test(local) ? `+998${local}` : null;
}

export function validateCourierEmail(value: string): string | null {
  if (!value) return null;
  if (value.length > 255) return "Email не должен превышать 255 символов.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Введите корректный email.";
  return null;
}

export function courierErrorMessage(error: { status: number; message: string; code?: string }): string {
  const backend = error.message;
  if (error.status === 0) return `Не удалось связаться с сервером. Проверьте список перед повторной отправкой. ${backend}`;
  if (error.status === 400) return `Проверьте введённые данные. ${backend}`;
  if (error.status === 401) return `Сессия истекла. Войдите в приложение заново. ${backend}`;
  if (error.status === 403) return `Недостаточно прав для управления аккаунтами курьеров. ${backend}`;
  if (error.status === 404 && error.code === "route_not_found") return `Сервер не нашёл API маршрут. ${backend}`;
  if (error.status === 404) return `Аккаунт курьера не найден. ${backend}`;
  if (error.status === 409) return `Курьер, телефон или email уже связаны с аккаунтом. ${backend}`;
  if (error.status === 502) return `Не удалось проверить курьера в МойСклад. ${backend}`;
  if (error.status >= 500) return `Ошибка сервера. ${backend}`;
  return backend || "Не удалось выполнить запрос.";
}
