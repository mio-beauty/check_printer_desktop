import type { ReactNode } from "react";
import { AppLayout } from "./AppLayout";
import type { ConnectionState } from "./TitleBar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Sidebar, SidebarLabel, SidebarSection } from "../../components/ui/sidebar";
import type { PrinterStatus } from "../types";
import { useLocation, useNavigate } from "react-router-dom";

type LayoutProps = {
  connectionState: ConnectionState;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
  status: PrinterStatus | null;
  forcedUpdate: boolean;
  children: ReactNode;
};

export function Layout({
  connectionState,
  onMinimize,
  onToggleMaximize,
  onClose,
  status,
  forcedUpdate,
  children,
}: LayoutProps) {
  const authed = Boolean(status?.warehouseAuth?.hasToken);
  const navigate = useNavigate();
  const location = useLocation();
  const currentView = location.pathname === "/warehouse" ? "warehouse" : "status";
  const sidebar = authed ? (
    <Sidebar className="overflow-y-auto">
      <div className="space-y-3">
        <SidebarSection>
          <SidebarLabel>Навигация</SidebarLabel>
          <Button
            className="w-full justify-start"
            variant={currentView === "status" ? "default" : "outline"}
            onClick={() => navigate("/")}
          >
            Статус
          </Button>
          <Button
            className="w-full justify-start"
            variant={currentView === "warehouse" ? "default" : "outline"}
            onClick={() => navigate("/warehouse")}
          >
            Склад
          </Button>
        </SidebarSection>

        <SidebarSection>
          <SidebarLabel>Связь</SidebarLabel>
          <div className="flex flex-wrap gap-2">
            <Badge variant={status?.connected ? "default" : "destructive"}>
              {status?.connected ? "socket: ok" : "socket: нет"}
            </Badge>
            <Badge variant={status?.joined ? "secondary" : "destructive"}>
              {status?.joined ? "join: ok" : `join: ${status?.joinError || "нет"}`}
            </Badge>
          </div>
          {forcedUpdate && <Badge variant="destructive">Требуется обновление</Badge>}
        </SidebarSection>

        <SidebarSection>
          <SidebarLabel>Аккаунт</SidebarLabel>
          <Badge variant="secondary">{status?.warehouseAuth?.phone || "—"}</Badge>
          <Button
            className="w-full justify-start"
            variant="outline"
            onClick={() => void window.checkPrinter?.warehouseLogout?.()}
          >
            Выйти
          </Button>
        </SidebarSection>
      </div>
    </Sidebar>
  ) : undefined;

  return (
    <AppLayout
      connectionState={connectionState}
      appVersion={status?.appVersion ?? undefined}
      onMinimize={onMinimize}
      onToggleMaximize={onToggleMaximize}
      onClose={onClose}
      sidebar={sidebar}
    >
      {children}
    </AppLayout>
  );
}
