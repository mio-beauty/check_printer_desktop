import * as React from "react";

import type { OrderDetailResponse, OrdersResponse, WarehouseAuthStatus } from "./types";

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
}) {
  const hasToken = Boolean(opts.auth?.hasToken);

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

  React.useEffect(() => {
    if (!opts.active) return;
    setPhone(opts.auth?.phone || "");
  }, [opts.active, opts.auth?.phone]);

  React.useEffect(() => {
    hasDataRef.current = data !== null;
  }, [data]);

  const refresh = React.useCallback(
    async (mode: "initial" | "manual" | "background" = "manual") => {
      if (!opts.active) return;
      if (!hasToken) return;
      if (mode === "background") setRefreshing(true);
      else setLoading(true);
      if (mode !== "background") setError(null);
      try {
        const json = (await window.checkPrinter?.warehouseOrders?.({
          status: statusFilter || null,
          q: qDebounced || null,
          limit,
          offset,
        })) as OrdersResponse;
        setData(json);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [hasToken, limit, offset, opts.active, qDebounced, statusFilter],
  );

  const openDetail = React.useCallback(
    async (id: number) => {
      setSelectedId(id);
      setDetail(null);
      setDetailError(null);
      if (!hasToken) return;
      setDetailBusy(true);
      try {
        const json = (await window.checkPrinter?.warehouseOrderDetail?.(id)) as OrderDetailResponse;
        setDetail(json);
      } catch (e) {
        setDetailError(String(e));
      } finally {
        setDetailBusy(false);
      }
    },
    [hasToken],
  );

  const pickingStart = React.useCallback(
    async (id: number) => {
      if (opts.forcedUpdate) return;
      setDetailError(null);
      try {
        await window.checkPrinter?.warehousePickingStart?.(id);
        await openDetail(id);
        await refresh("background");
      } catch (e) {
        setDetailError(String(e));
      }
    },
    [openDetail, opts.forcedUpdate, refresh],
  );

  React.useEffect(() => {
    if (!opts.active) return;
    setOffset(0);
  }, [opts.active, statusFilter, qDebounced]);

  React.useEffect(() => {
    if (!opts.active) return;
    void refresh(hasDataRef.current ? "manual" : "initial");
  }, [opts.active, hasToken, statusFilter, qDebounced, offset, refresh]);

  React.useEffect(() => {
    if (!opts.active) return;
    if (!hasToken) return;
    const off = window.checkPrinter?.onWarehouseHint?.((e) => {
      if (!e?.reason) return;
      if (selectedId !== null) return;
      if (!opts.online) return;
      void refresh("background");
    });
    return () => {
      off?.();
    };
  }, [hasToken, opts.active, opts.online, refresh, selectedId]);

  React.useEffect(() => {
    if (!opts.active) return;
    if (!hasToken) return;
    if (!opts.online) return;
    const t = setInterval(() => void refresh("background"), 30_000);
    return () => clearInterval(t);
  }, [opts.active, hasToken, opts.online, refresh]);

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
      setLoginError(String(e));
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
    try {
      await window.checkPrinter?.warehouseLogout?.();
    } catch (e) {
      setLoginError(String(e));
    }
  };

  return {
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
    openDetail,
    pickingStart,
  };
}

