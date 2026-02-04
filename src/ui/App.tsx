import React from "react";

type UpdateState =
  | { kind: "idle" }
  | { kind: "available"; message: string; forced: boolean }
  | { kind: "downloading"; progress?: number }
  | { kind: "ready"; message: string }
  | { kind: "error"; message: string };

type Settings = {
  backendUrl: string;
  printer: { host: string; port: number; encoding: string };
};

type LogEntry = { ts: string; level: "info" | "warn" | "error"; message: string };

declare global {
  interface Window {
    checkPrinter?: {
      getStatus: () => Promise<{
        connected: boolean;
        backendUrl: string;
        printer: { host: string | null; port: number; encoding: string };
      }>;
      getSettings: () => Promise<Settings>;
      setSettings: (next: Partial<Settings>) => Promise<Settings>;
      onStatus: (
        cb: (s: { connected: boolean; backendUrl: string; printer: { host: string | null; port: number; encoding: string } }) => void,
      ) => () => void;
      onLog: (cb: (e: LogEntry) => void) => () => void;
      getLogs: () => Promise<LogEntry[]>;
      testPrint: (text?: string) => Promise<{ ok: boolean }>;
      checkUpdates: () => Promise<{ available: boolean; forced: boolean; message: string }>;
      startUpdate: () => Promise<void>;
    };
  }
}

export default function App() {
  const [status, setStatus] = React.useState<{
    connected: boolean;
    backendUrl: string;
    printer: { host: string | null; port: number; encoding: string };
  } | null>(null);
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [update, setUpdate] = React.useState<UpdateState>({ kind: "idle" });

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

  const checkUpdates = async () => {
    try {
      const res = await window.checkPrinter?.checkUpdates();
      if (!res) return;
      if (!res.available) {
        setUpdate({ kind: "idle" });
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
      setUpdate({ kind: "ready", message: "Обновление скачано. Перезапустите приложение для установки." });
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

  return (
    <div style={{ fontFamily: "system-ui", padding: 16, maxWidth: 760 }}>
      <h1 style={{ margin: "0 0 8px" }}>CheckPrinterClient</h1>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <span>
          Backend: <code>{status?.backendUrl ?? "—"}</code>
        </span>
        <span>
          Принтер:{" "}
          <code>
            {status?.printer?.host ?? "—"}:{status?.printer?.port ?? "—"} ({status?.printer?.encoding ?? "—"})
          </code>
        </span>
        <span>
          Статус:{" "}
          <b style={{ color: status?.connected ? "#0a7" : "#c22" }}>
            {status?.connected ? "подключено" : "нет соединения"}
          </b>
        </span>
        <button onClick={testPrint}>Тестовая печать</button>
        <button onClick={checkUpdates}>Проверить обновления</button>
      </div>

      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Настройки</div>
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, alignItems: "center" }}>
          <label>Backend URL</label>
          <input
            value={settings?.backendUrl ?? ""}
            onChange={(e) => setSettings((p) => (p ? { ...p, backendUrl: e.target.value } : null))}
            placeholder="https://printer.backend.miobeauty.uz"
          />
          <label>Printer host</label>
          <input
            value={settings?.printer.host ?? ""}
            onChange={(e) => setSettings((p) => (p ? { ...p, printer: { ...p.printer, host: e.target.value } } : null))}
            placeholder="127.0.0.1"
          />
          <label>Printer port</label>
          <input
            value={String(settings?.printer.port ?? "")}
            onChange={(e) =>
              setSettings((p) =>
                p ? { ...p, printer: { ...p.printer, port: Number(e.target.value || 0) || 0 } } : null,
              )
            }
            placeholder="9100"
          />
          <label>Encoding</label>
          <input
            value={settings?.printer.encoding ?? ""}
            onChange={(e) => setSettings((p) => (p ? { ...p, printer: { ...p.printer, encoding: e.target.value } } : null))}
            placeholder="cp866"
          />
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button onClick={saveSettings} disabled={!settings}>
            Сохранить
          </button>
        </div>
      </div>

      {update.kind === "available" && (
        <div
          style={{
            border: "1px solid #ddd",
            padding: 12,
            borderRadius: 8,
            background: "#fff7e6",
            marginBottom: 12,
          }}
        >
          <div style={{ marginBottom: 8 }}>{update.message}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={startUpdate}>Обновить</button>
            {!update.forced && <button onClick={() => setUpdate({ kind: "idle" })}>Не сейчас</button>}
          </div>
        </div>
      )}

      {update.kind === "downloading" && (
        <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          Скачивание обновления...
        </div>
      )}

      {update.kind === "ready" && (
        <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          {update.message}
        </div>
      )}

      {update.kind === "error" && (
        <div style={{ border: "1px solid #f99", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          Ошибка: {update.message}
        </div>
      )}

      <p style={{ color: "#666" }}>
        Для теста без реального принтера: запусти <code>npm run fake-printer</code> и не задавай PRINTER_IP (в dev по
        умолчанию будет 127.0.0.1:9100).
      </p>

      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Логи</div>
        <pre style={{ margin: 0, maxHeight: 220, overflow: "auto", background: "#111", color: "#ddd", padding: 8 }}>
          {logs.map((l) => `${l.ts} [${l.level}] ${l.message}`).join("\n")}
        </pre>
      </div>
    </div>
  );
}
