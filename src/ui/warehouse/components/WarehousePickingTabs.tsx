import * as React from "react";

import { Badge } from "../../../components/ui/badge";
import { Card, CardContent } from "../../../components/ui/card";
import { Progress } from "../../../components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs";

import { percent, statusBadgeVariant, statusLabel } from "../ui";

export function WarehousePickingTabs(props: {
  tabValue: string;
  activePickingOrders: Array<{
    id: number;
    number?: string | null;
    picking_status?: string | null;
    progress?: { picked?: number | null; ordered?: number | null } | null;
  }>;
  onSelectQueue: () => void;
  onSelectOrder: (id: number) => void;
}) {
  const renderPickingTab = (o: (typeof props.activePickingOrders)[number]) => {
    const picked = Number(o.progress?.picked ?? 0);
    const ordered = Number(o.progress?.ordered ?? 0);
    const pct = percent(picked, ordered);
    return (
      <TabsTrigger key={o.id} value={String(o.id)} className="min-w-[220px] bg-color-red-600">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{o.number || `#${o.id}`}</span>
            <Badge variant={statusBadgeVariant(String(o.picking_status || ""))}>{statusLabel(String(o.picking_status || ""))}</Badge>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {Math.round(picked)}/{Math.round(ordered)}
            </span>
            <div className="min-w-[120px] flex-1">
              <Progress value={pct} />
            </div>
            <span className="text-xs text-muted-foreground">{Math.round(pct)}%</span>
          </div>
        </div>
      </TabsTrigger>
    );
  };

  return (
    <Card>
      <CardContent className="border-none p-0 shadow-none bg-color-red-600">
        <Tabs
          value={props.tabValue}
          onValueChange={(v) => {
            if (v === "queue") {
              props.onSelectQueue();
              return;
            }
            props.onSelectOrder(Number(v));
          }}
        >
          <TabsList className="rounded-b-none border-b-0">{props.activePickingOrders.map(renderPickingTab)}</TabsList>
        </Tabs>
      </CardContent>
    </Card>
  );
}
