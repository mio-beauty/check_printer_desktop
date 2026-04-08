import React from "react";
import { CircleAlert, Loader2 } from "lucide-react";
import { ConnectionState } from "./components/TitleBar";
import { AppRoutes } from "./routes/AppRoutes";
import type { Settings, UpdateState, LogEntry, PrinterStatus } from "./types";

export default function App() {
  const [status, setStatus] = React.useState<PrinterStatus | null>(null);
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [update, setUpdate] = React.useState<UpdateState>({ kind: "idle" });
  const [warehouseHint, setWarehouseHint] = React.useState<string | null>(null);
  const forcedUpdate = Boolean(status?.update?.forced || (update.kind === "available" && update.forced));
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
    let offHint = () => { };
    (async () => {
      const s = await window.checkPrinter?.getStatus();
      if (s) setStatus(s);
      off = window.checkPrinter?.onStatus((next) => setStatus(next)) ?? (() => { });

      const cfg = await window.checkPrinter?.getSettings();
      if (cfg) setSettings(cfg);

      const initialLogs = (await window.checkPrinter?.getLogs?.()) || [];
      setLogs(initialLogs.slice(-200));
      offLog = window.checkPrinter?.onLog?.((e) => setLogs((prev) => [...prev, e].slice(-200))) ?? (() => { });

      offHint =
        window.checkPrinter?.onWarehouseHint?.((e) => {
          if (!e?.reason) return;
          if (e.reason === "auth_expired") {
            setWarehouseHint("Сессия истекла. Войдите заново.");
          }
        }) ?? (() => { });
    })();
    return () => {
      off();
      offLog();
      offHint();
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
      const result = await window.checkPrinter?.startUpdate();
      if (result && typeof result === "object" && "mode" in result) {
        if (result.mode === "external") {
          setUpdate({
            kind: "error",
            message:
              status?.update?.error ||
              (status?.update?.policy?.downloadUrl
                ? `Автообновление недоступно.\nСкачать установщик: ${status.update.policy.downloadUrl}`
                : "Автообновление недоступно. Откройте установщик вручную."),
          });
          return;
        }
        if (result.mode === "noop") {
          return;
        }
      }
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
    <AppRoutes
      connectionState={connectionState}
      status={status}
      forcedUpdate={forcedUpdate}
      settings={settings}
      setSettings={setSettings}
      logs={logs}
      update={update}
      setUpdate={setUpdate}
      warehouseHint={warehouseHint}
      onTestPrint={testPrint}
      onCheckUpdates={checkUpdates}
      onStartUpdate={startUpdate}
      onSaveSettings={saveSettings}
      onMinimize={windowMinimize}
      onToggleMaximize={windowToggleMaximize}
      onClose={windowClose}
    />
  );
}
