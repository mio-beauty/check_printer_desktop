import { BrowserWindow, Menu, app, ipcMain } from "electron";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { io, Socket } from "socket.io-client";
import semver from "semver";
import { buildEscPosJob } from "./escpos.js";
import { sendToTcpPrinter } from "./lan_printer.js";
import { loadSettings, saveSettings, Settings } from "./settings.js";

const require = createRequire(import.meta.url);
const { autoUpdater } = require("electron-updater") as { autoUpdater: any };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let socket: Socket | null = null;
let settings: Settings | null = null;
let joined = false;
let joinError: string | null = null;
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
let backendHttp: { ok: boolean; checkedAt: string | null; error: string | null } = { ok: false, checkedAt: null, error: null };
let printerReachability: { configured: boolean; ok: boolean; checkedAt: string | null; error: string | null } = {
  configured: false,
  ok: false,
  checkedAt: null,
  error: null,
};
let printerProbeTimer: NodeJS.Timeout | null = null;
let windowIsMaximized = false;
let policyUpdate: { forced: boolean; message: string } | null = null;
let updaterUpdate: { message: string } | null = null;

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

function log(level: LogEntry["level"], message: string) {
  const entry: LogEntry = { ts: new Date().toISOString(), level, message };
  logs.push(entry);
  if (logs.length > 300) logs.splice(0, logs.length - 300);
  mainWindow?.webContents.send("log", entry);
}

function setBackendHttpState(next: { ok: boolean; error: string | null; checkedAt: string }) {
  const changed = backendHttp.ok !== next.ok || backendHttp.error !== next.error;
  backendHttp = { ok: next.ok, error: next.error, checkedAt: next.checkedAt };
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
}

async function probePrinterReachabilityOnce() {
  const s = ensureSettings();
  const host = String(s.printer.host || "").trim();
  const port = Number(s.printer.port || 0);
  const checkedAt = new Date().toISOString();

  if (!host) {
    setPrinterReachability({ configured: false, ok: false, error: "printer_not_configured", checkedAt });
    return;
  }
  if (!Number.isFinite(port) || port <= 0) {
    setPrinterReachability({ configured: true, ok: false, error: "invalid_port", checkedAt });
    return;
  }

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

    socket.setTimeout(900);
    socket.once("connect", () => finish(true, null));
    socket.once("timeout", () => finish(false, "timeout"));
    socket.once("error", (e: any) => {
      const code = e?.code ? String(e.code) : "";
      const msg = e?.message ? String(e.message) : String(e);
      finish(false, code ? `${code}${msg && !msg.includes(code) ? `: ${msg}` : ""}` : msg);
    });

    try {
      socket.connect(port, host);
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

function sendStatus() {
  const s = ensureSettings();
  mainWindow?.webContents.send("status", {
    connected: Boolean(socket?.connected),
    joined,
    joinError,
    backendUrl: s.backendUrl,
    backend: {
      httpOk: backendHttp.ok,
      httpError: backendHttp.error,
      checkedAt: backendHttp.checkedAt,
    },
    printer: {
      host: s.printer.host || null,
      port: s.printer.port,
      encoding: s.printer.encoding,
      name: s.printer.name,
      reachability: printerReachability,
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
      hasToken: Boolean(s.warehouseAuth?.accessToken),
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
    setBackendHttpState({ ok: true, error: null, checkedAt: new Date().toISOString() });
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
    setBackendHttpState({ ok: false, error: details, checkedAt: new Date().toISOString() });
    return { ok: false, status: 0, json: { raw: details } };
  } finally {
    clearTimeout(t);
  }
}

async function warehouseRequestJson(
  path: string,
  opts: { method?: string; json?: any; timeoutMs?: number } = {},
): Promise<{ ok: boolean; status: number; json: any }> {
  const auth = warehouseAuth();
  const headers: Record<string, string> = {};
  if (auth.accessToken) headers.authorization = `Bearer ${auth.accessToken}`;

  let res = await apiFetchJson(path, { method: opts.method, json: opts.json, timeoutMs: opts.timeoutMs, headers });
  if (res.status !== 401) return res;

  // try refresh once
  if (!auth.refreshToken) return res;
  try {
    const refreshed = await apiFetchJson("/api/auth/refresh", {
      method: "POST",
      json: { refresh_token: auth.refreshToken },
      timeoutMs: 8000,
    });
    if (!refreshed.ok || !refreshed.json?.access_token || !refreshed.json?.refresh_token) return res;
    saveWarehouseAuth({
      accessToken: String(refreshed.json.access_token),
      refreshToken: String(refreshed.json.refresh_token),
    });
    const auth2 = warehouseAuth();
    const headers2: Record<string, string> = { authorization: `Bearer ${auth2.accessToken}` };
    res = await apiFetchJson(path, { method: opts.method, json: opts.json, timeoutMs: opts.timeoutMs, headers: headers2 });
    sendStatus();
    return res;
  } catch {
    return res;
  }
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

  socket.on("connect", () => {
    log("info", `Socket.IO подключён к ${url}`);
    joined = false;
    joinError = null;
    const s = ensureSettings();
    socket?.emit("join", {
      room: "local_printer",
      token: s.printerClientToken,
      client_id: s.clientId,
      printer: {
        name: s.printer.name,
        ip: s.printer.host,
        port: s.printer.port,
        version: "check_printer_desktop",
      },
      warehouse: s.warehouse,
    });
    sendStatus();
  });
  socket.on("disconnect", () => {
    log("warn", "Socket.IO отключён");
    joined = false;
    sendStatus();
  });
  socket.on("connect_error", (e) => {
    log("error", `Socket.IO ошибка подключения: ${String(e)}`);
    joined = false;
    sendStatus();
  });

  socket.on("join_ok", (payload) => {
    joined = true;
    joinError = null;
    log("info", `join_ok: ${JSON.stringify(payload || {})}`);
    sendStatus();
  });

  socket.on("join_error", (payload) => {
    joined = false;
    joinError = String((payload || {}).reason || "unknown");
    log("error", `join_error: ${joinError}`);
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
      const s = ensureSettings();
      const host = s.printer.host;
      const port = s.printer.port;
      if (!host) throw new Error("Не настроен принтер (host пустой)");

      log("info", `Печать заказа id=${orderId} number=${number} job=${printJobId} attempt=${payload?.attempt}`);
      const checkedAtMs = printerReachability.checkedAt ? Date.parse(printerReachability.checkedAt) : 0;
      const fresh = checkedAtMs && Date.now() - checkedAtMs < 12_000;
      if (fresh && printerReachability.configured && !printerReachability.ok) {
        throw new Error(`printer_unreachable: ${printerReachability.error || "unknown"}`);
      }

      const job = buildEscPosJob(text, { encoding: s.printer.encoding });
      await sendToTcpPrinter(job, { host, port, timeoutMs: 5000 });

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
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }

  if (!isDev()) {
    configureAutoUpdater();
    // Policy can block the app if current version < minSupportedVersion.
    await refreshUpdatePolicy();
    void checkForUpdates();
  }

  schedulePrinterProbe();

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
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("getStatus", async () => {
  const s = ensureSettings();
  return {
    connected: Boolean(socket?.connected),
    joined,
    joinError,
    backendUrl: s.backendUrl,
    backend: {
      httpOk: backendHttp.ok,
      httpError: backendHttp.error,
      checkedAt: backendHttp.checkedAt,
    },
    printer: { ...s.printer, host: s.printer.host || null, reachability: printerReachability },
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
    warehouseAuth: {
      phone: s.warehouseAuth?.phone || null,
      hasToken: Boolean(s.warehouseAuth?.accessToken),
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
  settings = saveSettings(next);
  schedulePrinterProbe();
  if (!updateAvailable?.forced) connectSocket();
  sendStatus();
  log("info", "Настройки сохранены");
  return settings;
});

ipcMain.handle("getLogs", async () => {
  return logs;
});

ipcMain.handle("testPrint", async (_evt, text: string | undefined) => {
  const s = ensureSettings();
  const host = s.printer.host;
  const port = s.printer.port;
  if (!host) throw new Error("Не настроен принтер (host пустой)");
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
  if (fresh && printerReachability.configured && !printerReachability.ok) {
    throw new Error(`printer_unreachable: ${printerReachability.error || "unknown"}`);
  }

  const job = buildEscPosJob(sample, { encoding: s.printer.encoding });
  await sendToTcpPrinter(job, { host, port, timeoutMs: 5000 });
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
  sendStatus();
  return { ok: true };
});

ipcMain.handle("warehouse:logout", async () => {
  saveWarehouseAuth({ accessToken: null, refreshToken: null });
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
  const res = await warehouseRequestJson(`/api/warehouse/orders/${Number(queueId)}/picking/start`, { method: "POST", timeoutMs: 12000 });
  if (!res.ok) {
    const msg = res.json?.message || `picking/start failed (${res.status})`;
    log("error", `Picking start failed queueId=${Number(queueId)}: ${String(msg)}`);
    throw new Error(String(msg));
  }
  log("info", `Picking start OK queueId=${Number(queueId)}`);
  return res.json;
});

ipcMain.handle("warehouse:pickingScan", async (_evt, payload: { queueId: number; code: string }) => {
  const queueId = Number(payload?.queueId);
  const code = String(payload?.code || "").trim();
  if (!queueId || !code) throw new Error("queueId and code required");

  log("info", `Picking scan queueId=${queueId} code=${JSON.stringify(code)}`);
  const res = await warehouseRequestJson(`/api/warehouse/orders/${queueId}/picking/scan`, {
    method: "POST",
    json: { code },
    timeoutMs: 12000,
  });
  if (!res.ok) {
    const msg = res.json?.message || `picking/scan failed (${res.status})`;
    log("error", `Picking scan failed queueId=${queueId}: ${String(msg)}`);
    throw new Error(String(msg));
  }
  log("info", `Picking scan OK queueId=${queueId}`);
  return res.json;
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

    const res = await warehouseRequestJson(`/api/warehouse/orders/${queueId}/picking/finish`, {
      method: "POST",
      json: Object.keys(body).length ? body : undefined,
      timeoutMs: 12000,
    });
    if (!res.ok) {
      const msg = res.json?.message || `picking/finish failed (${res.status})`;
      log("error", `Picking finish failed queueId=${queueId}: ${String(msg)}`);
      throw new Error(String(msg));
    }
    log("info", `Picking finish OK queueId=${queueId}`);
    return res.json;
  },
);
