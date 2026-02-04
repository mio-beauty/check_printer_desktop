import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("checkPrinter", {
  getStatus: () => ipcRenderer.invoke("getStatus"),
  onStatus: (cb: (s: { connected: boolean; backendUrl: string }) => void) => {
    const listener = (_: unknown, payload: { connected: boolean; backendUrl: string }) => cb(payload);
    ipcRenderer.on("status", listener);
    return () => ipcRenderer.removeListener("status", listener);
  },
  checkUpdates: () => ipcRenderer.invoke("checkUpdates"),
  startUpdate: () => ipcRenderer.invoke("startUpdate"),
});

