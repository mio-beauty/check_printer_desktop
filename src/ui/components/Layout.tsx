import React from "react";
import { AppLayout } from "./AppLayout";
import { AppSidebar } from "./Layout/app-sidebar";
import type { ConnectionState } from "./TitleBar";
import type { PrinterStatus } from "../types";
import { SidebarProvider } from "@/components/ui/sidebar";

type LayoutProps = {
  connectionState: ConnectionState;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
  status: PrinterStatus | null;
  forcedUpdate: boolean;
  showSidebar?: boolean;
  children: React.ReactNode;
};

export function Layout({
  connectionState,
  onMinimize,
  onToggleMaximize,
  onClose,
  status,
  forcedUpdate,
  showSidebar = true,
  children,
}: LayoutProps) {
  void status;
  void forcedUpdate;

  const handleLogout = React.useCallback(async () => {
    try {
      await window.checkPrinter?.warehouseLogout?.();
    } catch (error) {
      console.error("warehouse logout failed", error);
    }
  }, []);

  return (
    <SidebarProvider>
      <AppLayout
        connectionState={connectionState}
        onMinimize={onMinimize}
        onToggleMaximize={onToggleMaximize}
        onClose={onClose}
        sidebar={
          showSidebar ? (
            <AppSidebar
              warehouseName={status?.warehouse?.name ?? null}
              warehousePhone={status?.warehouseAuth?.phone ?? null}
              onLogout={handleLogout}
            />
          ) : undefined
        }
      >
        {children}
      </AppLayout>
    </SidebarProvider>
  );
}

export default Layout;
