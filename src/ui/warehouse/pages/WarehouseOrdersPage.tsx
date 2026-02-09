import * as React from "react";

import { CheckCircle2, Clock, Package, Phone, Search, TriangleAlert, User } from "lucide-react";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";

import { formatSum, percent } from "../ui";
import type { OrderItem } from "../types";
import type { WarehouseQueueState } from "../useWarehouseQueue";
import { cn } from "../../../lib/utils";
import { BoxCheckIcon, ProfileFilledIcon } from "@/components/icons";


function StatusFilterChip(props: {
  active: boolean;
  label: string;
  srLabel?: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props.srLabel ?? props.label}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
        props.active ? "bg-violet-100 text-violet-700" : "text-[#747479] hover:bg-black/5 hover:text-black",
        props.disabled && "opacity-60",
      )}
    >
      <span>{props.icon}</span>
      <span>{props.label}</span>
    </button>
  );
}

function safeToUpper(s: string | null | undefined): string {
  return String(s || "").toUpperCase();
}

function formatRuDateTime(input: string | null | undefined): string | null {
  const iso = String(input || "").trim();
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);

  const day = parts.find((p) => p.type === "day")?.value;
  const monthRaw = parts.find((p) => p.type === "month")?.value;
  const hour = parts.find((p) => p.type === "hour")?.value;
  const minute = parts.find((p) => p.type === "minute")?.value;

  if (!day || !monthRaw || !hour || !minute) return null;
  const month = monthRaw.replace(/\.$/, "");
  return `${day} ${month}, ${hour}:${minute}`;
}

function ProgressCircle(props: { value: number; label: string }) {
  const r = 16;
  const cx = 18;
  const cy = 18;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number(props.value) || 0));
  const dashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative grid h-12 w-12 place-items-center rounded-full bg-transparent">
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
  reasonLabel: string | null;
  forcedUpdate: boolean;
  actionsDisabled: boolean;
  onOpen: () => void;
  onPrimary?: () => void;
  primaryLabel?: string | null;
}) {
  const pct = percent(props.it.progress?.picked ?? 0, props.it.progress?.ordered ?? 0);
  const statusUp = safeToUpper(props.it.picking_status);
  const createdAtRaw =
    (props.it as any).created_at ??
    (props.it as any).createdAt ??
    (props.it as any).created ??
    (props.it as any).order_created_at ??
    (props.it as any).orderCreatedAt ??
    props.it.started_at ??
    null;
  const createdAt = formatRuDateTime(createdAtRaw);
  const finishedAt = formatRuDateTime(props.it.finished_at ?? null);
  const showFinishedMeta = statusUp === "PICKED" && Boolean(finishedAt);
  const finisherLabel =
    (props.it.finished_by_display && String(props.it.finished_by_display).trim()) ||
    (props.it.finished_by_user_id != null ? `User #${props.it.finished_by_user_id}` : null);

  return (
    <div
      role="button"
      tabIndex={props.forcedUpdate ? -1 : 0}
      onClick={() => {
        if (props.forcedUpdate) return;
        props.onOpen();
      }}
      onKeyDown={(e) => {
        if (props.forcedUpdate) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onOpen();
        }
      }}
      className={cn(
        "group cursor-pointer rounded-2xl border bg-white p-0 transition-shadow hover:bg-[#F8F8F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        props.forcedUpdate && "cursor-not-allowed opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-[#EDEDED]">
        <div className="min-w-0 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-lg font-semibold">{props.it.number ? `#${props.it.number}` : `#${props.it.id}`}</div>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Заказ создан: {createdAt ?? "—"}</div>

        </div>



        <div className="flex items-center gap-2 p-3">
          <ProgressCircle value={pct} label={`${Math.round(pct)}%`} />
        </div>

      </div>

      <div className=" grid text-[14px] py-2">

        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2 text-[14px] text-black">
            <ProfileFilledIcon className="h-5 w-5 text-[#757575]" />
            <span className="truncate">{props.it.client_name || "—"}</span>
          </div>
          <div className="flex items-center gap-2 text-[14px] text-[#757575]">
            <span className="font-mono">{props.it.client_phone || "—"}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <div className="flex items-center gap-2 text-[14px] text-black">
            <BoxCheckIcon className="h-5 w-5 text-[#757575]" />
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
      {showFinishedMeta ? (
        <div className="text-[13px] text-[#757575] px-3 py-[10px] border-t border-[#EDEDED]">
          <div>Заказ собран: {finishedAt}</div>
          <div>Собирал: {finisherLabel ?? "—"}</div>
        </div>
      ) : null}

      {props.mode === "problems" && props.it.partial_reason_comment ? (
        <div className="mt-3 line-clamp-2 text-xs text-muted-foreground">Комментарий: {String(props.it.partial_reason_comment)}</div>
      ) : null}


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

  const visibleItems = React.useMemo(() => {
    const items = Array.isArray(s.data?.items) ? s.data!.items : [];

    // Safety net: never show PICKED orders outside the dedicated completed filter.
    const filtered =
      s.mode === "queue" && safeToUpper(s.statusFilter) !== "PICKED"
        ? items.filter((it) => safeToUpper(it.picking_status) !== "PICKED")
        : items;

    const score = (it: OrderItem) => percent(Number(it.progress?.picked ?? 0), Number(it.progress?.ordered ?? 0));

    return [...filtered].sort((a, b) => {
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      return (b.id ?? 0) - (a.id ?? 0);
    });
  }, [s.data?.items, s.mode, s.statusFilter]);

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
          <div className="flex flex-col gap-4 sm:flex-row justify-between sm:items-center">
            <div className="relative w-full min-w-[275px] max-w-[350px]">
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

            <div className="flex flex-wrap items-center gap-2 min-w-[451px] sm:ml-auto">
              {s.mode === "queue" ? (
                <>
                  <StatusFilterChip
                    active={s.statusFilter === "TO_PICK"}
                    label="К сборке"
                    srLabel="Фильтр 1"
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    onClick={() => s.setStatusFilter("TO_PICK")}
                    disabled={s.loading}
                  />
                  <StatusFilterChip
                    active={s.statusFilter === "PICKING"}
                    label="Собирается"
                    srLabel="Фильтр 2"
                    icon={<Clock className="h-4 w-4" />}
                    onClick={() => s.setStatusFilter("PICKING")}
                    disabled={s.loading}
                  />
                  <StatusFilterChip
                    active={s.statusFilter === "PICKED"}
                    label="Собрано"
                    srLabel="Фильтр 3"
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
                    srLabel="Фильтр A"
                    icon={<Clock className="h-5 w-5" />}
                    onClick={() => s.setStatusFilter("PARTIALLY_PICKED")}
                    disabled={s.loading}
                  />
                  <StatusFilterChip
                    active={s.statusFilter === "PICK_FAILED"}
                    label="Ошибка"
                    srLabel="Фильтр B"
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
            {!s.loading && visibleItems.length === 0 && <div className="text-sm text-muted-foreground">Пусто.</div>}

            {visibleItems.map((it) => {
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
