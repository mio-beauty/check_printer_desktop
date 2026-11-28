import * as React from "react";
import { Loader2, Pencil, Plus, RefreshCw, Search, UserRoundCheck, UserRoundX } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import { CourierForm } from "../couriers/CourierForm";
import { useCouriers } from "../couriers/useCouriers";
import { courierErrorMessage } from "../couriers/validation";
import type { CourierUser } from "../couriers/types";

type StatusFilter = "all" | "active" | "inactive";

function formatCreatedAt(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
}

function CourierListSkeleton() {
  return (
    <div className="grid gap-3 p-4" aria-label="Загрузка списка курьеров">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="grid grid-cols-2 gap-4 rounded-lg border p-4 md:grid-cols-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}

export function CouriersPage() {
  const api = useCouriers();
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [formMode, setFormMode] = React.useState<"create" | "edit">("create");
  const [editingCourier, setEditingCourier] = React.useState<CourierUser | null>(null);
  const [confirmCourier, setConfirmCourier] = React.useState<CourierUser | null>(null);
  const [feedback, setFeedback] = React.useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const filteredCouriers = React.useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ru");
    return api.couriers.filter((courier) => {
      if (statusFilter === "active" && !courier.is_active) return false;
      if (statusFilter === "inactive" && courier.is_active) return false;
      if (!normalizedQuery) return true;
      return [courier.display_name, courier.phone, courier.email]
        .some((value) => String(value ?? "").toLocaleLowerCase("ru").includes(normalizedQuery));
    });
  }, [api.couriers, query, statusFilter]);

  const openCreate = () => {
    setFeedback(null);
    setFormMode("create");
    setEditingCourier(null);
    setFormOpen(true);
  };

  const openEdit = (courier: CourierUser) => {
    setFeedback(null);
    setActionError(null);
    setFormMode("edit");
    setEditingCourier(courier);
    setFormOpen(true);
  };

  const reactivate = async (courier: CourierUser) => {
    setActionError(null);
    const result = await api.update(courier.id, { is_active: true });
    if (!result.ok) {
      setActionError(courierErrorMessage(result.error));
      return;
    }
    setFeedback({ kind: "success", message: "Аккаунт курьера активирован." });
  };

  const deactivate = async (courier: CourierUser) => {
    setActionError(null);
    const result = await api.deactivate(courier.id);
    if (!result.ok) {
      setActionError(courierErrorMessage(result.error));
      return false;
    }
    setFeedback({ kind: "success", message: "Аккаунт курьера деактивирован." });
    return true;
  };

  const resultCountLabel = filteredCouriers.length === 1 ? "аккаунт" : filteredCouriers.length >= 2 && filteredCouriers.length <= 4 ? "аккаунта" : "аккаунтов";

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Курьеры</h1>
          <p className="text-sm text-muted-foreground">Управление аккаунтами курьеров</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void api.refresh()} disabled={api.loading || api.refreshing} aria-label="Обновить список курьеров">
            <RefreshCw className={api.refreshing ? "size-4 animate-spin" : "size-4"} /> Обновить
          </Button>
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Добавить курьера
          </Button>
        </div>
      </header>

      {feedback ? (
        <div className={feedback.kind === "success" ? "rounded-md border border-green-600/20 bg-green-600/5 px-3 py-2 text-sm text-green-700" : "rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"} role="status">
          {feedback.message}
        </div>
      ) : null}
      {actionError ? <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">{actionError}</div> : null}
      {api.error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          <span>{courierErrorMessage(api.error)}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void api.refresh()} disabled={api.refreshing}>
            <RefreshCw className={api.refreshing ? "size-4 animate-spin" : "size-4"} /> Повторить
          </Button>
        </div>
      ) : null}

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-1">
            <CardTitle>Список курьеров</CardTitle>
            <CardDescription>Аккаунты мобильного приложения Courier Mobile App.</CardDescription>
          </div>
          <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-[minmax(220px,320px)_180px]">
            <div className="grid gap-1.5">
              <Label htmlFor="courier-search" className="sr-only">Поиск курьеров</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="courier-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя, телефон или email" className="pl-9" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="courier-status-filter" className="sr-only">Фильтр по статусу</Label>
              <Select id="courier-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Все статусы</option>
                <option value="active">Активные</option>
                <option value="inactive">Неактивные</option>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1">
          {api.loading ? (
            <CourierListSkeleton />
          ) : api.error && api.couriers.length === 0 ? null : api.couriers.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">Пока нет аккаунтов курьеров.</p>
              <Button variant="outline" onClick={openCreate}><Plus className="size-4" /> Добавить курьера</Button>
            </div>
          ) : filteredCouriers.length === 0 ? (
            <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground">По заданным условиям курьеры не найдены.</div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Курьер</th>
                    <th scope="col" className="px-4 py-3 font-medium">Телефон</th>
                    <th scope="col" className="px-4 py-3 font-medium">Email</th>
                    <th scope="col" className="px-4 py-3 font-medium">Статус</th>
                    <th scope="col" className="px-4 py-3 font-medium">Дата создания</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredCouriers.map((courier) => {
                    const busy = api.mutationId === courier.id;
                    return (
                      <tr key={courier.id} className="hover:bg-muted/20">
                        <td className="max-w-[260px] px-4 py-3 font-medium">{courier.display_name || "—"}</td>
                        <td className="px-4 py-3 tabular-nums">{courier.phone || "—"}</td>
                        <td className="max-w-[260px] truncate px-4 py-3">{courier.email || "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={courier.is_active ? "secondary" : "outline"} className={courier.is_active ? "border-green-600/20 bg-green-600/10 text-green-700" : "text-muted-foreground"}>
                            {courier.is_active ? "Активен" : "Неактивен"}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatCreatedAt(courier.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button type="button" size="sm" variant="outline" onClick={() => openEdit(courier)} disabled={busy} aria-label={`Редактировать: ${courier.display_name || courier.phone || courier.id}`}>
                              <Pencil className="size-4" />
                              <span className="sr-only">Редактировать</span>
                            </Button>
                            {courier.is_active ? (
                              <Button type="button" size="sm" variant="outline" onClick={() => setConfirmCourier(courier)} disabled={busy} aria-label={`Деактивировать: ${courier.display_name || courier.phone || courier.id}`}>
                                <UserRoundX className="size-4" /> <span className="sr-only">Деактивировать</span>
                              </Button>
                            ) : (
                              <Button type="button" size="sm" variant="outline" onClick={() => void reactivate(courier)} disabled={busy} aria-label={`Активировать: ${courier.display_name || courier.phone || courier.id}`}>
                                {busy ? <Loader2 className="size-4 animate-spin" /> : <UserRoundCheck className="size-4" />}
                                <span className="sr-only">Активировать</span>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!api.loading && api.couriers.length > 0 ? (
            <div className="flex items-center justify-between gap-3 pt-3 text-xs text-muted-foreground">
              <span>{filteredCouriers.length} {resultCountLabel}</span>
              {api.refreshing ? <span className="inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> Обновление…</span> : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <CourierForm
        open={formOpen}
        mode={formMode}
        courier={editingCourier}
        options={api.options}
        optionsLoading={api.optionsLoading}
        optionsError={api.optionsError}
        onOpenChange={setFormOpen}
        onLoadOptions={api.loadOptions}
        onCreate={api.create}
        onUpdate={api.update}
        onSuccess={(message) => setFeedback({ kind: "success", message })}
      />

      <AlertDialog open={Boolean(confirmCourier)} onOpenChange={(open) => (!open ? setConfirmCourier(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Деактивировать аккаунт?</AlertDialogTitle>
            <AlertDialogDescription>Курьер больше не сможет войти в мобильное приложение.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={api.mutationId !== null}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              closeOnClick
              disabled={api.mutationId !== null}
              onClick={(event) => {
                event.preventDefault();
                if (confirmCourier) void deactivate(confirmCourier).then((success) => success && setConfirmCourier(null));
              }}
            >
              {api.mutationId !== null ? <Loader2 className="size-4 animate-spin" /> : null}
              Деактивировать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
