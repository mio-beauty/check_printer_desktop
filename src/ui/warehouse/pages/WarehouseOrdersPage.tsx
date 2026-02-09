import * as React from "react";

import { CheckCircle2, Clock, Package, Phone, Printer, Search, TriangleAlert, User } from "lucide-react";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";

import { formatSum, percent, statusBadgeVariant, statusLabel } from "../ui";
import type { OrderItem } from "../types";
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

function ProgressCircle(props: { value: number; label: string }) {
  const r = 16;
  const cx = 18;
  const cy = 18;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number(props.value) || 0));
  const dashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative grid h-12 w-12 place-items-center rounded-full border bg-white">
      <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <circle cx={18} cy={18} r={r} className="fill-none stroke-muted" strokeWidth="3.5" />
        <circle
          cx={18}
          cy={18}
          r={r}
          className="fill-none stroke-emerald-500"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashoffset}
          transform="rotate(-90 18 18)"
        />
      </svg>
      <div className="text-xs font-semibold text-black">{props.label}</div>
    </div>
  );
}

function OrderCard(props: {
  it: OrderItem;
  mode: WarehouseQueueState["mode"];
  statusLabel: string;
  statusVariant: ReturnType<typeof statusBadgeVariant>;
  reasonLabel: string | null;
  forcedUpdate: boolean;
  actionsDisabled: boolean;
  onOpen: () => void;
  onPrimary?: () => void;
  primaryLabel?: string | null;
}) {
  const pct = percent(props.it.progress?.picked ?? 0, props.it.progress?.ordered ?? 0);
  const printed = Boolean(props.it.printed);

  return (
    <div className="group rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          className="min-w-0 text-left"
          onClick={props.onOpen}
          disabled={props.forcedUpdate}
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-lg font-semibold">{props.it.number ? `#${props.it.number}` : `#${props.it.id}`}</div>
            <Badge variant={props.statusVariant} className="rounded-full px-2.5 py-0.5">
              {props.statusLabel}
            </Badge>
            {printed ? (
              <Badge className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-emerald-700 hover:bg-emerald-50">Напечатано</Badge>
            ) : (
              <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                Не печаталось
              </Badge>
            )}
            {props.mode === "problems" && props.reasonLabel ? (
              <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                Причина: {props.reasonLabel}
              </Badge>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {props.it.order_id ? <span className="font-mono">ID: {props.it.order_id}</span> : null}
            {props.it.order_id ? <span className="mx-2">•</span> : null}
            Прогресс: {Math.round(props.it.progress?.picked ?? 0)}/{Math.round(props.it.progress?.ordered ?? 0)}
          </div>
        </button>

        <div className="flex items-center gap-2">
          <ProgressCircle value={pct} label={`${Math.round(pct)}%`} />
          <div
            className={cn(
              "grid h-12 w-12 place-items-center rounded-full border",
              printed ? "border-emerald-100 bg-emerald-500 text-white" : "bg-white text-muted-foreground",
            )}
            title={printed ? "Напечатано" : "Не печаталось"}
          >
            <Printer className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span className="truncate">{props.it.client_name || "—"}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span className="font-mono">{props.it.client_phone || "—"}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>Товаров в заказе</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full justify-center px-1.5 py-0 bg-[#757575] text-white font-medium">
              {props.it.items_count ?? "—"}
            </Badge>
            <div className="font-medium pl-2 border-l border-[#e5e5e5] text-[14px]">{formatSum(props.it.total)} сум</div>
          </div>
        </div>
      </div>

      {props.mode === "problems" && props.it.partial_reason_comment ? (
        <div className="mt-3 line-clamp-2 text-xs text-muted-foreground">Комментарий: {String(props.it.partial_reason_comment)}</div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={props.onOpen} disabled={props.actionsDisabled}>
          Открыть
        </Button>
        {props.primaryLabel && props.onPrimary ? (
          <Button onClick={props.onPrimary} disabled={props.actionsDisabled}>
            {props.primaryLabel}
          </Button>
        ) : null}
      </div>
    </div>
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

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                <OrderCard
                  key={it.id}
                  it={it}
                  mode={s.mode}
                  statusLabel={label}
                  statusVariant={statusBadgeVariant(it.picking_status)}
                  reasonLabel={reasonLabel}
                  forcedUpdate={props.forcedUpdate}
                  actionsDisabled={ctaDisabled}
                  onOpen={() => void s.openDetail(it.id)}
                  onPrimary={s.mode === "queue" ? () => (primaryCta === "Начать" ? void s.pickingStart(it.id) : void s.openDetail(it.id)) : undefined}
                  primaryLabel={s.mode === "queue" ? primaryCta : null}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
