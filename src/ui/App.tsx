import React from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

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
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">CheckPrinterClient</h1>
            <p className="text-sm text-muted-foreground">
              Backend: <span className="font-mono">{status?.backendUrl ?? "—"}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status?.connected ? "default" : "destructive"}>
              {status?.connected ? "подключено" : "нет соединения"}
            </Badge>
            <Button variant="outline" onClick={testPrint}>
              Тестовая печать
            </Button>
            <Button variant="secondary" onClick={checkUpdates}>
              Проверить обновления
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Принтер</CardTitle>
            <CardDescription>
              Текущие параметры:{" "}
              <span className="font-mono">
                {status?.printer?.host ?? "—"}:{status?.printer?.port ?? "—"} ({status?.printer?.encoding ?? "—"})
              </span>
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Настройки</CardTitle>
            <CardDescription>Сохраняются локально на этом ПК.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Backend URL</Label>
                <Input
                  value={settings?.backendUrl ?? ""}
                  onChange={(e) => setSettings((p) => (p ? { ...p, backendUrl: e.target.value } : null))}
                  placeholder="https://printer.backend.miobeauty.uz"
                />
              </div>

              <div className="grid gap-2">
                <Label>Encoding</Label>
                <Input
                  value={settings?.printer.encoding ?? ""}
                  onChange={(e) => setSettings((p) => (p ? { ...p, printer: { ...p.printer, encoding: e.target.value } } : null))}
                  placeholder="cp866"
                />
              </div>

              <div className="grid gap-2">
                <Label>Printer host</Label>
                <Input
                  value={settings?.printer.host ?? ""}
                  onChange={(e) => setSettings((p) => (p ? { ...p, printer: { ...p.printer, host: e.target.value } } : null))}
                  placeholder="192.168.0.100"
                />
              </div>

              <div className="grid gap-2">
                <Label>Printer port</Label>
                <Input
                  inputMode="numeric"
                  value={String(settings?.printer.port ?? "")}
                  onChange={(e) =>
                    setSettings((p) =>
                      p ? { ...p, printer: { ...p.printer, port: Number(e.target.value || 0) || 0 } } : null,
                    )
                  }
                  placeholder="9100"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={saveSettings} disabled={!settings}>
                Сохранить
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  alert("Для теста без реального принтера: npm run fake-printer и host=127.0.0.1 port=9100.")
                }
              >
                Как тестировать
              </Button>
            </div>
          </CardContent>
        </Card>

      {update.kind === "available" && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle>Доступно обновление</CardTitle>
            <CardDescription>{update.message}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={startUpdate}>Обновить</Button>
            {!update.forced && (
              <Button variant="outline" onClick={() => setUpdate({ kind: "idle" })}>
                Не сейчас
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {update.kind === "downloading" && (
        <Card>
          <CardHeader>
            <CardTitle>Скачивание обновления...</CardTitle>
          </CardHeader>
        </Card>
      )}

      {update.kind === "ready" && (
        <Card>
          <CardHeader>
            <CardTitle>Готово</CardTitle>
            <CardDescription>{update.message}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {update.kind === "error" && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle>Ошибка</CardTitle>
            <CardDescription>{update.message}</CardDescription>
          </CardHeader>
        </Card>
      )}

        <Card>
          <CardHeader>
            <CardTitle>Логи</CardTitle>
            <CardDescription>Последние события подключения/печати.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-64 overflow-auto rounded-md bg-black p-3 font-mono text-xs text-zinc-200">
              {logs.map((l) => `${l.ts} [${l.level}] ${l.message}`).join("\n")}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
