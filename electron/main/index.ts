import { BrowserWindow, Menu, app, globalShortcut, ipcMain } from "electron";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { io, Socket } from "socket.io-client";
import semver from "semver";
import { buildEscPosJob } from "./escpos.js";
import { sendToTcpPrinter } from "./lan_printer.js";
import { loadSettings, saveSettings, Settings } from "./settings.js";
import { listWindowsPrinters, probeWindowsPrinter, sendRawToWindowsPrinter, type UsbProbeResult } from "./windows_usb_printer.js";

const require = createRequire(import.meta.url);
const { autoUpdater } = require("electron-updater") as { autoUpdater: any };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let socket: Socket | null = null;
let settings: Settings | null = null;
let joined = false;
let joinError: string | null = null;
let warehouseJoined = false;
let warehouseJoinError: string | null = null;
let updateAvailable: { forced: boolean; message: string } | null = null;
let updateDownloading = false;
let updateError: string | null = null;
let updateProgress: number | null = null;
let updatePolicy: {
  latestVersion: string | null;
  minSupportedVersion: string | null;
  downloadUrl: string | null;
  notes: string | null;
} | null = null;
let backendHttp: { ok: boolean; checkedAt: string | null; error: string | null; status: number | null } = {
  ok: false,
  checkedAt: null,
  error: null,
  status: null,
};
let printerReachability: { configured: boolean; ok: boolean; checkedAt: string | null; error: string | null } = {
  configured: false,
  ok: false,
  checkedAt: null,
  error: null,
};
let usbPrinterReachability: { configured: boolean; ok: boolean; checkedAt: string | null; error: string | null; details?: any } = {
  configured: false,
  ok: false,
  checkedAt: null,
  error: null,
};
let backendProbeTimer: NodeJS.Timeout | null = null;
let printerProbeTimer: NodeJS.Timeout | null = null;
let usbPrinterProbeTimer: NodeJS.Timeout | null = null;
let windowIsMaximized = false;
let policyUpdate: { forced: boolean; message: string } | null = null;
let updaterUpdate: { message: string } | null = null;
let deviceActivationPromise: Promise<{ ok: true; printer_id: string }> | null = null;

function recomputeUpdateAvailable() {
  const forced = Boolean(policyUpdate?.forced);
  const any = Boolean(policyUpdate) || Boolean(updaterUpdate);
  if (!any) {
    updateAvailable = null;
    return;
  }

  const message = forced
    ? policyUpdate?.message || "Обновление обязательно."
    : policyUpdate?.message || updaterUpdate?.message || "";

  updateAvailable = { forced, message };
}

function isDev(): boolean {
  return !app.isPackaged;
}

type LogEntry = { ts: string; level: "info" | "warn" | "error"; message: string };
const logs: LogEntry[] = [];

type WarehouseAuth = {
  phone: string | null;
  accessToken: string | null;
  refreshToken: string | null;
};

type DeviceAuth = {
  printerId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
};

function log(level: LogEntry["level"], message: string) {
  const entry: LogEntry = { ts: new Date().toISOString(), level, message };
  logs.push(entry);
  if (logs.length > 300) logs.splice(0, logs.length - 300);
  mainWindow?.webContents.send("log", entry);
}

function setBackendHttpState(next: { ok: boolean; error: string | null; checkedAt: string; status: number | null }) {
  const changed = backendHttp.ok !== next.ok || backendHttp.error !== next.error || backendHttp.status !== next.status;
  backendHttp = { ok: next.ok, error: next.error, checkedAt: next.checkedAt, status: next.status };
  if (!changed) return;
  log(next.ok ? "info" : "warn", next.ok ? "Backend HTTP: ok" : `Backend HTTP: fail (${next.error || "unknown"})`);
  sendStatus();
}

function setPrinterReachability(next: { configured: boolean; ok: boolean; error: string | null; checkedAt: string }) {
  const changed =
    printerReachability.configured !== next.configured || printerReachability.ok !== next.ok || printerReachability.error !== next.error;
  printerReachability = { configured: next.configured, ok: next.ok, error: next.error, checkedAt: next.checkedAt };
  if (!changed) return;
  const msg = !next.configured
    ? "Printer reachability: not configured"
    : next.ok
      ? "Printer reachability: ok"
      : `Printer reachability: fail (${next.error || "unknown"})`;
  log(next.ok ? "info" : "warn", msg);
  sendStatus();

  // Report reachability to backend (LAN reachability is only known by this desktop client).
  try {
    if (socket?.connected && joined) {
      socket.emit("printer_reachability", {
        configured: printerReachability.configured,
        ok: printerReachability.ok,
        checked_at: printerReachability.checkedAt,
        error: printerReachability.error,
      });
    }
  } catch {
    // ignore
  }
}

function setUsbPrinterReachability(next: UsbProbeResult) {
  const changed =
    usbPrinterReachability.configured !== next.configured ||
    usbPrinterReachability.ok !== next.ok ||
    usbPrinterReachability.error !== next.error;
  usbPrinterReachability = {
    configured: next.configured,
    ok: next.ok,
    checkedAt: next.checkedAt,
    error: next.error,
    details: next.details || undefined,
  };
  if (!changed) return;
  const msg = !next.configured
    ? "USB printer reachability: not configured"
    : next.ok
      ? "USB printer reachability: ok"
      : `USB printer reachability: fail (${next.error || "unknown"})`;
  log(next.ok ? "info" : "warn", msg);
  sendStatus();
}

function parseLanEndpoint(printer: { host?: unknown; port?: unknown }) {
  let hostRaw = String(printer?.host || "").trim();
  let portRaw = Number(printer?.port || 0);

  if (!hostRaw) {
    return { configured: false as const, host: "", port: 0, error: "printer_not_configured" as const };
  }

  // Allow users to paste values like:
  // - 192.168.1.100
  // - 192.168.1.100:9100
  // - tcp://192.168.1.100:9100
  hostRaw = hostRaw.replace(/^https?:\/\//i, "").replace(/^tcp:\/\//i, "");
  hostRaw = hostRaw.replace(/\/.*$/, ""); // strip path if any

  let host = hostRaw;
  let port = portRaw;

  // IPv6 in brackets: [::1]:9100
  const m6 = hostRaw.match(/^\[([^\]]+)\](?::(\d+))?$/);
  if (m6) {
    host = m6[1];
    if (m6[2]) port = Number(m6[2]);
  } else {
    // IPv4/hostname: host:port (but avoid treating raw IPv6 as host:port)
    const idx = hostRaw.lastIndexOf(":");
    const hasColon = idx > 0;
    const looksLikeIpv6 = hostRaw.includes(":") && hostRaw.includes("::");
    if (hasColon && !looksLikeIpv6) {
      const candidateHost = hostRaw.slice(0, idx).trim();
      const candidatePort = hostRaw.slice(idx + 1).trim();
      if (/^\d+$/.test(candidatePort)) {
        host = candidateHost;
        port = Number(candidatePort);
      }
    }
  }

  if (!host) {
    return { configured: false as const, host: "", port: 0, error: "printer_not_configured" as const };
  }
  if (!Number.isFinite(port) || port <= 0) {
    return { configured: true as const, host, port: 0, error: "invalid_port" as const };
  }

  return { configured: true as const, host, port, error: null as string | null };
}

async function probePrinterReachabilityOnce() {
  const s = ensureSettings();
  const checkedAt = new Date().toISOString();

  const ep = parseLanEndpoint(s.printer);
  if (!ep.configured) {
    setPrinterReachability({ configured: false, ok: false, error: ep.error, checkedAt });
    return;
  }
  if (ep.error) {
    setPrinterReachability({ configured: true, ok: false, error: ep.error, checkedAt });
    return;
  }

  const timeoutMs = 2500;

  await new Promise<void>((resolve) => {
    const socket = new net.Socket();
    let done = false;

    const finish = (ok: boolean, error: string | null) => {
      if (done) return;
      done = true;
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      setPrinterReachability({ configured: true, ok, error, checkedAt });
      resolve();
    };

    // Important: too small timeouts may give false negatives (ARP, Wi‑Fi, busy printer).
    // Keep it reasonably fast for UI, but not overly aggressive.
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true, null));
    socket.once("timeout", () => finish(false, "timeout"));
    socket.once("error", (e: any) => {
      const code = e?.code ? String(e.code) : "";
      const msg = e?.message ? String(e.message) : String(e);
      finish(false, code ? `${code}${msg && !msg.includes(code) ? `: ${msg}` : ""}` : msg);
    });

    try {
      socket.connect({ host: ep.host, port: ep.port, family: 4 });
    } catch (e) {
      finish(false, String(e));
    }
  });
}

function schedulePrinterProbe() {
  if (printerProbeTimer) clearInterval(printerProbeTimer);
  void probePrinterReachabilityOnce();
  printerProbeTimer = setInterval(() => void probePrinterReachabilityOnce(), 7000);
}

async function probeUsbPrinterReachabilityOnce() {
  const s = ensureSettings();
  const mode = s.printer.mode || "lan_then_usb";
  const name = s.printer.usbPrinterName || null;

  // Probe only when USB is relevant.
  if (mode !== "usb" && mode !== "lan_then_usb") {
    setUsbPrinterReachability({ configured: false, ok: false, checkedAt: new Date().toISOString(), error: "usb_disabled" });
    return;
  }

  const res = await probeWindowsPrinter(name);
  setUsbPrinterReachability(res);
}

function scheduleUsbPrinterProbe() {
  if (usbPrinterProbeTimer) clearInterval(usbPrinterProbeTimer);
  void probeUsbPrinterReachabilityOnce();
  usbPrinterProbeTimer = setInterval(() => void probeUsbPrinterReachabilityOnce(), 15000);
}

async function probeBackendHealthOnce() {
  const checkedAt = new Date().toISOString();
  const s = ensureSettings();
  const base = String(s.backendUrl || "").trim().replace(/\/+$/, "");
  if (!base) {
    setBackendHttpState({ ok: false, error: "backend_url_empty", checkedAt, status: null });
    return;
  }

  const res = await apiFetchJson("/api/health", { timeoutMs: 2500 });
  if (res.status === 0) {
    setBackendHttpState({ ok: false, error: res.json?.raw ? String(res.json.raw) : "fetch_failed", checkedAt, status: 0 });
    return;
  }

  if (res.ok) {
    setBackendHttpState({ ok: true, error: null, checkedAt, status: res.status });
    return;
  }

  const err = res.json?.error || res.json?.message || res.json?.raw || `HTTP ${res.status}`;
  setBackendHttpState({ ok: false, error: String(err), checkedAt, status: res.status });
}

function scheduleBackendProbe() {
  if (backendProbeTimer) clearInterval(backendProbeTimer);
  void probeBackendHealthOnce();
  backendProbeTimer = setInterval(() => void probeBackendHealthOnce(), 5000);
}

function sendWarehouseHint(reason: string) {
  try {
    mainWindow?.webContents.send("warehouse:hint", { reason, ts: new Date().toISOString() });
  } catch {
    // ignore
  }
}

function ensureSettings(): Settings {
  if (!settings) settings = loadSettings();
  return settings;
}

async function sendToConfiguredPrinter(rawText: string): Promise<void> {
  const s = ensureSettings();
  const mode = s.printer.mode || "lan_then_usb";
  const job = buildEscPosJob(rawText, { encoding: s.printer.encoding, codepage: s.printer.codepage ?? 17 });

  const lanCheckedAtMs = printerReachability.checkedAt ? Date.parse(printerReachability.checkedAt) : 0;
  const lanFresh = Boolean(lanCheckedAtMs && Date.now() - lanCheckedAtMs < 12_000);
  const lanFreshUnreachable = Boolean(lanFresh && printerReachability.configured && !printerReachability.ok);

  const isSoftLanFailure = (err: string | null) => {
    const e = String(err || "").toLowerCase();
    return e === "timeout" || e.includes("timeout");
  };

  const lanHardDown = lanFreshUnreachable && !isSoftLanFailure(printerReachability.error);
  const lanSoftDown = lanFreshUnreachable && isSoftLanFailure(printerReachability.error);

  const tryLan = async (timeoutMs = 5000) => {
    const ep = parseLanEndpoint(s.printer);
    if (!ep.configured) throw new Error("Не настроен принтер (host пустой)");
    if (ep.error) throw new Error(ep.error);
    await sendToTcpPrinter(job, { host: ep.host, port: ep.port, timeoutMs });
  };

  const tryUsb = async () => {
    const usbName = String(s.printer.usbPrinterName || "").trim();
    if (!usbName) throw new Error("USB принтер не выбран");
    await sendRawToWindowsPrinter({ printerName: usbName, payload: job, docName: "Mio beauty: чек" });
  };

  if (mode === "lan") {
    // Treat probe results as a hint:
    // - "timeout" can be a false negative, so still try LAN with a shorter timeout.
    // - other errors (ECONNREFUSED/ENETUNREACH/...) are usually hard failures -> fail fast.
    if (lanHardDown) {
      throw new Error(`printer_unreachable: ${printerReachability.error || "unknown"}`);
    }
    await tryLan(lanSoftDown ? 2500 : 5000);
    return;
  }
  if (mode === "usb") {
    await tryUsb();
    return;
  }

  // fallback (old client behavior): LAN -> USB
  if (lanHardDown) {
    log("warn", `LAN принтер недоступен (${printerReachability.error || "unknown"}), пробуем USB...`);
    await tryUsb();
    return;
  }
  try {
    await tryLan(lanSoftDown ? 2500 : 5000);
  } catch (e1) {
    log("warn", `LAN печать не удалась (${String(e1)}), пробуем USB...`);
    await tryUsb();
  }
}

function warehouseAuth(): WarehouseAuth {
  const s = ensureSettings();
  return (
    s.warehouseAuth ?? {
      phone: null,
      accessToken: null,
      refreshToken: null,
    }
  );
}

function deviceAuth(): DeviceAuth {
  const s = ensureSettings();
  return (
    s.deviceAuth ?? {
      printerId: null,
      accessToken: null,
      refreshToken: null,
    }
  );
}

function saveWarehouseAuth(next: Partial<WarehouseAuth>): WarehouseAuth {
  const cur = warehouseAuth();
  const merged: WarehouseAuth = {
    phone: next.phone !== undefined ? (next.phone || null) : cur.phone,
    accessToken: next.accessToken !== undefined ? (next.accessToken || null) : cur.accessToken,
    refreshToken: next.refreshToken !== undefined ? (next.refreshToken || null) : cur.refreshToken,
  };
  settings = saveSettings({ warehouseAuth: merged } as Partial<Settings>);
  return merged;
}

function saveDeviceAuth(next: Partial<DeviceAuth>): DeviceAuth {
  const cur = deviceAuth();
  const merged: DeviceAuth = {
    printerId: next.printerId !== undefined ? (next.printerId || null) : cur.printerId,
    accessToken: next.accessToken !== undefined ? (next.accessToken || null) : cur.accessToken,
    refreshToken: next.refreshToken !== undefined ? (next.refreshToken || null) : cur.refreshToken,
  };
  settings = saveSettings({ deviceAuth: merged } as Partial<Settings>);
  return merged;
}

function sendStatus() {
  const s = ensureSettings();
  mainWindow?.webContents.send("status", {
    connected: Boolean(socket?.connected),
    joined,
    joinError,
    warehouseRealtime: {
      connected: Boolean(socket?.connected),
      joined: warehouseJoined,
      joinError: warehouseJoinError,
    },
    backendUrl: s.backendUrl,
    backend: {
      httpOk: backendHttp.ok,
      httpError: backendHttp.error,
      checkedAt: backendHttp.checkedAt,
      httpStatus: backendHttp.status,
    },
    printer: {
      host: s.printer.host || null,
      port: s.printer.port,
      encoding: s.printer.encoding,
      name: s.printer.name,
      mode: s.printer.mode || "lan_then_usb",
      usbPrinterName: s.printer.usbPrinterName || null,
      reachability: printerReachability,
      usbReachability: usbPrinterReachability,
    },
    warehouse: s.warehouse,
    appVersion: app.getVersion(),
    update: {
      available: Boolean(updateAvailable),
      forced: Boolean(updateAvailable?.forced),
      message: updateAvailable?.message || "",
      downloading: updateDownloading,
      progress: updateProgress,
      error: updateError,
      policy: updatePolicy
        ? {
            latestVersion: updatePolicy.latestVersion,
            minSupportedVersion: updatePolicy.minSupportedVersion,
            downloadUrl: updatePolicy.downloadUrl,
            notes: updatePolicy.notes,
          }
        : null,
    },
    warehouseAuth: {
      phone: s.warehouseAuth?.phone || null,
      hasToken: Boolean(s.warehouseAuth?.accessToken || s.warehouseAuth?.refreshToken),
    },
    window: {
      maximized: windowIsMaximized,
    },
  });
}

async function apiFetchJson(
  pathOrUrl: string,
  opts: { method?: string; headers?: Record<string, string>; json?: any; timeoutMs?: number } = {},
): Promise<{ ok: boolean; status: number; json: any }> {
  const s = ensureSettings();
  const base = String(s.backendUrl || "").trim().replace(/\/+$/, "");

  function formatFetchError(e: unknown): string {
    const err = e as any;
    const msg = err?.name && err?.message ? `${err.name}: ${err.message}` : String(e);
    const cause = err?.cause as any;
    if (!cause) return msg;

    const parts: string[] = [];
    const causeMsg =
      cause?.name && cause?.message ? `${cause.name}: ${cause.message}` : (typeof cause === "string" ? cause : String(cause));
    if (causeMsg && causeMsg !== msg) parts.push(causeMsg);

    const code = cause?.code || err?.code;
    if (code) parts.push(`code=${String(code)}`);

    const syscall = cause?.syscall;
    if (syscall) parts.push(`syscall=${String(syscall)}`);

    const hostname = cause?.hostname;
    if (hostname) parts.push(`host=${String(hostname)}`);

    const address = cause?.address;
    if (address) parts.push(`addr=${String(address)}`);

    const port = cause?.port;
    if (port) parts.push(`port=${String(port)}`);

    return parts.length ? `${msg} (cause: ${parts.join(" ")})` : msg;
  }

  let url: string;
  if (/^https?:\/\//i.test(pathOrUrl)) {
    url = pathOrUrl;
  } else {
    if (!base) return { ok: false, status: 0, json: { raw: "Backend URL пустой (настройки). Укажи https://... и попробуй снова." } };
    if (!/^https?:\/\//i.test(base)) {
      return {
        ok: false,
        status: 0,
        json: { raw: `Backend URL должен начинаться с http(s):// (сейчас: ${JSON.stringify(base)})` },
      };
    }
    url = `${base}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);
  try {
    const res = await fetch(url, {
      method: opts.method || "GET",
      headers: {
        accept: "application/json",
        ...(opts.json ? { "content-type": "application/json" } : {}),
        ...(opts.headers || {}),
      },
      body: opts.json ? JSON.stringify(opts.json) : undefined,
      signal: controller.signal,
    });
    const raw = await res.text().catch(() => "");
    let json: any = null;
    if (raw) {
      try {
        json = JSON.parse(raw);
      } catch {
        json = null;
      }
    }
    if (!res.ok) {
      const brief = raw ? raw.slice(0, 240) : "";
      log("warn", `HTTP ${res.status} ${opts.method || "GET"} ${url} ${brief ? `body=${JSON.stringify(brief)}` : ""}`.trim());
    }
    return { ok: res.ok, status: res.status, json: json ?? { raw } };
  } catch (e) {
    const details = formatFetchError(e);
    log("error", `HTTP FAIL ${opts.method || "GET"} ${url}: ${details}`);
    return { ok: false, status: 0, json: { raw: details } };
  } finally {
    clearTimeout(t);
  }
}

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((base64Url.length + 3) % 4);
    const json = Buffer.from(base64, "base64").toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function jwtExpMs(token: string | null): number | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  const expSec = payload?.exp;
  if (!Number.isFinite(expSec)) return null;
  return Number(expSec) * 1000;
}

type AuthRefreshError = Error & { status?: number };

async function ensureDeviceAccessToken(opts: { force?: boolean } = {}): Promise<string | null> {
  const auth = deviceAuth();
  const refresh = auth.refreshToken;
  if (!refresh) return null;

  const expMs = jwtExpMs(auth.accessToken);
  const stillValid = expMs && expMs - Date.now() > 60_000;
  if (!opts.force && auth.accessToken && stillValid) return auth.accessToken;

  const res = await apiFetchJson("/api/device/auth/refresh", { method: "POST", json: { refresh_token: refresh }, timeoutMs: 8000 });
  if (!res.ok) {
    const msg = res.json?.message || res.json?.error || res.json?.raw || `device refresh failed (${res.status})`;
    // If refresh token is invalid/expired — clear local device auth and require re-activation.
    if (res.status === 401) {
      saveDeviceAuth({ accessToken: null, refreshToken: null });
      sendStatus();
    }
    throw new Error(String(msg));
  }
  const access = res.json?.access_token ? String(res.json.access_token) : "";
  const refresh2 = res.json?.refresh_token ? String(res.json.refresh_token) : "";
  const printerId = res.json?.printer_id ? String(res.json.printer_id) : null;
  if (!access || !refresh2) throw new Error("device refresh: tokens missing");
  saveDeviceAuth({ accessToken: access, refreshToken: refresh2, printerId: printerId || auth.printerId || null });
  return access;
}

let warehouseRefreshPromise: Promise<string> | null = null;

async function ensureWarehouseAccessToken(opts: { force?: boolean } = {}): Promise<string | null> {
  const auth = warehouseAuth();
  const refresh = auth.refreshToken;
  if (!refresh) return auth.accessToken || null;

  const expMs = jwtExpMs(auth.accessToken);
  const stillValid = expMs && expMs - Date.now() > 60_000;
  if (!opts.force && auth.accessToken && stillValid) return auth.accessToken;

  // Refresh-token rotation requires single-flight refresh to avoid "Invalid refresh token"
  // from concurrent refresh attempts.
  if (warehouseRefreshPromise) return await warehouseRefreshPromise;

  warehouseRefreshPromise = (async () => {
    const refreshed = await apiFetchJson("/api/auth/refresh", {
      method: "POST",
      json: { refresh_token: refresh },
      timeoutMs: 8000,
    });
    if (!refreshed.ok) {
      const msg =
        refreshed.json?.message || refreshed.json?.error || refreshed.json?.raw || `warehouse refresh failed (${refreshed.status})`;
      const err: AuthRefreshError = new Error(String(msg));
      err.status = refreshed.status;
      throw err;
    }
    const access2 = refreshed.json?.access_token ? String(refreshed.json.access_token) : "";
    const refresh2 = refreshed.json?.refresh_token ? String(refreshed.json.refresh_token) : "";
    if (!access2 || !refresh2) {
      const err: AuthRefreshError = new Error("warehouse refresh: tokens missing");
      err.status = refreshed.status;
      throw err;
    }
    saveWarehouseAuth({ accessToken: access2, refreshToken: refresh2 });
    sendStatus();
    return access2;
  })().finally(() => {
    warehouseRefreshPromise = null;
  });

  return await warehouseRefreshPromise;
}

async function warehouseRequestJson(
  path: string,
  opts: { method?: string; json?: any; timeoutMs?: number } = {},
): Promise<{ ok: boolean; status: number; json: any }> {
  const headers: Record<string, string> = {};
  try {
    const access = await ensureWarehouseAccessToken();
    if (access) headers.authorization = `Bearer ${access}`;
  } catch (e) {
    const err = e as AuthRefreshError;
    // Only force re-login when backend explicitly rejects refresh token.
    if (err?.status === 401) {
      saveWarehouseAuth({ accessToken: null, refreshToken: null });
      sendWarehouseHint("auth_expired");
      sendStatus();
      throw new Error("Сессия истекла. Войдите заново.");
    }
    throw new Error(`Не удалось обновить сессию: ${String(err?.message || err)}`);
  }

  let res = await apiFetchJson(path, { method: opts.method, json: opts.json, timeoutMs: opts.timeoutMs, headers });
  if (res.status !== 401) return res;

  // try refresh once
  try {
    const access = await ensureWarehouseAccessToken({ force: true });
    if (!access) return res;
    res = await apiFetchJson(path, {
      method: opts.method,
      json: opts.json,
      timeoutMs: opts.timeoutMs,
      headers: { authorization: `Bearer ${access}` },
    });
    return res;
  } catch (e) {
    const err = e as AuthRefreshError;
    if (err?.status === 401) {
      saveWarehouseAuth({ accessToken: null, refreshToken: null });
      sendWarehouseHint("auth_expired");
      sendStatus();
      throw new Error("Сессия истекла. Войдите заново.");
    }
    throw new Error(`Не удалось обновить сессию: ${String(err?.message || err)}`);
  }
}

function nextWarehouseRequestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function joinWarehouseSocket() {
  if (updateAvailable?.forced) return;
  if (!socket?.connected) {
    warehouseJoined = false;
    warehouseJoinError = null;
    sendStatus();
    return;
  }

  const auth = warehouseAuth();
  if (!auth.accessToken && !auth.refreshToken) {
    warehouseJoined = false;
    warehouseJoinError = null;
    sendStatus();
    return;
  }

  try {
    const access = await ensureWarehouseAccessToken();
    if (!access) {
      warehouseJoined = false;
      warehouseJoinError = "access_token_missing";
      sendStatus();
      return;
    }

    socket.emit("join", {
      room: "warehouse_user",
      access_token: access,
      request_id: nextWarehouseRequestId("warehouse-join"),
    });
  } catch (e) {
    const err = e as AuthRefreshError;
    if (err?.status === 401) {
      saveWarehouseAuth({ accessToken: null, refreshToken: null });
      sendWarehouseHint("auth_expired");
      warehouseJoined = false;
      warehouseJoinError = "auth_expired";
      sendStatus();
      return;
    }

    warehouseJoined = false;
    warehouseJoinError = String(err?.message || err);
    log("warn", `Warehouse realtime join failed: ${warehouseJoinError}`);
    sendStatus();
  }
}

function leaveWarehouseSocket() {
  warehouseJoined = false;
  warehouseJoinError = null;
  try {
    socket?.emit("warehouse:leave");
  } catch {
    // ignore
  }
  sendStatus();
}

async function warehouseSocketRequest(event: string, payload: Record<string, any> = {}, timeoutMs = 4000): Promise<any> {
  if (!socket?.connected) throw new Error("warehouse realtime disconnected");

  const access = await ensureWarehouseAccessToken();
  if (!access) throw new Error("warehouse access token missing");

  return await new Promise((resolve, reject) => {
    const s: any = socket;
    s.timeout(timeoutMs).emit(
      event,
      {
        ...payload,
        access_token: access,
        request_id: nextWarehouseRequestId(event.replace(/[^a-z0-9]+/gi, "-").toLowerCase()),
      },
      (err: unknown, ack?: { ok?: boolean; data?: any; message?: string; status?: number }) => {
        if (err) {
          const error: AuthRefreshError = new Error("warehouse realtime timeout");
          error.status = 0;
          reject(error);
          return;
        }
        if (!ack?.ok) {
          const error: AuthRefreshError = new Error(String(ack?.message || "warehouse realtime request failed"));
          error.status = ack?.status;
          reject(error);
          return;
        }
        resolve(ack.data);
      },
    );
  });
}

async function warehouseActionRequest(opts: {
  label: string;
  event: string;
  payload?: Record<string, any>;
  path: string;
  body?: any;
  timeoutMs?: number;
  httpTimeoutMs?: number;
}) {
  if (socket?.connected) {
    try {
      return await warehouseSocketRequest(opts.event, opts.payload || {}, opts.timeoutMs ?? 4000);
    } catch (e) {
      const err = e as AuthRefreshError;
      if (err?.status === 401) {
        saveWarehouseAuth({ accessToken: null, refreshToken: null });
        warehouseJoined = false;
        warehouseJoinError = "auth_expired";
        sendWarehouseHint("auth_expired");
        sendStatus();
        throw new Error("Сессия истекла. Войдите заново.");
      }
      if (typeof err?.status === "number" && err.status > 0) {
        throw new Error(String(err.message || err));
      }
      log("warn", `${opts.label} realtime failed, fallback to HTTP: ${String(err?.message || err)}`);
    }
  }

  const res = await warehouseRequestJson(opts.path, {
    method: "POST",
    json: opts.body,
    timeoutMs: opts.httpTimeoutMs ?? 12000,
  });
  if (!res.ok) {
    const msg = res.json?.message || `${opts.label} failed (${res.status})`;
    throw new Error(String(msg));
  }
  return res.json;
}

function configureAutoUpdater() {
  if (!autoUpdater || typeof autoUpdater.checkForUpdates !== "function") {
    updateError = "autoUpdater недоступен (electron-updater не загрузился)";
    log("error", updateError);
    sendStatus();
    return;
  }
  // Best practice:
  // - optional updates: download/install only by explicit user action
  // - forced updates: show blocking UI and let user click "Обновить"
  // Installation still requires restart.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info: any) => {
    updaterUpdate = { message: `Доступна новая версия: ${info.version}` };
    recomputeUpdateAvailable();
    updateDownloading = false;
    updateProgress = null;
    updateError = null;
    log("info", `Update available: ${info.version}`);
    sendStatus();
  });

  autoUpdater.on("update-not-available", (info: any) => {
    // Do NOT clear policy-based forced update here.
    updaterUpdate = null;
    recomputeUpdateAvailable();
    updateDownloading = false;
    updateProgress = null;
    updateError = null;
    log("info", `No updates: ${info.version}`);
    sendStatus();
  });

  autoUpdater.on("download-progress", (p: any) => {
    updateDownloading = true;
    updateProgress = Math.max(0, Math.min(100, Number(p?.percent ?? 0)));
    sendStatus();
  });

  autoUpdater.on("update-downloaded", (info: any) => {
    updateDownloading = false;
    updateProgress = 100;
    updateError = null;
    log("info", `Update downloaded: ${info.version}`);
    sendStatus();
  });

  autoUpdater.on("error", (err: any) => {
    updateError = String(err);
    updateDownloading = false;
    updateProgress = null;
    log("error", `Update error: ${updateError}`);
    sendStatus();
  });
}

async function refreshUpdatePolicy() {
  const res = await apiFetchJson("/api/desktop/update-manifest", { timeoutMs: 5000 });
  if (!res.ok) return;
  try {
    const json = res.json;
    updatePolicy = {
      latestVersion: (json?.latest_version || null) && String(json.latest_version),
      minSupportedVersion: (json?.min_supported_version || null) && String(json.min_supported_version),
      downloadUrl: (json?.download_url || null) && String(json.download_url),
      notes: (json?.notes || null) && String(json.notes),
    };

    const current = semver.coerce(app.getVersion());
    const latest = updatePolicy.latestVersion ? semver.coerce(updatePolicy.latestVersion) : null;
    const minSupported = updatePolicy.minSupportedVersion ? semver.coerce(updatePolicy.minSupportedVersion) : null;

    const forced = Boolean(current && minSupported && semver.lt(current, minSupported));
    const availableByPolicy = Boolean(current && latest && semver.lt(current, latest));

    if (!forced && !availableByPolicy) {
      policyUpdate = null;
      recomputeUpdateAvailable();
      sendStatus();
      return;
    }

    const verLabel = updatePolicy.latestVersion || updatePolicy.minSupportedVersion || "";
    const notes = (updatePolicy.notes || "").trim();
    const msgBase = forced ? `Обновление обязательно (требуется версия >= ${updatePolicy.minSupportedVersion}).` : `Доступна новая версия: ${verLabel}`;
    const msg = notes ? `${msgBase}\n${notes}` : msgBase;

    policyUpdate = { forced, message: msg };
    recomputeUpdateAvailable();

    sendStatus();
  } catch (e) {
    log("warn", `update-manifest parse failed: ${String(e)}`);
  }
}

async function checkForUpdates() {
  try {
    updateError = null;
    await autoUpdater.checkForUpdates();
  } catch (e) {
    updateError = String(e);
    log("error", `checkForUpdates failed: ${updateError}`);
    sendStatus();
  }
}

function connectSocket() {
  const url = ensureSettings().backendUrl;
  socket?.disconnect();
  socket = io(url, {
    path: "/socket.io",
    transports: ["polling", "websocket"],
    timeout: 10_000,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
  });

  socket.on("connect", async () => {
    log("info", `Socket.IO подключён к ${url}`);
    joined = false;
    joinError = null;
    warehouseJoined = false;
    warehouseJoinError = null;
    const s = ensureSettings();
    let deviceAccess: string | null = null;
    try {
      deviceAccess = await ensureDeviceAccessToken();
    } catch (e) {
      log("warn", `Device auth refresh failed: ${String(e)}`);
    }
    socket?.emit("join", {
      room: "local_printer",
      token: s.printerClientToken,
      device_access_token: deviceAccess,
      client_id: s.clientId,
      printer: {
        name: s.printer.name,
        ip: s.printer.host,
        port: s.printer.port,
        version: "check_printer_desktop",
      },
      printer_reachability: {
        configured: printerReachability.configured,
        ok: printerReachability.ok,
        checked_at: printerReachability.checkedAt,
        error: printerReachability.error,
      },
      warehouse: s.warehouse,
    });
    void joinWarehouseSocket();
    sendStatus();
  });
  socket.on("disconnect", () => {
    log("warn", "Socket.IO отключён");
    joined = false;
    warehouseJoined = false;
    warehouseJoinError = null;
    sendStatus();
  });
  socket.on("connect_error", (e) => {
    log("error", `Socket.IO ошибка подключения: ${String(e)}`);
    joined = false;
    warehouseJoined = false;
    warehouseJoinError = null;
    sendStatus();
  });

  socket.on("join_ok", (payload) => {
    joined = true;
    joinError = null;
    log("info", `join_ok: ${JSON.stringify(payload || {})}`);
    try {
      socket?.emit("printer_reachability", {
        configured: printerReachability.configured,
        ok: printerReachability.ok,
        checked_at: printerReachability.checkedAt,
        error: printerReachability.error,
      });
    } catch {
      // ignore
    }
    sendStatus();
  });

  socket.on("join_error", (payload) => {
    joined = false;
    joinError = String((payload || {}).reason || "unknown");
    log("error", `join_error: ${joinError}`);
    sendStatus();
  });

  socket.on("warehouse_join_ok", (payload) => {
    warehouseJoined = true;
    warehouseJoinError = null;
    log("info", `warehouse_join_ok: ${JSON.stringify(payload || {})}`);
    sendStatus();
  });

  socket.on("warehouse_join_error", (payload) => {
    warehouseJoined = false;
    warehouseJoinError = String((payload || {}).reason || "unknown");
    log("warn", `warehouse_join_error: ${warehouseJoinError}`);
    sendStatus();
  });

  // Для склада: когда приходит новый заказ — подсказать UI обновиться без polling.
  socket.on("new_order", (_payload) => {
    sendWarehouseHint("new_order");
  });

  // Для склада: любые изменения сборки (start/scan/finish) — обновить список сразу.
  socket.on("warehouse_update", (payload) => {
    const kind = String(payload?.kind || "warehouse_update");
    sendWarehouseHint(kind);
  });

  // Для склада: изменения статуса печати (может влиять на список/фильтры и "удаление" из очереди).
  socket.on("printed_true", (_payload) => {
    sendWarehouseHint("printed_true");
  });
  socket.on("printed_false", (_payload) => {
    sendWarehouseHint("printed_false");
  });
  socket.on("printed_unknown", (_payload) => {
    sendWarehouseHint("printed_unknown");
  });

  socket.on("print_text", async (payload) => {
    const orderId = payload?.id;
    const number = payload?.number;
    const printJobId = payload?.print_job_id;
    const requestId = payload?.request_id;
    const text = String(payload?.text || "");

	    try {
	      if (updateAvailable?.forced) {
	        throw new Error("force_update_required");
	      }

	      log("info", `Печать заказа id=${orderId} number=${number} job=${printJobId} attempt=${payload?.attempt}`);
	      await sendToConfiguredPrinter(text);

	      socket?.emit("printed_true", {
	        id: orderId,
	        number,
        print_job_id: printJobId,
        request_id: requestId,
      });
      log("info", `Печать OK id=${orderId}`);
    } catch (e) {
      socket?.emit("printed_false", {
        id: orderId,
        number,
        error: String(e),
        print_job_id: printJobId,
        request_id: requestId,
      });
      log("error", `Печать FAIL id=${orderId}: ${String(e)}`);
    }
  });
}

async function createWindow() {
  settings = loadSettings();
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  Menu.setApplicationMenu(null);
  mainWindow.setMenuBarVisibility(false);
  windowIsMaximized = mainWindow.isMaximized();
  mainWindow.on("maximize", () => {
    windowIsMaximized = true;
    sendStatus();
  });
  mainWindow.on("unmaximize", () => {
    windowIsMaximized = false;
    sendStatus();
  });

  if (isDev()) {
    const devUrl = "http://127.0.0.1:5173";
    let lastErr: unknown = null;
    for (let i = 0; i < 30; i++) {
      try {
        // В dev иногда Electron стартует раньше Vite и ловит ERR_CONNECTION_REFUSED.
        await mainWindow.loadURL(devUrl);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    if (lastErr) throw lastErr;

    // "detach" can open DevTools off-screen (e.g. after monitor/layout changes).
    // Use a docked mode by default, and still allow a shortcut to toggle it.
    mainWindow.webContents.openDevTools({ mode: "right" });
    globalShortcut.register("CommandOrControl+Shift+I", () => {
      try {
        if (!mainWindow) return;
        if (mainWindow.webContents.isDevToolsOpened()) mainWindow.webContents.closeDevTools();
        else mainWindow.webContents.openDevTools({ mode: "right" });
      } catch {
        // ignore
      }
    });
  } else {
    await mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }

  if (!isDev()) {
    configureAutoUpdater();
    // Policy can block the app if current version < minSupportedVersion.
    await refreshUpdatePolicy();
    void checkForUpdates();
  }

  scheduleBackendProbe();
  schedulePrinterProbe();
  scheduleUsbPrinterProbe();

  // If update is forced — do not connect to Socket.IO and do not perform any business actions.
  // UI will show a blocking screen with the update CTA.
  if (!updateAvailable?.forced) {
    connectSocket();
  } else {
    joined = false;
    joinError = "force_update_required";
  }
  sendStatus();
  log("info", "Приложение запущено");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  try {
    globalShortcut.unregisterAll();
  } catch {
    // ignore
  }
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("getStatus", async () => {
  const s = ensureSettings();
  return {
    connected: Boolean(socket?.connected),
    joined,
    joinError,
    warehouseRealtime: {
      connected: Boolean(socket?.connected),
      joined: warehouseJoined,
      joinError: warehouseJoinError,
    },
    backendUrl: s.backendUrl,
    backend: {
      httpOk: backendHttp.ok,
      httpError: backendHttp.error,
      checkedAt: backendHttp.checkedAt,
      httpStatus: backendHttp.status,
    },
    printer: { ...s.printer, host: s.printer.host || null, reachability: printerReachability, usbReachability: usbPrinterReachability },
    warehouse: s.warehouse,
    appVersion: app.getVersion(),
    update: {
      available: Boolean(updateAvailable),
      forced: Boolean(updateAvailable?.forced),
      message: updateAvailable?.message || "",
      downloading: updateDownloading,
      progress: updateProgress,
      error: updateError,
    },
    deviceAuth: {
      printerId: s.deviceAuth?.printerId || null,
      activated: Boolean(s.deviceAuth?.refreshToken),
    },
    warehouseAuth: {
      phone: s.warehouseAuth?.phone || null,
      hasToken: Boolean(s.warehouseAuth?.accessToken || s.warehouseAuth?.refreshToken),
    },
    window: {
      maximized: windowIsMaximized,
    },
  };
});

ipcMain.handle("getSettings", async () => {
  return ensureSettings();
});

ipcMain.handle("setSettings", async (_evt, next: Partial<Settings>) => {
  // Never allow renderer to overwrite auth tokens/client_id by accident.
  // Renderer UI often operates on a stale `settings` snapshot (tokens are updated in main on login/activate),
  // so sending back the full object can clear tokens and "log out" the user.
  const safeNext: Partial<Settings> = {
    backendUrl: next.backendUrl,
    printerClientToken: next.printerClientToken,
    printer: next.printer,
    warehouse: next.warehouse,
  };
	  settings = saveSettings(safeNext);
	  schedulePrinterProbe();
	  scheduleUsbPrinterProbe();
	  if (!updateAvailable?.forced) connectSocket();
	  sendStatus();
	  log("info", "Настройки сохранены");
	  return settings;
	});

ipcMain.handle("device:activate", async (_evt, payload: { code: string }) => {
  if (deviceActivationPromise) return await deviceActivationPromise;

  deviceActivationPromise = (async () => {
    const code = String(payload?.code || "")
      .trim()
      .toUpperCase();
    if (!code) throw new Error("code required");
    if (updateAvailable?.forced) throw new Error("force_update_required");

    const s = ensureSettings();
    log("info", "Device activation start");
    const res = await apiFetchJson("/api/device/activate", {
      method: "POST",
      json: {
        code,
        client_id: s.clientId,
        printer: {
          name: s.printer.name,
          ip: s.printer.host,
          port: s.printer.port,
          version: "check_printer_desktop",
        },
      },
      timeoutMs: 12000,
    });
    if (!res.ok) {
      const msg = res.json?.message || res.json?.error || res.json?.raw || `activate failed (${res.status})`;
      log("error", `Device activation failed: ${String(msg)}`);
      throw new Error(String(msg));
    }

    const access = res.json?.access_token ? String(res.json.access_token) : "";
    const refresh = res.json?.refresh_token ? String(res.json.refresh_token) : "";
    const printerId = res.json?.printer_id ? String(res.json.printer_id) : "";
    if (!access || !refresh || !printerId) throw new Error("activate: tokens missing");

    saveDeviceAuth({ printerId, accessToken: access, refreshToken: refresh });
    log("info", `Device activation OK printer_id=${printerId}`);

    if (!updateAvailable?.forced) connectSocket();
    sendStatus();
    return { ok: true as const, printer_id: printerId };
  })().finally(() => {
    deviceActivationPromise = null;
  });

  return await deviceActivationPromise;
});

ipcMain.handle("getLogs", async () => {
  return logs;
});

ipcMain.handle("printer:probe", async () => {
  await probePrinterReachabilityOnce();
  sendStatus();
  return printerReachability;
});

ipcMain.handle("usb:printers", async () => {
  return await listWindowsPrinters();
});

ipcMain.handle("usb:probe", async () => {
  await probeUsbPrinterReachabilityOnce();
  sendStatus();
  return usbPrinterReachability;
});

ipcMain.handle("usb:testPrint", async (_evt, text: string | undefined) => {
  const s = ensureSettings();
  const usbName = String(s.printer.usbPrinterName || "").trim();
  if (!usbName) throw new Error("USB принтер не выбран");

  const sample =
    text ||
    [
      "!CENTER ТЕСТ ПЕЧАТИ (USB)",
      "!LEFT",
      "Дата: " + new Date().toISOString(),
      "Проверка печати через Windows spooler (RAW)",
      "!BIG ИТОГО: 123 456 сум",
      "!NORMAL",
      "Спасибо!",
    ].join("\n");

  const job = buildEscPosJob(sample, { encoding: s.printer.encoding });
  await sendRawToWindowsPrinter({ printerName: usbName, payload: job, docName: "Mio beauty: тест (USB)" });
  log("info", "Тестовая печать (USB) отправлена");
  // Refresh probe after successful job submission so UI reflects current device state.
  try {
    await probeUsbPrinterReachabilityOnce();
  } catch {
    // ignore
  }
  sendStatus();
  return { ok: true };
});

ipcMain.handle("testPrint", async (_evt, text: string | undefined) => {
  const s = ensureSettings();
  const ep = parseLanEndpoint(s.printer);
  if (!ep.configured) throw new Error("Не настроен принтер (host пустой)");
  if (ep.error) throw new Error(ep.error);
  const sample =
    text ||
    [
      "!CENTER ТЕСТ ПЕЧАТИ",
      "!LEFT",
      "Дата: " + new Date().toISOString(),
      "Проверка связи с принтером",
      "!BIG ИТОГО: 123 456 сум",
      "!NORMAL",
      "Спасибо!",
    ].join("\n");
  const checkedAtMs = printerReachability.checkedAt ? Date.parse(printerReachability.checkedAt) : 0;
  const fresh = checkedAtMs && Date.now() - checkedAtMs < 12_000;
  const reachErr = printerReachability.error || "unknown";
  const reachErrLower = String(reachErr).toLowerCase();
  const softFail = reachErrLower === "timeout" || reachErrLower.includes("timeout");
  if (fresh && printerReachability.configured && !printerReachability.ok && !softFail) {
    throw new Error(`printer_unreachable: ${printerReachability.error || "unknown"}`);
  }

  const job = buildEscPosJob(sample, { encoding: s.printer.encoding });
  await sendToTcpPrinter(job, { host: ep.host, port: ep.port, timeoutMs: softFail ? 2500 : 5000 });
  log("info", "Тестовая печать отправлена");
  return { ok: true };
});

ipcMain.handle("checkUpdates", async () => {
  if (isDev()) return { available: false, forced: false, message: "dev mode" };
  await refreshUpdatePolicy();
  await checkForUpdates();
  return {
    available: Boolean(updateAvailable),
    forced: Boolean(updateAvailable?.forced),
    message: updateAvailable?.message || "",
  };
});

ipcMain.handle("startUpdate", async () => {
  if (isDev()) return;
  log("info", "Update requested by user");
  // Ensure we have the latest policy and/or updater metadata.
  await refreshUpdatePolicy();
  await checkForUpdates();
  if (!updateAvailable) return;
  updateError = null;
  updateDownloading = true;
  updateProgress = 0;
  sendStatus();
  try {
    if (!autoUpdater || typeof autoUpdater.downloadUpdate !== "function") {
      throw new Error("autoUpdater недоступен");
    }
    await autoUpdater.downloadUpdate();
  } catch (e) {
    updateDownloading = false;
    updateError = String(e);
    sendStatus();
    // Avoid opening the installer automatically (user requested not to see it).
    // Provide a link in the error so the user can download manually if needed.
    const url = updatePolicy?.downloadUrl;
    if (url) updateError = `${updateError}\nСкачать установщик: ${url}`;
    sendStatus();
    return;
  }
  updateDownloading = false;
  sendStatus();
  // Silent install with auto relaunch.
  try {
    autoUpdater.quitAndInstall(true, true);
  } catch {
    // ignore
  }
});

ipcMain.handle("window:minimize", async () => {
  mainWindow?.minimize();
});

ipcMain.handle("window:toggleMaximize", async () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});

ipcMain.handle("window:close", async () => {
  mainWindow?.close();
});

ipcMain.handle("warehouse:login", async (_evt, payload: { phone: string; password: string }) => {
  const phone = String(payload?.phone || "").trim().replace(/\s+/g, "");
  const password = String(payload?.password || "");
  if (!phone || !password) throw new Error("phone and password required");

  log("info", `Warehouse login start (${phone})`);
  const res = await apiFetchJson("/api/auth/login", {
    method: "POST",
    json: { phone, password },
    timeoutMs: 12000,
  });
  if (!res.ok) {
    const msg = res.json?.message || res.json?.error || res.json?.raw || `login failed (${res.status})`;
    log("error", `Warehouse login failed (${phone}): ${String(msg)}`);
    throw new Error(String(msg));
  }
  const access = res.json?.access_token ? String(res.json.access_token) : "";
  const refresh = res.json?.refresh_token ? String(res.json.refresh_token) : "";
  if (!access || !refresh) throw new Error("login: tokens missing");

  saveWarehouseAuth({ phone, accessToken: access, refreshToken: refresh });
  log("info", `Warehouse login OK (${phone})`);
  void joinWarehouseSocket();
  sendStatus();
  return { ok: true };
});

ipcMain.handle("warehouse:logout", async () => {
  saveWarehouseAuth({ accessToken: null, refreshToken: null });
  leaveWarehouseSocket();
  log("info", "Warehouse logout");
  sendStatus();
  return { ok: true };
});

ipcMain.handle(
  "warehouse:orders",
  async (
    _evt,
    params: { status?: string | null; q?: string | null; limit?: number; offset?: number; problemsOnly?: boolean },
  ) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", String(params.status));
    if (params?.q) qs.set("q", String(params.q));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    if (params?.problemsOnly) qs.set("problems", "1");
    const url = `/api/warehouse/orders${qs.toString() ? `?${qs.toString()}` : ""}`;

    const res = await warehouseRequestJson(url, { method: "GET", timeoutMs: 12000 });
    if (!res.ok) {
      const msg = res.json?.message || `warehouse/orders failed (${res.status})`;
      throw new Error(String(msg));
    }
    return res.json;
  },
);

ipcMain.handle("warehouse:orderDetail", async (_evt, queueId: number) => {
  const res = await warehouseRequestJson(`/api/warehouse/orders/${Number(queueId)}`, { method: "GET", timeoutMs: 12000 });
  if (!res.ok) {
    const msg = res.json?.message || `warehouse/order failed (${res.status})`;
    throw new Error(String(msg));
  }
  return res.json;
});

ipcMain.handle("warehouse:orderEvents", async (_evt, queueId: number) => {
  const res = await warehouseRequestJson(`/api/warehouse/orders/${Number(queueId)}/events`, { method: "GET", timeoutMs: 12000 });
  if (!res.ok) {
    const msg = res.json?.message || `warehouse/events failed (${res.status})`;
    throw new Error(String(msg));
  }
  return res.json;
});

ipcMain.handle("warehouse:printRetry", async (_evt, queueId: number) => {
  const res = await warehouseRequestJson(`/api/warehouse/orders/${Number(queueId)}/print/retry`, { method: "POST", timeoutMs: 12000 });
  if (!res.ok) {
    const msg = res.json?.message || `warehouse/printRetry failed (${res.status})`;
    throw new Error(String(msg));
  }
  return res.json;
});

ipcMain.handle("warehouse:reasons", async () => {
  const res = await warehouseRequestJson(`/api/warehouse/reasons`, { method: "GET", timeoutMs: 12000 });
  if (!res.ok) {
    const msg = res.json?.message || `warehouse/reasons failed (${res.status})`;
    throw new Error(String(msg));
  }
  return res.json;
});

ipcMain.handle("warehouse:pickingStart", async (_evt, queueId: number) => {
  log("info", `Picking start queueId=${Number(queueId)}`);
  try {
    const json = await warehouseActionRequest({
      label: "picking/start",
      event: "warehouse:picking_start",
      payload: { queue_id: Number(queueId) },
      path: `/api/warehouse/orders/${Number(queueId)}/picking/start`,
    });
    log("info", `Picking start OK queueId=${Number(queueId)}`);
    return json;
  } catch (e) {
    log("error", `Picking start failed queueId=${Number(queueId)}: ${String(e)}`);
    throw e;
  }
});

ipcMain.handle("warehouse:pickingScan", async (_evt, payload: { queueId: number; code: string }) => {
  const queueId = Number(payload?.queueId);
  const code = String(payload?.code || "").trim();
  if (!queueId || !code) throw new Error("queueId and code required");

  log("info", `Picking scan queueId=${queueId} code=${JSON.stringify(code)}`);
  try {
    const json = await warehouseActionRequest({
      label: "picking/scan",
      event: "warehouse:picking_scan",
      payload: { queue_id: queueId, code },
      path: `/api/warehouse/orders/${queueId}/picking/scan`,
      body: { code },
    });
    log("info", `Picking scan OK queueId=${queueId}`);
    return json;
  } catch (e) {
    log("error", `Picking scan failed queueId=${queueId}: ${String(e)}`);
    throw e;
  }
});

ipcMain.handle(
  "warehouse:pickingFinish",
  async (_evt, payload: { queueId: number; reason_code?: string | null; comment?: string | null }) => {
    const queueId = Number(payload?.queueId);
    if (!queueId) throw new Error("queueId required");
    const reason_code = payload?.reason_code ? String(payload.reason_code).trim() : "";
    const comment = payload?.comment ? String(payload.comment).trim() : "";

    log(
      "info",
      `Picking finish queueId=${queueId} reason_code=${reason_code ? JSON.stringify(reason_code) : "null"} comment=${
        comment ? JSON.stringify(comment) : "null"
      }`,
    );
    const body: any = {};
    if (reason_code) body.reason_code = reason_code;
    if (comment) body.comment = comment;

    try {
      const json = await warehouseActionRequest({
        label: "picking/finish",
        event: "warehouse:picking_finish",
        payload: { queue_id: queueId, ...(reason_code ? { reason_code } : {}), ...(comment ? { comment } : {}) },
        path: `/api/warehouse/orders/${queueId}/picking/finish`,
        body: Object.keys(body).length ? body : undefined,
      });
      log("info", `Picking finish OK queueId=${queueId}`);
      return json;
    } catch (e) {
      log("error", `Picking finish failed queueId=${queueId}: ${String(e)}`);
      throw e;
    }
  },
);

ipcMain.handle(
  "warehouse:pickingFail",
  async (_evt, payload: { queueId: number; reason_code: string; comment?: string | null }) => {
    const queueId = Number(payload?.queueId);
    const reason_code = String(payload?.reason_code || "").trim();
    const comment = payload?.comment ? String(payload.comment).trim() : "";
    if (!queueId || !reason_code) throw new Error("queueId and reason_code required");

    log(
      "info",
      `Picking fail queueId=${queueId} reason_code=${JSON.stringify(reason_code)} comment=${comment ? JSON.stringify(comment) : "null"}`,
    );

    const body: any = { reason_code };
    if (comment) body.comment = comment;

    try {
      const json = await warehouseActionRequest({
        label: "picking/fail",
        event: "warehouse:picking_fail",
        payload: { queue_id: queueId, reason_code, ...(comment ? { comment } : {}) },
        path: `/api/warehouse/orders/${queueId}/picking/fail`,
        body,
      });
      log("info", `Picking fail OK queueId=${queueId}`);
      return json;
    } catch (e) {
      log("error", `Picking fail failed queueId=${queueId}: ${String(e)}`);
      throw e;
    }
  },
);
