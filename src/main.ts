import {
  app,
  BrowserView,
  BrowserWindow,
  ipcMain,
  Notification,
  type IpcMainEvent,
} from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWorker, PSM, type Worker } from "tesseract.js";
import {
  decideAutomationAction,
  type ActivityMode,
} from "./automation/decision.js";
import { BIT_HEROES_PAGE } from "./selection/candidate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOLBAR_HEIGHT = 148;
const OCR_INTERVAL_MS = 1800;
const OCR_MIN_CONFIDENCE = 45;
let window: BrowserWindow | null = null;
let gameView: BrowserView | null = null;
let selectedFrame = false;
let frameAvailable = false;
let selectedFrameRect: {
  x: number;
  y: number;
  width: number;
  height: number;
} | null = null;
let automationMode: ActivityMode | null = null;
let automationTimer: NodeJS.Timeout | null = null;
let ocrWorker: Worker | null = null;
let automationBusy = false;
let automationRunId = 0;
let automationBusyRunId: number | null = null;

function sendAutomationStatus(state: string, detail: string): void {
  sendToToolbar("automation-status", { state, detail, mode: automationMode });
}

function stopAutomation(state: string, detail: string): void {
  const wasRunning = automationMode !== null;
  automationRunId += 1;
  if (automationTimer) clearInterval(automationTimer);
  automationTimer = null;
  automationMode = null;
  sendToToolbar("automation-status", { state, detail, mode: null });
  if (wasRunning && state !== "stopped") {
    try {
      new Notification({
        title: "Bit Heroes automation paused",
        body: detail,
      }).show();
    } catch {
      // The toolbar status remains available when desktop notifications are unavailable.
    }
  }
}

async function getOcrWorker(): Promise<Worker> {
  if (ocrWorker) return ocrWorker;
  const langPath = path.resolve(
    __dirname,
    "../node_modules/@tesseract.js-data/eng/4.0.0_best_int",
  );
  ocrWorker = await createWorker("eng", 1, {
    langPath,
    gzip: true,
    logger: () => undefined,
  });
  await ocrWorker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  return ocrWorker;
}

async function inspectVisibleFrame(runId: number): Promise<void> {
  if (
    runId !== automationRunId ||
    !automationMode ||
    automationBusy ||
    !gameView ||
    !selectedFrame ||
    !frameAvailable
  )
    return;
  automationBusy = true;
  automationBusyRunId = runId;
  const mode = automationMode;
  try {
    const viewBounds = gameView.getBounds();
    const rect = selectedFrameRect;
    if (
      !rect ||
      !rect.width ||
      !rect.height ||
      !viewBounds.width ||
      !viewBounds.height
    ) {
      stopAutomation("paused", "Game capture has no visible area");
      return;
    }
    const crop = {
      x: Math.max(0, Math.floor(rect.x)),
      y: Math.max(0, Math.floor(rect.y)),
      width: Math.min(
        Math.ceil(rect.width),
        viewBounds.width - Math.max(0, Math.floor(rect.x)),
      ),
      height: Math.min(
        Math.ceil(rect.height),
        viewBounds.height - Math.max(0, Math.floor(rect.y)),
      ),
    };
    if (crop.width <= 0 || crop.height <= 0) {
      stopAutomation(
        "paused",
        "Selected game frame is outside the visible window",
      );
      return;
    }
    const image = await gameView.webContents.capturePage(crop);
    const { width: imageWidth, height: imageHeight } = image.getSize();
    if (!imageWidth || !imageHeight) {
      stopAutomation("paused", "Game capture has no visible area");
      return;
    }
    const worker = await getOcrWorker();
    const result = await worker.recognize(image.toPNG());
    const words = (result.data.blocks ?? [])
      .flatMap((block) =>
        block.paragraphs.flatMap((paragraph) =>
          paragraph.lines.flatMap((line) => line.words),
        ),
      )
      .filter(
        (word) => word.confidence >= OCR_MIN_CONFIDENCE && word.text.trim(),
      )
      .map((word) => ({
        text: word.text,
        confidence: word.confidence,
        x: word.bbox.x0,
        y: word.bbox.y0,
        width: word.bbox.x1 - word.bbox.x0,
        height: word.bbox.y1 - word.bbox.y0,
      }));
    const decision = decideAutomationAction(
      mode,
      words,
      crop.width / imageWidth,
      crop.height / imageHeight,
    );
    if (runId !== automationRunId || !automationMode) return;
    if (decision.action === "stop") {
      const messages = {
        defeat: "Defeat detected. Automation stopped.",
        energy: "Energy appears depleted. Automation stopped.",
        purchase:
          "Purchase or premium-currency prompt detected. Automation stopped without clicking.",
        ambiguous:
          "Multiple possible controls detected. Automation stopped without clicking.",
        unknown:
          "Screen state is unclear. Automation stopped without clicking.",
      };
      stopAutomation(decision.reason, messages[decision.reason]);
      return;
    }
    if (decision.action === "click") {
      const x = Math.max(
        crop.x,
        Math.min(crop.x + crop.width - 1, crop.x + decision.x),
      );
      const y = Math.max(
        crop.y,
        Math.min(crop.y + crop.height - 1, crop.y + decision.y),
      );
      gameView.webContents.focus();
      gameView.webContents.sendInputEvent({ type: "mouseMove", x, y });
      gameView.webContents.sendInputEvent({
        type: "mouseDown",
        x,
        y,
        button: "left",
        clickCount: 1,
      });
      gameView.webContents.sendInputEvent({
        type: "mouseUp",
        x,
        y,
        button: "left",
        clickCount: 1,
      });
      sendAutomationStatus(
        "running",
        decision.label === "rerun" ? "Rerun selected" : "Chat bubble dismissed",
      );
    } else if (decision.reason === "battle") {
      sendAutomationStatus(
        "running",
        "Battle in progress; waiting for a result",
      );
    } else {
      sendAutomationStatus(
        "monitoring",
        "No verified action; waiting without clicking",
      );
    }
  } catch {
    if (runId === automationRunId)
      stopAutomation("error", "Visible-screen OCR failed. Automation stopped.");
  } finally {
    if (automationBusyRunId === runId) {
      automationBusy = false;
      automationBusyRunId = null;
    }
  }
}

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
        stopAutomation(
          "paused",
          "Page navigation detected; automation stopped",
        );
        selectedFrame = false;
        frameAvailable = false;
        selectedFrameRect = null;
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
      available?: boolean;
      rect?: { x: number; y: number; width: number; height: number } | null;
    };
    frameAvailable = Boolean(state.available);
    if (frameAvailable && state.rect) {
      selectedFrameRect = state.rect;
    } else if (!frameAvailable) {
      selectedFrameRect = null;
      if (automationMode)
        stopAutomation("paused", "Selected game surface is no longer visible");
    }
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
    selectedFrame = Boolean(state.selected);
    selectedFrameRect = state.selected
      ? (state.rect ?? selectedFrameRect)
      : null;
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
    selectedFrame = false;
    selectedFrameRect = null;
    stopAutomation("stopped", "Selection cleared");
    gameView?.webContents.send("reset-selection");
  }
});
ipcMain.on("automation-start", (event, mode: ActivityMode) => {
  if (!validateToolbarEvent(event)) return;
  if (!(["raid", "pvp", "expedition", "trial"] as string[]).includes(mode))
    return;
  if (!selectedFrame || !frameAvailable || !selectedFrameRect) {
    sendToToolbar("automation-status", {
      state: "error",
      detail: "Select a visible game surface before starting",
      mode: null,
    });
    return;
  }
  stopAutomation("stopped", "Previous run stopped");
  automationMode = mode;
  const runId = ++automationRunId;
  sendAutomationStatus("starting", `Monitoring ${mode} results`);
  automationTimer = setInterval(
    () => void inspectVisibleFrame(runId),
    OCR_INTERVAL_MS,
  );
  void inspectVisibleFrame(runId);
});
ipcMain.on("automation-stop", (event) => {
  if (!validateToolbarEvent(event)) return;
  stopAutomation("stopped", "Stopped by user");
});

app.whenReady().then(createWindow);
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  stopAutomation("stopped", "Application closing");
  void ocrWorker?.terminate();
  ocrWorker = null;
});
