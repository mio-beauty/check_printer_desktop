import * as React from "react";

import type { OrderDetailResponse, OrderEventsResponse, OrdersResponse, WarehouseAuthStatus, WarehouseReason } from "./types";
import { isWrongScanErrorMessage } from "../useErrorSounds";
import { formatWarehouseError, normalizeWarehouseScanErrorText } from "./errors";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

export function useWarehouseQueue(opts: {
  active: boolean;
  online: boolean;
  forcedUpdate: boolean;
  auth: WarehouseAuthStatus | null;
  onWrongScanError?: () => void;
}) {
  const hasToken = Boolean(opts.auth?.hasToken);
  const hintRefreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailSoftRefreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mode, setMode] = React.useState<"queue" | "problems">("queue");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loginBusy, setLoginBusy] = React.useState(false);
  const [loginError, setLoginError] = React.useState<string | null>(null);

  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [q, setQ] = React.useState("");
  const qDebounced = useDebouncedValue(q, 350);
  const [limit] = React.useState(20);
  const [offset, setOffset] = React.useState(0);

  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<OrdersResponse | null>(null);
  const hasDataRef = React.useRef(false);

  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [detailBusy, setDetailBusy] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<OrderDetailResponse | null>(null);
  const [eventsBusy, setEventsBusy] = React.useState(false);
  const [eventsError, setEventsError] = React.useState<string | null>(null);
  const [events, setEvents] = React.useState<OrderEventsResponse | null>(null);
  const [scanCode, setScanCode] = React.useState("");
  const [scanBusy, setScanBusy] = React.useState(false);
  const [scanError, setScanError] = React.useState<string | null>(null);
  const [pendingScan, setPendingScan] = React.useState<{ code: string; ts: string } | null>(null);
  const [lastScan, setLastScan] = React.useState<{ code: string; itemId: string; ts: string } | null>(null);
  const [lastScanTsByItemId, setLastScanTsByItemId] = React.useState<Record<string, string>>({});
  const [highlightItemId, setHighlightItemId] = React.useState<string | null>(null);
  const startOnScanRef = React.useRef<Promise<void> | null>(null);

  const [reasons, setReasons] = React.useState<WarehouseReason[]>([]);
  const [reasonsError, setReasonsError] = React.useState<string | null>(null);

  const [pickingTabs, setPickingTabs] = React.useState<OrdersResponse | null>(null);
  const [pickingTabsRefreshing, setPickingTabsRefreshing] = React.useState(false);

  const [finishConfirmOpen, setFinishConfirmOpen] = React.useState(false);
  const finishConfirmShownRef = React.useRef<string | null>(null);
  const [finishBusy, setFinishBusy] = React.useState(false);
  const [finishError, setFinishError] = React.useState<string | null>(null);
  const [printRetryBusy, setPrintRetryBusy] = React.useState(false);
  const [printRetryError, setPrintRetryError] = React.useState<string | null>(null);
  const [partialOpen, setPartialOpen] = React.useState(false);
  const [partialReason, setPartialReason] = React.useState<string>("");
  const [partialComment, setPartialComment] = React.useState<string>("");

  React.useEffect(() => {
    if (!opts.active) return;
    setPhone(opts.auth?.phone || "");
  }, [opts.active, opts.auth?.phone]);

  React.useEffect(() => {
    if (!opts.active) return;
    if (!hasToken) return;
    if (!opts.online) return;
    const api = window.checkPrinter;
    const warehouseReasons = api?.warehouseReasons;
    if (!warehouseReasons) return;

    (async () => {
      try {
        setReasonsError(null);
        const json = (await warehouseReasons()) as { reasons?: WarehouseReason[] };
        const list = Array.isArray(json?.reasons) ? json.reasons : [];
        setReasons(list.filter((r) => r && typeof r.code === "string" && typeof r.label === "string"));
      } catch (e) {
        setReasonsError(formatWarehouseError(e));
      }
    })();
  }, [hasToken, opts.active, opts.online]);

  React.useEffect(() => {
    hasDataRef.current = data !== null;
  }, [data]);

  const refresh = React.useCallback(
    async (refreshMode: "initial" | "manual" | "background" = "manual") => {
      if (!opts.active) return;
      if (!hasToken) return;
      if (refreshMode === "background") setRefreshing(true);
      else setLoading(true);
      if (refreshMode !== "background") setError(null);
      try {
        const json = (await window.checkPrinter?.warehouseOrders?.({
          status: statusFilter || null,
          q: qDebounced || null,
          limit,
          offset,
          problemsOnly: mode === "problems",
        })) as OrdersResponse;
        setData(json);
      } catch (e) {
        setError(formatWarehouseError(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [hasToken, limit, mode, offset, opts.active, qDebounced, statusFilter],
  );

  const refreshPickingTabs = React.useCallback(async () => {
    if (!opts.active) return;
    if (!hasToken) return;
    if (!opts.online) return;
    if (!window.checkPrinter?.warehouseOrders) return;

    setPickingTabsRefreshing(true);
    try {
      const json = (await window.checkPrinter.warehouseOrders({
        status: "PICKING",
        q: null,
        limit: 50,
        offset: 0,
      })) as OrdersResponse;
      setPickingTabs(json);
    } catch {
      // ignore
    } finally {
      setPickingTabsRefreshing(false);
    }
  }, [hasToken, opts.active, opts.online, selectedId]);

  const openDetail = React.useCallback(
    async (id: number) => {
      setSelectedId(id);
      setDetail(null);
      setDetailError(null);
      setScanError(null);
      setFinishError(null);
      setEvents(null);
      setEventsError(null);
      setLastScan(null);
      setLastScanTsByItemId({});
      if (!hasToken) return;
      setDetailBusy(true);
      try {
        const json = (await window.checkPrinter?.warehouseOrderDetail?.(id)) as OrderDetailResponse;
        setDetail(json);
      } catch (e) {
        setDetailError(formatWarehouseError(e));
      } finally {
        setDetailBusy(false);
      }

      // Events are read-only; fetch in background.
      if (!window.checkPrinter?.warehouseOrderEvents) return;
      setEventsBusy(true);
      try {
        const ev = (await window.checkPrinter.warehouseOrderEvents(id)) as OrderEventsResponse;
        setEvents(ev);
      } catch (e) {
        setEventsError(formatWarehouseError(e));
      } finally {
        setEventsBusy(false);
      }
    },
    [hasToken],
  );

  const softRefreshDetail = React.useCallback(
    async (id: number) => {
      if (!hasToken) return;
      if (selectedId !== id) return;
      const api = window.checkPrinter;
      if (!api?.warehouseOrderDetail) return;

      const stripQuery = (u: unknown) => {
        const s = String(u ?? "");
        const idx = s.indexOf("?");
        return idx >= 0 ? s.slice(0, idx) : s;
      };

      try {
        const json = (await api.warehouseOrderDetail(id)) as OrderDetailResponse;
        if (selectedId !== id) return;
        setDetail((prev) => {
          if (!prev) return json;

          if (!json?.picking) return { ...prev, ...json };

          const shouldKeepPresignedUrl = (prevUrl: unknown, nextUrl: unknown) => {
            const prevBase = stripQuery(prevUrl);
            const nextBase = stripQuery(nextUrl);
            return Boolean(prevBase && nextBase && prevBase === nextBase);
          };

          const prevItems = prev.picking?.pick_items ?? prev.picking?.items ?? null;
          const nextItems = json.picking?.pick_items ?? json.picking?.items ?? null;
          if (!Array.isArray(prevItems) || !Array.isArray(nextItems)) return json;

          const prevById = new Map(prevItems.map((it) => [String(it?.id ?? ""), it] as const));
          const mergedItems = nextItems.map((nextIt) => {
            const prevIt = prevById.get(String(nextIt?.id ?? ""));
            if (!prevIt) return nextIt;

            const prevUrl = (prevIt as any).main_image_mini_url;
            const nextUrl = (nextIt as any).main_image_mini_url;
            const keepUrl = shouldKeepPresignedUrl(prevUrl, nextUrl);
            const finalUrl = keepUrl ? prevUrl : nextUrl;

            const same =
              (prevIt as any).picked_qty === (nextIt as any).picked_qty &&
              (prevIt as any).ordered_qty === (nextIt as any).ordered_qty &&
              (prevIt as any).name === (nextIt as any).name &&
              (prevIt as any).sku === (nextIt as any).sku &&
              (prevIt as any).ms_assortment_id === (nextIt as any).ms_assortment_id &&
              stripQuery((prevIt as any).main_image_mini_url) === stripQuery(finalUrl);

            if (same && (prevIt as any).main_image_mini_url === finalUrl) return prevIt;

            return {
              ...prevIt,
              ...nextIt,
              ...(finalUrl ? { main_image_mini_url: finalUrl } : { main_image_mini_url: null }),
            };
          });

          const pickItemsUnchanged =
            mergedItems.length === prevItems.length && mergedItems.every((it, idx) => it === prevItems[idx]);

          const nextPicking = {
            ...(prev.picking as any),
            ...(json.picking as any),
            pick_items: pickItemsUnchanged ? prevItems : mergedItems,
          };

          const nextOrder =
            prev.order &&
            json.order &&
            prev.order.id === json.order.id &&
            prev.order.number === json.order.number &&
            prev.order.order_id === json.order.order_id &&
            prev.order.printed === json.order.printed &&
            prev.order.print_status === json.order.print_status &&
            prev.order.print_error === json.order.print_error
              ? prev.order
              : json.order;

          const prevPicking = prev.picking as any;
          const jsonPicking = json.picking as any;
          const progressSame =
            Number(prevPicking?.progress?.picked ?? 0) === Number(jsonPicking?.progress?.picked ?? 0) &&
            Number(prevPicking?.progress?.ordered ?? 0) === Number(jsonPicking?.progress?.ordered ?? 0);
          const pickingScalarsSame =
            prevPicking?.id === jsonPicking?.id &&
            prevPicking?.status === jsonPicking?.status &&
            Boolean(prevPicking?.is_active) === Boolean(jsonPicking?.is_active) &&
            String(prevPicking?.started_at ?? "") === String(jsonPicking?.started_at ?? "") &&
            String(prevPicking?.finished_at ?? "") === String(jsonPicking?.finished_at ?? "") &&
            String(prevPicking?.partial_reason_code ?? "") === String(jsonPicking?.partial_reason_code ?? "") &&
            String(prevPicking?.partial_reason_comment ?? "") === String(jsonPicking?.partial_reason_comment ?? "") &&
            progressSame;

          // If nothing actually changed, keep structural sharing to avoid UI flicker.
          if (nextOrder === prev.order && pickItemsUnchanged && pickingScalarsSame) return prev;

          return { ...prev, ...json, order: nextOrder, picking: nextPicking };
        });
      } catch {
        // ignore: keep current UI state, optimistic updates are applied during scanning
      }
    },
    [hasToken, selectedId],
  );

  const pickingStart = React.useCallback(
    async (id: number) => {
      if (opts.forcedUpdate) return;
      setDetailError(null);
      setFinishError(null);
      try {
        await window.checkPrinter?.warehousePickingStart?.(id);
        await openDetail(id);
        await refresh("background");
      } catch (e) {
        setDetailError(formatWarehouseError(e));
      }
    },
    [openDetail, opts.forcedUpdate, refresh],
  );

  const ensurePickingStarted = React.useCallback(
    async (queueId: number) => {
      if (opts.forcedUpdate) return;
      if (!queueId) return;
      if (detail?.picking?.is_active) return;

      if (startOnScanRef.current) {
        await startOnScanRef.current;
        return;
      }

      startOnScanRef.current = (async () => {
        if (!window.checkPrinter?.warehousePickingStart) {
          throw new Error("warehousePickingStart недоступен (нужна пересборка desktop/preload)");
        }
        await window.checkPrinter.warehousePickingStart(queueId);
        await openDetail(queueId);
        await refresh("background");
      })()
        .catch((e) => {
          setDetailError(formatWarehouseError(e));
          throw e;
        })
        .finally(() => {
          startOnScanRef.current = null;
        });

      await startOnScanRef.current;
    },
    [detail?.picking?.is_active, openDetail, opts.forcedUpdate, refresh],
  );

  const pickingFinish = React.useCallback(
    async (payload: { reason_code?: string | null; comment?: string | null } = {}) => {
      const queueId = selectedId;
      if (!queueId) return;
      if (opts.forcedUpdate) return;
      setFinishError(null);
      setFinishBusy(true);
      try {
        if (!window.checkPrinter?.warehousePickingFinish) {
          throw new Error("warehousePickingFinish недоступен (нужна пересборка desktop/preload)");
        }
        await window.checkPrinter.warehousePickingFinish(queueId, payload.reason_code ?? null, payload.comment ?? null);
        await refresh("background");
        await refreshPickingTabs();
        // После завершения возвращаемся в очередь.
        setSelectedId(null);
        setDetail(null);
      } catch (e) {
        setFinishError(formatWarehouseError(e));
      } finally {
        setFinishBusy(false);
      }
    },
    [opts.forcedUpdate, refresh, refreshPickingTabs, selectedId],
  );

  const printRetry = React.useCallback(
    async (queueId?: number) => {
      const id = Number(queueId ?? selectedId);
      if (!id) return;
      if (opts.forcedUpdate) return;
      if (!opts.online) return;

      setPrintRetryError(null);
      setPrintRetryBusy(true);
      try {
        if (!window.checkPrinter?.warehousePrintRetry) {
          throw new Error("warehousePrintRetry недоступен (нужна пересборка desktop/preload)");
        }
        await window.checkPrinter.warehousePrintRetry(id);
        await openDetail(id);
        await refresh("background");
      } catch (e) {
        const message = formatWarehouseError(e);
        setPrintRetryError(message);
        setDetailError(message);
      } finally {
        setPrintRetryBusy(false);
      }
    },
    [openDetail, opts.forcedUpdate, opts.online, refresh, selectedId],
  );

  const pickingScan = React.useCallback(
    async (code: string) => {
      const queueId = selectedId;
      const clean = String(code || "").trim();
      if (!queueId) return;
      if (!clean) return;
      if (opts.forcedUpdate) return;

      // Best practice for scanner workflow: first scan auto-starts picking.
      await ensurePickingStarted(queueId);

      setScanError(null);
      setScanBusy(true);
      setPendingScan({ code: clean, ts: new Date().toISOString() });
      // Clear input immediately: scanner workflows should be ready for the next scan.
      setScanCode("");
      try {
        if (!window.checkPrinter?.warehousePickingScan) throw new Error("warehousePickingScan недоступен (нужна пересборка desktop/preload)");
        const res = await window.checkPrinter.warehousePickingScan(queueId, clean);
        const itemId = String(res?.item?.id || "");
        const pickedQty = Number(res?.item?.picked_qty);
        if (itemId && Number.isFinite(pickedQty)) {
          setDetail((prev) => {
            if (!prev?.picking) return prev;

            const currentItems = prev.picking.pick_items ?? prev.picking.items;
            if (!currentItems) return prev;

            const nextItems = currentItems.map((it) => (String(it.id) === itemId ? { ...it, picked_qty: pickedQty } : it));
            const progressPicked = nextItems.reduce((sum, it) => sum + (Number(it.picked_qty) || 0), 0);
            const progressOrdered = nextItems.reduce((sum, it) => sum + (Number(it.ordered_qty) || 0), 0);
            return {
              ...prev,
              picking: {
                ...prev.picking,
                pick_items: nextItems,
                progress: { picked: progressPicked, ordered: progressOrdered },
              },
            };
          });
          const nowIso = new Date().toISOString();
          setLastScan({ code: clean, itemId, ts: nowIso });
          setLastScanTsByItemId((prev) => ({ ...prev, [itemId]: nowIso }));
          setHighlightItemId(itemId);
          setTimeout(() => setHighlightItemId((cur) => (cur === itemId ? null : cur)), 1500);
        }
        // Подтянуть истинное состояние (на случай конкуренции/пересканов) — но без блокировок UI.
        if (detailSoftRefreshTimerRef.current) clearTimeout(detailSoftRefreshTimerRef.current);
        detailSoftRefreshTimerRef.current = setTimeout(() => {
          void softRefreshDetail(queueId);
        }, 30000);
      } catch (e) {
        if (isWrongScanErrorMessage(e)) opts.onWrongScanError?.();
        setScanError(`Код ${JSON.stringify(clean)}: ${String(e)}`);
      } finally {
        setScanBusy(false);
        setPendingScan(null);
      }
    },
    [ensurePickingStarted, opts.forcedUpdate, opts.onWrongScanError, selectedId, softRefreshDetail],
  );

  React.useEffect(() => {
    return () => {
      if (detailSoftRefreshTimerRef.current) {
        clearTimeout(detailSoftRefreshTimerRef.current);
        detailSoftRefreshTimerRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    // Авто-завершение (с подтверждением): когда всё собрано, показываем confirm один раз на сессию.
    if (!detail?.picking?.is_active) return;
    const sessionId = String(detail.picking.id || "");
    const items = detail.picking.pick_items || detail.picking.items || [];
    if (!sessionId || items.length === 0) return;

    const complete = items.every((it) => (it.picked_qty ?? 0) >= (it.ordered_qty ?? 0));
    if (!complete) return;

    if (finishConfirmShownRef.current === sessionId) return;
    finishConfirmShownRef.current = sessionId;
    setFinishConfirmOpen(true);
  }, [detail?.picking?.id, detail?.picking?.is_active, detail?.picking?.pick_items, detail?.picking?.items]);

  React.useEffect(() => {
    if (!opts.active) return;
    setOffset(0);
  }, [opts.active, mode, statusFilter, qDebounced]);

  React.useEffect(() => {
    if (!opts.active) return;
    void refresh(hasDataRef.current ? "manual" : "initial");
  }, [opts.active, hasToken, statusFilter, qDebounced, offset, refresh]);

  React.useEffect(() => {
    if (!opts.active) return;
    if (!hasToken) return;
    if (!opts.online) return;
    void refreshPickingTabs();
  }, [hasToken, opts.active, opts.online, refreshPickingTabs]);

  React.useEffect(() => {
    if (!opts.active) return;
    if (!hasToken) return;
    if (!opts.online) return;
    if (opts.forcedUpdate) return;

    const off =
      window.checkPrinter?.onWarehouseHint?.((e) => {
        const reason = String(e?.reason || "");
        if (!reason) return;
        // `auth_expired` is handled globally in `src/ui/App.tsx`.
        if (reason === "auth_expired") return;

        // Debounced "invalidate + refresh": safest way to keep paging/search consistent.
        if (hintRefreshTimerRef.current) clearTimeout(hintRefreshTimerRef.current);
        hintRefreshTimerRef.current = setTimeout(() => {
          void refresh("background");
          // Keep the top picking tabs in sync too (they are independent from the current filter).
          void refreshPickingTabs();
        }, 250);
      }) ??
      (() => {});

    return () => {
      off();
      if (hintRefreshTimerRef.current) {
        clearTimeout(hintRefreshTimerRef.current);
        hintRefreshTimerRef.current = null;
      }
    };
  }, [hasToken, opts.active, opts.forcedUpdate, opts.online, refresh, refreshPickingTabs]);

  const onLogin = async () => {
    setLoginError(null);
    setLoginBusy(true);
    try {
      if (!window.checkPrinter) throw new Error("preload API недоступен (window.checkPrinter отсутствует)");
      if (!window.checkPrinter.warehouseLogin) throw new Error("warehouseLogin недоступен (нужна пересборка desktop/preload)");
      await window.checkPrinter.warehouseLogin(phone.trim().replace(/\s+/g, ""), password);
      setPassword("");
      await refresh("initial");
    } catch (e) {
      setLoginError(formatWarehouseError(e));
    } finally {
      setLoginBusy(false);
    }
  };

  const onLogout = async () => {
    setLoginError(null);
    setError(null);
    setData(null);
    setSelectedId(null);
    setDetail(null);
    setLastScan(null);
    setLastScanTsByItemId({});
    try {
      await window.checkPrinter?.warehouseLogout?.();
    } catch (e) {
      setLoginError(formatWarehouseError(e));
    }
  };

  return {
    mode,
    setMode,
    hasToken,
    phone,
    setPhone,
    password,
    setPassword,
    loginBusy,
    loginError,
    onLogin,
    onLogout,

    statusFilter,
    setStatusFilter,
    q,
    setQ,
    limit,
    offset,
    setOffset,

    loading,
    refreshing,
    error,
    data,
    refresh,

    selectedId,
    setSelectedId,
    detailBusy,
    detailError,
    detail,
    eventsBusy,
    eventsError,
    events,
    openDetail,
    pickingStart,
    scanCode,
    setScanCode,
    scanBusy,
    scanError: normalizeWarehouseScanErrorText(scanError),
    pendingScan,
    lastScan,
    lastScanTsByItemId,
    highlightItemId,
    pickingScan,
    reasons,
    reasonsError,
    pickingTabs,
    pickingTabsRefreshing,
    refreshPickingTabs,
    finishConfirmOpen,
    setFinishConfirmOpen,
    finishBusy,
    finishError,
    pickingFinish,
    printRetryBusy,
    printRetryError,
    printRetry,
    partialOpen,
    setPartialOpen,
    partialReason,
    setPartialReason,
    partialComment,
    setPartialComment,
  };
}

export type WarehouseQueueState = ReturnType<typeof useWarehouseQueue>;
