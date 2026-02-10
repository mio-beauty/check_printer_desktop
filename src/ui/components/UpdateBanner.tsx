import * as React from "react";

import { X } from "lucide-react";

import type { UpdateState } from "../types";

export const UPDATE_BANNER_HEIGHT_PX = 40;
export const UPDATE_SNOOZE_UNTIL_KEY = "desktop_update_snooze_until_ms";
export const UPDATE_DISMISSED_KEY = "desktop_update_dismissed_key";

function nowMs(): number {
  return Date.now();
}

function parseSnoozeUntil(): number | null {
  try {
    const raw = window.localStorage.getItem(UPDATE_SNOOZE_UNTIL_KEY);
    if (!raw) return null;
    const ms = Number.parseInt(raw, 10);
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

function setSnoozeUntil(ms: number) {
  try {
    window.localStorage.setItem(UPDATE_SNOOZE_UNTIL_KEY, String(Math.max(0, Math.floor(ms))));
  } catch {
    // ignore
  }
}

function parseDismissedKey(): string | null {
  try {
    return window.localStorage.getItem(UPDATE_DISMISSED_KEY);
  } catch {
    return null;
  }
}

function setDismissedKey(v: string) {
  try {
    window.localStorage.setItem(UPDATE_DISMISSED_KEY, v);
  } catch {
    // ignore
  }
}

function clearDismissState() {
  try {
    window.localStorage.removeItem(UPDATE_SNOOZE_UNTIL_KEY);
    window.localStorage.removeItem(UPDATE_DISMISSED_KEY);
  } catch {
    // ignore
  }
}

function extractVersionFromMessage(message: string): string | null {
  const m = String(message || "").match(/\bv?\d+\.\d+\.\d+\b/);
  if (!m?.[0]) return null;
  const v = m[0].startsWith("v") ? m[0] : `v${m[0]}`;
  return v;
}

function toDismissKey(update: Extract<UpdateState, { kind: "available" }>): string {
  const version = extractVersionFromMessage(update.message);
  return version ? `version:${version}` : `message:${update.message}`;
}

export function shouldShowUpdateBanner(update: UpdateState, forcedUpdate: boolean): boolean {
  const available = update.kind === "available" ? update : null;
  if (forcedUpdate) return false;
  if (!available) return false;
  if (available.forced) return false;

  const snoozeUntil = parseSnoozeUntil();
  if (snoozeUntil && nowMs() < snoozeUntil) return false;

  return true;
}

export function UpdateBanner(props: {
  update: UpdateState;
  forcedUpdate: boolean;
  onStartUpdate: () => void;
  hiddenThisRun: boolean;
  onHideThisRun: () => void;
}) {
  const available = props.update.kind === "available" ? props.update : null;
  const [visibilityBump, bumpVisibility] = React.useState(0);

  const shouldShow = React.useMemo(() => {
    if (!available) return false;
    return shouldShowUpdateBanner({ kind: "available", forced: available.forced, message: available.message }, props.forcedUpdate);
  }, [available, props.forcedUpdate, visibilityBump]);

  if (!shouldShow || !available || props.hiddenThisRun) return null;

  const version = extractVersionFromMessage(available.message);
  const text = version ? `Новая версия ${version} доступна. Обновить?` : "Новая версия доступна. Обновить?";

  return (
    <div className="bg-[#131314] text-white" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
      <div className="flex items-center justify-between gap-3 px-4 py-1">
        <div className="truncate text-[13px] font-medium">{text}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              clearDismissState();
              props.onStartUpdate();
            }}
            className="h-6 rounded-[8px] bg-white px-4 text-[13px] font-semibold text-black hover:bg-white/90 active:bg-white/80"
          >
            Обновить сейчас
          </button>
          <button
            type="button"
            onClick={() => {
              setSnoozeUntil(nowMs() + 6 * 60 * 60 * 1000);
              bumpVisibility((x) => x + 1);
              props.onHideThisRun();
            }}
            className="h-6 rounded-[8px] bg-white/0 px-3 text-[13px] font-semibold text-white/90 hover:bg-white/10 active:bg-white/15"
          >
            Напомнить позже
          </button>
          <button
            type="button"
            aria-label="Закрыть"
            onClick={() => {
              bumpVisibility((x) => x + 1);
              props.onHideThisRun();
            }}
            className="grid h-8 w-8 place-items-center rounded-[10px] hover:bg-white/10 active:bg-white/15"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
