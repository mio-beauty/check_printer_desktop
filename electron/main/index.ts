import { BrowserWindow, app, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { io, Socket } from "socket.io-client";

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

function sendStatus() {
  mainWindow?.webContents.send("status", {
    connected: Boolean(socket?.connected),
    backendUrl: getBackendUrl(),
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
    // TODO: локальная печать (LAN 9100 + USB RAW) и ack обратно в backend.
    // Сейчас только заглушка — не отправляем success, чтобы не было ложных "напечатано".
    const orderId = payload?.id;
    const number = payload?.number;
    const printJobId = payload?.print_job_id;
    const requestId = payload?.request_id;
    socket?.emit("printed_false", {
      id: orderId,
      number,
      error: "Печать ещё не настроена в desktop-клиенте",
      print_job_id: printJobId,
      request_id: requestId,
    });
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev()) {
    await mainWindow.loadURL("http://127.0.0.1:5173");
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
  return { connected: Boolean(socket?.connected), backendUrl: getBackendUrl() };
});

ipcMain.handle("checkUpdates", async () => {
  // TODO: подключим update-manifest.json + electron-updater.
  // Пока возвращаем "нет обновления".
  return { available: false, forced: false, message: "" };
});

ipcMain.handle("startUpdate", async () => {
  // TODO: downloadUpdate + quitAndInstall.
});

