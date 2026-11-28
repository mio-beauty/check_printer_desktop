import * as React from "react";

import { cn } from "../../lib/utils";
import { Button } from "./button";

type AlertDialogContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
  titleId: string;
  descriptionId: string;
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
  const id = React.useId();
  const onOpenChangeRef = React.useRef(props.onOpenChange);
  onOpenChangeRef.current = props.onOpenChange;
  const setOpen = React.useCallback((open: boolean) => onOpenChangeRef.current(open), []);
  const ctx = React.useMemo(
    () => ({ open: props.open, setOpen, titleId: `${id}-title`, descriptionId: `${id}-description` }),
    [id, props.open, setOpen],
  );
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
  const { open, setOpen, titleId, descriptionId } = useAlertDialog();
  const dialogRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusDialog = () => {
      const first = dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
      (first ?? dialogRef.current)?.focus();
    };
    const frame = window.requestAnimationFrame(focusDialog);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [open, setOpen]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div
        {...props}
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={cn("fixed left-1/2 top-1/2 w-[min(520px,calc(100%-24px))] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-4 shadow-lg", props.className)}
      >
        {props.children}
      </div>
    </div>
  );
}

export function AlertDialogHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("space-y-1.5", props.className)} />;
}

export function AlertDialogTitle(props: React.HTMLAttributes<HTMLHeadingElement>) {
  const { titleId } = useAlertDialog();
  return <h2 {...props} id={props.id ?? titleId} className={cn("text-base font-semibold", props.className)} />;
}

export function AlertDialogDescription(props: React.HTMLAttributes<HTMLParagraphElement>) {
  const { descriptionId } = useAlertDialog();
  return <p {...props} id={props.id ?? descriptionId} className={cn("text-sm text-muted-foreground", props.className)} />;
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

