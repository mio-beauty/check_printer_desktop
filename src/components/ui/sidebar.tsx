import * as React from "react";

import { cn } from "../../lib/utils";

export const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { widthClassName?: string }
>(({ className, widthClassName = "w-56", ...props }, ref) => (
  <div
    ref={ref}
    className={cn("shrink-0 border-r bg-background p-3", widthClassName, className)}
    {...props}
  />
));
Sidebar.displayName = "Sidebar";

export const SidebarSection = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("space-y-2", className)} {...props} />,
);
SidebarSection.displayName = "SidebarSection";

export const SidebarLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-xs text-muted-foreground", className)} {...props} />
  ),
);
SidebarLabel.displayName = "SidebarLabel";

