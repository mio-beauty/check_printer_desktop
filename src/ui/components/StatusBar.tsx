import React from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { AppStatus, joinErrorLabel, printerBlockedReason, printerReachabilityLabel, warehouseOfflineReason } from "../status/derive";

export function StatusBar(props: {
  status: AppStatus | null;
  forcedUpdate: boolean;
  onStartUpdate?: () => void;
}) {
  const backendChecked = Boolean(props.status?.backend?.checkedAt);
  const backendOk = Boolean(props.status?.backend?.httpOk);
  const socketOk = Boolean(props.status?.connected);
  const joinOk = Boolean(props.status?.joined);
  const joinLabel = joinOk ? "ok" : joinErrorLabel(props.status?.joinError ?? null);

  const printerHost = props.status?.printer?.host ?? null;
  const printerReach = props.status?.printer?.reachability;
  const printerLabel = printerReachabilityLabel(printerReach, printerHost);
  const printerOk = Boolean(printerHost && printerReach?.configured && printerReach.ok);

  const update = props.status?.update;
  const updateForced = Boolean(props.forcedUpdate);
  const updateDownloading = Boolean(update?.downloading);
  const updateAvailable = Boolean(update?.available);
  const updateProgress = update?.progress ?? null;

  const criticalReason =
    warehouseOfflineReason(props.status, props.forcedUpdate) ||
    printerBlockedReason(props.status, props.forcedUpdate) ||
    (!socketOk ? "нет соединения Socket.IO" : null) ||
    (!joinOk ? `не выполнен join: ${joinLabel}` : null);

  return (
    <div className="border-b bg-background">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 text-sm text-muted-foreground">
            Backend: <span className="font-mono">{props.status?.backendUrl ?? "—"}</span>
            {props.status?.appVersion ? (
              <>
                {" "}
                • v<span className="font-mono">{props.status.appVersion}</span>
              </>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={!backendChecked ? "outline" : backendOk ? "default" : "destructive"}>
              backend: {!backendChecked ? "—" : backendOk ? "ok" : "нет"}
            </Badge>
            <Badge variant={socketOk ? "default" : "destructive"}>socket: {socketOk ? "ok" : "нет"}</Badge>
            <Badge variant={joinOk ? "secondary" : "destructive"}>join: {joinOk ? "ok" : joinLabel}</Badge>
            <Badge variant={printerOk ? "secondary" : "destructive"}>printer: {printerOk ? "ok" : printerLabel}</Badge>
            <Badge
              variant={updateForced ? "destructive" : updateAvailable || updateDownloading ? "default" : "outline"}
              className={cn(updateDownloading && "animate-pulse")}
            >
              update:{" "}
              {updateForced
                ? "forced"
                : updateDownloading
                  ? `${Math.round(updateProgress ?? 0)}%`
                  : updateAvailable
                    ? "available"
                    : "ok"}
            </Badge>
            {props.onStartUpdate && updateAvailable && !updateDownloading && !updateForced ? (
              <Button size="sm" variant="outline" onClick={props.onStartUpdate}>
                Обновить
              </Button>
            ) : null}
          </div>
        </div>

        {criticalReason ? <div className="text-xs text-muted-foreground">Причина: {criticalReason}</div> : null}
      </div>
    </div>
  );
}
