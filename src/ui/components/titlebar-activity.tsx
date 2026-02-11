import * as React from "react";
import type { ConnectionState } from "./TitleBar";

export type TitleBarActivityState = ConnectionState | null;

type TitleBarActivityContextValue = {
  activity: TitleBarActivityState;
  setActivity: (next: TitleBarActivityState) => void;
};

const TitleBarActivityContext = React.createContext<TitleBarActivityContextValue | null>(null);

export function TitleBarActivityProvider(props: {
  value: TitleBarActivityContextValue;
  children: React.ReactNode;
}) {
  return <TitleBarActivityContext.Provider value={props.value}>{props.children}</TitleBarActivityContext.Provider>;
}

export function useTitleBarActivity(): TitleBarActivityContextValue {
  const ctx = React.useContext(TitleBarActivityContext);
  if (!ctx) {
    throw new Error("useTitleBarActivity must be used within <TitleBarActivityProvider>");
  }
  return ctx;
}

