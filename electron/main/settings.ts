import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export type Settings = {
  backendUrl: string;
  printer: {
    host: string;
    port: number;
    encoding: string;
  };
};

function isDev(): boolean {
  return !app.isPackaged;
}

function defaultSettings(): Settings {
  const backendUrl = (process.env.BACKEND_URL || "https://printer.backend.miobeauty.uz").trim();
  const hostEnv = (process.env.PRINTER_IP || "").trim();
  const host = hostEnv || (isDev() ? "127.0.0.1" : "");

  const portEnv = (process.env.PRINTER_PORT || "").trim();
  const portParsed = Number(portEnv);
  const port = Number.isFinite(portParsed) && portParsed > 0 ? portParsed : 9100;

  const encoding = (process.env.PRINTER_ENCODING || "cp866").trim() || "cp866";

  return { backendUrl, printer: { host, port, encoding } };
}

function settingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

export function loadSettings(): Settings {
  const defaults = defaultSettings();
  const p = settingsPath();
  try {
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      backendUrl: String(parsed?.backendUrl || defaults.backendUrl),
      printer: {
        host: String(parsed?.printer?.host || defaults.printer.host),
        port: Number(parsed?.printer?.port || defaults.printer.port),
        encoding: String(parsed?.printer?.encoding || defaults.printer.encoding),
      },
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(partial: Partial<Settings>): Settings {
  const current = loadSettings();
  const merged: Settings = {
    backendUrl: partial.backendUrl !== undefined ? String(partial.backendUrl) : current.backendUrl,
    printer: {
      host: partial.printer?.host !== undefined ? String(partial.printer.host) : current.printer.host,
      port: partial.printer?.port !== undefined ? Number(partial.printer.port) : current.printer.port,
      encoding: partial.printer?.encoding !== undefined ? String(partial.printer.encoding) : current.printer.encoding,
    },
  };
  const p = settingsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}

