const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("checkPrinter", {
  getStatus: () => ipcRenderer.invoke("getStatus"),
  getSettings: () => ipcRenderer.invoke("getSettings"),
  setSettings: (next) => ipcRenderer.invoke("setSettings", next),
  onStatus: (cb) => {
    const listener = (_event, payload) => cb(payload);
    ipcRenderer.on("status", listener);
    return () => ipcRenderer.removeListener("status", listener);
  },
  onLog: (cb) => {
    const listener = (_event, payload) => cb(payload);
    ipcRenderer.on("log", listener);
    return () => ipcRenderer.removeListener("log", listener);
  },
  getLogs: () => ipcRenderer.invoke("getLogs"),
  testPrint: (text) => ipcRenderer.invoke("testPrint", text),
  checkUpdates: () => ipcRenderer.invoke("checkUpdates"),
  startUpdate: () => ipcRenderer.invoke("startUpdate"),
});
