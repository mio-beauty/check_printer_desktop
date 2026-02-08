import React from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Progress } from "../../components/ui/progress";
import type { PrinterStatus, Settings, LogEntry, UpdateState } from "../types";

export function StatusPage(props: {
  status: PrinterStatus | null;
  settings: Settings | null;
  setSettings: React.Dispatch<React.SetStateAction<Settings | null>>;
  logs: LogEntry[];
  update: UpdateState;
  setUpdate: React.Dispatch<React.SetStateAction<UpdateState>>;
  forcedUpdate: boolean;
  onTestPrint: () => Promise<void>;
  onCheckUpdates: () => Promise<void>;
  onStartUpdate: () => Promise<void>;
  onSaveSettings: () => Promise<void>;
}) {
  const [activationCode, setActivationCode] = React.useState("");
  const [activationBusy, setActivationBusy] = React.useState(false);
  const [activationInfo, setActivationInfo] = React.useState<string | null>(null);
  const [activationError, setActivationError] = React.useState<string | null>(null);
  const deviceActivated = Boolean(props.settings?.deviceAuth?.refreshToken);

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

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Статус</h1>
          <p className="text-sm text-muted-foreground">
            Backend: <span className="font-mono">{props.status?.backendUrl ?? "—"}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Версия: <span className="font-mono">{props.status?.appVersion ?? "—"}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={props.onTestPrint}
            disabled={props.forcedUpdate || Boolean(props.status?.printer?.reachability?.configured && !props.status?.printer?.reachability?.ok)}
          >
            Тестовая печать
          </Button>
          <Button variant="secondary" onClick={props.onCheckUpdates}>
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
              {props.status?.printer?.name ?? "—"} | {props.status?.printer?.host ?? "—"}:{props.status?.printer?.port ?? "—"} (
              {props.status?.printer?.encoding ?? "—"})
            </span>
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Активация устройства</CardTitle>
          <CardDescription>Одноразовый код генерируется на сайте логистов (страница “Принтеры”).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {deviceActivated ? (
            <Badge variant="secondary">Устройство активировано</Badge>
          ) : (
            <>
              <div className="grid gap-2">
                <Label>Код активации</Label>
                <Input
                  value={activationCode}
                  onChange={(e) => setActivationCode(e.target.value)}
                  placeholder="ABCD2-EFGH3"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.currentTarget.form?.requestSubmit?.() as any)();
                  }}
                />
                <div className="text-xs text-muted-foreground">Можно ввести вручную или отсканировать (сканер как клавиатура).</div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  (async () => {
                    setActivationInfo(null);
                    setActivationError(null);
                    setActivationBusy(true);
                    try {
                      if (!window.checkPrinter?.deviceActivate) throw new Error("deviceActivate недоступен (нужна пересборка preload)");
                      const res = await window.checkPrinter.deviceActivate(activationCode);
                      setActivationInfo(`Активировано: printer_id=${res?.printer_id || "—"}`);
                      setActivationCode("");
                    } catch (err) {
                      setActivationError(String(err));
                    } finally {
                      setActivationBusy(false);
                    }
                  })();
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" disabled={activationBusy || !activationCode.trim() || props.forcedUpdate}>
                    {activationBusy ? "Активируем..." : "Активировать"}
                  </Button>
                  {activationInfo && <Badge variant="secondary">{activationInfo}</Badge>}
                  {activationError && <Badge variant="destructive">{activationError}</Badge>}
                </div>
              </form>
            </>
          )}
        </CardContent>
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
                value={props.settings?.backendUrl ?? ""}
                onChange={(e) => props.setSettings((p) => (p ? { ...p, backendUrl: e.target.value } : null))}
                placeholder="https://printer.backend.miobeauty.uz"
              />
            </div>

            <div className="grid gap-2">
              <Label>Имя принтера</Label>
              <Input
                value={props.settings?.printer?.name ?? ""}
                onChange={(e) =>
                  props.setSettings((p) => {
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
                value={props.settings?.warehouse?.name ?? ""}
                onChange={(e) =>
                  props.setSettings((p) => {
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
                value={props.settings?.printer?.host ?? ""}
                onChange={(e) =>
                  props.setSettings((p) => {
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
                value={String(props.settings?.printer?.port ?? "")}
                onChange={(e) =>
                  props.setSettings((p) =>
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
                value={props.settings?.printer?.encoding ?? ""}
                onChange={(e) =>
                  props.setSettings((p) => {
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
            client_id: <span className="font-mono">{props.settings?.clientId ?? "—"}</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={props.onSaveSettings} disabled={!props.settings || props.forcedUpdate}>
              Сохранить
            </Button>
            <Button
              variant="outline"
              onClick={() => alert("Для теста без реального принтера: npm run fake-printer и host=127.0.0.1 port=9100.")}
            >
              Как тестировать
            </Button>
          </div>
        </CardContent>
      </Card>

      {props.update.kind === "available" && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle>Доступно обновление</CardTitle>
            <CardDescription>{props.update.message}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={props.onStartUpdate}>Обновить</Button>
            {!props.update.forced && (
              <Button variant="outline" onClick={() => props.setUpdate({ kind: "idle" })}>
                Не сейчас
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {props.update.kind === "downloading" && (
        <Card>
          <CardHeader>
            <CardTitle>Скачивание обновления...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={props.update.progress ?? 0} />
            <div className="text-sm text-muted-foreground">{Math.round(props.update.progress ?? 0)}%</div>
          </CardContent>
        </Card>
      )}

      {props.update.kind === "ready" && (
        <Card>
          <CardHeader>
            <CardTitle>Готово</CardTitle>
            <CardDescription>{props.update.message}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {props.update.kind === "error" && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle>Ошибка</CardTitle>
            <CardDescription>{props.update.message}</CardDescription>
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
            {props.logs.map((l) => `${l.ts} [${l.level}] ${l.message}`).join("\n")}
          </pre>
        </CardContent>
      </Card>
    </>
  );
}

