import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type Settings = {
  backendUrl: string;
  printerClientToken: string | null;
  clientId: string;
  printer: {
    host: string;
    port: number;
    encoding: string;
    name: string;
  };
  warehouse: {
    name: string;
    lat: number | null;
    lon: number | null;
  };
};

function isDev(): boolean {
  return !app.isPackaged;
}

function defaultSettings(): Settings {
  const backendUrl = (process.env.BACKEND_URL || "https://printer.backend.miobeauty.uz").trim();
  const printerClientToken = (process.env.PRINTER_CLIENT_TOKEN || "").trim() || null;
  const hostEnv = (process.env.PRINTER_IP || "").trim();
  const host = hostEnv || (isDev() ? "127.0.0.1" : "");

  const portEnv = (process.env.PRINTER_PORT || "").trim();
  const portParsed = Number(portEnv);
  const port = Number.isFinite(portParsed) && portParsed > 0 ? portParsed : 9100;

  const encoding = (process.env.PRINTER_ENCODING || "cp866").trim() || "cp866";
  const name = (process.env.PRINTER_NAME || "").trim() || "CheckPrinterClient";
  const warehouseName = (process.env.WAREHOUSE_NAME || "").trim() || "Sklad";

  return {
    backendUrl,
    printerClientToken,
    clientId: crypto.randomUUID(),
    printer: { host, port, encoding, name },
    warehouse: { name: warehouseName, lat: null, lon: null },
  };
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
      printerClientToken:
        (typeof parsed?.printerClientToken === "string" ? parsed.printerClientToken : "")?.trim() || defaults.printerClientToken,
      clientId: String(parsed?.clientId || defaults.clientId),
      printer: {
        host: String(parsed?.printer?.host || defaults.printer.host),
        port: Number(parsed?.printer?.port || defaults.printer.port),
        encoding: String(parsed?.printer?.encoding || defaults.printer.encoding),
        name: String(parsed?.printer?.name || defaults.printer.name),
      },
      warehouse: {
        name: String(parsed?.warehouse?.name || defaults.warehouse.name),
        lat: parsed?.warehouse?.lat === null || parsed?.warehouse?.lat === undefined ? null : Number(parsed.warehouse.lat),
        lon: parsed?.warehouse?.lon === null || parsed?.warehouse?.lon === undefined ? null : Number(parsed.warehouse.lon),
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
    printerClientToken:
      partial.printerClientToken !== undefined
        ? (String(partial.printerClientToken || "").trim() || null)
        : current.printerClientToken,
    clientId: partial.clientId !== undefined ? String(partial.clientId) : current.clientId,
    printer: {
      host: partial.printer?.host !== undefined ? String(partial.printer.host) : current.printer.host,
      port: partial.printer?.port !== undefined ? Number(partial.printer.port) : current.printer.port,
      encoding: partial.printer?.encoding !== undefined ? String(partial.printer.encoding) : current.printer.encoding,
      name: partial.printer?.name !== undefined ? String(partial.printer.name) : current.printer.name,
    },
    warehouse: {
      name: partial.warehouse?.name !== undefined ? String(partial.warehouse.name) : current.warehouse.name,
      lat:
        partial.warehouse?.lat !== undefined
          ? (partial.warehouse.lat === null ? null : Number(partial.warehouse.lat))
          : current.warehouse.lat,
      lon:
        partial.warehouse?.lon !== undefined
          ? (partial.warehouse.lon === null ? null : Number(partial.warehouse.lon))
          : current.warehouse.lon,
    },
  };
  const p = settingsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}
