import {
  app,
  BrowserView,
  BrowserWindow,
  ipcMain,
  type IpcMainEvent,
} from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Tesseract from "tesseract.js";
import { BIT_HEROES_PAGE } from "./selection/candidate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOLBAR_HEIGHT = 214;
const COLLAPSED_TOOLBAR_HEIGHT = 48;
let window: BrowserWindow | null = null;
let gameWindow: BrowserWindow | null = null;
let gameView: BrowserView | null = null;
let toolbarCollapsed = false;
let selectedRect: { x: number; y: number; width: number; height: number } | null = null;
let frameAvailable = false;
let ocrTimer: ReturnType<typeof setInterval> | null = null;
let ocrWorker: Tesseract.Worker | null = null;
let ocrBusy = false;
let ocrGeneration = 0;
let ocrConfig = { intervalMs: 2000, keywords: [] as string[] };

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
  if (!gameWindow || !gameView) return;
  const [contentWidth, contentHeight] = gameWindow.getContentSize();
  const width = contentWidth ?? 760;
  const height = contentHeight ?? 560;
  gameView.setBounds({ x: 0, y: 0, width, height });
}

function setToolbarBounds(): void {
  if (!window || !gameWindow) return;
  const { x, y, width } = gameWindow.getContentBounds();
  window.setBounds({
    x,
    y,
    width,
    height: toolbarCollapsed ? COLLAPSED_TOOLBAR_HEIGHT : TOOLBAR_HEIGHT,
  });
}

function validateToolbarEvent(event: IpcMainEvent): boolean {
  return Boolean(window && event.sender === window.webContents);
}

function stopOcr(): void {
  ocrGeneration += 1;
  if (ocrTimer) clearInterval(ocrTimer);
  ocrTimer = null;
  sendToToolbar("ocr-state", { running: false, status: "Stopped" });
}

async function scanSelectedFrame(generation: number): Promise<void> {
  if (
    generation !== ocrGeneration ||
    !gameView ||
    !frameAvailable ||
    !selectedRect ||
    ocrBusy ||
    !ocrWorker
  )
    return;
  const { x, y, width, height } = selectedRect;
  if (width <= 0 || height <= 0) return;
  ocrBusy = true;
  try {
    const image = await gameView.webContents.capturePage({ x, y, width, height });
    const result = await ocrWorker.recognize(image.toPNG());
    if (generation !== ocrGeneration) return;
    const text = result.data.text.trim();
    const normalized = text.toLocaleLowerCase();
    const matches = ocrConfig.keywords.filter((keyword) =>
      normalized.includes(keyword.toLocaleLowerCase()),
    );
    sendToToolbar("ocr-result", {
      text,
      confidence: Math.round(result.data.confidence),
      matches,
      timestamp: new Date().toISOString(),
    });
  } catch {
    stopOcr();
    sendToToolbar("ocr-state", {
      running: false,
      status: "OCR failed. Check the game surface and connection.",
    });
  } finally {
    ocrBusy = false;
  }
}

function createWindow(): void {
  gameWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 760,
    minHeight: 560,
    title: "Bit Heroes Surface Selector",
    backgroundColor: "#e9edf0",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  gameWindow.loadURL("about:blank");

  window = new BrowserWindow({
    parent: gameWindow,
    width: 1360,
    height: TOOLBAR_HEIGHT,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    title: "Bit Heroes Surface Selector Controls",
    webPreferences: {
      preload: path.join(__dirname, "preload-shell.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.setMinimumSize(760, COLLAPSED_TOOLBAR_HEIGHT);
  window.setMaximumSize(16384, TOOLBAR_HEIGHT);
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
  gameWindow.addBrowserView(gameView);
  setGameBounds();
  setToolbarBounds();
  gameView.webContents.loadURL(BIT_HEROES_PAGE);
  gameWindow.on("resize", () => {
    setGameBounds();
    setToolbarBounds();
  });
  gameWindow.on("move", setToolbarBounds);
  gameWindow.on("maximize", () => {
    setGameBounds();
    setToolbarBounds();
  });
  gameWindow.on("unmaximize", () => {
    setGameBounds();
    setToolbarBounds();
  });
  window.on("closed", () => {
    stopOcr();
    void ocrWorker?.terminate();
    ocrWorker = null;
    window = null;
    gameView = null;
    gameWindow = null;
  });
  gameWindow.on("closed", () => {
    if (window && !window.isDestroyed()) window.close();
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
        selectedRect = null;
        frameAvailable = false;
        stopOcr();
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
  if (gameView && event.sender === gameView.webContents) {
    const state = payload as {
      identified?: boolean;
      available?: boolean;
      rect?: { x: number; y: number; width: number; height: number } | null;
    };
    frameAvailable = Boolean(state?.identified && state?.available);
    if (!frameAvailable) {
      selectedRect = null;
      stopOcr();
    } else if (selectedRect && state.rect) selectedRect = state.rect;
    sendToToolbar("candidate-state", payload);
  }
});
ipcMain.on("hover-state", (event, payload: unknown) => {
  if (gameView && event.sender === gameView.webContents)
    sendToToolbar("hover-state", payload);
});
ipcMain.on("selection-confirmed", (event, payload: unknown) => {
  if (gameView && event.sender === gameView.webContents) {
    const state = payload as {
      selected?: boolean;
      rect?: { x: number; y: number; width: number; height: number };
    };
    selectedRect = state?.selected ? (state.rect ?? null) : null;
    if (!selectedRect) stopOcr();
    sendToToolbar("selection-confirmed", payload);
  }
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
  if (validateToolbarEvent(event)) {
    selectedRect = null;
    stopOcr();
    gameView?.webContents.send("reset-selection");
  }
});
ipcMain.on("toolbar-collapse", (event, collapsed: boolean) => {
  if (!validateToolbarEvent(event)) return;
  toolbarCollapsed = Boolean(collapsed);
  setToolbarBounds();
});
ipcMain.on("ocr-start", async (event, payload: unknown) => {
  if (!validateToolbarEvent(event) || !selectedRect || !frameAvailable) return;
  const config = payload as { intervalMs?: unknown; keywords?: unknown };
  const intervalMs = Number(config?.intervalMs);
  const keywords = Array.isArray(config?.keywords)
    ? config.keywords
        .filter((keyword): keyword is string => typeof keyword === "string")
        .map((keyword) => keyword.trim().slice(0, 40))
        .filter(Boolean)
        .slice(0, 20)
    : [];
  if (!Number.isFinite(intervalMs)) return;
  ocrConfig = {
    intervalMs: Math.min(10000, Math.max(1000, Math.round(intervalMs))),
    keywords,
  };
  stopOcr();
  const generation = ocrGeneration;
  try {
    ocrWorker ??= await Tesseract.createWorker("eng");
    if (
      generation !== ocrGeneration ||
      !selectedRect ||
      !frameAvailable
    ) return;
    sendToToolbar("ocr-state", { running: true, status: "Scanning" });
    void scanSelectedFrame(generation);
    ocrTimer = setInterval(
      () => void scanSelectedFrame(generation),
      ocrConfig.intervalMs,
    );
  } catch {
    sendToToolbar("ocr-state", {
      running: false,
      status: "OCR could not start. Check the connection for language data.",
    });
  }
});
ipcMain.on("ocr-stop", (event) => {
  if (validateToolbarEvent(event)) stopOcr();
});

app.whenReady().then(createWindow);
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
