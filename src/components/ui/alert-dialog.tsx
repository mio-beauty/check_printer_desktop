import * as React from "react";

import { cn } from "../../lib/utils";
import { Button } from "./button";

type AlertDialogContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const AlertDialogContext = React.createContext<AlertDialogContextValue | null>(null);

function useAlertDialog() {
  const ctx = React.useContext(AlertDialogContext);
  if (!ctx) throw new Error("AlertDialog components must be used within <AlertDialog />");
  return ctx;
}

export function AlertDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  const ctx = React.useMemo(() => ({ open: props.open, setOpen: props.onOpenChange }), [props.open, props.onOpenChange]);
  return <AlertDialogContext.Provider value={ctx}>{props.children}</AlertDialogContext.Provider>;
}

export function AlertDialogTrigger(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useAlertDialog();
  return (
    <button
      type="button"
      {...props}
      onClick={(e) => {
        props.onClick?.(e);
        if (!e.defaultPrevented) setOpen(true);
      }}
    />
  );
}

export function AlertDialogContent(props: React.HTMLAttributes<HTMLDivElement>) {
  const { open, setOpen } = useAlertDialog();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div className="fixed left-1/2 top-1/2 w-[min(520px,calc(100%-24px))] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-4 shadow-lg">
        <div {...props} />
      </div>
    </div>
  );
}

export function AlertDialogHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("space-y-1.5", props.className)} />;
}

export function AlertDialogTitle(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 {...props} className={cn("text-base font-semibold", props.className)} />;
}

export function AlertDialogDescription(props: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} className={cn("text-sm text-muted-foreground", props.className)} />;
}

export function AlertDialogFooter(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("mt-4 flex justify-end gap-2", props.className)} />;
}

export function AlertDialogCancel(props: React.ComponentProps<typeof Button>) {
  const { setOpen } = useAlertDialog();
  return (
    <Button
      {...props}
      variant={props.variant ?? "outline"}
      onClick={(e) => {
        props.onClick?.(e);
        if (!e.defaultPrevented) setOpen(false);
      }}
    />
  );
}

export function AlertDialogAction(props: React.ComponentProps<typeof Button> & { closeOnClick?: boolean }) {
  const { setOpen } = useAlertDialog();
  const closeOnClick = props.closeOnClick ?? false;
  return (
    <Button
      {...props}
      onClick={(e) => {
        props.onClick?.(e);
        if (!e.defaultPrevented && closeOnClick) setOpen(false);
      }}
    />
  );
}

