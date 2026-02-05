import React from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useWarehouseQueue } from "./useWarehouseQueue";

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

export function WarehouseQueue(props: { active: boolean; online: boolean; forcedUpdate: boolean; auth: WarehouseAuthStatus | null }) {
  const s = useWarehouseQueue(props);
  const offline = !props.online;
  const actionsDisabled = offline || props.forcedUpdate || s.loading;

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

  if (s.selectedId !== null) {
    const sessionActive = Boolean(s.detail?.picking?.is_active);
    const canStart = !offline && !props.forcedUpdate && !sessionActive;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" onClick={() => s.setSelectedId(null)}>
            ← Назад к очереди
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant={offline ? "destructive" : "default"}>{offline ? "Оффлайн" : "Онлайн"}</Badge>
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

                {!sessionActive && (
                  <Button onClick={() => void s.pickingStart(s.selectedId!)} disabled={!canStart}>
                    Начать сборку
                  </Button>
                )}

                {s.detail.picking?.items?.length ? (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      Позиции: {s.detail.picking.items.length} • Прогресс:{" "}
                      {Math.round(s.detail.picking.progress?.picked ?? 0)}/{Math.round(s.detail.picking.progress?.ordered ?? 0)}
                    </div>
                    <div className="grid gap-2">
                      {s.detail.picking.items.map((it) => (
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
          <CardTitle>Очередь склада</CardTitle>
          <CardDescription>Список заказов для сборки. Поиск и фильтры.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Input value={s.q} onChange={(e) => s.setQ(e.target.value)} placeholder="Поиск: номер / order_id / телефон" />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant={s.statusFilter === "" ? "default" : "outline"} onClick={() => s.setStatusFilter("")}>
                Все
              </Button>
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
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant={s.statusFilter === "PICKED" ? "default" : "outline"} onClick={() => s.setStatusFilter("PICKED")}>
              Собран
            </Button>
            <Button
              variant={s.statusFilter === "PARTIALLY_PICKED" ? "default" : "outline"}
              onClick={() => s.setStatusFilter("PARTIALLY_PICKED")}
            >
              Частично
            </Button>
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
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {it.client_name ? it.client_name : "—"} • {it.client_phone ? it.client_phone : "—"} • позиций:{" "}
                      {it.items_count ?? "—"} • сумма: {formatSum(it.total)} сум
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={() => void s.openDetail(it.id)} disabled={ctaDisabled}>
                      Открыть
                    </Button>
                    <Button
                      onClick={() => (primaryCta === "Начать" ? void s.pickingStart(it.id) : void s.openDetail(it.id))}
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

