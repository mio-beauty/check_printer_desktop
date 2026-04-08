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
import { playErrorSound, resolveEffectiveErrorSound, usePreparedErrorSound, useWarehouseErrorSounds } from "../useErrorSounds";
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
  const activationInFlightRef = React.useRef(false);
  const [activationInfo, setActivationInfo] = React.useState<string | null>(null);
  const [activationError, setActivationError] = React.useState<string | null>(null);
  const deviceActivated = Boolean(props.status?.deviceAuth?.activated ?? props.settings?.deviceAuth?.refreshToken);
  const [debugOpen, setDebugOpen] = React.useState(false);
  const [probeBusy, setProbeBusy] = React.useState(false);
  const [usbPrinters, setUsbPrinters] = React.useState<string[] | null>(null);
  const [usbPrintersBusy, setUsbPrintersBusy] = React.useState(false);
  const [usbProbeBusy, setUsbProbeBusy] = React.useState(false);
  const [usbTestBusy, setUsbTestBusy] = React.useState(false);
  const errorSounds = useWarehouseErrorSounds(Boolean(props.status?.warehouseAuth?.hasToken));
  const effectiveErrorSound = React.useMemo(
    () => resolveEffectiveErrorSound(errorSounds.data, props.settings?.printer?.errorSoundId ?? null),
    [errorSounds.data, props.settings?.printer?.errorSoundId],
  );
  usePreparedErrorSound(effectiveErrorSound, Boolean(props.status?.warehouseAuth?.hasToken));
  const selectedErrorSoundValue = React.useMemo(() => {
    const configured = String(props.settings?.printer?.errorSoundId || "").trim();
    if (!configured) return "__default__";
    return errorSounds.data.sounds.some((sound) => sound.id === configured) ? configured : "__default__";
  }, [errorSounds.data.sounds, props.settings?.printer?.errorSoundId]);

  const reach = props.status?.printer?.reachability ?? null;
  const reachLabel = React.useMemo(() => {
    if (!reach) return null;
    if (!reach.configured) return "Принтер не настроен";
    if (reach.ok) return "Принтер доступен";
    return "Принтер недоступен";
  }, [reach]);

  const usbReach = props.status?.printer?.usbReachability ?? null;
  const usbReachLabel = React.useMemo(() => {
    if (!usbReach) return null;
    if (!usbReach.configured) return "USB: не настроен";
    if (usbReach.ok) return "USB: доступен";
    if (usbReach.error === "usb_printer_offline") return "USB: offline (job уйдёт в очередь)";
    return "USB: ошибка";
  }, [usbReach]);

  const usbReachTone = React.useMemo(() => {
    if (!usbReach) return "bg-[#F6F6F7] text-[#131314]";
    if (!usbReach.configured) return "bg-[#F6F6F7] text-[#131314]";
    if (usbReach.ok) return "bg-[#D0F4DA] text-[#16C647]";
    if (usbReach.error === "usb_printer_offline") return "bg-[#FFE9D6] text-[#FD9334]";
    return "bg-[#FDECEE] text-[#E73C50]";
  }, [usbReach]);

  const usbReachDetails = React.useMemo(() => {
    if (!usbReach) return null;
    const checked = usbReach.checkedAt ? new Date(usbReach.checkedAt) : null;
    const checkedLabel = checked
      ? checked.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
      : "—";
    const reason = !usbReach.configured
      ? "Выберите USB-принтер Windows и сохраните настройки."
      : usbReach.ok
        ? null
        : (usbReach.error || "unknown");
    return { checkedLabel, reason };
  }, [usbReach]);

  const reachTone = React.useMemo(() => {
    if (!reach) return "bg-[#F6F6F7] text-[#131314]";
    if (!reach.configured) return "bg-[#F6F6F7] text-[#131314]";
    if (reach.ok) return "bg-[#D0F4DA] text-[#16C647]";
    return "bg-[#FDECEE] text-[#E73C50]";
  }, [reach]);

  const reachDetails = React.useMemo(() => {
    if (!reach) return null;
    const checked = reach.checkedAt ? new Date(reach.checkedAt) : null;
    const checkedLabel = checked ? checked.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
    const reason = !reach.configured ? "Укажите host/port и сохраните настройки." : reach.ok ? null : (reach.error || "unknown");
    return { checkedLabel, reason };
  }, [reach]);

  const ensurePrinter = React.useCallback((p: Settings): Settings["printer"] => {
    return (
      p.printer ?? {
        host: "",
        port: 9100,
        encoding: "cp866",
        codepage: 17,
        name: "Mio beauty Склад принтер",
        errorSoundId: null,
      }
    );
  }, []);

  React.useEffect(() => {
    const configured = String(props.settings?.printer?.errorSoundId || "").trim();
    if (!configured) return;
    if (errorSounds.loading) return;
    if (errorSounds.data.sounds.some((sound) => sound.id === configured)) return;

    props.setSettings((p) => {
      if (!p) return null;
      const printer = ensurePrinter(p);
      if (!printer.errorSoundId) return p;
      return { ...p, printer: { ...printer, errorSoundId: null } };
    });
  }, [ensurePrinter, errorSounds.data.sounds, errorSounds.loading, props.setSettings, props.settings?.printer?.errorSoundId]);

  const canTestPrint = React.useMemo(() => {
    if (props.forcedUpdate) return false;
    const host = String(props.settings?.printer?.host ?? "").trim();
    const port = Number(props.settings?.printer?.port ?? 0);
    if (!host) return false;
    if (!Number.isFinite(port) || port <= 0) return false;
    return true;
  }, [props.forcedUpdate, props.settings?.printer?.host, props.settings?.printer?.port]);

  const ensureWarehouse = React.useCallback((p: Settings): Settings["warehouse"] => {
    return (
      p.warehouse ?? {
        name: "Sklad",
        lat: null,
        lon: null,
      }
    );
  }, []);

  const refreshUsbPrinters = React.useCallback(async () => {
    if (!window.checkPrinter?.usbPrinters) return;
    setUsbPrintersBusy(true);
    try {
      const names = await window.checkPrinter.usbPrinters();
      setUsbPrinters(Array.isArray(names) ? names : []);
    } catch (e) {
      setUsbPrinters([]);
      // Keep UX simple; details are in logs.
      alert(`Не удалось получить список USB-принтеров: ${String(e)}`);
    } finally {
      setUsbPrintersBusy(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshUsbPrinters();
  }, [refreshUsbPrinters]);

  const canTestUsbPrint = !props.forcedUpdate && Boolean(props.settings?.printer?.usbPrinterName);

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
              <div className="flex p-4 pr-2 items-start text-foreground">
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
            <div className="grid gap-2 px-4">
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
            <div className="grid gap-6 lg:grid-cols-2 p-4">

              <div className="mt-2 grid gap-2">
                <Label>Codepage (ESC t)</Label>
                <Select
                  value={String(props.settings?.printer?.codepage ?? 17)}
                  onChange={(e) =>
                    props.setSettings((p) => {
                      if (!p) return null;
                      const printer = ensurePrinter(p);
                      const next = e.target.value ? Number.parseInt(e.target.value, 10) : 17;
                      return { ...p, printer: { ...printer, codepage: Number.isFinite(next) ? next : 17 } };
                    })
                  }
                >
                  <option value="17">17 (recommended)</option>
                  <option value="6">6</option>
                  <option value="7">7</option>
                  <option value="16">16</option>
                  <option value="22">22</option>
                </Select>
                <div className="text-xs text-muted-foreground">Если вместо кириллицы “кракозябры” — поменяйте codepage и сделайте тестовую печать.</div>
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
              <div className="grid gap-2">
                <Label>Режим печати</Label>
                <Select
                  value={props.settings?.printer?.mode ?? "lan_then_usb"}
                  onChange={(e) =>
                    props.setSettings((p) => {
                      if (!p) return null;
                      const printer = ensurePrinter(p);
                      const mode =
                        e.target.value === "lan" || e.target.value === "usb" || e.target.value === "lan_then_usb" ? e.target.value : "lan_then_usb";
                      return { ...p, printer: { ...printer, mode } };
                    })
                  }
                >
                  <option value="lan_then_usb">LAN → USB (fallback)</option>
                  <option value="lan">Только LAN (IP:9100)</option>
                  <option value="usb">Только USB (Windows)</option>
                </Select>
                <div className="text-xs text-muted-foreground">
                  По умолчанию: LAN, если не получилось — пробуем USB (как в старом клиенте)
                </div>
              </div>

              <div className="grid gap-2">
                <Label>USB-принтер (Windows)</Label>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Select
                      value={props.settings?.printer?.usbPrinterName ?? ""}
                      onChange={(e) =>
                        props.setSettings((p) => {
                          if (!p) return null;
                          const printer = ensurePrinter(p);
                          const usbPrinterName = e.target.value ? String(e.target.value) : null;
                          return { ...p, printer: { ...printer, usbPrinterName } };
                        })
                      }
                    >
                      <option value="">— Не выбран —</option>
                      {(usbPrinters ?? []).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button type="button" variant="outline" onClick={refreshUsbPrinters} disabled={usbPrintersBusy || props.forcedUpdate}>
                    {usbPrintersBusy ? "Обновляем..." : "Обновить"}
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">Нужен установленный Windows-драйвер (например, Xprinter XP-80T)</div>
              </div>

              <div className="grid gap-2 lg:col-span-2">
                <Label>Звук ошибки сканирования</Label>
                <div className="flex flex-col gap-2 lg:flex-row">
                  <div className="min-w-0 flex-1">
                    <Select
                      value={selectedErrorSoundValue}
                      onChange={(e) =>
                        props.setSettings((p) => {
                          if (!p) return null;
                          const printer = ensurePrinter(p);
                          const errorSoundId = e.target.value === "__default__" ? null : String(e.target.value || "").trim() || null;
                          return { ...p, printer: { ...printer, errorSoundId } };
                        })
                      }
                    >
                      <option value="__default__">
                        {effectiveErrorSound ? `По умолчанию (${effectiveErrorSound.name})` : "По умолчанию (без звука)"}
                      </option>
                      {errorSounds.data.sounds.map((sound) => (
                        <option key={sound.id} value={sound.id}>
                          {sound.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!effectiveErrorSound?.file_url}
                    onClick={() => {
                      void playErrorSound(effectiveErrorSound);
                    }}
                  >
                    Прослушать
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Если оставить значение по умолчанию, этот компьютер будет использовать звук, который админ выбрал в frontend.
                </div>
                {errorSounds.error ? <div className="text-xs text-destructive">{errorSounds.error}</div> : null}
                {!errorSounds.loading && errorSounds.data.sounds.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Админ пока не загрузил ни одного звука ошибки.</div>
                ) : null}
              </div>
            </div>

            <div className="flex p-4 gap-6 w-full">
              <div className="w-full">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-background p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[16px] font-medium leading-[20px]">Подключение к принтеру</div>
                      {reachLabel ? (
                        <Badge variant="secondary" className={`py-1 px-2 rounded-md text-[13px] leading-[16px] hover:${reachTone} ${reachTone}`}>
                          {reachLabel}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="py-1 px-2 rounded-md text-[13px] leading-[16px]">
                          —
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-[13px] leading-[16px] text-muted-foreground">
                      {reachDetails ? (
                        <>
                          Последняя проверка: <span className="font-mono">{reachDetails.checkedLabel}</span>
                          {reachDetails.reason ? (
                            <>
                              {" "}
                              · Причина: <span className="font-mono">{reachDetails.reason}</span>
                            </>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </div>
                    {/* {props.settings?.printer?.host ? (
                      <div className="mt-1 text-[12px] leading-[16px] text-muted-foreground">
                        Быстрая проверка в PowerShell:{" "}
                        <span className="font-mono">
                          Test-NetConnection {props.settings.printer.host} -Port {props.settings.printer.port}
                        </span>
                      </div>
                    ) : null} */}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      disabled={probeBusy || props.forcedUpdate}
                      onClick={async () => {
                        if (!window.checkPrinter?.printerProbe) {
                          alert("printerProbe недоступен (нужна пересборка preload/electron).");
                          return;
                        }
                        setProbeBusy(true);
                        try {
                          await window.checkPrinter.printerProbe();
                        } catch (e) {
                          alert(`Ошибка проверки принтера: ${String(e)}`);
                        } finally {
                          setProbeBusy(false);
                        }
                      }}
                    >
                      {probeBusy ? "Проверяем..." : "Проверить сейчас"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="w-full">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-background p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[16px] font-medium leading-[20px]">USB-принтер</div>
                      {usbReachLabel ? (
                        <Badge variant="secondary" className={`py-1 px-2 rounded-md text-[13px] leading-[16px] hover:${usbReachTone} ${usbReachTone}`}>
                          {usbReachLabel}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="py-1 px-2 rounded-md text-[13px] leading-[16px]">
                          —
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-[13px] leading-[16px] text-muted-foreground">
                      {usbReachDetails ? (
                        <>
                          Последняя проверка: <span className="font-mono">{usbReachDetails.checkedLabel}</span>
                          {usbReachDetails.reason ? (
                            <>
                              {" "}
                              · Причина: <span className="font-mono">{usbReachDetails.reason}</span>
                            </>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </div>
                    {props.settings?.printer?.usbPrinterName ? (
                      <div className="mt-1 text-[12px] leading-[16px] text-muted-foreground">
                        Выбран: <span className="font-mono">{props.settings.printer.usbPrinterName}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={usbProbeBusy || props.forcedUpdate}
                      onClick={async () => {
                        if (!window.checkPrinter?.usbProbe) {
                          alert("usbProbe недоступен (нужна пересборка preload/electron).");
                          return;
                        }
                        setUsbProbeBusy(true);
                        try {
                          await window.checkPrinter.usbProbe();
                        } catch (e) {
                          alert(`Ошибка проверки USB-принтера: ${String(e)}`);
                        } finally {
                          setUsbProbeBusy(false);
                        }
                      }}
                    >
                      {usbProbeBusy ? "Проверяем..." : "Проверить USB сейчас"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="py-6 px-4 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={props.onTestPrint} disabled={!canTestPrint}>
                Тестовая печать
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!canTestUsbPrint || usbTestBusy}
                onClick={async () => {
                  if (!window.checkPrinter?.usbTestPrint) {
                    alert("usbTestPrint недоступен (нужна пересборка preload/electron).");
                    return;
                  }
                  setUsbTestBusy(true);
                  try {
                    await window.checkPrinter.usbTestPrint();
                  } catch (e) {
                    alert(`Ошибка USB-печати: ${String(e)}`);
                  } finally {
                    setUsbTestBusy(false);
                  }
                }}
              >
                {usbTestBusy ? "Печатаем (USB)..." : "Тестовая печать (USB)"}
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
                      if (activationInFlightRef.current) return;
                      activationInFlightRef.current = true;
                      setActivationBusy(true);
                      try {
                        if (!window.checkPrinter?.deviceActivate)
                          throw new Error("deviceActivate недоступен (нужна пересборка preload)");
                        const res = await window.checkPrinter.deviceActivate(activationCode);
                        setActivationInfo(`Активировано: printer_id=${res?.printer_id || "—"}`);
                        // Sync settings snapshot from main so UI reflects activation state (tokens live in main).
                        try {
                          const fresh = await window.checkPrinter.getSettings();
                          props.setSettings(fresh);
                        } catch {
                          // ignore
                        }
                        setActivationCode("");
                      } catch (err) {
                        setActivationError(String(err));
                      } finally {
                        setActivationBusy(false);
                        activationInFlightRef.current = false;
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

            <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
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

                  <label className="flex items-start gap-3 rounded-xl border bg-background/70 px-3 py-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={Boolean(props.settings?.debug?.forceWarehouseHttp)}
                      onChange={(e) =>
                        props.setSettings((p) => {
                          if (!p) return null;
                          return {
                            ...p,
                            debug: {
                              ...(p.debug || {}),
                              forceWarehouseHttp: e.target.checked,
                            },
                          };
                        })
                      }
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">Warehouse через HTTP</div>
                      <div className="text-xs text-muted-foreground">
                        Отладочный режим. `scan/finish/fail` пойдут через REST вместо Socket.IO и будут видны в обычных backend логах.
                      </div>
                    </div>
                  </label>

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
            </Collapsible>
          </div>
        </section>
      </div>
    </div>
  );
}
