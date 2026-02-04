import { BrowserWindow, app, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { io, Socket } from "socket.io-client";
import { buildEscPosJob } from "./escpos.js";
import { sendToTcpPrinter } from "./lan_printer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let socket: Socket | null = null;

function isDev(): boolean {
  return !app.isPackaged;
}

function getBackendUrl(): string {
  return (process.env.BACKEND_URL || "https://printer.backend.miobeauty.uz").trim();
}

function getPrinterHost(): string {
  const v = (process.env.PRINTER_IP || "").trim();
  if (v) return v;
  // удобно для разработки без реального принтера: используем fake printer на localhost:9100
  return isDev() ? "127.0.0.1" : "";
}

function getPrinterPort(): number {
  const raw = (process.env.PRINTER_PORT || "").trim();
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return 9100;
}

function getPrinterEncoding(): string {
  return (process.env.PRINTER_ENCODING || "cp866").trim() || "cp866";
}

function sendStatus() {
  mainWindow?.webContents.send("status", {
    connected: Boolean(socket?.connected),
    backendUrl: getBackendUrl(),
    printer: {
      host: getPrinterHost() || null,
      port: getPrinterPort(),
      encoding: getPrinterEncoding(),
    },
  });
}

function connectSocket() {
  const url = getBackendUrl();
  socket?.disconnect();
  socket = io(url, { path: "/socket.io", transports: ["polling", "websocket"] });

  socket.on("connect", () => sendStatus());
  socket.on("disconnect", () => sendStatus());
  socket.on("connect_error", () => sendStatus());

  socket.on("print_text", async (payload) => {
    const orderId = payload?.id;
    const number = payload?.number;
    const printJobId = payload?.print_job_id;
    const requestId = payload?.request_id;
    const text = String(payload?.text || "");

    try {
      const host = getPrinterHost();
      const port = getPrinterPort();
      if (!host) throw new Error("Не настроен PRINTER_IP");

      const job = buildEscPosJob(text, { encoding: getPrinterEncoding() });
      await sendToTcpPrinter(job, { host, port, timeoutMs: 5000 });

      socket?.emit("printed_true", {
        id: orderId,
        number,
        print_job_id: printJobId,
        request_id: requestId,
      });
    } catch (e) {
      socket?.emit("printed_false", {
        id: orderId,
        number,
        error: String(e),
        print_job_id: printJobId,
        request_id: requestId,
      });
    }
  });
}

async function createWindow() {
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
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("getStatus", async () => {
  return {
    connected: Boolean(socket?.connected),
    backendUrl: getBackendUrl(),
    printer: {
      host: getPrinterHost() || null,
      port: getPrinterPort(),
      encoding: getPrinterEncoding(),
    },
  };
});

ipcMain.handle("testPrint", async (_evt, text: string | undefined) => {
  const host = getPrinterHost();
  const port = getPrinterPort();
  if (!host) throw new Error("Не настроен PRINTER_IP");
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
  const job = buildEscPosJob(sample, { encoding: getPrinterEncoding() });
  await sendToTcpPrinter(job, { host, port, timeoutMs: 5000 });
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
