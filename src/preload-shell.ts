import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("selector", {
  setSelectionMode: (enabled: boolean) =>
    ipcRenderer.send("selection-mode", enabled),
  confirmSelection: () => ipcRenderer.send("confirm-selection"),
  resetSelection: () => ipcRenderer.send("reset-selection"),
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
});

declare global {
  interface Window {
    selector: {
      setSelectionMode(enabled: boolean): void;
      confirmSelection(): void;
      resetSelection(): void;
      onCandidateState(listener: (payload: unknown) => void): void;
      onHoverState(listener: (payload: unknown) => void): void;
      onSelectionConfirmed(listener: (payload: unknown) => void): void;
      onSelectionCleared(listener: (payload: unknown) => void): void;
      onPageStatus(listener: (payload: unknown) => void): void;
    };
  }
}
