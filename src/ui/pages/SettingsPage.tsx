import React from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import { Separator } from "../../components/ui/separator";
import { PrinterIcon } from "@/components/icons";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/ui/collapsible";
import type { PrinterStatus, Settings, LogEntry, UpdateState } from "../types";
import { Settings2, ChevronDown, ChevronRight } from "lucide-react";

export function SettingsPage(props: {
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
  const [debugOpen, setDebugOpen] = React.useState(false);

  const ensurePrinter = React.useCallback((p: Settings): Settings["printer"] => {
    return (
      p.printer ?? {
        host: "",
        port: 9100,
        encoding: "cp866",
        name: "Mio beauty Склад принтер",
      }
    );
  }, []);

  const canTestPrint = !props.forcedUpdate && !Boolean(props.status?.printer?.reachability?.configured && !props.status?.printer?.reachability?.ok);

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
    <div className="p-0 lg:p-0 h-full">
      <div className="grid min-h-0 grid-cols-1 gap-0 lg:grid-cols-[340px_1fr] h-full">
        <aside className="min-h-0 border-r bg-card">
          <div className="p-4">
            <h1 className="text-[24px] font-semibold leading-[120%]">Настройки</h1>
          </div>

          <div>
            <button
              type="button"
              className="relative flex w-full items-start text-left transition hover:bg-muted"
              aria-current="page"
            >
              <div className="flex p-4 pr-2 items-top text-foreground">
                <PrinterIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 py-4 w-full">
                <div className="flex items-center gap-2">
                  <div className="truncate text-[16px] font-medium leading-[20px]">Настройки принтера</div>
                </div>
                <div className=" text-[14px] leading-[16px] mt-0.5 text-muted-foreground">
                  {deviceActivated ? "Принтер активирован" : "Нужно активировать принтер"}
                </div>
              </div>
              <div className="flex h-full p-4">
                <span className="h-2 w-2 rounded-full bg-orange-400" />
              </div>

            </button>

            <div className="px-3 pt-4">
              {/* <Button variant="outline" className="w-full justify-between" onClick={props.onCheckUpdates} disabled={props.forcedUpdate}>
                Проверить обновления
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Button>
              <div className="mt-3 text-xs text-muted-foreground">
                Backend: <span className="font-mono">{props.status?.backendUrl ?? "—"}</span> · Версия:{" "}
                <span className="font-mono">{props.status?.appVersion ?? "—"}</span>
              </div> */}
            </div>
          </div>
        </aside>

        <section className="min-w-0 min-h-0 bg-card">
          <div className="flex items-start justify-between gap-6 p-4">
            <div className="min-w-0">
              <h2 className="text-[20px] leading-[120%] font-semibold">Настройки принтера</h2>
              <p className="text-[16px] leading-[20px] text-muted-foreground">Настройте принтер для печати чеков</p>
            </div>

            <Button variant="outline" className="shrink-0 gap-2" disabled>
              <PrinterIcon className="h-4 w-4" />
              <span className="max-w-[220px] truncate">{props.settings?.printer?.name || props.status?.printer?.name || "Принтер"}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>

          <div className="p-0">
            <div className="grid gap-6 lg:grid-cols-2 p-4">
              <div className="grid gap-2">
                <Label>Название принтера</Label>
                <Input
                  value={props.settings?.printer?.name ?? ""}
                  onChange={(e) =>
                    props.setSettings((p) => {
                      if (!p) return null;
                      const printer = ensurePrinter(p);
                      return { ...p, printer: { ...printer, name: e.target.value } };
                    })
                  }
                  placeholder="Придумайте название принтера"
                />
                <div className="text-xs text-muted-foreground">Это название будет использоваться для обозначения принтера</div>
              </div>

              <div className="grid gap-2">
                <Label>Принтер host</Label>
                <Input
                  value={props.settings?.printer?.host ?? ""}
                  onChange={(e) =>
                    props.setSettings((p) => {
                      if (!p) return null;
                      const printer = ensurePrinter(p);
                      return { ...p, printer: { ...printer, host: e.target.value } };
                    })
                  }
                  placeholder="192.168.1."
                />
                <div className="text-xs text-muted-foreground">Посмотрите хост принтера в его настройках</div>
              </div>

              <div className="grid gap-2">
                <Label>Порт принтера</Label>
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
                <div className="text-xs text-muted-foreground">Обычно 9100</div>
              </div>

              <div className="grid gap-2">
                <Label>Encoding</Label>
                <Select
                  value={props.settings?.printer?.encoding ?? ""}
                  onChange={(e) =>
                    props.setSettings((p) => {
                      if (!p) return null;
                      const printer = ensurePrinter(p);
                      return { ...p, printer: { ...printer, encoding: e.target.value } };
                    })
                  }
                >
                  <option value="cp866">cp866</option>
                  <option value="cp1251">cp1251</option>
                  <option value="utf-8">utf-8</option>
                </Select>
                <div className="text-xs text-muted-foreground">Кодировка текста, по которой принтер понимает символы</div>
              </div>
            </div>

            <div className="py-6 px-4 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={props.onTestPrint} disabled={!canTestPrint}>
                Тестовая печать
              </Button>
              <Button onClick={props.onSaveSettings} disabled={!props.settings || props.forcedUpdate}>
                Сохранить настройки
              </Button>
            </div>

            <Separator className="my-3" />

            <div className="p-4">
              <div className="flex items-start justify-between gap-3 pb-4">
                <div>
                  <div className="text-[20px] leading-[120%] font-semibold">Активация принтера</div>
                  <div className="text-[16px] leading-[20px] text-muted-foreground">Одноразовый код генерирует администратор (сайт логистов)</div>
                </div>
                {deviceActivated ? (
                  <Badge variant="secondary" className="py-1 px-1.5 rounded-md bg-[#D0F4DA]  text-[#16C647]  text-[14px] leading-[16px] hover:bg-[#D0F4DA]">
                    Активирован
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="py-1 px-1.5 rounded-md bg-[#FFE9D6]  text-[#FD9334]  text-[14px] leading-[16px] hover:bg-[#FFE9D6]">
                    Требуется активация
                  </Badge>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
                <div className="grid gap-2">
                  <Label>Код активации</Label>
                  <Input
                    value={activationCode}
                    onChange={(e) => setActivationCode(e.target.value)}
                    placeholder="ABCD2-EFGH3"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.currentTarget.form?.requestSubmit?.() as any)();
                    }}
                    disabled={deviceActivated || props.forcedUpdate}
                  />
                  <div className="text-xs text-muted-foreground">Отсканируйте или введите одноразовый код</div>
                </div>

                <form
                  className="flex items-center "
                  onSubmit={(e) => {
                    e.preventDefault();
                    (async () => {
                      setActivationInfo(null);
                      setActivationError(null);
                      setActivationBusy(true);
                      try {
                        if (!window.checkPrinter?.deviceActivate)
                          throw new Error("deviceActivate недоступен (нужна пересборка preload)");
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
                  <Button type="submit" className="w-full" disabled={deviceActivated || activationBusy || !activationCode.trim() || props.forcedUpdate}>
                    {activationBusy ? "Активируем..." : "Активировать"}
                  </Button>
                </form>
              </div>

              {(activationInfo || activationError) && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {activationInfo && <Badge variant="secondary">{activationInfo}</Badge>}
                  {activationError && <Badge variant="destructive">{activationError}</Badge>}
                </div>
              )}
            </div>

            {/* <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
              <div className="mt-10 flex items-center justify-between">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-0">
                    <Settings2 className="h-4 w-4" />
                    Диагностика
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </CollapsibleTrigger>
                <div className="text-xs text-muted-foreground">
                  client_id: <span className="font-mono">{props.settings?.clientId ?? "—"}</span>
                </div>
              </div>
              <CollapsibleContent>
                <div className="mt-4 grid gap-6 rounded-2xl border bg-muted/30 p-4">
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
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => alert("Для теста без реального принтера: npm run fake-printer и host=127.0.0.1 port=9100.")}
                    >
                      Как тестировать
                    </Button>
                    {props.update.kind === "available" ? (
                      <Button onClick={props.onStartUpdate}>Обновить</Button>
                    ) : null}
                  </div>

                  <div>
                    <div className="text-sm font-medium">Логи</div>
                    <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-black p-3 font-mono text-xs text-zinc-200">
                      {props.logs.map((l) => `${l.ts} [${l.level}] ${l.message}`).join("\n")}
                    </pre>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible> */}
          </div>
        </section>
      </div>
    </div>
  );
}

