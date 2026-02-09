import * as React from "react";

import { CheckCircle2, Clock, Search, TriangleAlert } from "lucide-react";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";

import { formatSum, statusBadgeVariant, statusLabel } from "../ui";
import type { WarehouseQueueState } from "../useWarehouseQueue";
import { cn } from "../../../lib/utils";

function StatusFilterChip(props: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ",
        props.active ? "bg-violet-100 text-violet-700" : "text-[#747479] hover:bg-black/5 hover:text-black",
        props.disabled && "",
      )}
    >
      <span>{props.icon}</span>
      {props.label}
    </button>
  );
}

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

  const headerTitle = s.mode === "problems" ? "Проблемы" : "Очередь заказов";
  const searchPlaceholder =
    s.mode === "problems" ? "Поиск по номеру, ID, телефону, коду" : "Поиск по номеру, ID, телефону";

  return (
    <div className="space-y-4">
      {props.chromeTabs}

      <div className="overflow-hidden ">
        <div className="bg-white px-4 py-4 text-black">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-[24px] font-semibold tracking-tight">{headerTitle}</h1>
          </div>
        </div>

        <div className="h-px bg-black/10" />

        <div className="bg-white px-4 py-4 text-black">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative w-full max-w-[560px]">
              <Search
                className="pointer-events-none absolute left-2 top-1/2 h-[20px] w-[20px] -translate-y-1/2 text-[#747479]"
                color="#747479"
              />
              <Input
                value={s.q}
                onChange={(e) => s.setQ(e.target.value)}
                placeholder={searchPlaceholder}
                className="rounded-lg bg-white pl-9 text-black placeholder:text-[#747479]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              {s.mode === "queue" ? (
                <>
                  <StatusFilterChip
                    active={s.statusFilter === "TO_PICK"}
                    label="К сборке"
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    onClick={() => s.setStatusFilter("TO_PICK")}
                    disabled={s.loading}
                  />
                  <StatusFilterChip
                    active={s.statusFilter === "PICKING"}
                    label="Собирается"
                    icon={<Clock className="h-4 w-4" />}
                    onClick={() => s.setStatusFilter("PICKING")}
                    disabled={s.loading}
                  />
                  <StatusFilterChip
                    active={s.statusFilter === "PICKED"}
                    label="Собрано"
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    onClick={() => s.setStatusFilter("PICKED")}
                    disabled={s.loading}
                  />
                </>
              ) : (
                <>
                  <StatusFilterChip
                    active={s.statusFilter === "PARTIALLY_PICKED"}
                    label="Частично"
                    icon={<Clock className="h-5 w-5" />}
                    onClick={() => s.setStatusFilter("PARTIALLY_PICKED")}
                    disabled={s.loading}
                  />
                  <StatusFilterChip
                    active={s.statusFilter === "PICK_FAILED"}
                    label="Ошибка"
                    icon={<TriangleAlert className="h-5 w-5" />}
                    onClick={() => s.setStatusFilter("PICK_FAILED")}
                    disabled={s.loading}
                  />
                </>
              )}

              <button
                type="button"
                onClick={() => s.setStatusFilter("")}
                disabled={s.loading || s.statusFilter === ""}
                className={cn(
                  "ml-2 rounded-xl px-4 py-2 text-sm font-semibold text-[#C4C4CC] transition-colors hover:bg-white/10 hover:text-black",
                  (s.loading || s.statusFilter === "") && "text-[#C4C4CC] hover:bg-transparent hover:text-[#C4C4CC]",
                )}
              >
                Сбросить
              </button>
            </div>
          </div>
        </div>
      </div>


      <Card>
        <CardHeader>
          <CardTitle>{s.mode === "problems" ? "Проблемные заказы" : "Список"}</CardTitle>
          <CardDescription>
            {s.mode === "problems"
              ? "PARTIALLY_PICKED и PICK_FAILED. Можно открыть заказ и посмотреть причину и аудит."
              : "Заказы для сборки. Клик по заказу открывает экран сборки."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
