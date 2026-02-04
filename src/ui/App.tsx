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
  printerClientToken: string | null;
  clientId: string;
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
        }) => void,
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
    joined: boolean;
    joinError: string | null;
    backendUrl: string;
    printer: { host: string | null; port: number; encoding: string; name: string };
    warehouse: { name: string; lat: number | null; lon: number | null };
  } | null>(null);
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [update, setUpdate] = React.useState<UpdateState>({ kind: "idle" });

  const ensurePrinter = React.useCallback((p: Settings): Settings["printer"] => {
    return (
      p.printer ?? {
        host: "",
        port: 9100,
        encoding: "cp866",
        name: "CheckPrinterClient",
      }
    );
  }, []);

  const ensureWarehouse = React.useCallback((p: Settings): Settings["warehouse"] => {
    return (
      p.warehouse ?? {
        name: "Sklad",
        lat: null,
        lon: null,
      }
    );
  }, []);

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
              {status?.connected ? "socket: ok" : "socket: нет"}
            </Badge>
            <Badge variant={status?.joined ? "secondary" : "destructive"}>
              {status?.joined ? "join: ok" : `join: ${status?.joinError || "нет"}`}
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
                {status?.printer?.name ?? "—"} | {status?.printer?.host ?? "—"}:{status?.printer?.port ?? "—"} (
                {status?.printer?.encoding ?? "—"})
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
                <Label>Token (printer client)</Label>
                <Input
                  value={settings?.printerClientToken ?? ""}
                  onChange={(e) => setSettings((p) => (p ? { ...p, printerClientToken: e.target.value } : null))}
                  placeholder="PRINTER_CLIENT_TOKEN"
                />
              </div>

              <div className="grid gap-2">
                <Label>Имя принтера</Label>
                <Input
                  value={settings?.printer?.name ?? ""}
                  onChange={(e) =>
                    setSettings((p) => {
                      if (!p) return null;
                      const printer = ensurePrinter(p);
                      return { ...p, printer: { ...printer, name: e.target.value } };
                    })
                  }
                  placeholder="Sklad Xprinter XP-80T"
                />
              </div>

              <div className="grid gap-2">
                <Label>Склад (warehouse)</Label>
                <Input
                  value={settings?.warehouse?.name ?? ""}
                  onChange={(e) =>
                    setSettings((p) => {
                      if (!p) return null;
                      const warehouse = ensureWarehouse(p);
                      return { ...p, warehouse: { ...warehouse, name: e.target.value } };
                    })
                  }
                  placeholder="Sklad"
                />
              </div>

              <div className="grid gap-2">
                <Label>Printer host</Label>
                <Input
                  value={settings?.printer?.host ?? ""}
                  onChange={(e) =>
                    setSettings((p) => {
                      if (!p) return null;
                      const printer = ensurePrinter(p);
                      return { ...p, printer: { ...printer, host: e.target.value } };
                    })
                  }
                  placeholder="192.168.0.100"
                />
              </div>

              <div className="grid gap-2">
                <Label>Printer port</Label>
                <Input
                  inputMode="numeric"
                  value={String(settings?.printer?.port ?? "")}
                  onChange={(e) =>
                    setSettings((p) =>
                      p
                        ? {
                            ...p,
                            printer: {
                              ...ensurePrinter(p),
                              port: Math.max(0, Number.parseInt(e.target.value || "0", 10) || 0),
                            },
                          }
                        : null,
                    )
                  }
                  placeholder="9100"
                />
              </div>

              <div className="grid gap-2">
                <Label>Encoding</Label>
                <Input
                  value={settings?.printer?.encoding ?? ""}
                  onChange={(e) =>
                    setSettings((p) => {
                      if (!p) return null;
                      const printer = ensurePrinter(p);
                      return { ...p, printer: { ...printer, encoding: e.target.value } };
                    })
                  }
                  placeholder="cp866"
                />
              </div>
            </div>

            <div className="mt-4 text-xs text-muted-foreground">
              client_id: <span className="font-mono">{settings?.clientId ?? "—"}</span>
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
