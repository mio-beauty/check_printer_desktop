import React from "react";
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { ConnectionState } from "../components/TitleBar";
import { Layout } from "../components/Layout";
import { WarehousePage } from "../pages/WarehousePage";
import { StatusPage } from "../pages/StatusPage";
import { LoginPage } from "../pages/LoginPage";
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
          path="/login"
          element={
            <Layout
              connectionState={props.connectionState}
              onMinimize={props.onMinimize}
              onToggleMaximize={props.onToggleMaximize}
              onClose={props.onClose}
              status={props.status}
              forcedUpdate={props.forcedUpdate}
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
                <StatusPage
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
      </Routes>
    </HashRouter>
  );
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
