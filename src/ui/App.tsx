import React from "react";
import { CircleAlert, Loader2 } from "lucide-react";
import { ConnectionState } from "./components/TitleBar";
import { Layout } from "./components/Layout";
import { WarehouseQueue } from "./WarehouseQueue";
import { StatusView } from "./views/StatusView";
import { LoginView } from "./views/LoginView";

type UpdateState =
  | { kind: "idle" }
  | { kind: "available"; message: string; forced: boolean }
  | { kind: "downloading"; progress?: number }
  | { kind: "ready"; message: string }
  | { kind: "error"; message: string };

type Settings = {
  backendUrl: string;
  printerClientToken: string | null;
  clientId: string;
  warehouseAuth?: {
    phone: string | null;
    accessToken: string | null;
    refreshToken: string | null;
  };
  printer: { host: string; port: number; encoding: string; name: string };
  warehouse: { name: string; lat: number | null; lon: number | null };
};

type LogEntry = { ts: string; level: "info" | "warn" | "error"; message: string };

declare global {
  interface Window {
    checkPrinter?: {
      getStatus: () => Promise<{
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
      }>;
      getSettings: () => Promise<Settings>;
      setSettings: (next: Partial<Settings>) => Promise<Settings>;
      onStatus: (
        cb: (s: {
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
        }) => void,
      ) => () => void;
      onLog: (cb: (e: LogEntry) => void) => () => void;
      onWarehouseHint?: (cb: (e: { reason: string; ts: string }) => void) => () => void;
      getLogs: () => Promise<LogEntry[]>;
      testPrint: (text?: string) => Promise<{ ok: boolean }>;
      checkUpdates: () => Promise<{ available: boolean; forced: boolean; message: string }>;
      startUpdate: () => Promise<void>;
      warehouseLogin?: (phone: string, password: string) => Promise<{ ok: boolean }>;
      warehouseLogout?: () => Promise<{ ok: boolean }>;
      warehouseOrders?: (params: { status?: string | null; q?: string | null; limit?: number; offset?: number }) => Promise<any>;
      warehouseOrderDetail?: (queueId: number) => Promise<any>;
      warehousePickingStart?: (queueId: number) => Promise<any>;
      warehousePickingScan?: (queueId: number, code: string) => Promise<any>;
      warehousePickingFinish?: (queueId: number, reason_code?: string | null, comment?: string | null) => Promise<any>;
      windowMinimize?: () => Promise<void>;
      windowToggleMaximize?: () => Promise<void>;
      windowClose?: () => Promise<void>;
    };
  }
}

export default function App() {
  const [status, setStatus] = React.useState<{
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
  } | null>(null);
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [update, setUpdate] = React.useState<UpdateState>({ kind: "idle" });
  const forcedUpdate = Boolean(status?.update?.forced || (update.kind === "available" && update.forced));
  const [view, setView] = React.useState<"status" | "warehouse">("status");
  const authed = Boolean(status?.warehouseAuth?.hasToken);
  const connectionState = React.useMemo<ConnectionState>(() => {
    if (status?.joinError) {
      return {
        label: "Ошибка подключения",
        tone: "bg-[#FDECEE] text-[#E73C50]",
        icon: <CircleAlert className="h-4 w-4 text-current fill-[#E73C50] text-white" strokeWidth={2} />,
      };
    }
    if (status?.connected) {
      return {
        label: "Подключён",
        tone: "bg-[#D0F4DA] text-[#16C647]",
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <g clip-path="url(#clip0_29_164)">
            <mask id="mask0_29_164" maskUnits="userSpaceOnUse" x="0" y="0" width="16" height="16">
              <path d="M15.5 0.5V15.5H0.5V0.5H15.5Z" fill="white" stroke="white" />
            </mask>
            <g mask="url(#mask0_29_164)">
              <path d="M4.44671 10.6667H2.66671C1.93337 10.6667 1.33337 11.2667 1.33337 12L1.33337 14C1.33337 14.3667 1.63337 14.6667 2.00004 14.6667H4.44671C4.81337 14.6667 5.11337 14.3667 5.11337 14V11.3333C5.11337 10.9667 4.81337 10.6667 4.44671 10.6667Z" fill="#16C647" />
              <path d="M8.21998 6.66666L7.10664 6.66666C6.37332 6.66666 5.77332 7.26666 5.77332 7.99999V14C5.77332 14.3667 6.07332 14.6667 6.43998 14.6667H8.88664C9.25331 14.6667 9.55331 14.3667 9.55331 14V7.99999C9.55331 7.26666 8.95998 6.66666 8.21998 6.66666Z" fill="#16C647" />
              <path d="M13.3334 2.66666L11 2.66666C10.6334 2.66666 10.3334 2.96666 10.3334 3.33332V14C10.3334 14.3667 10.6334 14.6667 11 14.6667H14.0001C14.3668 14.6667 14.6668 14.3667 14.6668 14V3.99999C14.6668 3.26666 14.0668 2.66666 13.3334 2.66666Z" fill="#16C647" />
            </g>
          </g>
          <defs>
            <clipPath id="clip0_29_164">
              <rect width="16" height="16" fill="white" />
            </clipPath>
          </defs>
        </svg>

      };
    }



    return {
      label: "Подключение",
      tone: "bg-[#F6F6F7] text-[#131314]",
      icon: <Loader2 className="h-4 w-4 text-current animate-spin" strokeWidth={2} />,
    };
  }, [status?.connected, status?.joinError]);

  React.useEffect(() => {
    let off = () => { };
    let offLog = () => { };
    (async () => {
      const s = await window.checkPrinter?.getStatus();
      if (s) setStatus(s);
      off = window.checkPrinter?.onStatus((next) => setStatus(next)) ?? (() => { });

      const cfg = await window.checkPrinter?.getSettings();
      if (cfg) setSettings(cfg);

      const initialLogs = (await window.checkPrinter?.getLogs?.()) || [];
      setLogs(initialLogs.slice(-200));
      offLog = window.checkPrinter?.onLog?.((e) => setLogs((prev) => [...prev, e].slice(-200))) ?? (() => { });
    })();
    return () => {
      off();
      offLog();
    };
  }, []);

  React.useEffect(() => {
    const u = status?.update;
    if (!u) return;
    if (u.error) {
      setUpdate({ kind: "error", message: u.error });
      return;
    }
    if (u.downloading) {
      setUpdate({ kind: "downloading", progress: u.progress ?? undefined });
      return;
    }
    if (u.available) {
      setUpdate({ kind: "available", forced: Boolean(u.forced), message: u.message || "Доступно обновление" });
    }
  }, [status?.update?.available, status?.update?.downloading, status?.update?.error, status?.update?.forced, status?.update?.message]);

  const checkUpdates = async () => {
    try {
      const res = await window.checkPrinter?.checkUpdates();
      if (!res) return;
      if (!res.available) {
        setUpdate({ kind: "idle" });
        alert(`Обновлений нет. Текущая версия: ${status?.appVersion ?? "—"}`);
        return;
      }
      setUpdate({ kind: "available", forced: res.forced, message: res.message });
    } catch (e) {
      setUpdate({ kind: "error", message: String(e) });
    }
  };

  const startUpdate = async () => {
    try {
      setUpdate({ kind: "downloading" });
      await window.checkPrinter?.startUpdate();
      setUpdate({ kind: "ready", message: "Обновление скачано. Если вы выбрали “Перезапустить”, приложение перезапустится." });
    } catch (e) {
      setUpdate({ kind: "error", message: String(e) });
    }
  };

  const testPrint = async () => {
    try {
      if (!window.checkPrinter) {
        alert("Ошибка: preload API недоступен (window.checkPrinter отсутствует).");
        return;
      }
      await window.checkPrinter.testPrint();
    } catch (e) {
      alert(`Ошибка тестовой печати: ${String(e)}`);
    }
  };

  const saveSettings = async () => {
    try {
      if (!window.checkPrinter || !settings) return;
      const updated = await window.checkPrinter.setSettings(settings);
      setSettings(updated);
      alert("Настройки сохранены");
    } catch (e) {
      alert(`Ошибка сохранения настроек: ${String(e)}`);
    }
  };

  const windowMinimize = async () => {
    try {
      await window.checkPrinter?.windowMinimize?.();
    } catch {
      // ignore
    }
  };

  const windowToggleMaximize = async () => {
    try {
      await window.checkPrinter?.windowToggleMaximize?.();
    } catch {
      // ignore
    }
  };

  const windowClose = async () => {
    try {
      await window.checkPrinter?.windowClose?.();
    } catch {
      // ignore
    }
  };

  return (
    <Layout
      connectionState={connectionState}
      onMinimize={windowMinimize}
      onToggleMaximize={windowToggleMaximize}
      onClose={windowClose}
      status={status}
      view={view}
      setView={setView}
      forcedUpdate={forcedUpdate}
    >
      {!authed ? (
        <LoginView
          online={Boolean(status?.connected && status?.joined)}
          forcedUpdate={forcedUpdate}
          settings={settings}
          setSettings={setSettings}
        />
      ) : (
        <div className="mx-auto max-w-4xl space-y-4 p-6">
          {view === "warehouse" ? (
            <WarehouseQueue
              active
              online={Boolean(status?.connected && status?.joined)}
              forcedUpdate={forcedUpdate}
              auth={status?.warehouseAuth ?? null}
            />
          ) : (
            <StatusView
              status={status}
              settings={settings}
              setSettings={setSettings}
              logs={logs}
              update={update}
              setUpdate={setUpdate}
              forcedUpdate={forcedUpdate}
              onTestPrint={testPrint}
              onCheckUpdates={checkUpdates}
              onStartUpdate={startUpdate}
              onSaveSettings={saveSettings}
            />
          )}
        </div>
      )}
    </Layout>
  );
}
