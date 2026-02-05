export type StatusBackend = { httpOk: boolean; httpError: string | null; checkedAt: string | null };
export type PrinterReachability = { configured: boolean; ok: boolean; checkedAt: string | null; error: string | null };

export type AppStatus = {
  connected: boolean;
  joined: boolean;
  joinError: string | null;
  backendUrl: string;
  backend?: StatusBackend;
  appVersion?: string;
  printer: { host: string | null; port: number; encoding: string; name: string; reachability?: PrinterReachability };
  update?: { available: boolean; forced: boolean; message: string; downloading: boolean; progress: number | null; error: string | null };
};

export function joinErrorLabel(code: string | null): string {
  const c = String(code || "").trim();
  if (!c) return "нет";
  if (c === "bad_token") return "bad token";
  if (c === "force_update_required") return "force update";
  return c;
}

export function printerReachabilityLabel(r: PrinterReachability | undefined, host: string | null): string {
  if (!host) return "не настроен";
  if (!r) return "—";
  if (!r.configured) return "не настроен";
  if (r.ok) return "ok";
  if (r.error === "timeout") return "timeout";
  if (r.error === "invalid_port") return "port";
  if (r.error === "printer_not_configured") return "не настроен";
  return r.error ? "нет" : "нет";
}

export function warehouseOfflineReason(status: AppStatus | null, forcedUpdate: boolean): string | null {
  if (forcedUpdate) return "требуется обновление";
  if (!status) return "нет статуса";
  if (status.backend && !status.backend.httpOk) return `backend недоступен: ${status.backend.httpError || "unknown"}`;
  return null;
}

export function printerBlockedReason(status: AppStatus | null, forcedUpdate: boolean): string | null {
  if (forcedUpdate) return "требуется обновление";
  if (!status) return "нет статуса";
  const host = status.printer?.host || null;
  const r = status.printer?.reachability;
  if (!host) return "принтер не настроен";
  if (r?.configured && r.ok) return null;
  if (!r) return null;
  if (!r.configured) return "принтер не настроен";
  return `принтер недоступен: ${r.error || "unknown"}`;
}
