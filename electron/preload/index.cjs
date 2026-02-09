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
  onWarehouseHint: (cb) => {
    const listener = (_event, payload) => cb(payload);
    ipcRenderer.on("warehouse:hint", listener);
    return () => ipcRenderer.removeListener("warehouse:hint", listener);
  },
  getLogs: () => ipcRenderer.invoke("getLogs"),
  testPrint: (text) => ipcRenderer.invoke("testPrint", text),
  checkUpdates: () => ipcRenderer.invoke("checkUpdates"),
  startUpdate: () => ipcRenderer.invoke("startUpdate"),
  deviceActivate: (code) => ipcRenderer.invoke("device:activate", { code }),
  windowMinimize: () => ipcRenderer.invoke("window:minimize"),
  windowToggleMaximize: () => ipcRenderer.invoke("window:toggleMaximize"),
  windowClose: () => ipcRenderer.invoke("window:close"),
  warehouseLogin: (phone, password) => ipcRenderer.invoke("warehouse:login", { phone, password }),
  warehouseLogout: () => ipcRenderer.invoke("warehouse:logout"),
  warehouseOrders: (params) => ipcRenderer.invoke("warehouse:orders", params || {}),
  warehouseOrderDetail: (queueId) => ipcRenderer.invoke("warehouse:orderDetail", queueId),
  warehouseOrderEvents: (queueId) => ipcRenderer.invoke("warehouse:orderEvents", queueId),
  warehousePrintRetry: (queueId) => ipcRenderer.invoke("warehouse:printRetry", queueId),
  warehouseReasons: () => ipcRenderer.invoke("warehouse:reasons"),
  warehousePickingStart: (queueId) => ipcRenderer.invoke("warehouse:pickingStart", queueId),
  warehousePickingScan: (queueId, code) => ipcRenderer.invoke("warehouse:pickingScan", { queueId, code }),
  warehousePickingFinish: (queueId, reason_code, comment) =>
    ipcRenderer.invoke("warehouse:pickingFinish", { queueId, reason_code, comment }),
});
