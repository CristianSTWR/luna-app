const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const keytar = require("keytar");

const squirrelStartup = require("electron-squirrel-startup");
if (squirrelStartup) {
  app.quit();
}

const { updateElectronApp } = require("update-electron-app");
if (app.isPackaged) {
  updateElectronApp();
}


 /* "scripts": {
    "dev": "electronmon --trace-warnings .",
    "start": "electron-forge start"
  }, */

/* const API_BASE = "http://127.0.0.1:8001"; */
const API_BASE = "https://gara-desig-veloped-api.onrender.com";

const SERVICE = "LUNA_APP";
const ACCOUNT_REFRESH = "refresh_token";
const ACCOUNT_ACCESS = "access_token";
const ACCOUNT_DEVICE_SECRET = "device_secret";

let loaderWin = null;
let mainWin = null;
let licenseWin = null;

// ---------------------------
// HTTP helpers
// ---------------------------
async function apiPost(pathname, body, extraHeaders = {}) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body ?? {}),
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_) {}

  if (!res.ok) {
    const msg = (data && (data.detail || data.error)) ? (data.detail || data.error) : `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function apiGet(pathname) {
  const res = await fetch(`${API_BASE}${pathname}`);
  return res.ok;
}

function getKeytar() {
  return keytar; // aquí está instalado directo
}

// ---------------------------
// DeviceId estable
// ---------------------------
async function getOrCreateDeviceSecret() {
  const kt = getKeytar();
  let secret = await kt.getPassword(SERVICE, ACCOUNT_DEVICE_SECRET);
  if (!secret) {
    secret = crypto.randomBytes(32).toString("hex");
    await kt.setPassword(SERVICE, ACCOUNT_DEVICE_SECRET, secret);
  }
  return secret;
}

async function getDeviceId() {
  const secret = await getOrCreateDeviceSecret();
  const fingerprint = `${os.hostname()}|${os.platform()}|${os.arch()}`; // estable en la máquina
  return crypto
    .createHash("sha256")
    .update(secret + "|" + fingerprint)
    .digest("hex")
    .slice(0, 32); // >=16 chars OK
}

// ---------------------------
// Windows

/* 

splashWindow = new BrowserWindow({
    width: 440,
    height: 280,
    frame: false,
    transparent: true,
    resizable: false,
    show: false,
    alwaysOnTop: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

*/

// ---------------------------
function createLoaderWindow() {
  loaderWin = new BrowserWindow({
    width: 350,
    height: 350,
    resizable: false,
    frame: false,
    show: false,
    title: "LUNA",
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  loaderWin.once("ready-to-show", () => loaderWin && loaderWin.show());
  loaderWin.loadFile(path.join(__dirname, "../renderer/loader.html"));
}

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1100,
    height: 720,
    frame: false,              // ✅ quita la barra nativa
    titleBarStyle: "hidden",   // ✅ (opcional) mejor compat
    backgroundColor: "#0b0b0b",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWin.once("ready-to-show", () => mainWin && mainWin.show());
  mainWin.loadFile(path.join(__dirname, "../renderer/index.html"));
}

function createLicenseWindow() {
  licenseWin = new BrowserWindow({
    width: 520,
    height: 520,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  licenseWin.once("ready-to-show", () => licenseWin && licenseWin.show());
  licenseWin.loadFile(path.join(__dirname, "../renderer/license.html"));
}

// ---------------------------
// Boot logic
// ---------------------------
async function pingApi() {
  try {
    const ok = await apiGet("/health");
    return { ok };
  } catch (e) {
    return { ok: false, msg: e?.message || "no connection" };
  }
}

async function checkOrRefreshSession() {
  try {
    const kt = getKeytar();
    const refresh = await kt.getPassword(SERVICE, ACCOUNT_REFRESH);
    if (!refresh) return { ok: false, reason: "NO_REFRESH" };

    const deviceId = await getDeviceId();

    // ✅ endpoint real: /refresh
    const out = await apiPost("/refresh", { refreshToken: refresh, deviceId });

    const access =
      typeof out?.accessToken === "string" ? out.accessToken :
      typeof out?.access_token === "string" ? out.access_token :
      "";

    if (!access.trim()) return { ok: false, reason: "NO_ACCESS" };

    await kt.setPassword(SERVICE, ACCOUNT_ACCESS, access);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "ERROR", msg: e?.message || String(e), status: e?.status };
  }
}

// ---------------------------
// IPC: Activate license (license window)
// ---------------------------
ipcMain.handle("license:activate", async (_evt, payload) => {
  try {
    const key =
      typeof payload?.licenseKey === "string" ? payload.licenseKey.trim() :
      typeof payload?.key === "string" ? payload.key.trim() :
      "";

    if (!key) return { ok: false, error: "Escribe una clave." };

    const deviceId = await getDeviceId();

    const out = await apiPost("/activate", { licenseKey: key, deviceId });

    const access =
      typeof out?.accessToken === "string" ? out.accessToken :
      typeof out?.access_token === "string" ? out.access_token :
      "";

    const refresh =
      typeof out?.refreshToken === "string" ? out.refreshToken :
      typeof out?.refresh_token === "string" ? out.refresh_token :
      "";

    if (!access.trim() || !refresh.trim()) {
      return { ok: false, error: "Respuesta inválida del servidor." };
    }

    const kt = getKeytar();
    await kt.setPassword(SERVICE, ACCOUNT_ACCESS, access);
    await kt.setPassword(SERVICE, ACCOUNT_REFRESH, refresh);

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: (e?.data && (e.data.detail || e.data.error)) ? (e.data.detail || e.data.error) :
             (e?.message || "Error activando."),
      status: e?.status
    };
  }
});

// ---------------------------
// IPC: Boot
// ---------------------------
ipcMain.handle("boot:run", async () => {
  const ping = await pingApi();
  if (!ping.ok) return { step: "PING", ok: false, msg: ping.msg };

  const session = await checkOrRefreshSession();
  if (!session.ok) return { step: "LICENSE", ok: false, reason: session.reason, msg: session.msg, status: session.status };

  return { step: "DONE", ok: true };
});

ipcMain.on("app:enterMain", () => {
  if (!mainWin) createMainWindow();
  if (licenseWin) { try { licenseWin.close(); } catch {} }
  licenseWin = null;

  if (loaderWin) loaderWin.close();
  loaderWin = null;
});

ipcMain.on("app:enterLicense", () => {
  if (!licenseWin) createLicenseWindow();
  if (mainWin) { try { mainWin.close(); } catch {} }
  mainWin = null;

  if (loaderWin) loaderWin.close();
  loaderWin = null;
});

// ---------------------------
// App lifecycle
// ---------------------------
app.whenReady().then(createLoaderWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// 

ipcMain.on("win:minimize", (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  win?.minimize();
});

ipcMain.on("win:toggleMaximize", (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win) return;
  win.isMaximized() ? win.unmaximize() : win.maximize();
});

ipcMain.on("win:close", (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  win?.close();
});
// Close loader
ipcMain.on("loader:loader_close", (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  win?.close();
});
