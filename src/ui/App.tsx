import React from "react";

type UpdateState =
  | { kind: "idle" }
  | { kind: "available"; message: string; forced: boolean }
  | { kind: "downloading"; progress?: number }
  | { kind: "ready"; message: string }
  | { kind: "error"; message: string };

declare global {
  interface Window {
    checkPrinter?: {
      getStatus: () => Promise<{ connected: boolean; backendUrl: string }>;
      onStatus: (cb: (s: { connected: boolean; backendUrl: string }) => void) => () => void;
      checkUpdates: () => Promise<{ available: boolean; forced: boolean; message: string }>;
      startUpdate: () => Promise<void>;
    };
  }
}

export default function App() {
  const [status, setStatus] = React.useState<{ connected: boolean; backendUrl: string } | null>(null);
  const [update, setUpdate] = React.useState<UpdateState>({ kind: "idle" });

  React.useEffect(() => {
    let off = () => {};
    (async () => {
      const s = await window.checkPrinter?.getStatus();
      if (s) setStatus(s);
      off = window.checkPrinter?.onStatus((next) => setStatus(next)) ?? (() => {});
    })();
    return () => off();
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

  return (
    <div style={{ fontFamily: "system-ui", padding: 16, maxWidth: 760 }}>
      <h1 style={{ margin: "0 0 8px" }}>CheckPrinterClient</h1>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <span>
          Backend: <code>{status?.backendUrl ?? "—"}</code>
        </span>
        <span>
          Статус:{" "}
          <b style={{ color: status?.connected ? "#0a7" : "#c22" }}>
            {status?.connected ? "подключено" : "нет соединения"}
          </b>
        </span>
        <button onClick={checkUpdates}>Проверить обновления</button>
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
        Следующий шаг: подключить Socket.IO и локальную печать (LAN 9100 + USB RAW), затем автообновления через GitHub
        Releases.
      </p>
    </div>
  );
}

