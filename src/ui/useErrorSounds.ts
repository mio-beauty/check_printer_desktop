import * as React from "react";

import type { ErrorSound, ErrorSoundsResponse } from "./types";

const REFRESH_INTERVAL_MS = 2 * 60 * 1000;

function normalizeErrorSoundsResponse(raw: unknown): ErrorSoundsResponse {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const defaultSoundId = typeof source.default_sound_id === "string" ? source.default_sound_id.trim() || null : null;
  const rawSounds = Array.isArray(source.sounds) ? source.sounds : [];

  const sounds = rawSounds
    .map((sound): ErrorSound | null => {
      if (!sound || typeof sound !== "object") return null;
      const row = sound as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id.trim() : "";
      const name = typeof row.name === "string" ? row.name.trim() : "";
      const fileUrl = typeof row.file_url === "string" ? row.file_url.trim() : "";
      if (!id || !name || !fileUrl) return null;
      return {
        id,
        name,
        file_url: fileUrl,
        content_type: typeof row.content_type === "string" ? row.content_type : null,
        size_bytes: typeof row.size_bytes === "number" ? row.size_bytes : null,
        original_filename: typeof row.original_filename === "string" ? row.original_filename : null,
        created_at: typeof row.created_at === "string" ? row.created_at : null,
        is_default: Boolean(row.is_default),
      };
    })
    .filter((sound): sound is ErrorSound => Boolean(sound));

  const ids = new Set(sounds.map((sound) => sound.id));
  const resolvedDefaultId = defaultSoundId && ids.has(defaultSoundId) ? defaultSoundId : null;

  return {
    default_sound_id: resolvedDefaultId,
    sounds,
  };
}

export function resolveEffectiveErrorSound(data: ErrorSoundsResponse | null | undefined, selectedSoundId: string | null | undefined) {
  const sounds = Array.isArray(data?.sounds) ? data.sounds : [];
  if (!sounds.length) return null;

  const soundById = new Map(sounds.map((sound) => [sound.id, sound] as const));
  const localSelection = selectedSoundId ? soundById.get(String(selectedSoundId)) : null;
  if (localSelection) return localSelection;

  const defaultSelection = data?.default_sound_id ? soundById.get(String(data.default_sound_id)) : null;
  return defaultSelection ?? null;
}

export function isWrongScanErrorMessage(value: unknown): boolean {
  const message = String(value ?? "").toLowerCase();
  return message.includes("unknown_code") || message.includes("picked_qty_exceeds_ordered_qty");
}

export async function playErrorSound(sound: ErrorSound | null | undefined): Promise<boolean> {
  const url = String(sound?.file_url || "").trim();
  if (!url) return false;
  try {
    const audio = new Audio(url);
    audio.preload = "auto";
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

export function useWarehouseErrorSounds(enabled: boolean) {
  const [data, setData] = React.useState<ErrorSoundsResponse>({ default_sound_id: null, sounds: [] });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!enabled) return;
    if (!window.checkPrinter?.warehouseErrorSounds) return;

    setLoading(true);
    try {
      const json = await window.checkPrinter.warehouseErrorSounds();
      setData(normalizeErrorSoundsResponse(json));
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  React.useEffect(() => {
    if (!enabled) return;
    void refresh();

    const timerId = window.setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timerId);
  }, [enabled, refresh]);

  return { data, loading, error, refresh };
}
