import React from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Progress } from "../../components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { useWarehouseQueue } from "./useWarehouseQueue";
import { cn } from "../../lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";

import type { WarehouseAuthStatus } from "./types";

function formatSum(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("ru-RU").format(n);
  } catch {
    return String(n);
  }
}

function statusLabel(s: string): string {
  switch ((s || "").toUpperCase()) {
    case "TO_PICK":
      return "К сборке";
    case "PICKING":
      return "В сборке";
    case "PICKED":
      return "Собран";
    case "PARTIALLY_PICKED":
      return "Частично собран";
    case "PICK_FAILED":
      return "Ошибка";
    default:
      return s || "—";
  }
}

function statusBadgeVariant(s: string): "default" | "secondary" | "destructive" {
  const up = (s || "").toUpperCase();
  if (up === "PICKED") return "default";
  if (up === "PARTIALLY_PICKED") return "secondary";
  if (up === "PICK_FAILED") return "destructive";
  if (up === "PICKING") return "secondary";
  return "secondary";
}

function percent(picked: number, ordered: number): number {
  const o = Number(ordered);
  const p = Number(picked);
  if (!Number.isFinite(o) || o <= 0) return 0;
  if (!Number.isFinite(p) || p <= 0) return 0;
  return Math.max(0, Math.min(100, (p / o) * 100));
}

export function WarehouseQueue(props: {
  active: boolean;
  online: boolean;
  offlineReason?: string | null;
  forcedUpdate: boolean;
  auth: WarehouseAuthStatus | null;
}) {
  const s = useWarehouseQueue(props);
  const scanInputRef = React.useRef<HTMLInputElement | null>(null);
  const lastPointerDownAtRef = React.useRef<number>(0);
  const offline = !props.online;
  const actionsDisabled = offline || props.forcedUpdate || s.loading;
  const activePickingOrders = s.pickingTabs?.items || [];
  const activePickingCount = activePickingOrders.length;
  const tabValue = s.selectedId === null ? "queue" : String(s.selectedId);
  const PARTIAL_REASONS: Array<{ code: string; label: string }> = s.reasons?.length
    ? s.reasons
    : [
        { code: "OUT_OF_STOCK", label: "Нет в наличии" },
        { code: "DAMAGED", label: "Повреждено" },
        { code: "NOT_FOUND", label: "Не найдено" },
        { code: "SUBSTITUTED", label: "Замена" },
        { code: "OTHER", label: "Другое" },
      ];

  const sessionActive = Boolean(s.selectedId !== null && s.detail?.picking?.is_active);
  const canFocusScan =
    sessionActive && !offline && !props.forcedUpdate && !s.scanBusy && !s.finishBusy && !s.finishConfirmOpen && !s.partialOpen;

  const focusScanSoon = React.useCallback(() => {
    if (!canFocusScan) return;
    requestAnimationFrame(() => {
      scanInputRef.current?.focus();
    });
  }, [canFocusScan]);

  React.useEffect(() => {
    // After errors, return focus back to scan input for keyboard-only workflow.
    if (!canFocusScan) return;
    if (s.scanError || s.finishError) focusScanSoon();
  }, [canFocusScan, focusScanSoon, s.finishError, s.scanError]);

  React.useEffect(() => {
    // When dialogs close, return focus back to scan input.
    if (!sessionActive) return;
    if (s.finishConfirmOpen || s.partialOpen) return;
    focusScanSoon();
  }, [focusScanSoon, s.finishConfirmOpen, s.partialOpen, sessionActive]);

  if (!props.active) return null;

  if (!s.hasToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Склад: вход</CardTitle>
          <CardDescription>Нужен доступ “picker” (JWT). Токен сохраняется локально на этом ПК.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Телефон</Label>
            <Input value={s.phone} onChange={(e) => s.setPhone(e.target.value)} placeholder="+998901234567" />
          </div>
          <div className="grid gap-2">
            <Label>Пароль</Label>
            <Input value={s.password} onChange={(e) => s.setPassword(e.target.value)} placeholder="••••••••" type="password" />
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button onClick={s.onLogin} disabled={s.loginBusy || !s.phone || !s.password || props.forcedUpdate}>
              Войти
            </Button>
            {props.forcedUpdate && <Badge variant="destructive">Требуется обновление — вход/действия заблокированы</Badge>}
            {s.loginError && <Badge variant="destructive">{s.loginError}</Badge>}
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderPickingTab = (o: any) => {
    const picked = Number(o.progress?.picked ?? 0);
    const ordered = Number(o.progress?.ordered ?? 0);
    const pct = percent(picked, ordered);
    return (
      <TabsTrigger key={o.id} value={String(o.id)} className="min-w-[220px]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{o.number || `#${o.id}`}</span>
            <Badge variant={statusBadgeVariant(o.picking_status)}>{statusLabel(o.picking_status)}</Badge>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {Math.round(picked)}/{Math.round(ordered)}
            </span>
            <div className="min-w-[120px] flex-1">
              <Progress value={pct} />
            </div>
            <span className="text-xs text-muted-foreground">{Math.round(pct)}%</span>
          </div>
        </div>
      </TabsTrigger>
    );
  };

  const WarehouseChromeTabs = (
    <Card>
      <CardContent className="p-0 border-none shadow-none">
        <Tabs
          value={tabValue}
          onValueChange={(v) => {
            if (v === "queue") {
              s.setSelectedId(null);
              return;
            }
            void s.openDetail(Number(v));
          }}
        >
          <TabsList className="rounded-b-none border-b-0">

            {activePickingOrders.map(renderPickingTab)}
          </TabsList>
        </Tabs>
      </CardContent>
    </Card>
  );

  if (s.selectedId !== null) {
    const readOnly = s.mode === "problems";
    const canStart = !readOnly && !offline && !props.forcedUpdate && !sessionActive;

    const pickingItems = s.detail?.picking?.items || [];
    const notScanned = pickingItems.filter((it) => (it.picked_qty ?? 0) < (it.ordered_qty ?? 0));
    const scanned = pickingItems.filter((it) => (it.picked_qty ?? 0) >= (it.ordered_qty ?? 0));

    const complete = pickingItems.length > 0 && notScanned.length === 0;

    const renderPickItem = (it: (typeof pickingItems)[number]) => (
      <div
        key={it.id}
        className={cn(
          "flex items-center justify-between rounded-md border px-3 py-2",
          (it.picked_qty ?? 0) > 0 && (it.picked_qty ?? 0) < (it.ordered_qty ?? 0) && "border-amber-200 bg-amber-50",
          (it.picked_qty ?? 0) >= (it.ordered_qty ?? 0) && "border-emerald-200 bg-emerald-50",
          s.highlightItemId === it.id && "ring-2 ring-primary",
        )}
      >
        <div className="min-w-0">
          <div className="truncate font-medium">{it.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {it.sku ? `SKU: ${it.sku}` : "SKU: —"} • штрихкодов: {it.barcodes?.length ?? 0}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(it.picked_qty ?? 0) >= (it.ordered_qty ?? 0) ? (
            <Badge variant="default">Готово</Badge>
          ) : (it.picked_qty ?? 0) > 0 ? (
            <Badge variant="secondary">В процессе</Badge>
          ) : (
            <Badge variant="secondary">Не начато</Badge>
          )}
          <Badge variant="secondary">
            {Math.round(it.picked_qty)}/{Math.round(it.ordered_qty)}
          </Badge>
        </div>
      </div>
    );

    return (
      <div
        className="space-y-4"
        onPointerDownCapture={() => {
          lastPointerDownAtRef.current = Date.now();
        }}
      >
        {WarehouseChromeTabs}
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" onClick={() => s.setSelectedId(null)}>
            ← Назад к очереди
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant={offline ? "destructive" : "default"}>{offline ? "Оффлайн" : "Онлайн"}</Badge>
            {offline && props.offlineReason ? (
              <span className="text-xs text-muted-foreground">Причина: {props.offlineReason}</span>
            ) : null}
            <Button variant="outline" onClick={s.onLogout}>
              Выйти
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Заказ #{s.selectedId}</CardTitle>
            <CardDescription>Экран сборки (MVP): детали + позиции.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {s.detailBusy && <div className="text-sm text-muted-foreground">Загрузка…</div>}
            {s.detailError && <Badge variant="destructive">{s.detailError}</Badge>}
            {!s.detailBusy && s.detail && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{s.detail.order.number}</Badge>
                  <Badge variant="secondary">Сумма: {formatSum(s.detail.order.order_data?.total ?? null)} сум</Badge>
                  <Badge variant={s.detail.order.printed ? "default" : "secondary"}>
                    {s.detail.order.printed ? "Печатался" : "Не печатался"}
                  </Badge>
                  {s.detail.picking && (
                    <Badge variant={statusBadgeVariant(s.detail.picking.status)}>{statusLabel(s.detail.picking.status)}</Badge>
                  )}
                </div>

                {!sessionActive && !readOnly && (
                  <Button onClick={() => void s.pickingStart(s.selectedId!)} disabled={!canStart}>
                    Начать сборку
                  </Button>
                )}

                {sessionActive && !readOnly && (
                  <div className="space-y-2 rounded-md border p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Скан-код</Label>
                        <Input
                          ref={scanInputRef}
                          value={s.scanCode}
                          onChange={(e) => s.setScanCode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "Tab") {
                              e.preventDefault();
                              void s.pickingScan(s.scanCode);
                            }
                          }}
                          placeholder="Отсканируй штрихкод/QR и нажми Enter/Tab"
                          disabled={offline || props.forcedUpdate || s.scanBusy}
                          autoFocus
                          onBlur={() => {
                            // Keep focus for scanner workflows but don't steal it from mouse clicks.
                            const sincePointerMs = Date.now() - lastPointerDownAtRef.current;
                            if (sincePointerMs >= 350) focusScanSoon();
                          }}
                        />
                        <div className="text-xs text-muted-foreground">
                          Сканер обычно вводит код как клавиатура и завершает Enter (иногда Tab).
                        </div>
                      </div>
                      <div className="flex flex-col justify-end gap-2">
                        <Button
                          onClick={() => void s.pickingScan(s.scanCode)}
                          disabled={offline || props.forcedUpdate || s.scanBusy || !s.scanCode.trim()}
                        >
                          Применить
                        </Button>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => s.setPartialOpen(true)}
                            disabled={offline || props.forcedUpdate || s.scanBusy || s.finishBusy}
                          >
                            Завершить частично
                          </Button>
                          {complete && (
                            <Button
                              onClick={() => s.setFinishConfirmOpen(true)}
                              disabled={offline || props.forcedUpdate || s.scanBusy || s.finishBusy}
                            >
                              Завершить
                            </Button>
                          )}
                        </div>
                        {s.scanError && <Badge variant="destructive">{s.scanError}</Badge>}
                        {s.pendingScan && (
                          <Badge variant="secondary">
                            Отправка: <span className="font-mono">{s.pendingScan.code}</span>
                          </Badge>
                        )}
                        {s.lastScan && (
                          <Badge variant="secondary">
                            Последний скан: <span className="font-mono">{s.lastScan.code}</span>
                          </Badge>
                        )}
                        {s.finishError && <Badge variant="destructive">{s.finishError}</Badge>}
                      </div>
                    </div>
                  </div>
                )}

                {readOnly && (
                  <div className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">
                    Режим “Проблемы”: просмотр только для чтения.
                  </div>
                )}

                {s.detail.picking?.items?.length ? (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      Позиции: {s.detail.picking.items.length} • Прогресс:{" "}
                      {Math.round(s.detail.picking.progress?.picked ?? 0)}/{Math.round(s.detail.picking.progress?.ordered ?? 0)}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Не отсканировано</div>
                        {notScanned.length ? (
                          <div className="grid gap-2">{notScanned.map(renderPickItem)}</div>
                        ) : (
                          <div className="text-sm text-muted-foreground">Все позиции собраны.</div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium">Отсканировано</div>
                        {scanned.length ? (
                          <div className="grid gap-2">{scanned.map(renderPickItem)}</div>
                        ) : (
                          <div className="text-sm text-muted-foreground">Пока нет отсканированных позиций.</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Позиции пока не созданы. Нажми “Начать сборку”.</div>
                )}

                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-medium">Аудит</div>
                    {s.eventsBusy && <Badge variant="secondary">Загрузка…</Badge>}
                    {s.eventsError && <Badge variant="destructive">{s.eventsError}</Badge>}
                    {s.detail.picking?.partial_reason_code ? (
                      <Badge variant="secondary">
                        Причина:{" "}
                        {PARTIAL_REASONS.find((r) => r.code === String(s.detail?.picking?.partial_reason_code))?.label ||
                          String(s.detail?.picking?.partial_reason_code)}
                      </Badge>
                    ) : null}
                  </div>
                  {s.detail.picking?.partial_reason_comment ? (
                    <div className="text-xs text-muted-foreground">Комментарий: {String(s.detail.picking.partial_reason_comment)}</div>
                  ) : null}

                  {(s.events?.events || []).length ? (
                    <div className="max-h-48 space-y-1 overflow-auto rounded-md bg-muted p-2 text-xs">
                      {(s.events?.events || []).slice(-60).map((e) => (
                        <div key={e.id} className="flex flex-wrap gap-x-2 gap-y-1">
                          <span className="font-mono text-muted-foreground">{e.ts ? String(e.ts).slice(11, 19) : "—"}</span>
                          <span className="font-mono">{e.type}</span>
                          {e.code ? <span className="font-mono">{e.code}</span> : null}
                          {e.message ? <span className="text-muted-foreground">{e.message}</span> : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Событий пока нет.</div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={s.finishConfirmOpen} onOpenChange={s.setFinishConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Завершить сборку?</AlertDialogTitle>
              <AlertDialogDescription>
                Все товары отсканированы. Завершить сборку и отметить заказ как “Собран”?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={s.finishBusy}>Отмена</AlertDialogCancel>
              <AlertDialogAction
                disabled={offline || props.forcedUpdate || s.finishBusy}
                onClick={() => void s.pickingFinish()}
              >
                Завершить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={s.partialOpen} onOpenChange={s.setPartialOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Завершить частично</AlertDialogTitle>
              <AlertDialogDescription>Выбери причину, почему заказ собран не полностью.</AlertDialogDescription>
            </AlertDialogHeader>

            <div className="mt-3 grid gap-2">
              <Label>Причина</Label>
              <Select value={s.partialReason} onChange={(e) => s.setPartialReason(e.target.value)} disabled={s.finishBusy}>
                <option value="">Выбери причину…</option>
                {PARTIAL_REASONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </Select>
              {s.reasonsError ? <div className="text-xs text-destructive">{String(s.reasonsError)}</div> : null}
            </div>

            <div className="mt-3 grid gap-2">
              <Label>Комментарий (опционально)</Label>
              <Textarea
                value={s.partialComment}
                onChange={(e) => s.setPartialComment(e.target.value)}
                placeholder="Например: нет на полке, будет позже…"
                disabled={s.finishBusy}
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={s.finishBusy}>Отмена</AlertDialogCancel>
              <AlertDialogAction
                disabled={offline || props.forcedUpdate || s.finishBusy || !s.partialReason}
                onClick={() => void s.pickingFinish({ reason_code: s.partialReason, comment: s.partialComment })}
              >
                Завершить частично
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {WarehouseChromeTabs}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={offline ? "destructive" : "default"}>{offline ? "Оффлайн" : "Онлайн"}</Badge>
          {offline && props.offlineReason ? (
            <span className="text-xs text-muted-foreground">Причина: {props.offlineReason}</span>
          ) : null}
          {props.forcedUpdate && <Badge variant="destructive">Требуется обновление — действия заблокированы</Badge>}
          <Badge variant="secondary">{props.auth?.phone || "—"}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={s.mode === "queue" ? "default" : "outline"}
            onClick={() => {
              s.setMode("queue");
              s.setStatusFilter("");
            }}
            disabled={s.loading}
          >
            Очередь
          </Button>
          <Button
            variant={s.mode === "problems" ? "default" : "outline"}
            onClick={() => {
              s.setMode("problems");
              s.setStatusFilter("");
            }}
            disabled={s.loading}
          >
            Проблемы
          </Button>
          <Button variant="outline" onClick={() => void s.refresh("manual")} disabled={!s.hasToken || s.loading}>
            Обновить
          </Button>
          <Button variant="outline" onClick={s.onLogout}>
            Выйти
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{s.mode === "problems" ? "Проблемы" : "Очередь склада"}</CardTitle>
          <CardDescription>
            {s.mode === "problems"
              ? "PARTIALLY_PICKED и PICK_FAILED. Можно открыть заказ и посмотреть причину и аудит."
              : "Список заказов для сборки. Поиск и фильтры."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Input
                value={s.q}
                onChange={(e) => s.setQ(e.target.value)}
                placeholder={s.mode === "problems" ? "Поиск: номер / order_id / телефон / код" : "Поиск: номер / order_id / телефон"}
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant={s.statusFilter === "" ? "default" : "outline"} onClick={() => s.setStatusFilter("")}>
                Все
              </Button>
              {s.mode === "problems" ? (
                <>
                  <Button
                    variant={s.statusFilter === "PARTIALLY_PICKED" ? "default" : "outline"}
                    onClick={() => s.setStatusFilter("PARTIALLY_PICKED")}
                  >
                    Частично
                  </Button>
                  <Button
                    variant={s.statusFilter === "PICK_FAILED" ? "default" : "outline"}
                    onClick={() => s.setStatusFilter("PICK_FAILED")}
                  >
                    Ошибка
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant={s.statusFilter === "TO_PICK" ? "default" : "outline"}
                    onClick={() => s.setStatusFilter("TO_PICK")}
                  >
                    К сборке
                  </Button>
                  <Button
                    variant={s.statusFilter === "PICKING" ? "default" : "outline"}
                    onClick={() => s.setStatusFilter("PICKING")}
                  >
                    В сборке
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {s.mode === "queue" ? (
              <>
                <Button variant={s.statusFilter === "PICKED" ? "default" : "outline"} onClick={() => s.setStatusFilter("PICKED")}>
                  Собран
                </Button>
                <Button
                  variant={s.statusFilter === "PARTIALLY_PICKED" ? "default" : "outline"}
                  onClick={() => s.setStatusFilter("PARTIALLY_PICKED")}
                >
                  Частично
                </Button>
              </>
            ) : null}
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => s.setOffset(Math.max(0, s.offset - s.limit))}
                disabled={s.offset === 0 || s.loading}
              >
                ←
              </Button>
              <Button
                variant="outline"
                onClick={() => s.setOffset(s.offset + s.limit)}
                disabled={s.loading || (s.data?.items?.length ?? 0) < s.limit}
              >
                →
              </Button>
            </div>
          </div>

          {s.error && <Badge variant="destructive">{s.error}</Badge>}

          <div className="space-y-2">
            {s.loading && <div className="text-sm text-muted-foreground">Загрузка…</div>}
            {!s.loading && s.refreshing && <div className="text-xs text-muted-foreground">Обновление…</div>}
            {!s.loading && (s.data?.items?.length ?? 0) === 0 && <div className="text-sm text-muted-foreground">Пусто.</div>}

            {(s.data?.items || []).map((it) => {
              const label = statusLabel(it.picking_status);
              const primaryCta = it.active_session_id || it.picking_status === "PICKING" ? "Продолжить" : "Начать";
              const ctaDisabled = actionsDisabled;
              const reasonLabel = it.partial_reason_code
                ? PARTIAL_REASONS.find((r) => r.code === it.partial_reason_code)?.label || it.partial_reason_code
                : null;

              return (
                <div key={it.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="truncate text-left font-semibold underline-offset-4 hover:underline"
                        onClick={() => void s.openDetail(it.id)}
                        disabled={props.forcedUpdate}
                      >
                        {it.number || `#${it.id}`}
                      </button>
                      <Badge variant={statusBadgeVariant(it.picking_status)}>{label}</Badge>
                      <Badge variant="secondary">
                        {Math.round(it.progress?.picked ?? 0)}/{Math.round(it.progress?.ordered ?? 0)}
                      </Badge>
                      {it.printed ? <Badge variant="default">Печатался</Badge> : <Badge variant="secondary">Не печатался</Badge>}
                      {s.mode === "problems" && reasonLabel ? <Badge variant="secondary">Причина: {reasonLabel}</Badge> : null}
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {it.client_name ? it.client_name : "—"} • {it.client_phone ? it.client_phone : "—"} • позиций:{" "}
                      {it.items_count ?? "—"} • сумма: {formatSum(it.total)} сум
                    </div>
                    {s.mode === "problems" && it.partial_reason_comment ? (
                      <div className="mt-1 truncate text-xs text-muted-foreground">Комментарий: {String(it.partial_reason_comment)}</div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={() => void s.openDetail(it.id)} disabled={ctaDisabled}>
                      Открыть
                    </Button>
                    {s.mode === "queue" ? (
                      <Button
                        onClick={() => (primaryCta === "Начать" ? void s.pickingStart(it.id) : void s.openDetail(it.id))}
                        disabled={ctaDisabled}
                      >
                        {primaryCta}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
