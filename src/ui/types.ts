export type PrinterStatus = {
  connected: boolean;
  joined: boolean;
  joinError: string | null;
  backendUrl: string;
  printer: { host: string | null; port: number; encoding: string; name: string };
  warehouse: { name: string; lat: number | null; lon: number | null };
  appVersion?: string;
  update?: { available: boolean; forced: boolean; message: string; downloading: boolean; progress: number | null; error: string | null };
  warehouseAuth?: { phone: string | null; hasToken: boolean };
  window?: { maximized: boolean };
};
