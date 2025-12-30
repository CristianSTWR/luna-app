const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("boot", {
  run: () => ipcRenderer.invoke("boot:run"),
  enterMain: () => ipcRenderer.send("app:enterMain"),
  enterLicense: () => ipcRenderer.send("app:enterLicense"),
});

contextBridge.exposeInMainWorld("license", {
  activate: (licenseKey) =>
    ipcRenderer.invoke("license:activate", { licenseKey }),
  finishSuccess: () => ipcRenderer.send("license:success"),
  close: () => ipcRenderer.send("license:close"),
});


contextBridge.exposeInMainWorld("win", {
  minimize: () => ipcRenderer.send("win:minimize"),
  toggleMaximize: () => ipcRenderer.send("win:toggleMaximize"),
  close: () => ipcRenderer.send("win:close"),
});

contextBridge.exposeInMainWorld("loader", {
  close: () => ipcRenderer.send("loader:loader_close"),
});