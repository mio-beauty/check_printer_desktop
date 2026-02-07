import React from "react";
import { TitleBar, ConnectionState } from "./TitleBar";

type AppLayoutProps = {
  connectionState: ConnectionState;
  appVersion?: string;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
};

export function AppLayout({
  connectionState,
  appVersion,
  onMinimize,
  onToggleMaximize,
  onClose,
  sidebar,
  children,
}: AppLayoutProps) {
  return (
    <div className="h-screen bg-background text-foreground w-full">
      <div className="flex h-full flex-col">
        <TitleBar
          connectionState={connectionState}
          appVersion={appVersion}
          onMinimize={onMinimize}
          onToggleMaximize={onToggleMaximize}
          onClose={onClose}
        />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {sidebar}
          <main className="min-w-0 flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
