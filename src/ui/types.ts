import type {
  OrderDetailResponse,
  OrderEventsResponse,
  OrdersResponse,
  WarehouseReason,
} from "./warehouse/types";

export type PrinterStatus = {
  connected: boolean;
  joined: boolean;
  joinError: string | null;
  backendUrl: string;
  backend?: { httpOk: boolean; httpError: string | null; checkedAt: string | null; httpStatus?: number | null };
  printer: {
    host: string | null;
    port: number;
    encoding: string;
    name: string;
    reachability?: { configured: boolean; ok: boolean; checkedAt: string | null; error: string | null };
  };
  warehouse: { name: string; lat: number | null; lon: number | null };
  appVersion?: string;
  update?: { available: boolean; forced: boolean; message: string; downloading: boolean; progress: number | null; error: string | null };
  warehouseAuth?: { phone: string | null; hasToken: boolean };
  window?: { maximized: boolean };
};

export type UpdateState =
  | { kind: "idle" }
  | { kind: "available"; message: string; forced: boolean }
  | { kind: "downloading"; progress?: number }
  | { kind: "ready"; message: string }
  | { kind: "error"; message: string };

export type Settings = {
  backendUrl: string;
  printerClientToken: string | null;
  clientId: string;
  deviceAuth?: { printerId: string | null; accessToken: string | null; refreshToken: string | null };
  warehouseAuth?: {
    phone: string | null;
    accessToken: string | null;
    refreshToken: string | null;
  };
  printer: { host: string; port: number; encoding: string; name: string };
  warehouse: { name: string; lat: number | null; lon: number | null };
};

export type LogEntry = { ts: string; level: "info" | "warn" | "error"; message: string };

export type DeviceActivateResult = { printer_id?: string };

export type WarehouseOrdersParams = {
  status?: string | null;
  q?: string | null;
  limit?: number;
  offset?: number;
  problemsOnly?: boolean;
};

export type WarehousePickingScanResult = { item?: { id?: string | number; picked_qty?: number } };

export interface CheckPrinter {
  getStatus: () => Promise<PrinterStatus>;
  getSettings: () => Promise<Settings>;
  setSettings: (next: Partial<Settings>) => Promise<Settings>;
  onStatus: (cb: (s: PrinterStatus) => void) => () => void;
  onLog: (cb: (e: LogEntry) => void) => () => void;
  onWarehouseHint?: (cb: (e: { reason: string; ts: string }) => void) => () => void;
  getLogs: () => Promise<LogEntry[]>;
  testPrint: (text?: string) => Promise<{ ok: boolean }>;
  checkUpdates: () => Promise<{ available: boolean; forced: boolean; message: string }>;
  startUpdate: () => Promise<void>;
  deviceActivate: (code: string) => Promise<DeviceActivateResult>;
  warehouseLogin?: (phone: string, password: string) => Promise<{ ok: boolean }>;
  warehouseLogout?: () => Promise<{ ok: boolean }>;
  warehouseOrders?: (params?: WarehouseOrdersParams) => Promise<OrdersResponse>;
  warehouseOrderDetail?: (queueId: number) => Promise<OrderDetailResponse>;
  warehouseOrderEvents?: (queueId: number) => Promise<OrderEventsResponse>;
  warehousePrintRetry?: (queueId: number) => Promise<{ ok?: boolean; dispatched?: boolean; print_job?: { id: string; status: string; error?: string | null } }>;
  warehouseReasons?: () => Promise<{ reasons?: WarehouseReason[] }>;
  warehousePickingStart?: (queueId: number) => Promise<any>;
  warehousePickingScan?: (queueId: number, code: string) => Promise<WarehousePickingScanResult>;
  warehousePickingFinish?: (queueId: number, reason_code?: string | null, comment?: string | null) => Promise<any>;
  windowMinimize?: () => Promise<void>;
  windowToggleMaximize?: () => Promise<void>;
  windowClose?: () => Promise<void>;
}

declare global {
  interface Window {
    checkPrinter?: CheckPrinter;
  }
}
