import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("selector", {
  setSelectionMode: (enabled: boolean) =>
    ipcRenderer.send("selection-mode", enabled),
  confirmSelection: () => ipcRenderer.send("confirm-selection"),
  resetSelection: () => ipcRenderer.send("reset-selection"),
  setToolbarCollapsed: (collapsed: boolean) =>
    ipcRenderer.send("toolbar-collapse", collapsed),
  startOcr: (config: { intervalMs: number; keywords: string[] }) =>
    ipcRenderer.send("ocr-start", config),
  stopOcr: () => ipcRenderer.send("ocr-stop"),
  onCandidateState: (listener: (payload: unknown) => void) =>
    ipcRenderer.on("candidate-state", (_event, payload) => listener(payload)),
  onHoverState: (listener: (payload: unknown) => void) =>
    ipcRenderer.on("hover-state", (_event, payload) => listener(payload)),
  onSelectionConfirmed: (listener: (payload: unknown) => void) =>
    ipcRenderer.on("selection-confirmed", (_event, payload) =>
      listener(payload),
    ),
  onSelectionCleared: (listener: (payload: unknown) => void) =>
    ipcRenderer.on("selection-cleared", (_event, payload) => listener(payload)),
  onPageStatus: (listener: (payload: unknown) => void) =>
    ipcRenderer.on("page-status", (_event, payload) => listener(payload)),
  onOcrState: (listener: (payload: unknown) => void) =>
    ipcRenderer.on("ocr-state", (_event, payload) => listener(payload)),
  onOcrResult: (listener: (payload: unknown) => void) =>
    ipcRenderer.on("ocr-result", (_event, payload) => listener(payload)),
});

declare global {
  interface Window {
    selector: {
      setSelectionMode(enabled: boolean): void;
      confirmSelection(): void;
      resetSelection(): void;
      setToolbarCollapsed(collapsed: boolean): void;
      startOcr(config: { intervalMs: number; keywords: string[] }): void;
      stopOcr(): void;
      onCandidateState(listener: (payload: unknown) => void): void;
      onHoverState(listener: (payload: unknown) => void): void;
      onSelectionConfirmed(listener: (payload: unknown) => void): void;
      onSelectionCleared(listener: (payload: unknown) => void): void;
      onPageStatus(listener: (payload: unknown) => void): void;
      onOcrState(listener: (payload: unknown) => void): void;
      onOcrResult(listener: (payload: unknown) => void): void;
    };
  }
}
