import * as React from "react";

import { ImageOff } from "lucide-react";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Skeleton } from "../../../components/ui/skeleton";
import { Textarea } from "../../../components/ui/textarea";
import { cn } from "../../../lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";

import { formatSum } from "../ui";
import type { WarehouseQueueState } from "../useWarehouseQueue";

export function WarehousePickingPage(props: {
  s: WarehouseQueueState;
  chromeTabs: React.ReactNode;
  offline: boolean;
  offlineReason?: string | null;
  forcedUpdate: boolean;
  partialReasons: Array<{ code: string; label: string }>;
}) {
  const s = props.s;
  const scanInputRef = React.useRef<HTMLInputElement | null>(null);
  const lastPointerDownAtRef = React.useRef<number>(0);

  const sessionActive = Boolean(s.selectedId !== null && s.detail?.picking?.is_active);
  const readOnly = s.mode === "problems";

  const canFocusScan =
    s.selectedId !== null &&
    s.mode !== "problems" &&
    !props.offline &&
    !props.forcedUpdate &&
    !s.scanBusy &&
    !s.finishBusy &&
    !s.finishConfirmOpen &&
    !s.partialOpen;

  const focusScanSoon = React.useCallback(() => {
    if (!canFocusScan) return;
    requestAnimationFrame(() => {
      scanInputRef.current?.focus();
    });
  }, [canFocusScan]);

  React.useEffect(() => {
    if (!canFocusScan) return;
    if (s.scanError || s.finishError) focusScanSoon();
  }, [canFocusScan, focusScanSoon, s.finishError, s.scanError]);

  React.useEffect(() => {
    if (s.selectedId === null) return;
    if (s.finishConfirmOpen || s.partialOpen) return;
    focusScanSoon();
  }, [focusScanSoon, s.finishConfirmOpen, s.partialOpen, s.selectedId]);

  if (s.selectedId === null) return null;

  const pickingItems = s.detail?.picking?.pick_items || s.detail?.picking?.items || [];
  const notScanned = pickingItems.filter((it) => (it.picked_qty ?? 0) < (it.ordered_qty ?? 0));
  const scanned = pickingItems.filter((it) => (it.picked_qty ?? 0) >= (it.ordered_qty ?? 0));

  const complete = pickingItems.length > 0 && notScanned.length === 0;
  const orderItems = (s.detail?.order?.order_items as any[] | undefined) || [];
  const previewItems = orderItems
    .filter((it) => it && typeof it === "object")
    .map((it, idx) => ({
      id: `order_item_${idx}`,
      name: String(it.name || "Товар"),
      sku: it.sku ? String(it.sku) : null,
      ms_assortment_id: it.ms_assortment_id ? String(it.ms_assortment_id) : null,
      main_image_mini_url: (it.main_image_mini_url ? String(it.main_image_mini_url) : null) as string | null,
      barcodes: Array.isArray(it.barcodes) ? it.barcodes.map((b: any) => String(b)) : [],
      ordered_qty: Number(it.qty) || 0,
      picked_qty: 0,
    }));

  const PickItemThumb = (p: { url: string | null | undefined; alt: string }) => {
    const [state, setState] = React.useState<"idle" | "loading" | "loaded" | "error">("idle");

    React.useEffect(() => {
      const u = (p.url || "").trim();
      setState(u ? "loading" : "error");
    }, [p.url]);

    return (
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-muted">
        {state === "loading" ? <Skeleton className="absolute inset-0" /> : null}
        {state === "error" ? (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <ImageOff className="h-4 w-4" />
          </div>
        ) : null}
        {p.url ? (
          <img
            src={p.url}
            alt={p.alt}
            className={cn("absolute inset-0 h-full w-full object-cover", state === "loaded" ? "opacity-100" : "opacity-0")}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setState("loaded")}
            onError={() => setState("error")}
          />
        ) : null}
      </div>
    );
  };

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
      <div className="min-w-0 flex items-center gap-3">
        <PickItemThumb url={it.main_image_mini_url} alt={it.name} />
        <div className="min-w-0">
          <div className="truncate font-medium">{it.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {it.sku ? `SKU: ${it.sku}` : "SKU: —"} • штрихкодов: {it.barcodes?.length ?? 0}
          </div>
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
      {props.chromeTabs}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={() => s.setSelectedId(null)}>
          ← Назад к очереди
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant={props.offline ? "destructive" : "default"}>{props.offline ? "Оффлайн" : "Онлайн"}</Badge>
          {props.offline && props.offlineReason ? (
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
              </div>

              {!readOnly && (
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
                        placeholder="Отсканируй штрихкод/QR и нажми Enter/Tab (первый скан начнёт сборку)"
                        disabled={props.offline || props.forcedUpdate || s.scanBusy}
                        autoFocus
                        onBlur={() => {
                          const sincePointerMs = Date.now() - lastPointerDownAtRef.current;
                          if (sincePointerMs >= 350) focusScanSoon();
                        }}
                      />
                      <div className="text-xs text-muted-foreground">
                        Сканер вводит код как клавиатура и завершает Enter (иногда Tab). Первый скан автоматически начнёт сборку.
                      </div>
                    </div>
                    <div className="flex flex-col justify-end gap-2">
                      <Button onClick={() => void s.pickingScan(s.scanCode)} disabled={props.offline || props.forcedUpdate || s.scanBusy || !s.scanCode.trim()}>
                        Применить
                      </Button>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => s.setPartialOpen(true)}
                          disabled={!sessionActive || props.offline || props.forcedUpdate || s.scanBusy || s.finishBusy}
                        >
                          Завершить частично
                        </Button>
                        {complete && (
                          <Button
                            onClick={() => s.setFinishConfirmOpen(true)}
                            disabled={!sessionActive || props.offline || props.forcedUpdate || s.scanBusy || s.finishBusy}
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

                  {!sessionActive ? (
                    <div className="text-xs text-muted-foreground">Сборка ещё не начата. Первый скан создаст сессию и начнёт сборку.</div>
                  ) : null}
                </div>
              )}

              {readOnly && (
                <div className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">Режим “Проблемы”: просмотр только для чтения.</div>
              )}

              {(s.detail.picking?.pick_items?.length || s.detail.picking?.items?.length) ? (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    Позиции: {(s.detail.picking.pick_items?.length ?? s.detail.picking.items?.length) ?? 0} • Прогресс:{" "}
                    {Math.round(s.detail.picking.progress?.picked ?? 0)}/{Math.round(s.detail.picking.progress?.ordered ?? 0)}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Не отсканировано</div>
                      {notScanned.length ? <div className="grid gap-2">{notScanned.map(renderPickItem)}</div> : <div className="text-sm text-muted-foreground">Все позиции собраны.</div>}
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">Отсканировано</div>
                      {scanned.length ? <div className="grid gap-2">{scanned.map(renderPickItem)}</div> : <div className="text-sm text-muted-foreground">Пока нет отсканированных позиций.</div>}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    Сессия сборки ещё не начата. Можно заранее посмотреть товары заказа — первый скан автоматически начнёт сборку.
                  </div>
                  {previewItems.length ? (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Товары заказа</div>
                      <div className="grid gap-2">{previewItems.map(renderPickItem)}</div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Товары заказа не найдены.</div>
                  )}
                </div>
              )}

              <div className="space-y-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-medium">Аудит</div>
                  {s.eventsBusy && <Badge variant="secondary">Загрузка…</Badge>}
                  {s.eventsError && <Badge variant="destructive">{s.eventsError}</Badge>}
                  {s.detail.picking?.partial_reason_code ? (
                    <Badge variant="secondary">
                      Причина:{" "}
                      {props.partialReasons.find((r) => r.code === String(s.detail?.picking?.partial_reason_code))?.label ||
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
            <AlertDialogDescription>Все товары отсканированы. Завершить сборку и отметить заказ как завершённый?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={s.finishBusy}>Отмена</AlertDialogCancel>
            <AlertDialogAction disabled={props.offline || props.forcedUpdate || s.finishBusy} onClick={() => void s.pickingFinish()}>
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
              {props.partialReasons.map((r) => (
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
              disabled={props.offline || props.forcedUpdate || s.finishBusy || !s.partialReason}
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
