import React from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

type WarehouseAuthStatus = { phone: string | null; hasToken: boolean };

type OrderItem = {
  id: number;
  number: string;
  order_id: string | null;
  total: number | null;
  client_name: string | null;
  client_phone: string | null;
  items_count: number | null;
  printed: 0 | 1;
  picking_status: "TO_PICK" | "PICKING" | "PICKED" | "PARTIALLY_PICKED" | "PICK_FAILED" | string;
  active_session_id: string | null;
  progress: { picked: number; ordered: number };
};

type OrdersResponse = { items: OrderItem[]; meta?: { limit?: number; offset?: number } };

type OrderDetailResponse = {
  order: { id: number; number: string; order_id: string | null; order_data: any; printed: 0 | 1 };
  picking: null | {
    id: string;
    status: string;
    is_active: boolean;
    progress?: { picked: number; ordered: number };
    items?: Array<{
      id: string;
      name: string;
      sku: string | null;
      ms_assortment_id: string | null;
      barcodes: string[];
      ordered_qty: number;
      picked_qty: number;
    }>;
  };
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

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

export function WarehouseQueue(props: {
  active: boolean;
  online: boolean;
  forcedUpdate: boolean;
  auth: WarehouseAuthStatus | null;
}) {
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loginBusy, setLoginBusy] = React.useState(false);
  const [loginError, setLoginError] = React.useState<string | null>(null);

  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [q, setQ] = React.useState("");
  const qDebounced = useDebouncedValue(q, 350);
  const [limit] = React.useState(20);
  const [offset, setOffset] = React.useState(0);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<OrdersResponse | null>(null);

  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [detailBusy, setDetailBusy] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<OrderDetailResponse | null>(null);

  const hasToken = Boolean(props.auth?.hasToken);

  React.useEffect(() => {
    if (!props.active) return;
    setPhone(props.auth?.phone || "");
  }, [props.active, props.auth?.phone]);

  const refresh = React.useCallback(async () => {
    if (!props.active) return;
    if (!hasToken) return;
    setBusy(true);
    setError(null);
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
      setBusy(false);
    }
  }, [hasToken, limit, offset, props.active, qDebounced, statusFilter]);

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
      if (props.forcedUpdate) return;
      setDetailError(null);
      try {
        await window.checkPrinter?.warehousePickingStart?.(id);
        await openDetail(id);
        await refresh();
      } catch (e) {
        setDetailError(String(e));
      }
    },
    [openDetail, props.forcedUpdate, refresh],
  );

  React.useEffect(() => {
    if (!props.active) return;
    setOffset(0);
  }, [props.active, statusFilter, qDebounced]);

  React.useEffect(() => {
    if (!props.active) return;
    void refresh();
  }, [props.active, hasToken, statusFilter, qDebounced, offset, refresh]);

  React.useEffect(() => {
    if (!props.active) return;
    if (!hasToken) return;
    if (!props.online) return;
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, [props.active, hasToken, props.online, refresh]);

  const onLogin = async () => {
    setLoginError(null);
    setLoginBusy(true);
    try {
      await window.checkPrinter?.warehouseLogin?.(phone, password);
      setPassword("");
      await refresh();
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

  const offline = !props.online;
  const actionsDisabled = offline || props.forcedUpdate || busy;

  if (!props.active) return null;

  if (!hasToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Склад: вход</CardTitle>
          <CardDescription>Нужен доступ “picker” (JWT). Токен сохраняется локально на этом ПК.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Телефон</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998901234567" />
          </div>
          <div className="grid gap-2">
            <Label>Пароль</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" type="password" />
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button onClick={onLogin} disabled={loginBusy || !phone || !password || props.forcedUpdate}>
              Войти
            </Button>
            {props.forcedUpdate && (
              <Badge variant="destructive">Требуется обновление — вход/действия заблокированы</Badge>
            )}
            {loginError && <Badge variant="destructive">{loginError}</Badge>}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (selectedId !== null) {
    const canStart = !offline && !props.forcedUpdate && Boolean(detail?.picking?.is_active !== true);
    const sessionActive = Boolean(detail?.picking?.is_active);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" onClick={() => setSelectedId(null)}>
            ← Назад к очереди
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant={offline ? "destructive" : "default"}>{offline ? "Оффлайн" : "Онлайн"}</Badge>
            <Button variant="outline" onClick={onLogout}>
              Выйти
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Заказ #{selectedId}</CardTitle>
            <CardDescription>Экран сборки (MVP): детали + позиции.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {detailBusy && <div className="text-sm text-muted-foreground">Загрузка…</div>}
            {detailError && <Badge variant="destructive">{detailError}</Badge>}
            {!detailBusy && detail && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{detail.order.number}</Badge>
                  <Badge variant="secondary">Сумма: {formatSum(detail.order.order_data?.total ?? null)} сум</Badge>
                  <Badge variant={detail.order.printed ? "default" : "secondary"}>
                    {detail.order.printed ? "Печатался" : "Не печатался"}
                  </Badge>
                  {detail.picking && (
                    <Badge variant={statusBadgeVariant(detail.picking.status)}>{statusLabel(detail.picking.status)}</Badge>
                  )}
                </div>

                {!sessionActive && (
                  <Button onClick={() => void pickingStart(selectedId)} disabled={!canStart}>
                    Начать сборку
                  </Button>
                )}

                {detail.picking?.items?.length ? (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      Позиции: {detail.picking.items.length} • Прогресс:{" "}
                      {Math.round(detail.picking.progress?.picked ?? 0)}/{Math.round(detail.picking.progress?.ordered ?? 0)}
                    </div>
                    <div className="grid gap-2">
                      {detail.picking.items.map((it) => (
                        <div key={it.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{it.name}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {it.sku ? `SKU: ${it.sku}` : "SKU: —"} • штрихкодов: {it.barcodes?.length ?? 0}
                            </div>
                          </div>
                          <Badge variant="secondary">
                            {Math.round(it.picked_qty)}/{Math.round(it.ordered_qty)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Позиции пока не созданы. Нажми “Начать сборку”.</div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={offline ? "destructive" : "default"}>{offline ? "Оффлайн" : "Онлайн"}</Badge>
          {props.forcedUpdate && <Badge variant="destructive">Требуется обновление — действия заблокированы</Badge>}
          <Badge variant="secondary">{props.auth?.phone || "—"}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={refresh} disabled={!hasToken || busy}>
            Обновить
          </Button>
          <Button variant="outline" onClick={onLogout}>
            Выйти
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Очередь склада</CardTitle>
          <CardDescription>Список заказов для сборки. Поиск и фильтры.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск: номер / order_id / телефон" />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant={statusFilter === "" ? "default" : "outline"} onClick={() => setStatusFilter("")}>
                Все
              </Button>
              <Button
                variant={statusFilter === "TO_PICK" ? "default" : "outline"}
                onClick={() => setStatusFilter("TO_PICK")}
              >
                К сборке
              </Button>
              <Button
                variant={statusFilter === "PICKING" ? "default" : "outline"}
                onClick={() => setStatusFilter("PICKING")}
              >
                В сборке
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={statusFilter === "PICKED" ? "default" : "outline"}
              onClick={() => setStatusFilter("PICKED")}
            >
              Собран
            </Button>
            <Button
              variant={statusFilter === "PARTIALLY_PICKED" ? "default" : "outline"}
              onClick={() => setStatusFilter("PARTIALLY_PICKED")}
            >
              Частично
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0 || busy}>
                ←
              </Button>
              <Button variant="outline" onClick={() => setOffset(offset + limit)} disabled={busy || (data?.items?.length ?? 0) < limit}>
                →
              </Button>
            </div>
          </div>

          {error && <Badge variant="destructive">{error}</Badge>}

          <div className="space-y-2">
            {busy && <div className="text-sm text-muted-foreground">Загрузка…</div>}
            {!busy && (data?.items?.length ?? 0) === 0 && <div className="text-sm text-muted-foreground">Пусто.</div>}

            {(data?.items || []).map((it) => {
              const label = statusLabel(it.picking_status);
              const canClick = !props.forcedUpdate;
              const primaryCta = it.active_session_id || it.picking_status === "PICKING" ? "Продолжить" : "Начать";
              const ctaDisabled = actionsDisabled || !canClick;

              return (
                <div key={it.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="truncate text-left font-semibold underline-offset-4 hover:underline"
                        onClick={() => void openDetail(it.id)}
                        disabled={!canClick}
                      >
                        {it.number || `#${it.id}`}
                      </button>
                      <Badge variant={statusBadgeVariant(it.picking_status)}>{label}</Badge>
                      <Badge variant="secondary">
                        {Math.round(it.progress?.picked ?? 0)}/{Math.round(it.progress?.ordered ?? 0)}
                      </Badge>
                      {it.printed ? <Badge variant="default">Печатался</Badge> : <Badge variant="secondary">Не печатался</Badge>}
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {it.client_name ? it.client_name : "—"} • {it.client_phone ? it.client_phone : "—"} • позиций:{" "}
                      {it.items_count ?? "—"} • сумма: {formatSum(it.total)} сум
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={() => void openDetail(it.id)} disabled={ctaDisabled}>
                      Открыть
                    </Button>
                    <Button
                      onClick={() => (primaryCta === "Начать" ? void pickingStart(it.id) : void openDetail(it.id))}
                      disabled={ctaDisabled}
                    >
                      {primaryCta}
                    </Button>
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

