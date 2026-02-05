import { BrowserWindow, Menu, app, dialog, ipcMain } from "electron";
import { createRequire } from "node:module";
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
let windowIsMaximized = false;

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
    printer: {
      host: s.printer.host || null,
      port: s.printer.port,
      encoding: s.printer.encoding,
      name: s.printer.name,
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
  const base = String(s.backendUrl || "").replace(/\/+$/, "");
  const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : `${base}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;

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
    log("error", `HTTP FAIL ${opts.method || "GET"} ${url}: ${String(e)}`);
    return { ok: false, status: 0, json: { raw: String(e) } };
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
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info: any) => {
    updateAvailable = { forced: false, message: `Доступна новая версия: ${info.version}` };
    updateDownloading = false;
    updateProgress = null;
    updateError = null;
    log("info", `Update available: ${info.version}`);
    sendStatus();
  });

  autoUpdater.on("update-not-available", (info: any) => {
    updateAvailable = null;
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
  const s = ensureSettings();
  const base = String(s.backendUrl || "").replace(/\/+$/, "");
  if (!base) return;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${base}/api/desktop/update-manifest`, {
      method: "GET",
      headers: { "accept": "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return;
    const json = await res.json().catch(() => null);
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
      // keep message from updater (if any), but clear forced flag
      if (updateAvailable) updateAvailable = { ...updateAvailable, forced: false };
      sendStatus();
      return;
    }

    const verLabel = updatePolicy.latestVersion || updatePolicy.minSupportedVersion || "";
    const notes = (updatePolicy.notes || "").trim();
    const msgBase = forced ? `Обновление обязательно (требуется версия >= ${updatePolicy.minSupportedVersion}).` : `Доступна новая версия: ${verLabel}`;
    const msg = notes ? `${msgBase}\n${notes}` : msgBase;

    updateAvailable = updateAvailable
      ? { forced: updateAvailable.forced || forced, message: msg || updateAvailable.message }
      : { forced, message: msg };

    sendStatus();
  } catch (e) {
    log("warn", `update-manifest недоступен: ${String(e)}`);
  } finally {
    clearTimeout(t);
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
    void checkForUpdates();
    void refreshUpdatePolicy();
  }

  connectSocket();
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
    printer: { ...s.printer, host: s.printer.host || null },
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
  connectSocket();
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
  if (!updateAvailable) return;
  updateError = null;
  updateDownloading = true;
  updateProgress = 0;
  sendStatus();
  await autoUpdater.downloadUpdate();
  updateDownloading = false;
  sendStatus();
  const res = await (mainWindow
    ? dialog.showMessageBox(mainWindow, {
        type: "info",
        message: "Обновление скачано",
        detail: "Перезапустить приложение сейчас, чтобы установить обновление?",
        buttons: ["Перезапустить", "Позже"],
        defaultId: 0,
        cancelId: 1,
      })
    : dialog.showMessageBox({
        type: "info",
        message: "Обновление скачано",
        detail: "Перезапустить приложение сейчас, чтобы установить обновление?",
        buttons: ["Перезапустить", "Позже"],
        defaultId: 0,
        cancelId: 1,
      }));
  if (res.response === 0) {
    autoUpdater.quitAndInstall();
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
  async (_evt, params: { status?: string | null; q?: string | null; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", String(params.status));
    if (params?.q) qs.set("q", String(params.q));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
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

ipcMain.handle("warehouse:pickingStart", async (_evt, queueId: number) => {
  const res = await warehouseRequestJson(`/api/warehouse/orders/${Number(queueId)}/picking/start`, { method: "POST", timeoutMs: 12000 });
  if (!res.ok) {
    const msg = res.json?.message || `picking/start failed (${res.status})`;
    throw new Error(String(msg));
  }
  return res.json;
});
