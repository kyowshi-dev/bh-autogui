import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("selector", {
  setSelectionMode: (enabled: boolean) =>
    ipcRenderer.send("selection-mode", enabled),
  confirmSelection: () => ipcRenderer.send("confirm-selection"),
  resetSelection: () => ipcRenderer.send("reset-selection"),
  startAutomation: (mode: "raid" | "pvp" | "expedition" | "trial") =>
    ipcRenderer.send("automation-start", mode),
  stopAutomation: () => ipcRenderer.send("automation-stop"),
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
  onAutomationStatus: (listener: (payload: unknown) => void) =>
    ipcRenderer.on("automation-status", (_event, payload) => listener(payload)),
});

declare global {
  interface Window {
    selector: {
      setSelectionMode(enabled: boolean): void;
      confirmSelection(): void;
      resetSelection(): void;
      startAutomation(mode: "raid" | "pvp" | "expedition" | "trial"): void;
      stopAutomation(): void;
      onCandidateState(listener: (payload: unknown) => void): void;
      onHoverState(listener: (payload: unknown) => void): void;
      onSelectionConfirmed(listener: (payload: unknown) => void): void;
      onSelectionCleared(listener: (payload: unknown) => void): void;
      onPageStatus(listener: (payload: unknown) => void): void;
      onAutomationStatus(listener: (payload: unknown) => void): void;
    };
  }
}
