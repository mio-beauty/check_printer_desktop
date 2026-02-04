import { BrowserWindow, app, dialog, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { io, Socket } from "socket.io-client";
import { autoUpdater } from "electron-updater";
import semver from "semver";
import { buildEscPosJob } from "./escpos.js";
import { sendToTcpPrinter } from "./lan_printer.js";
import { loadSettings, saveSettings, Settings } from "./settings.js";

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
let updatePolicy: {
  latestVersion: string | null;
  minSupportedVersion: string | null;
  downloadUrl: string | null;
  notes: string | null;
} | null = null;

function isDev(): boolean {
  return !app.isPackaged;
}

type LogEntry = { ts: string; level: "info" | "warn" | "error"; message: string };
const logs: LogEntry[] = [];

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
      error: updateError,
    },
  });
}

function configureAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    updateAvailable = { forced: false, message: `Доступна новая версия: ${info.version}` };
    updateDownloading = false;
    updateError = null;
    log("info", `Update available: ${info.version}`);
    sendStatus();
  });

  autoUpdater.on("update-not-available", (info) => {
    updateAvailable = null;
    updateDownloading = false;
    updateError = null;
    log("info", `No updates: ${info.version}`);
    sendStatus();
  });

  autoUpdater.on("error", (err) => {
    updateError = String(err);
    updateDownloading = false;
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
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
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
      error: updateError,
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
