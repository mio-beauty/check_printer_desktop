import React from "react";
import { cn } from "../lib/utils";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Sidebar, SidebarLabel, SidebarSection } from "../components/ui/sidebar";
import { AlertTriangle, CircleAlert, Loader2, Minus, Square, X } from "lucide-react";
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

type ConnectionState = {
  label: string;
  tone: string;
  icon: React.ReactNode;
  title?: string;
};

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
    <div className="h-screen bg-background text-foreground">
      <div className="flex h-full flex-col">
        <div
          className="sticky top-0 z-50 flex items-center justify-between bg-background h-8"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          <div className="px-2 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <g clip-path="url(#clip0_29_75)">
                <mask id="mask0_29_75" maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20">
                  <path d="M20 0H0V20H20V0Z" fill="white" />
                </mask>
                <g mask="url(#mask0_29_75)">
                  <path d="M14.6667 4.4244L9.95842 1.89107C9.45842 1.6244 8.86675 1.6244 8.36675 1.89107L3.66673 4.4244C3.32507 4.61607 3.1084 4.98274 3.1084 5.38274C3.1084 5.79107 3.31673 6.15774 3.66673 6.34107L8.37508 8.8744C8.62508 9.00774 8.90008 9.0744 9.16675 9.0744C9.43341 9.0744 9.71675 9.00774 9.95842 8.8744L14.6667 6.34107C15.0084 6.15774 15.2251 5.79107 15.2251 5.38274C15.2251 4.98274 15.0084 4.61607 14.6667 4.4244Z" fill="#131314" />
                  <path d="M7.60008 9.75716L3.22508 7.57385C2.88341 7.39885 2.50008 7.42385 2.17508 7.61552C1.85841 7.81552 1.66675 8.15719 1.66675 8.53216V12.6655C1.66675 13.3822 2.06675 14.0238 2.70841 14.3488L7.08342 16.5322C7.23342 16.6072 7.40008 16.6488 7.56675 16.6488C7.75842 16.6488 7.95842 16.5905 8.13342 16.4905C8.45008 16.2905 8.64175 15.9488 8.64175 15.5738V11.4405C8.63342 10.7238 8.23342 10.0822 7.60008 9.75716Z" fill="#131314" />
                  <path d="M16.6666 8.53216V10.5822C16.2666 10.4655 15.8416 10.4155 15.4166 10.4155C14.2833 10.4155 13.175 10.8072 12.3 11.5072C11.1 12.4488 10.4166 13.8738 10.4166 15.4155C10.4166 15.8238 10.4666 16.2322 10.575 16.6238C10.45 16.6072 10.325 16.5572 10.2083 16.4822C9.89162 16.2905 9.69995 15.9488 9.69995 15.5738V11.4405C9.69995 10.7238 10.1 10.0822 10.7333 9.75716L15.1083 7.57385C15.45 7.39885 15.8333 7.42385 16.1583 7.61552C16.475 7.81552 16.6666 8.15719 16.6666 8.53216Z" fill="#131314" />
                  <path d="M18.3167 13.0579C17.6334 12.2162 16.5917 11.6829 15.4167 11.6829C14.5334 11.6829 13.7167 11.9912 13.0751 12.5079C12.2084 13.1912 11.6667 14.2496 11.6667 15.4329C11.6667 16.1329 11.8667 16.7996 12.2084 17.3662C12.4334 17.7412 12.7167 18.0662 13.0501 18.3329H13.0584C13.7001 18.8662 14.5251 19.1829 15.4167 19.1829C16.3667 19.1829 17.2251 18.8329 17.8834 18.2496C18.1751 17.9996 18.4251 17.6996 18.6251 17.3662C18.9667 16.7996 19.1667 16.1329 19.1667 15.4329C19.1667 14.5329 18.8501 13.6996 18.3167 13.0579ZM17.3001 14.9662L15.3001 16.8162C15.1834 16.9246 15.0251 16.9829 14.8751 16.9829C14.7167 16.9829 14.5584 16.9246 14.4334 16.7996L13.5084 15.8746C13.2667 15.6329 13.2667 15.2329 13.5084 14.9912C13.7501 14.7496 14.1501 14.7496 14.3917 14.9912L14.8917 15.4912L16.4501 14.0496C16.7001 13.8162 17.1001 13.8329 17.3334 14.0829C17.5751 14.3412 17.5584 14.7329 17.3001 14.9662Z" fill="#131314" />
                </g>
              </g>
              <defs>
                <clipPath id="clip0_29_75">
                  <rect width="20" height="20" fill="white" />
                </clipPath>
              </defs>
            </svg>
            <span className="text-[13px] text-[#131314] font-medium">Склад принтер</span>
            {status?.appVersion && (
              <p className="text-[11px] flex items-center text-muted-foreground h-[18px] px-1.5 bg-[#F6F6F7] text-[#747479] rounded-[6px] font-medium leading-[120%]">v{status?.appVersion}</p>
            )}
          </div>
          <div
            className={cn(
              "flex items-center gap-1 rounded-[6px] px-1.5 h-6 text-sm font-semibold tracking-wide",
              connectionState.tone,
            )}
            title={connectionState.title}
          >
            <span className="flex h-4 w-4 items-center justify-center text-current">{connectionState.icon}</span>
            <span className="leading-[16px]">{connectionState.label}</span>
          </div>
          <div className="flex items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <Button variant="ghost" size="icon" onClick={windowMinimize} aria-label="Свернуть" className="rounded-none">
              <Minus className=" w-3.5" strokeWidth={1.5} />
            </Button>
            <Button variant="ghost" size="icon" onClick={windowToggleMaximize} aria-label="Развернуть" className="rounded-none">
              <Square className=" w-3" strokeWidth={1.5} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={windowClose}
              aria-label="Закрыть"
              className="rounded-none hover:bg-red-600/70 hover:text-white"
            >
              <X className="w-4" strokeWidth={1.5} />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {authed && (
            <Sidebar className="overflow-y-auto">
              <div className="space-y-3">
                <SidebarSection>
                  <SidebarLabel>Навигация</SidebarLabel>
                  <Button
                    className="w-full justify-start"
                    variant={view === "status" ? "default" : "outline"}
                    onClick={() => setView("status")}
                  >
                    Статус
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant={view === "warehouse" ? "default" : "outline"}
                    onClick={() => setView("warehouse")}
                  >
                    Склад
                  </Button>
                </SidebarSection>

                <SidebarSection>
                  <SidebarLabel>Связь</SidebarLabel>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={status?.connected ? "default" : "destructive"}>
                      {status?.connected ? "socket: ok" : "socket: нет"}
                    </Badge>
                    <Badge variant={status?.joined ? "secondary" : "destructive"}>
                      {status?.joined ? "join: ok" : `join: ${status?.joinError || "нет"}`}
                    </Badge>
                  </div>
                  {forcedUpdate && <Badge variant="destructive">Требуется обновление</Badge>}
                </SidebarSection>

                <SidebarSection>
                  <SidebarLabel>Аккаунт</SidebarLabel>
                  <Badge variant="secondary">{status?.warehouseAuth?.phone || "—"}</Badge>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => void window.checkPrinter?.warehouseLogout?.()}
                  >
                    Выйти
                  </Button>
                </SidebarSection>
              </div>
            </Sidebar>
          )}

          <main className="min-w-0 flex-1 overflow-auto">
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
          </main>
        </div>
      </div>
    </div>
  );
}
