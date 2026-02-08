import * as React from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs";

import { percent, statusBadgeVariant, statusLabel } from "../ui";

function ProgressRing(props: { value: number; className?: string }) {
  const r = 6;
  const cx = 8;
  const cy = 8;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number(props.value) || 0));
  const dashoffset = circumference - (pct / 100) * circumference;

  return (
    <svg viewBox="0 0 16 16" className={props.className} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} className="fill-none stroke-black/10" strokeWidth="3" />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        className="fill-none stroke-emerald-400"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashoffset}
        transform="rotate(-90 8 8)"
      />
    </svg>
  );
}

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
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  const scrollBy = React.useCallback((dx: number) => {
    scrollRef.current?.scrollBy({ left: dx, behavior: "smooth" });
  }, []);

  const renderPickingTab = (o: (typeof props.activePickingOrders)[number]) => {
    const picked = Number(o.progress?.picked ?? 0);
    const ordered = Number(o.progress?.ordered ?? 0);
    const pct = percent(picked, ordered);
    const label = statusLabel(String(o.picking_status || ""));
    const variant = statusBadgeVariant(String(o.picking_status || ""));
    return (
      <TabsTrigger
        key={o.id}
        value={String(o.id)}
        className="gap-3 rounded-lg border-0 bg-transparent px-2 py-2 text-black hover:bg-black/5 data-[state=active]:bg-black/5 data-[state=active]:text-black first:ml-1"
      >
        <ProgressRing value={pct} className="h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-bold">{o.number ? `#${o.number}` : `#${o.id}`}</span>
            <span className="text-black/50">
              {Math.round(picked)}/{Math.round(ordered)}
            </span>
          </div>
        </div>
      </TabsTrigger>
    );
  };

  return (
    <div className="w-full overflow-hidden border-b border-[#EDEDED] bg-white text-black">
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
        <div className="flex py-1 items-center">
          <div className="flex items-center gap-1 px-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-[#0B0B0B] hover:bg-secondary/80"
              onClick={() => scrollBy(-260)}
              aria-label="Прокрутить влево"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-[#0B0B0B] hover:bg-secondary/80"
              onClick={() => scrollBy(260)}
              aria-label="Прокрутить вправо"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="h-8 w-px bg-[#EDEDED]" />

          <div ref={scrollRef} className="flex flex-1 items-center overflow-x-auto text-black">
            <TabsList className="h-10 w-max min-w-full gap-[2px] rounded-none bg-transparent p-0">
              {props.activePickingOrders.map(renderPickingTab)}
            </TabsList>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
