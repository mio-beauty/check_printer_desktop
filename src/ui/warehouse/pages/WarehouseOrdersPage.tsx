import * as React from "react";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";

import { formatSum, statusBadgeVariant, statusLabel } from "../ui";
import type { WarehouseQueueState } from "../useWarehouseQueue";

export function WarehouseOrdersPage(props: {
  s: WarehouseQueueState;
  chromeTabs: React.ReactNode;
  offline: boolean;
  offlineReason?: string | null;
  forcedUpdate: boolean;
  authPhone?: string | null;
  actionsDisabled: boolean;
  partialReasons: Array<{ code: string; label: string }>;
}) {
  const s = props.s;
  return (
    <div className="space-y-4">
      {props.chromeTabs}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={props.offline ? "destructive" : "default"}>{props.offline ? "Оффлайн" : "Онлайн"}</Badge>
          {props.offline && props.offlineReason ? (
            <span className="text-xs text-muted-foreground">Причина: {props.offlineReason}</span>
          ) : null}
          {props.forcedUpdate && <Badge variant="destructive">Требуется обновление — действия заблокированы</Badge>}
          <Badge variant="secondary">{props.authPhone || "—"}</Badge>
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
              const ctaDisabled = props.actionsDisabled;
              const reasonLabel = it.partial_reason_code
                ? props.partialReasons.find((r) => r.code === it.partial_reason_code)?.label || it.partial_reason_code
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
