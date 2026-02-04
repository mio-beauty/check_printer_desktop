const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("checkPrinter", {
  getStatus: () => ipcRenderer.invoke("getStatus"),
  onStatus: (cb) => {
    const listener = (_event, payload) => cb(payload);
    ipcRenderer.on("status", listener);
    return () => ipcRenderer.removeListener("status", listener);
  },
  testPrint: (text) => ipcRenderer.invoke("testPrint", text),
  checkUpdates: () => ipcRenderer.invoke("checkUpdates"),
  startUpdate: () => ipcRenderer.invoke("startUpdate"),
});

