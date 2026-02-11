import React from "react";
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { ConnectionState } from "../components/TitleBar";
import { Layout } from "../components/Layout";
import { WarehousePage } from "../pages/WarehousePage";
import { SettingsPage } from "../pages/SettingsPage";
import { LoginPage } from "../pages/LoginPage";
import { ForcedUpdatePage } from "../pages/ForcedUpdatePage";
import type { Settings, UpdateState, LogEntry, PrinterStatus } from "../types";

type AppRoutesProps = {
  connectionState: ConnectionState;
  status: PrinterStatus | null;
  forcedUpdate: boolean;
  settings: Settings | null;
  setSettings: React.Dispatch<React.SetStateAction<Settings | null>>;
  logs: LogEntry[];
  update: UpdateState;
  setUpdate: React.Dispatch<React.SetStateAction<UpdateState>>;
  warehouseHint?: string | null;
  onTestPrint: () => Promise<void>;
  onCheckUpdates: () => Promise<void>;
  onStartUpdate: () => Promise<void>;
  onSaveSettings: () => Promise<void>;
  onMinimize: () => Promise<void>;
  onToggleMaximize: () => Promise<void>;
  onClose: () => Promise<void>;
};

export function AppRoutes(props: AppRoutesProps) {
  const authed = Boolean(props.status?.warehouseAuth?.hasToken);
  const online = Boolean(props.status?.connected && props.status?.joined);
  const defaultAuthedPath = "/warehouse";

  return (
    <HashRouter>
      <Routes>
        <Route
          path="/force-update"
          element={
            <Layout
              connectionState={props.connectionState}
              onMinimize={props.onMinimize}
              onToggleMaximize={props.onToggleMaximize}
              onClose={props.onClose}
              status={props.status}
              forcedUpdate={true}
              update={props.update}
              onStartUpdate={props.onStartUpdate}
              showSidebar={false}
            >
              <ForcedUpdatePage
                currentVersion={props.status?.appVersion ?? "—"}
                minSupportedVersion={null}
                message={props.update.kind === "available" ? props.update.message : "Обновление обязательно."}
                downloading={props.update.kind === "downloading"}
                progress={props.update.kind === "downloading" ? props.update.progress ?? null : null}
                error={props.update.kind === "error" ? props.update.message : null}
                onUpdate={props.onStartUpdate}
              />
            </Layout>
          }
        />

        <Route element={<RequireNoForceUpdate forcedUpdate={props.forcedUpdate} />}>
        <Route
          path="/login"
          element={
            <Layout
              connectionState={props.connectionState}
              onMinimize={props.onMinimize}
              onToggleMaximize={props.onToggleMaximize}
              onClose={props.onClose}
              status={props.status}
              forcedUpdate={props.forcedUpdate}
              update={props.update}
              onStartUpdate={props.onStartUpdate}
              showSidebar={false}
            >
              <LoginRoute
                authed={authed}
                online={online}
                forcedUpdate={props.forcedUpdate}
                hint={props.warehouseHint}
                settings={props.settings}
                setSettings={props.setSettings}
              />
            </Layout>
          }
        />
        <Route element={<RequireAuth authed={authed} />}>
          <Route
            element={
              <Layout
                connectionState={props.connectionState}
                onMinimize={props.onMinimize}
                onToggleMaximize={props.onToggleMaximize}
                onClose={props.onClose}
                status={props.status}
                forcedUpdate={props.forcedUpdate}
                update={props.update}
                onStartUpdate={props.onStartUpdate}
              >
                <Outlet />
              </Layout>
            }
          >
            <Route
              index
              element={<Navigate to={defaultAuthedPath} replace />}
            />
            <Route
              path="status"
              element={
                <SettingsPage
                  status={props.status}
                  settings={props.settings}
                  setSettings={props.setSettings}
                  logs={props.logs}
                  update={props.update}
                  setUpdate={props.setUpdate}
                  forcedUpdate={props.forcedUpdate}
                  onTestPrint={props.onTestPrint}
                  onCheckUpdates={props.onCheckUpdates}
                  onStartUpdate={props.onStartUpdate}
                  onSaveSettings={props.onSaveSettings}
                />
              }
            />
            <Route
              path="warehouse"
              element={
                <WarehousePage
                  active
                  online={online}
                  forcedUpdate={props.forcedUpdate}
                  auth={props.status?.warehouseAuth ?? null}
                />
              }
            />
            <Route path="*" element={<Navigate to={defaultAuthedPath} replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to={authed ? defaultAuthedPath : "/login"} replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

function RequireNoForceUpdate({ forcedUpdate }: { forcedUpdate: boolean }) {
  const location = useLocation();
  if (forcedUpdate && location.pathname !== "/force-update") {
    return <Navigate to="/force-update" replace />;
  }
  return <Outlet />;
}

function LoginRoute(props: {
  authed: boolean;
  online: boolean;
  forcedUpdate: boolean;
  hint?: string | null;
  settings: Settings | null;
  setSettings: React.Dispatch<React.SetStateAction<Settings | null>>;
}) {
  if (props.authed) {
    return <Navigate to="/warehouse" replace />;
  }
  return (
    <LoginPage
      online={props.online}
      forcedUpdate={props.forcedUpdate}
      hint={props.hint}
      settings={props.settings}
      setSettings={props.setSettings}
    />
  );
}

function RequireAuth({ authed }: { authed: boolean }) {
  const location = useLocation();
  if (!authed) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}
