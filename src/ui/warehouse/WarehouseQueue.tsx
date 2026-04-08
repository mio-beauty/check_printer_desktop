import * as React from "react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

import { WarehousePickingTabs } from "./components/WarehousePickingTabs";
import { WarehouseOrdersPage } from "./pages/WarehouseOrdersPage";
import { WarehousePickingPage } from "./pages/WarehousePickingPage";
import { playErrorSound, resolveEffectiveErrorSound, usePreparedErrorSound, useWarehouseErrorSounds } from "../useErrorSounds";
import { useWarehouseQueue } from "./useWarehouseQueue";

import type { WarehouseAuthStatus } from "./types";
import type { Settings } from "../types";

export function WarehouseQueue(props: {
  active: boolean;
  online: boolean;
  offlineReason?: string | null;
  forcedUpdate: boolean;
  auth: WarehouseAuthStatus | null;
  settings: Settings | null;
}) {
  const errorSounds = useWarehouseErrorSounds(props.active && props.online && !props.forcedUpdate && Boolean(props.auth?.hasToken));
  const effectiveErrorSound = React.useMemo(
    () => resolveEffectiveErrorSound(errorSounds.data, props.settings?.printer?.errorSoundId ?? null),
    [errorSounds.data, props.settings?.printer?.errorSoundId],
  );
  usePreparedErrorSound(effectiveErrorSound, props.active && props.online && !props.forcedUpdate && Boolean(props.auth?.hasToken));
  const playWrongScanSound = React.useCallback(() => {
    void playErrorSound(effectiveErrorSound);
  }, [effectiveErrorSound]);

  const s = useWarehouseQueue({
    active: props.active,
    online: props.online,
    forcedUpdate: props.forcedUpdate,
    auth: props.auth,
    onWrongScanError: playWrongScanSound,
  });
  const offline = !props.online;
  const actionsDisabled = offline || props.forcedUpdate || s.loading;

  const activePickingOrders = s.pickingTabs?.items || [];
  const tabValue = s.selectedId === null ? "queue" : String(s.selectedId);
  const partialReasons: Array<{ code: string; label: string }> = s.reasons?.length
    ? s.reasons
    : [
      { code: "OUT_OF_STOCK", label: "Нет в наличии" },
      { code: "DAMAGED", label: "Повреждено" },
      { code: "NOT_FOUND", label: "Не найдено" },
      { code: "SUBSTITUTED", label: "Замена" },
      { code: "OTHER", label: "Другое" },
    ];

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
          <div className="flex flex-wrap gap-2 sm:col-span-2">
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

  const chromeTabs = (
    <WarehousePickingTabs
      tabValue={tabValue}
      activePickingOrders={activePickingOrders}
      onSelectQueue={() => s.setSelectedId(null)}
      onSelectOrder={(id) => void s.openDetail(id)}
    />
  );

  if (s.selectedId !== null) {
    return (
      <WarehousePickingPage
        s={s}
        chromeTabs={chromeTabs}
        offline={offline}
        offlineReason={props.offlineReason}
        forcedUpdate={props.forcedUpdate}
        partialReasons={partialReasons}
      />
    );
  }

  return (
    <WarehouseOrdersPage
      s={s}
      chromeTabs={chromeTabs}
      offline={offline}
      offlineReason={props.offlineReason}
      forcedUpdate={props.forcedUpdate}
      authPhone={props.auth?.phone ?? null}
      actionsDisabled={actionsDisabled}
      partialReasons={partialReasons}
    />
  );
}
