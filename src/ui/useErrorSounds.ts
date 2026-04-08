import * as React from "react";

import type { ErrorSound, ErrorSoundsResponse } from "./types";
import { extractRemoteErrorMessage } from "./warehouse/errors";

const REFRESH_INTERVAL_MS = 2 * 60 * 1000;
const PREPARE_TIMEOUT_MS = 4000;

type PreparedAudioEntry = {
  cacheKey: string;
  sourceUrl: string;
  objectUrl: string | null;
  audio: HTMLAudioElement | null;
  preparePromise: Promise<HTMLAudioElement | null> | null;
};

const preparedAudioCache = new Map<string, PreparedAudioEntry>();

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
  const message = extractRemoteErrorMessage(value).toLowerCase();
  return message.includes("unknown_code") || message.includes("picked_qty_exceeds_ordered_qty");
}

function getErrorSoundCacheKey(sound: ErrorSound | null | undefined): string {
  const id = String(sound?.id || "").trim();
  const url = String(sound?.file_url || "").trim();
  return id && url ? `${id}|${url}` : "";
}

function shouldPrepareViaFetch(url: string): boolean {
  const source = String(url || "").trim();
  if (!source || typeof window === "undefined") return false;

  try {
    const resolved = new URL(source, window.location.href);
    const protocol = resolved.protocol.toLowerCase();
    if (protocol === "blob:" || protocol === "data:") return true;
    if (protocol !== "http:" && protocol !== "https:") return false;
    const pageOrigin = String(window.location.origin || "").trim();
    if (!pageOrigin || pageOrigin === "null") return false;
    return resolved.origin === pageOrigin;
  } catch {
    return false;
  }
}

async function waitForAudioReady(audio: HTMLAudioElement): Promise<void> {
  if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return;

  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve();
    };
    const cleanup = () => {
      audio.removeEventListener("canplaythrough", finish);
      audio.removeEventListener("loadeddata", finish);
      audio.removeEventListener("error", finish);
      window.clearTimeout(timeoutId);
    };
    const timeoutId = window.setTimeout(finish, PREPARE_TIMEOUT_MS);
    audio.addEventListener("canplaythrough", finish, { once: true });
    audio.addEventListener("loadeddata", finish, { once: true });
    audio.addEventListener("error", finish, { once: true });
    audio.load();
  });
}

export async function prepareErrorSound(sound: ErrorSound | null | undefined): Promise<HTMLAudioElement | null> {
  const url = String(sound?.file_url || "").trim();
  const cacheKey = getErrorSoundCacheKey(sound);
  if (!url || !cacheKey) return null;

  const cached = preparedAudioCache.get(cacheKey);
  if (cached?.audio) return cached.audio;
  if (cached?.preparePromise) return await cached.preparePromise;

  const entry: PreparedAudioEntry = {
    cacheKey,
    sourceUrl: url,
    objectUrl: null,
    audio: null,
    preparePromise: null,
  };

  entry.preparePromise = (async () => {
    try {
      let playbackUrl = url;
      if (shouldPrepareViaFetch(url)) {
        const response = await fetch(url, { cache: "force-cache" });
        if (response.ok) {
          const blob = await response.blob();
          entry.objectUrl = URL.createObjectURL(blob);
          playbackUrl = entry.objectUrl;
        }
      }

      const audio = new Audio(playbackUrl);
      audio.preload = "auto";
      await waitForAudioReady(audio);
      entry.audio = audio;
      return audio;
    } catch {
      try {
        const audio = new Audio(url);
        audio.preload = "auto";
        entry.audio = audio;
        return audio;
      } catch {
        return null;
      }
    } finally {
      entry.preparePromise = null;
    }
  })();

  preparedAudioCache.set(cacheKey, entry);
  return await entry.preparePromise;
}

export async function playErrorSound(sound: ErrorSound | null | undefined): Promise<boolean> {
  const audio = await prepareErrorSound(sound);
  if (!audio) return false;
  try {
    audio.pause();
    if (Number.isFinite(audio.currentTime) && audio.currentTime > 0) {
      audio.currentTime = 0;
    }
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

export function usePreparedErrorSound(sound: ErrorSound | null | undefined, enabled: boolean) {
  const cacheKey = React.useMemo(() => getErrorSoundCacheKey(sound), [sound?.file_url, sound?.id]);

  React.useEffect(() => {
    if (!enabled) return;
    if (!cacheKey) return;
    void prepareErrorSound(sound);
  }, [cacheKey, enabled, sound]);
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
