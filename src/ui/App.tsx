import React from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Sidebar, SidebarLabel, SidebarSection } from "../components/ui/sidebar";
import { Minus, Square, X } from "lucide-react";
import { WarehouseQueue } from "./WarehouseQueue";
import { StatusView } from "./views/StatusView";
import { LoginView } from "./views/LoginView";
import { ForcedUpdateView } from "./views/ForcedUpdateView";
import { StatusBar } from "./components/StatusBar";
import { warehouseOfflineReason } from "./status/derive";

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

type UpdatePolicy = {
  latestVersion: string | null;
  minSupportedVersion: string | null;
  downloadUrl: string | null;
  notes: string | null;
};

type StatusUpdate = {
  available: boolean;
  forced: boolean;
  message: string;
  downloading: boolean;
  progress: number | null;
  error: string | null;
  policy?: UpdatePolicy | null;
};

declare global {
  interface Window {
    checkPrinter?: {
      getStatus: () => Promise<{
        connected: boolean;
        joined: boolean;
        joinError: string | null;
        backendUrl: string;
        backend?: { httpOk: boolean; httpError: string | null; checkedAt: string | null };
        printer: {
          host: string | null;
          port: number;
          encoding: string;
          name: string;
          reachability?: { configured: boolean; ok: boolean; checkedAt: string | null; error: string | null };
        };
        warehouse: { name: string; lat: number | null; lon: number | null };
        appVersion?: string;
        update?: StatusUpdate;
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
          backend?: { httpOk: boolean; httpError: string | null; checkedAt: string | null };
          printer: {
            host: string | null;
            port: number;
            encoding: string;
            name: string;
            reachability?: { configured: boolean; ok: boolean; checkedAt: string | null; error: string | null };
          };
          warehouse: { name: string; lat: number | null; lon: number | null };
          appVersion?: string;
          update?: StatusUpdate;
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
      warehouseOrders?: (params: { status?: string | null; q?: string | null; limit?: number; offset?: number; problemsOnly?: boolean }) => Promise<any>;
      warehouseOrderDetail?: (queueId: number) => Promise<any>;
      warehouseOrderEvents?: (queueId: number) => Promise<any>;
      warehouseReasons?: () => Promise<any>;
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
    backend?: { httpOk: boolean; httpError: string | null; checkedAt: string | null };
    printer: {
      host: string | null;
      port: number;
      encoding: string;
      name: string;
      reachability?: { configured: boolean; ok: boolean; checkedAt: string | null; error: string | null };
    };
    warehouse: { name: string; lat: number | null; lon: number | null };
    appVersion?: string;
    update?: StatusUpdate;
    warehouseAuth?: { phone: string | null; hasToken: boolean };
    window?: { maximized: boolean };
  } | null>(null);
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [update, setUpdate] = React.useState<UpdateState>({ kind: "idle" });
  const forcedUpdate = Boolean(status?.update?.forced || (update.kind === "available" && update.forced));
  const [view, setView] = React.useState<"status" | "warehouse">("status");
  const authed = Boolean(status?.warehouseAuth?.hasToken);
  const warehouseOnline = Boolean(status?.backend?.httpOk);
  const offlineReason = !status
    ? "нет статуса"
    : !status.connected
      ? "нет соединения Socket.IO с backend"
      : !status.joined
        ? `не выполнен join: ${status.joinError || "unknown"}`
        : null;
  const warehouseOfflineReasonText = warehouseOfflineReason(status as any, forcedUpdate);
  const currentVersion = String(status?.appVersion || "");
  const minSupportedVersion = status?.update?.policy?.minSupportedVersion || null;
  const policyNotes = status?.update?.policy?.notes || null;

  React.useEffect(() => {
    let off = () => {};
    let offLog = () => {};
    (async () => {
      const s = await window.checkPrinter?.getStatus();
      if (s) setStatus(s);
      off = window.checkPrinter?.onStatus((next) => setStatus(next)) ?? (() => {});

      const cfg = await window.checkPrinter?.getSettings();
      if (cfg) setSettings(cfg);

      const initialLogs = (await window.checkPrinter?.getLogs?.()) || [];
      setLogs(initialLogs.slice(-200));
      offLog = window.checkPrinter?.onLog?.((e) => setLogs((prev) => [...prev, e].slice(-200))) ?? (() => {});
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
    <div className="min-h-screen bg-background text-foreground">
      <div
        className="sticky top-0 z-50 flex items-center justify-between border-b bg-background px-2 py-1.5"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <div />
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <Button variant="ghost" size="icon" onClick={windowMinimize} aria-label="Свернуть">
            <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>
          <Button variant="ghost" size="icon" onClick={windowToggleMaximize} aria-label="Развернуть">
            <Square className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>
          <Button variant="ghost" size="icon" onClick={windowClose} aria-label="Закрыть">
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>
        </div>
      </div>

      <StatusBar status={status} forcedUpdate={forcedUpdate} onStartUpdate={() => void startUpdate()} />

      <div className="flex">
        {!forcedUpdate && authed && (
          <Sidebar>
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

        <main className="min-w-0 flex-1">
          {forcedUpdate ? (
            <ForcedUpdateView
              currentVersion={currentVersion || "—"}
              minSupportedVersion={minSupportedVersion}
              message={status?.update?.message || "Обновление обязательно."}
              notes={policyNotes}
              downloading={Boolean(status?.update?.downloading)}
              progress={status?.update?.progress ?? null}
              error={status?.update?.error ?? null}
              onUpdate={startUpdate}
            />
          ) : !authed ? (
            <LoginView
              online={warehouseOnline}
              forcedUpdate={forcedUpdate}
              settings={settings}
              setSettings={setSettings}
            />
          ) : (
            <div className="mx-auto max-w-4xl space-y-4 p-6">
              {view === "warehouse" ? (
                <WarehouseQueue
                  active
                  online={warehouseOnline}
                  offlineReason={warehouseOfflineReasonText ?? offlineReason}
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
  );
}
