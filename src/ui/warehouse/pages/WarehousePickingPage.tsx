import * as React from "react";

import { Badge, ChevronLeft, ImageOff, Info, RotateCw, ScanLine } from "lucide-react";
import { useAutoAnimate } from "@formkit/auto-animate/react";

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
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Skeleton } from "../../../components/ui/skeleton";
import { Textarea } from "../../../components/ui/textarea";
import { cn } from "../../../lib/utils";
import { BoxCheckIcon } from "@/components/icons";

import { formatSum, percent } from "../ui";
import type { WarehouseQueueState } from "../useWarehouseQueue";

function ProgressRing(props: { value: number; className?: string }) {
  const r = 7;
  const cx = 9;
  const cy = 9;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number(props.value) || 0));
  const dashoffset = circumference - (pct / 100) * circumference;

  return (
    <svg viewBox="0 0 18 18" className={props.className} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} className="fill-none stroke-black/10" strokeWidth="3" />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        className="fill-none stroke-emerald-400"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashoffset}
        transform="rotate(-90 9 9)"
      />
    </svg>
  );
}

function PickItemThumb(props: { url: string | null | undefined; alt: string; className?: string }) {
  const [state, setState] = React.useState<"idle" | "loading" | "loaded" | "error">("idle");
  const lastBaseRef = React.useRef<string>("");

  React.useEffect(() => {
    const stripQuery = (u: string) => {
      const idx = u.indexOf("?");
      return idx >= 0 ? u.slice(0, idx) : u;
    };

    const raw = (props.url || "").trim();
    const base = raw ? stripQuery(raw) : "";

    // Preserve UX: when only the presigned query string changes, don't reset the loader.
    const prevBase = lastBaseRef.current;
    lastBaseRef.current = base;

    if (!base) {
      setState("error");
      return;
    }

    if (prevBase && prevBase === base) return;

    setState("loading");
  }, [props.url]);

  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-md border bg-muted", props.className ?? "h-10 w-10")}>
      {state === "loading" ? <Skeleton className="absolute inset-0" /> : null}
      {state === "error" ? (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <ImageOff className="h-4 w-4" />
        </div>
      ) : null}
      {props.url ? (
        <img
          src={props.url}
          alt={props.alt}
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
}

function QtyDots(props: { ordered: number; picked: number }) {
  const ordered = Math.max(0, Math.floor(Number(props.ordered) || 0));
  const picked = Math.max(0, Math.floor(Number(props.picked) || 0));

  if (ordered <= 0) return null;

  const maxDots = 12;
  const visible = Math.min(ordered, maxDots);
  const extra = ordered - visible;

  return (
    <div className="flex items-center gap-1 p-1 bg-[#F8F8F8] rounded-full">
      {Array.from({ length: visible }).map((_, i) => {
        const active = i < picked;
        return (
          <span
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            className={cn("h-3 w-3 rounded-full", active ? "bg-[#45D16C]" : "bg-[#757575]")}
            aria-hidden="true"
          />
        );
      })}
      {extra > 0 ? <span className="ml-1 text-xs text-black/40">{`+${extra}`}</span> : null}
    </div>
  );
}

function NoScansEmptyState() {
  return (
    <div className="flex min-h-[360px] h-full flex-col items-center justify-center gap-3 px-6 text-center text-[#757575] px-12">
      <BoxCheckIcon className="h-8 w-8 text-[#757575]" />
      <div className="text-[16px] leading-tight">Ещё не отсканировано ни одного продукта</div>
    </div>
  );
}

function isTesterByFolder(input: unknown): boolean {
  const s = String(input ?? "").toLowerCase();
  if (!s) return false;
  return s.includes("tester") || s.includes("тестер");
}

function TesterBadge() {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2 py-1 text-[15px] leading-tight font-medium text-violet-600">
      <Info className="h-4 w-4" aria-hidden="true" />
      <span>Tester</span>
    </div>
  );
}

function TesterBadgeMuted() {
  return (
    <div className="inline-flex items-center gap-1 rounded-[6px] bg-violet-50 px-1.5 py-0.5 text-[12px] leading-tight font-medium text-violet-600">
      <Info className="h-3 w-3" aria-hidden="true" />
      <span>Tester</span>
    </div>
  );
}

function toFiniteNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function PickItemCard(props: {
  it: {
    id: string;
    name: string;
    ordered_qty: number;
    picked_qty: number;
    sku?: string | null;
    main_image_mini_url?: string | null;
    is_tester?: boolean;
  };
  highlight: boolean;
  showRemaining: boolean;
  showDots: boolean;
}) {
  const picked = Math.max(0, Math.floor(Number(props.it.picked_qty) || 0));
  const ordered = Math.max(0, Math.floor(Number(props.it.ordered_qty) || 0));
  const remaining = Math.max(0, ordered - picked);
  const sku = props.it.sku ? String(props.it.sku) : null;
  const shouldShowRemainingBadge = props.showRemaining && ordered > 1 && picked >= 1 && picked < ordered;
  const shouldShowDots = props.showDots && ordered > 1 && picked < ordered;

  return (
    <div
      className={cn(
        "flex items-start gap-4 rounded-2xl border border-[#EDEDED] bg-white p-2",
        props.highlight && "ring-2 ring-violet-400",
      )}
    >
      <PickItemThumb url={props.it.main_image_mini_url} alt={props.it.name} className="mt-0.5 h-14 w-14 rounded-xl border-[#EDEDED]" />

      <div className="min-w-0 flex flex-col justify-between h-full ">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="truncate text-[18px] font-semibold leading-tight text-black">{props.it.name}</div>
            {props.it.is_tester ? <TesterBadge /> : null}
          </div>

          {shouldShowRemainingBadge ? (
            <div className="shrink-0 rounded-lg bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-600">
              {`Осталось ${remaining}`}
            </div>
          ) : null}
        </div>
        <div className=" flex items-center gap-4 text-[16px] text-[#757575] font-medium">
          <div className="flex items-center gap-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{picked < 1 ? `Кол-во: ${ordered}` : `Собрано: ${picked}/${ordered}`}</span>
              {sku ? <span className="text-[14px] font-semibold text-black/60">{`SKU: ${sku}`}</span> : null}
            </div>
            {shouldShowDots ? <QtyDots ordered={ordered} picked={picked} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadyItemRow(props: {
  it: {
    id: string;
    name: string;
    ordered_qty: number;
    picked_qty: number;
    sku?: string | null;
    main_image_mini_url?: string | null;
    is_tester?: boolean;
  };
  highlight: boolean;
  testerBadge?: React.ReactNode;
}) {
  const ordered = Math.max(0, Math.floor(Number(props.it.ordered_qty) || 0));
  const sku = props.it.sku ? String(props.it.sku) : null;

  return (
    <div
      className={cn(
        "flex w-full items-start gap-3 border-b border-[#EDEDED] px-4 py-3 last:border-0",
        props.highlight ? "bg-violet-50/40" : "bg-white"
      )}
    >
      <PickItemThumb url={props.it.main_image_mini_url} alt={props.it.name} className="h-11 w-11 rounded-md border-[#EDEDED]" />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <div className="truncate text-[14px] font-semibold leading-tight text-[#0B0B0B]">{props.it.name}</div>
          {props.it.is_tester ? (props.testerBadge ?? <TesterBadgeMuted />) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] font-medium leading-tight text-[#757575]">
          <span>{`Кол-во: ${ordered} шт`}</span>
          {sku ? <span className="font-semibold text-black/60">{`SKU: ${sku}`}</span> : null}
        </div>
      </div>
    </div>
  );
}

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
  const [toScanListRef] = useAutoAnimate<HTMLDivElement>({ duration: 220, easing: "ease-in-out" });
  const [readyListRef] = useAutoAnimate<HTMLDivElement>({ duration: 220, easing: "ease-in-out" });

  const sessionActive = Boolean(s.selectedId !== null && s.detail?.picking?.is_active);
  const readOnly = s.mode === "problems";

  const printStatus = s.detail?.order
    ? s.detail.order.print_status ?? (s.detail.order.printed === 1 ? "printed" : "not_printed")
    : null;
  const printError = s.detail?.order?.print_error ?? null;
  const printUi =
    printStatus === "printed"
      ? { label: "Напечатан", className: "border-emerald-200 bg-emerald-50 text-emerald-700" }
      : printStatus === "print_failed"
        ? { label: "Ошибка печати", className: "border-red-200 bg-red-50 text-red-700" }
        : printStatus === "not_printed"
          ? { label: "Не напечатан", className: "border-orange-200 bg-orange-50 text-orange-700" }
          : null;

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
    if (!canFocusScan) return;
    if (!s.scanBusy) focusScanSoon();
  }, [canFocusScan, focusScanSoon, s.scanBusy]);

  React.useEffect(() => {
    if (!canFocusScan) return;

    const onWindowFocus = () => focusScanSoon();
    const onVisibility = () => {
      if (document.visibilityState === "visible") focusScanSoon();
    };

    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibility);

    const intervalId = window.setInterval(() => {
      if (!canFocusScan) return;
      if (document.activeElement !== scanInputRef.current) focusScanSoon();
    }, 1000);

    return () => {
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(intervalId);
    };
  }, [canFocusScan, focusScanSoon]);

  React.useEffect(() => {
    if (s.selectedId === null) return;
    if (s.finishConfirmOpen || s.partialOpen) return;
    focusScanSoon();
  }, [focusScanSoon, s.finishConfirmOpen, s.partialOpen, s.selectedId]);

  if (s.selectedId === null) return null;

  const pickingItems = s.detail?.picking?.pick_items || s.detail?.picking?.items || [];

  const orderItems = (s.detail?.order?.order_items as any[] | undefined) || [];
  const orderDataItems = ((s.detail?.order as any)?.order_data?.items as any[] | undefined) || [];
  const catalogSourceItems = React.useMemo(() => [...orderItems, ...orderDataItems], [orderDataItems, orderItems]);

  const groupByAssortmentId = React.useMemo(() => {
    const map = new Map<string, { name?: string | null; path?: string | null }>();
    for (const it of catalogSourceItems) {
      if (!it || typeof it !== "object") continue;
      const msId = it.ms_assortment_id ? String(it.ms_assortment_id) : "";
      if (!msId) continue;
      const group = (it as any).group ?? null;
      const name = group?.name ? String(group.name) : null;
      const path = group?.path ? String(group.path) : null;
      if (name || path) map.set(msId, { name, path });
    }
    return map;
  }, [catalogSourceItems]);
  const unitPriceByAssortmentId = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const it of catalogSourceItems) {
      if (!it || typeof it !== "object") continue;
      const msId = it.ms_assortment_id ? String(it.ms_assortment_id) : "";
      if (!msId) continue;

      const qty = toFiniteNumber((it as any).qty ?? (it as any).ordered_qty) ?? 0;
      const price = toFiniteNumber((it as any).price ?? (it as any).unit_price);
      const sum = toFiniteNumber((it as any).sum ?? (it as any).total ?? (it as any).amount);

      let unit: number | null = null;
      if (price !== null) unit = price;
      else if (sum !== null && qty > 0) unit = sum / qty;

      if (unit !== null && Number.isFinite(unit)) map.set(msId, unit);
    }
    return map;
  }, [catalogSourceItems]);

  const skuByAssortmentId = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const it of catalogSourceItems) {
      if (!it || typeof it !== "object") continue;
      const msId = it.ms_assortment_id ? String(it.ms_assortment_id) : "";
      if (!msId) continue;
      const sku = (it as any).sku ? String((it as any).sku) : "";
      if (!sku) continue;
      map.set(msId, sku);
    }
    return map;
  }, [catalogSourceItems]);

  const previewSource = orderDataItems.length ? orderDataItems : orderItems;
  const previewItems = previewSource
    .filter((it) => it && typeof it === "object")
    .map((it, idx) => ({
      id: `order_item_${idx}`,
      name: String(it.name || "Товар"),
      sku: (it as any).sku ? String((it as any).sku) : null,
      ordered_qty: Number(it.qty) || 0,
      picked_qty: 0,
      main_image_mini_url: (it.main_image_mini_url ? String(it.main_image_mini_url) : null) as string | null,
      ms_assortment_id: it.ms_assortment_id ? String(it.ms_assortment_id) : null,
      group_name: (it as any).group?.name ? String((it as any).group.name) : null,
      group_path: (it as any).group?.path ? String((it as any).group.path) : null,
    }));

  const itemsForUi = (pickingItems.length ? pickingItems : previewItems).map((it) => ({
    id: String(it.id),
    name: String(it.name || "Товар"),
    ordered_qty: Number(it.ordered_qty ?? 0),
    picked_qty: Number(it.picked_qty ?? 0),
    main_image_mini_url: (it as any).main_image_mini_url ? String((it as any).main_image_mini_url) : null,
    ms_assortment_id: (it as any).ms_assortment_id ? String((it as any).ms_assortment_id) : null,
    sku: (() => {
      const raw = (it as any).sku ? String((it as any).sku) : "";
      if (raw) return raw;
      const msId = (it as any).ms_assortment_id ? String((it as any).ms_assortment_id) : "";
      return msId ? skuByAssortmentId.get(msId) ?? null : null;
    })(),
    is_tester: (() => {
      const groupName = (it as any).group_name ?? (it as any).group?.name ?? null;
      const groupPath = (it as any).group_path ?? (it as any).group?.path ?? null;
      if (isTesterByFolder(groupName) || isTesterByFolder(groupPath)) return true;

      const msId = (it as any).ms_assortment_id ? String((it as any).ms_assortment_id) : "";
      const fromOrder = msId ? groupByAssortmentId.get(msId) : undefined;
      if (fromOrder && (isTesterByFolder(fromOrder.name) || isTesterByFolder(fromOrder.path))) return true;
      return false;
    })(),
  }));

  const notScanned = itemsForUi.filter((it) => (it.picked_qty ?? 0) < (it.ordered_qty ?? 0));
  const scanned = itemsForUi.filter((it) => (it.picked_qty ?? 0) >= (it.ordered_qty ?? 0));

  // UX sorting rules:
  // - "К сканированию": first show multi-qty items that already started scanning (qty > 1 && picked > 0),
  //   keep relative order as received from backend within groups.
  // - "Готово к отправке": sort by last scan time desc (most recent scan on top), stable for ties/missing.
  const notScannedUi = React.useMemo(() => {
    const startedMulti: typeof notScanned = [];
    const rest: typeof notScanned = [];
    for (const it of notScanned) {
      const ordered = Number(it.ordered_qty) || 0;
      const picked = Number(it.picked_qty) || 0;
      if (ordered > 1 && picked > 0) startedMulti.push(it);
      else rest.push(it);
    }
    return [...startedMulti, ...rest];
  }, [notScanned]);

  const scannedUi = React.useMemo(() => {
    const tsById: Record<string, string> = { ...(s.lastScanTsByItemId ?? {}) };

    const ev = s.events?.events ?? [];
    for (const e of ev) {
      const itemId = e?.pick_item_id ? String(e.pick_item_id) : "";
      const ts = e?.ts ? String(e.ts) : "";
      if (!itemId || !ts) continue;
      const prev = tsById[itemId];
      if (!prev || Date.parse(ts) > Date.parse(prev)) tsById[itemId] = ts;
    }

    return scanned
      .map((it, idx) => {
        const ts = tsById[String(it.id)] ?? "";
        const t = ts ? Date.parse(ts) : Number.NEGATIVE_INFINITY;
        return { it, idx, t };
      })
      .sort((a, b) => (b.t !== a.t ? b.t - a.t : a.idx - b.idx))
      .map((x) => x.it);
  }, [s.events?.events, s.lastScanTsByItemId, scanned]);

  const totalUnitsOrdered = itemsForUi.reduce((sum, it) => sum + (Number(it.ordered_qty) || 0), 0);
  const totalUnitsPicked = itemsForUi.reduce((sum, it) => sum + (Number(it.picked_qty) || 0), 0);
  const overallPct = percent(totalUnitsPicked, totalUnitsOrdered);

  const totalPositions = itemsForUi.length;
  const positionsDone = scannedUi.length;
  const collectedLabel =
    totalPositions === 0 ? "—" : positionsDone >= totalPositions ? `Все ${totalPositions} позиций` : `${positionsDone} из ${totalPositions} позиций`;

  const cachedOrderNumber =
    s.selectedId !== null
      ? s.data?.items?.find((it) => it.id === s.selectedId)?.number ??
      s.pickingTabs?.items?.find((it) => it.id === s.selectedId)?.number ??
      null
      : null;

  const orderNumberValue = s.detail?.order?.number ?? cachedOrderNumber;
  const orderNumber = orderNumberValue ? `#${orderNumberValue}` : `#${s.selectedId}`;
  const totalSum = s.detail?.order?.order_data?.total ?? null;

  const readySum = React.useMemo(() => {
    if (scannedUi.length === 0) return 0;

    let sum = 0;
    let missing = false;

    for (const it of scannedUi) {
      const msId = it.ms_assortment_id ? String(it.ms_assortment_id) : "";
      const unit = msId ? unitPriceByAssortmentId.get(msId) : undefined;
      const qty = Math.max(0, Math.min(Number(it.picked_qty) || 0, Number(it.ordered_qty) || 0));

      if (!qty) continue;
      if (!unit) {
        missing = true;
        continue;
      }
      sum += unit * qty;
    }

    if (missing) return null;
    return sum;
  }, [scannedUi, unitPriceByAssortmentId]);

  const actionsDisabled = props.offline || props.forcedUpdate || s.scanBusy || s.finishBusy;

  const complete = itemsForUi.length > 0 && notScanned.length === 0;

  const handleFinish = () => {
    if (readOnly) return;
    if (!sessionActive) return;
    if (complete) s.setFinishConfirmOpen(true);
    else s.setPartialOpen(true);
  };

  return (
    <div
      onPointerDownCapture={() => (lastPointerDownAtRef.current = Date.now())}
      onPointerUpCapture={() => {
        // After any click/tap, return focus to the scanner input (unless blocked by offline/update/modals).
        focusScanSoon();
      }}
      className="flex h-full min-h-0 flex-col bg-white"
    >
      {props.chromeTabs}

      <div className="flex min-h-0 flex-1 flex-col text-black">
        <div className="flex flex-wrap items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-[22px] font-bold leading-tight">{`Заказ ${orderNumber}`}</div>
              {s.detailError ? <div className="text-xs text-destructive">{s.detailError}</div> : null}
              {props.offline ? (
                <div className="text-xs text-destructive">
                  Оффлайн{props.offlineReason ? `: ${props.offlineReason}` : ""}. Сканирование и завершение сборки заблокированы.
                </div>
              ) : props.forcedUpdate ? (
                <div className="text-xs text-destructive">Требуется обновление. Сканирование и завершение сборки заблокированы.</div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">


            <div className="flex items-center gap-2 text-sm text-black/70">
              <span>{`Прогресс: ${Math.round(overallPct)}%`}</span>
              <ProgressRing value={overallPct} className="h-6 w-6" />
            </div>

            {printUi ? (
              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-3 py-1 text-sm font-semibold",
                  printUi.className,
                )}
                title={printError || undefined}
              >
                <span>{printUi.label}</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-lg  bg-black/5 px-3 py-1">
                <Skeleton className="h-5 w-16" />
              </div>
            )}

            {printStatus === "print_failed" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void s.printRetry?.()}
                disabled={actionsDisabled || s.printRetryBusy}
                className="h-9 gap-2 border-[#EDEDED] bg-white text-black hover:bg-black/5"
              >
                <RotateCw className={cn("h-4 w-4", s.printRetryBusy ? "animate-spin" : "")} aria-hidden="true" />
                Повторить
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-1.5 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <ScanLine className="pointer-events-none absolute left-[12px] top-1/2 h-5 w-5 -translate-y-1/2 text-black/40" aria-hidden="true" />
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
                placeholder="Готово к сканированию"
                disabled={readOnly || props.offline || props.forcedUpdate || s.scanBusy}
                className="h-12 rounded-lg border-[#EDEDED] bg-white pl-10 text-base shadow-none placeholder:text-[#747479] focus-visible:ring-black"
                autoFocus
                onBlur={() => {
                  const sincePointerMs = Date.now() - lastPointerDownAtRef.current;
                  if (sincePointerMs >= 350) focusScanSoon();
                }}
              />
            </div>

            <Button
              type="button"
              onClick={() => void s.pickingScan(s.scanCode)}
              disabled={readOnly || props.offline || props.forcedUpdate || s.scanBusy || !s.scanCode.trim()}
              className={cn(
                "h-12 rounded-lg px-6 text-base",
                !s.scanCode.trim() || readOnly || props.offline || props.forcedUpdate || s.scanBusy
                  ? "bg-black/10 text-black/40 hover:bg-black/10"
                  : "bg-black text-white hover:bg-black/90"
              )}
            >
              Пробить
            </Button>
          </div>
          <div className="text-sm leading-4 text-black/50">Отсканируйте штрихкод товара или введите код товара вручную</div>
          {s.scanError ? <div className="text-sm text-destructive">{s.scanError}</div> : null}
          {s.pendingScan ? (
            <div className="text-xs text-black/50">
              Отправка: <span className="font-mono">{s.pendingScan.code}</span>
            </div>
          ) : null}
          {s.lastScan ? (
            <div className="text-xs text-black/50">
              Последний скан: <span className="font-mono">{s.lastScan.code}</span>
            </div>
          ) : null}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 p-4 gap-6 lg:grid-cols-[1fr_380px]">
          <div className="min-h-0">
            <div className="flex items-center gap-2 py-3 gap-2">
              <div className="text-[18px] font-semibold">К сканированию</div>
              <div className="rounded-full justify-center px-1.5 py-0 bg-[#F8F8F8] text-sm text-[#757575] font-medium">
                {notScanned.length}
              </div>
            </div>

            <div className="min-h-0 h-full">
              {s.detailBusy ? (
                <div className="grid gap-2" ref={toScanListRef}>
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={`to-scan-sk-${idx}`} className="flex items-start gap-4 rounded-2xl border border-[#EDEDED] bg-white p-2">
	                      <Skeleton className="mt-0.5 h-14 w-14 rounded-xl" />
                      <div className="min-w-0 flex-1 space-y-3 py-1">
                        <div className="flex items-start justify-between gap-3">
                          <Skeleton className="h-6 w-56" />
                          <Skeleton className="h-7 w-24 rounded-lg" />
                        </div>
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-5 w-40" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : itemsForUi.length > 0 && notScanned.length === 0 ? (
                <div className="flex min-h-[360px] h-full flex-col items-center justify-center gap-3 text-center text-black/60">
                  <div className="grid h-10 w-10 place-items-center rounded-full">
                    <BoxCheckIcon className="h-6 w-6 text-black/60" />
                  </div>
                  <div className="text-sm font-medium">В сборке не осталось товаров</div>
                </div>
              ) : notScannedUi.length ? (
                <div className="grid gap-2" ref={toScanListRef}>
                  {notScannedUi.map((it) => (
                    <PickItemCard
                      key={it.id}
                      it={it}
                      highlight={s.highlightItemId === it.id}
                      showRemaining={
                        Number(it.ordered_qty) > 1 &&
                        Number(it.picked_qty) >= 1 &&
                        Number(it.picked_qty) < Number(it.ordered_qty)
                      }
                      showDots={true}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[240px] items-center justify-center text-sm text-black/50">
                  {itemsForUi.length === 0 ? "Позиции заказа не найдены." : "Все позиции собраны."}
                </div>
              )}
            </div>
          </div>

          <Card className="flex min-h-0 flex-col rounded-[16px] border border-[#EDEDED] shadow-none">
            <CardHeader className="flex gap-2 py-3 gap-2 p-4 pb-2">
              <CardTitle className="text-[18px] font-semibold">Готово к отправке</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-auto p-0 gap-0">
              <div className="flex w-full flex-col gap-0" ref={readyListRef}>
                {s.detailBusy ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <div key={`ready-sk-${idx}`} className="flex w-full items-start gap-3 border-b border-[#EDEDED] px-4 py-3 bg-white">
                      <Skeleton className="h-11 w-11 rounded-md" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    </div>
                  ))
                ) : itemsForUi.length > 0 && scannedUi.length === 0 ? (
                  <NoScansEmptyState />
                ) : (
                  scannedUi.map((it) => <ReadyItemRow key={it.id} it={it} highlight={s.highlightItemId === it.id} />)
                )}
              </div>
            </CardContent>
            <div className="p-0">
              <div className="grid gap-2 p-3 text-[16px] border-t border-[#EDEDED]">
                <div className="flex items-center justify-between">
                  <div className="text-black/50">Собрано:</div>
                  <div className="font-semibold">{collectedLabel}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-black/50">Сумма товаров:</div>
                  <div className="font-semibold">
                    {readySum === null ? "—" : `${formatSum(readySum)} сум`}
                    {complete && totalSum !== null ? <span className="ml-2 text-xs font-medium text-black/40">{`из ${formatSum(totalSum)} сум`}</span> : null}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-2 p-3 border-t border-[#EDEDED]">
                <Button
                  className="h-11 w-full rounded-xl bg-violet-600 text-white hover:bg-violet-700"
                  onClick={handleFinish}
                  disabled={readOnly || !sessionActive || actionsDisabled || totalPositions === 0}
                >
                  Завершить сборку
                </Button>
              </div>
              {s.finishError ? <div className="mt-2 text-sm text-destructive">{s.finishError}</div> : null}
            </div>
          </Card>
        </div>
      </div>

      <AlertDialog open={s.finishConfirmOpen} onOpenChange={s.setFinishConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Завершить сборку?</AlertDialogTitle>
            <AlertDialogDescription>Все товары отсканированы. Завершить сборку и отметить заказ как собранный?</AlertDialogDescription>
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
            <AlertDialogDescription>Выберите причину, почему заказ собран не полностью.</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mt-3 grid gap-2">
            <Label>Причина</Label>
            <Select value={s.partialReason} onChange={(e) => s.setPartialReason(e.target.value)} disabled={s.finishBusy}>
              <option value="">Выберите причину…</option>
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
    </div >
  );
}
