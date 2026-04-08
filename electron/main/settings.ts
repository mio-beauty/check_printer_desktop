import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type Settings = {
  backendUrl: string;
  printerClientToken: string | null;
  clientId: string;
  debug?: {
    forceWarehouseHttp?: boolean;
  };
  deviceAuth?: {
    printerId: string | null;
    accessToken: string | null;
    refreshToken: string | null;
  };
  warehouseAuth?: {
    phone: string | null;
    accessToken: string | null;
    refreshToken: string | null;
  };
  printer: {
    host: string;
    port: number;
    encoding: string;
    codepage?: number | null;
    name: string;
    mode?: "lan" | "usb" | "lan_then_usb";
    usbPrinterName?: string | null;
    errorSoundId?: string | null;
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
  const codepageEnv = (process.env.PRINTER_CODEPAGE || "").trim();
  const codepageParsed = codepageEnv ? Number.parseInt(codepageEnv, 10) : NaN;
  const codepage = Number.isFinite(codepageParsed) ? codepageParsed : 17;
  const name = (process.env.PRINTER_NAME || "").trim() || "Mio beauty Склад принтер";
  const warehouseName = (process.env.WAREHOUSE_NAME || "").trim() || "Sklad";

  return {
    backendUrl,
    printerClientToken,
    clientId: crypto.randomUUID(),
    debug: { forceWarehouseHttp: false },
    deviceAuth: { printerId: null, accessToken: null, refreshToken: null },
    warehouseAuth: { phone: null, accessToken: null, refreshToken: null },
    printer: { host, port, encoding, codepage, name, mode: "lan_then_usb", usbPrinterName: null, errorSoundId: null },
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
      debug: {
        forceWarehouseHttp:
          parsed?.debug?.forceWarehouseHttp === undefined
            ? Boolean(defaults.debug?.forceWarehouseHttp)
            : Boolean(parsed.debug.forceWarehouseHttp),
      },
      deviceAuth: {
        printerId: (typeof parsed?.deviceAuth?.printerId === "string" ? parsed.deviceAuth.printerId : "")?.trim() || null,
        accessToken: (typeof parsed?.deviceAuth?.accessToken === "string" ? parsed.deviceAuth.accessToken : "")?.trim() || null,
        refreshToken: (typeof parsed?.deviceAuth?.refreshToken === "string" ? parsed.deviceAuth.refreshToken : "")?.trim() || null,
      },
      warehouseAuth: {
        phone: (typeof parsed?.warehouseAuth?.phone === "string" ? parsed.warehouseAuth.phone : "")?.trim() || null,
        accessToken:
          (typeof parsed?.warehouseAuth?.accessToken === "string" ? parsed.warehouseAuth.accessToken : "")?.trim() || null,
        refreshToken:
          (typeof parsed?.warehouseAuth?.refreshToken === "string" ? parsed.warehouseAuth.refreshToken : "")?.trim() || null,
      },
      printer: {
        host: String(parsed?.printer?.host || defaults.printer.host),
        port: Number(parsed?.printer?.port || defaults.printer.port),
        encoding: String(parsed?.printer?.encoding || defaults.printer.encoding),
        codepage:
          parsed?.printer?.codepage === null || parsed?.printer?.codepage === undefined
            ? (defaults.printer.codepage ?? 17)
            : Number(parsed.printer.codepage),
        name: String(parsed?.printer?.name || defaults.printer.name),
        mode: (parsed?.printer?.mode === "lan" || parsed?.printer?.mode === "usb" || parsed?.printer?.mode === "lan_then_usb")
          ? parsed.printer.mode
          : defaults.printer.mode,
        usbPrinterName:
          (typeof parsed?.printer?.usbPrinterName === "string" ? parsed.printer.usbPrinterName : "")?.trim() || null,
        errorSoundId:
          (typeof parsed?.printer?.errorSoundId === "string" ? parsed.printer.errorSoundId : "")?.trim() || null,
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
  const nextDeviceAuth = partial.deviceAuth !== undefined ? partial.deviceAuth : current.deviceAuth;
  const nextAuth = partial.warehouseAuth !== undefined ? partial.warehouseAuth : current.warehouseAuth;
  const nextDebug = partial.debug !== undefined ? partial.debug : current.debug;
  const merged: Settings = {
    backendUrl: partial.backendUrl !== undefined ? String(partial.backendUrl) : current.backendUrl,
    printerClientToken:
      partial.printerClientToken !== undefined
        ? (String(partial.printerClientToken || "").trim() || null)
        : current.printerClientToken,
    clientId: partial.clientId !== undefined ? String(partial.clientId) : current.clientId,
    debug: {
      forceWarehouseHttp: Boolean(nextDebug?.forceWarehouseHttp),
    },
    deviceAuth: {
      printerId: (typeof nextDeviceAuth?.printerId === "string" ? nextDeviceAuth.printerId : "")?.trim() || null,
      accessToken: (typeof nextDeviceAuth?.accessToken === "string" ? nextDeviceAuth.accessToken : "")?.trim() || null,
      refreshToken: (typeof nextDeviceAuth?.refreshToken === "string" ? nextDeviceAuth.refreshToken : "")?.trim() || null,
    },
    warehouseAuth: {
      phone: (typeof nextAuth?.phone === "string" ? nextAuth.phone : "")?.trim() || null,
      accessToken: (typeof nextAuth?.accessToken === "string" ? nextAuth.accessToken : "")?.trim() || null,
      refreshToken: (typeof nextAuth?.refreshToken === "string" ? nextAuth.refreshToken : "")?.trim() || null,
    },
    printer: {
      host: partial.printer?.host !== undefined ? String(partial.printer.host) : current.printer.host,
      port: partial.printer?.port !== undefined ? Number(partial.printer.port) : current.printer.port,
      encoding: partial.printer?.encoding !== undefined ? String(partial.printer.encoding) : current.printer.encoding,
      codepage:
        partial.printer?.codepage !== undefined
          ? (partial.printer.codepage === null ? null : Number(partial.printer.codepage))
          : (current.printer.codepage ?? 17),
      name: partial.printer?.name !== undefined ? String(partial.printer.name) : current.printer.name,
      mode:
        partial.printer?.mode !== undefined
          ? (partial.printer.mode === "lan" || partial.printer.mode === "usb" || partial.printer.mode === "lan_then_usb"
            ? partial.printer.mode
            : current.printer.mode)
          : current.printer.mode,
      usbPrinterName:
        partial.printer?.usbPrinterName !== undefined
          ? (String(partial.printer.usbPrinterName || "").trim() || null)
          : (current.printer.usbPrinterName || null),
      errorSoundId:
        partial.printer?.errorSoundId !== undefined
          ? (String(partial.printer.errorSoundId || "").trim() || null)
          : (current.printer.errorSoundId || null),
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
