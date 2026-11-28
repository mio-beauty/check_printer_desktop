import * as React from "react";
import type {
  CourierApiResult,
  CourierApiError,
  CourierCreatePayload,
  CourierOption,
  CourierUpdatePayload,
  CourierUser,
} from "./types";

function unavailable<T>(): CourierApiResult<T> {
  return { ok: false, error: { status: 0, message: "Courier API is unavailable in preload." } };
}

export function useCouriers() {
  const [couriers, setCouriers] = React.useState<CourierUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<CourierApiError | null>(null);
  const [options, setOptions] = React.useState<CourierOption[]>([]);
  const [optionsLoading, setOptionsLoading] = React.useState(false);
  const [optionsError, setOptionsError] = React.useState<CourierApiError | null>(null);
  const [mutationId, setMutationId] = React.useState<number | "create" | null>(null);
  const listRequest = React.useRef(0);
  const optionsRequest = React.useRef(0);
  const optionsPromise = React.useRef<Promise<CourierApiResult<CourierOption[]>> | null>(null);
  const optionsCache = React.useRef<CourierOption[]>([]);
  const optionsLoaded = React.useRef(false);
  const mutationLock = React.useRef(false);

  const hasLoadedList = React.useRef(false);

  const refresh = React.useCallback(async () => {
    const requestId = ++listRequest.current;
    if (hasLoadedList.current) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await (window.checkPrinter?.couriersList?.() ?? Promise.resolve(unavailable<CourierUser[]>()));
      if (requestId !== listRequest.current) return result;
      if (result.ok) {
        setCouriers(result.data.filter((user) => user?.role === "courier"));
        hasLoadedList.current = true;
      } else {
        setError(result.error);
      }
      return result;
    } catch (cause) {
      const result: CourierApiResult<CourierUser[]> = {
        ok: false,
        error: { status: 0, message: String((cause as Error)?.message || cause) },
      };
      if (requestId === listRequest.current) setError(result.error);
      return result;
    } finally {
      if (requestId === listRequest.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const loadOptions = React.useCallback(async (force = false) => {
    if (!force && optionsLoaded.current) return { ok: true, data: optionsCache.current } as const;
    if (optionsPromise.current) return optionsPromise.current;
    const requestId = ++optionsRequest.current;
    setOptionsLoading(true);
    setOptionsError(null);
    const request = (async () => {
      try {
        const result = await (window.checkPrinter?.couriersOptions?.() ?? Promise.resolve(unavailable<CourierOption[]>()));
        if (requestId === optionsRequest.current) {
          if (result.ok) {
            optionsLoaded.current = true;
            optionsCache.current = result.data;
            setOptions(result.data);
          }
          else setOptionsError(result.error);
        }
        return result;
      } catch (cause) {
        const result: CourierApiResult<CourierOption[]> = {
          ok: false,
          error: { status: 0, message: String((cause as Error)?.message || cause) },
        };
        if (requestId === optionsRequest.current) setOptionsError(result.error);
        return result;
      } finally {
        if (requestId === optionsRequest.current) setOptionsLoading(false);
        optionsPromise.current = null;
      }
    })();
    optionsPromise.current = request;
    return request;
  }, []);

  React.useEffect(() => {
    void refresh();
    return () => {
      listRequest.current += 1;
      optionsRequest.current += 1;
    };
  }, [refresh]);

  const create = React.useCallback(async (payload: CourierCreatePayload) => {
    if (mutationLock.current) return unavailable<CourierUser>();
    mutationLock.current = true;
    setMutationId("create");
    try {
      const result = await (window.checkPrinter?.couriersCreate?.(payload) ?? Promise.resolve(unavailable<CourierUser>()));
      if (result.ok) {
        void refresh();
        void loadOptions(true);
      } else if (result.error.status === 0 || result.error.status === 409) {
        // A timed-out create may have succeeded on the server; inspect state without retrying POST.
        void refresh();
        void loadOptions(true);
      }
      return result;
    } catch (cause) {
      void refresh();
      void loadOptions(true);
      return { ok: false, error: { status: 0, message: String((cause as Error)?.message || cause) } } as const;
    } finally {
      mutationLock.current = false;
      setMutationId(null);
    }
  }, [loadOptions, refresh]);

  const update = React.useCallback(async (id: number, payload: CourierUpdatePayload) => {
    if (mutationLock.current) return unavailable<{ success: boolean }>();
    mutationLock.current = true;
    setMutationId(id);
    try {
      const result = await (window.checkPrinter?.couriersUpdate?.(id, payload) ?? Promise.resolve(unavailable<{ success: boolean }>()));
      if (result.ok) {
        void refresh();
      } else if (result.error.status === 404 || result.error.status === 409) {
        void refresh();
      }
      return result;
    } catch (cause) {
      return { ok: false, error: { status: 0, message: String((cause as Error)?.message || cause) } } as const;
    } finally {
      mutationLock.current = false;
      setMutationId(null);
    }
  }, [refresh]);

  const deactivate = React.useCallback(async (id: number) => {
    if (mutationLock.current) return unavailable<{ success: boolean }>();
    mutationLock.current = true;
    setMutationId(id);
    try {
      const result = await (window.checkPrinter?.couriersDeactivate?.(id) ?? Promise.resolve(unavailable<{ success: boolean }>()));
      if (result.ok) {
        void refresh();
      } else if (result.error.status === 404 || result.error.status === 409) {
        void refresh();
      }
      return result;
    } catch (cause) {
      return { ok: false, error: { status: 0, message: String((cause as Error)?.message || cause) } } as const;
    } finally {
      mutationLock.current = false;
      setMutationId(null);
    }
  }, [refresh]);

  const getCourier = React.useCallback(async (id: number) => {
    try {
      return await (window.checkPrinter?.couriersGet?.(id) ?? Promise.resolve(unavailable<CourierUser>()));
    } catch (cause) {
      return { ok: false, error: { status: 0, message: String((cause as Error)?.message || cause) } } as const;
    }
  }, []);

  return {
    couriers,
    loading,
    refreshing,
    error,
    options,
    optionsLoading,
    optionsError,
    mutationId,
    refresh,
    loadOptions,
    create,
    update,
    deactivate,
    getCourier,
  };
}
