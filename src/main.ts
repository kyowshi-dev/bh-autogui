import {
  app,
  BrowserView,
  BrowserWindow,
  ipcMain,
  type IpcMainEvent,
} from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BIT_HEROES_PAGE } from "./selection/candidate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOLBAR_HEIGHT = 100;
let window: BrowserWindow | null = null;
let gameView: BrowserView | null = null;

function isTrustedPage(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "kongregate.com" ||
        parsed.hostname.endsWith(".kongregate.com"))
    );
  } catch {
    return false;
  }
}

function sendToToolbar(channel: string, payload: unknown): void {
  if (window && !window.isDestroyed())
    window.webContents.send(channel, payload);
}

function setGameBounds(): void {
  if (!window || !gameView) return;
  const [contentWidth, contentHeight] = window.getContentSize();
  const width = contentWidth ?? 760;
  const height = contentHeight ?? 560;
  gameView.setBounds({
    x: 0,
    y: TOOLBAR_HEIGHT,
    width,
    height: Math.max(100, height - TOOLBAR_HEIGHT),
  });
}

function validateToolbarEvent(event: IpcMainEvent): boolean {
  return Boolean(window && event.sender === window.webContents);
}

function createWindow(): void {
  window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 760,
    minHeight: 560,
    title: "Bit Heroes Surface Selector",
    backgroundColor: "#e9edf0",
    webPreferences: {
      preload: path.join(__dirname, "preload-shell.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.loadFile(path.join(__dirname, "ui", "index.html"));

  gameView = new BrowserView({
    webPreferences: {
      partition: "persist:bit-heroes-kongregate",
      preload: path.join(__dirname, "preload-game.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  window.addBrowserView(gameView);
  setGameBounds();
  gameView.webContents.loadURL(BIT_HEROES_PAGE);
  window.on("resize", setGameBounds);
  window.on("maximize", setGameBounds);
  window.on("unmaximize", setGameBounds);
  window.on("closed", () => {
    window = null;
    gameView = null;
  });

  gameView.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedPage(url)) gameView?.webContents.loadURL(url);
    return { action: "deny" };
  });
  gameView.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedPage(url)) event.preventDefault();
  });
  gameView.webContents.on(
    "did-start-navigation",
    (_event, _url, isInPlace, isMainFrame) => {
      if (!isInPlace && isMainFrame) {
        sendToToolbar("page-status", { status: "loading" });
        sendToToolbar("selection-cleared", { reason: "navigation" });
      }
    },
  );
  gameView.webContents.on("did-finish-load", () =>
    sendToToolbar("page-status", { status: "loaded" }),
  );
  gameView.webContents.on("render-process-gone", () =>
    sendToToolbar("page-status", { status: "error" }),
  );
}

ipcMain.on("candidate-state", (event, payload: unknown) => {
  if (gameView && event.sender === gameView.webContents)
    sendToToolbar("candidate-state", payload);
});
ipcMain.on("hover-state", (event, payload: unknown) => {
  if (gameView && event.sender === gameView.webContents)
    sendToToolbar("hover-state", payload);
});
ipcMain.on("selection-confirmed", (event, payload: unknown) => {
  if (gameView && event.sender === gameView.webContents)
    sendToToolbar("selection-confirmed", payload);
});
ipcMain.on("selection-mode", (event, enabled: boolean) => {
  if (validateToolbarEvent(event))
    gameView?.webContents.send("selection-mode", Boolean(enabled));
});
ipcMain.on("confirm-selection", (event) => {
  if (validateToolbarEvent(event))
    gameView?.webContents.send("confirm-selection");
});
ipcMain.on("reset-selection", (event) => {
  if (validateToolbarEvent(event))
    gameView?.webContents.send("reset-selection");
});

app.whenReady().then(createWindow);
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
