import React from "react";
import { TitleBar, ConnectionState } from "./TitleBar";
import { shouldShowUpdateBanner, UpdateBanner, UPDATE_BANNER_HEIGHT_PX } from "./UpdateBanner";
import type { UpdateState } from "../types";

type AppLayoutProps = {
  connectionState: ConnectionState;
  activityState?: ConnectionState | null;
  appVersion?: string;
  update?: UpdateState;
  forcedUpdate?: boolean;
  onStartUpdate?: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
};

export function AppLayout({
  connectionState,
  activityState = null,
  appVersion,
  update,
  forcedUpdate = false,
  onStartUpdate,
  onMinimize,
  onToggleMaximize,
  onClose,
  sidebar,
  children,
}: AppLayoutProps) {
  const [bannerHiddenThisRun, setBannerHiddenThisRun] = React.useState(false);
  const updateMessageKey = update?.kind === "available" ? update.message : "";

  React.useEffect(() => {
    setBannerHiddenThisRun(false);
  }, [update?.kind, updateMessageKey]);

  const showBanner = Boolean(update && shouldShowUpdateBanner(update, forcedUpdate) && !bannerHiddenThisRun);
  const appTopOffsetPx = 32 + (showBanner ? UPDATE_BANNER_HEIGHT_PX : 0);

  return (
    <div
      className="h-screen bg-background text-foreground w-full"
      style={{ ["--app-top-offset" as any]: `${appTopOffsetPx}px` } as React.CSSProperties}
    >
      <div className="flex h-full flex-col">
        <TitleBar
          connectionState={connectionState}
          activityState={activityState}
          appVersion={appVersion}
          onMinimize={onMinimize}
          onToggleMaximize={onToggleMaximize}
          onClose={onClose}
        />
        {showBanner && update && onStartUpdate ? (
          <UpdateBanner
            update={update}
            forcedUpdate={forcedUpdate}
            onStartUpdate={onStartUpdate}
            hiddenThisRun={bannerHiddenThisRun}
            onHideThisRun={() => setBannerHiddenThisRun(true)}
          />
        ) : null}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {sidebar}
          <main className="min-w-0 flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
