import React from "react";
import { AppLayout } from "./AppLayout";
import { AppSidebar } from "./Layout/app-sidebar";
import type { ConnectionState } from "./TitleBar";
import type { PrinterStatus, UpdateState } from "../types";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TitleBarActivityProvider, type TitleBarActivityState } from "./titlebar-activity";

type LayoutProps = {
  connectionState: ConnectionState;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
  status: PrinterStatus | null;
  forcedUpdate: boolean;
  update?: UpdateState;
  onStartUpdate?: () => Promise<void>;
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
  update,
  onStartUpdate,
  showSidebar = true,
  children,
}: LayoutProps) {
  void forcedUpdate;
  const [activityState, setActivityState] = React.useState<TitleBarActivityState>(null);

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
        activityState={activityState}
        appVersion={status?.appVersion}
        update={update}
        forcedUpdate={forcedUpdate}
        onStartUpdate={
          onStartUpdate
            ? () => {
                void onStartUpdate();
              }
            : undefined
        }
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
        <TitleBarActivityProvider value={{ activity: activityState, setActivity: setActivityState }}>
          {children}
        </TitleBarActivityProvider>
      </AppLayout>
    </SidebarProvider>
  );
}

export default Layout;
