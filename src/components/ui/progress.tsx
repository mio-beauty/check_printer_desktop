import * as React from "react";
import { cn } from "../../lib/utils";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  value?: number; // 0..100
};

export function Progress({ className, value = 0, ...props }: Props) {
  const v = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      role="progressbar"
    >
      <div className="h-full w-full flex-1 bg-primary transition-transform" style={{ transform: `translateX(-${100 - v}%)` }} />
    </div>
  );
}

