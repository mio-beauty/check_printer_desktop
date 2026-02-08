import * as React from "react";

import { cn } from "../../lib/utils";

type TabsContextValue = {
  value: string;
  setValue: (v: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabs() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("Tabs components must be used within <Tabs />");
  return ctx;
}

export function Tabs(props: {
  value: string;
  onValueChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useMemo<TabsContextValue>(
    () => ({ value: props.value, setValue: props.onValueChange }),
    [props.onValueChange, props.value],
  );
  return (
    <TabsContext.Provider value={ctx}>
      <div className={cn("w-full", props.className)}>{props.children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList(props: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "inline-flex w-full items-center gap-2 overflow-auto rounded-md p-0",
        props.className,
      )}
    />
  );
}

export function TabsTrigger(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const { value, setValue } = useTabs();
  const active = value === props.value;
  return (
    <button
      type="button"
      {...props}
      data-state={active ? "active" : "inactive"}
      onClick={(e) => {
        props.onClick?.(e);
        if (!e.defaultPrevented) setValue(props.value);
      }}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
        active ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted",
        props.className,
      )}
    />
  );
}

export function TabsContent(props: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const { value } = useTabs();
  if (value !== props.value) return null;
  return <div {...props} className={cn("mt-3", props.className)} />;
}

