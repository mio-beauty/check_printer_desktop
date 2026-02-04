import { BrowserWindow, app, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { io, Socket } from "socket.io-client";
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
  });
}

function connectSocket() {
  const url = ensureSettings().backendUrl;
  socket?.disconnect();
  socket = io(url, { path: "/socket.io", transports: ["polling", "websocket"] });

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
  // TODO: подключим update-manifest.json + electron-updater.
  // Пока возвращаем "нет обновления".
  return { available: false, forced: false, message: "" };
});

ipcMain.handle("startUpdate", async () => {
  // TODO: downloadUpdate + quitAndInstall.
});
