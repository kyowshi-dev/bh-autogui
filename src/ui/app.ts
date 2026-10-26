type CandidateState = {
  identified: boolean;
  available: boolean;
  reason: string;
  rect: Rect | null;
};
type HoverState = { accepted: boolean; reason: string };
type SelectionState = { selected: boolean; reason?: string };
type AutomationStatus = { state: string; detail: string; mode: string | null };
type Rect = { x: number; y: number; width: number; height: number };

const selectButton =
  document.querySelector<HTMLButtonElement>("#select-button")!;
const confirmButton =
  document.querySelector<HTMLButtonElement>("#confirm-button")!;
const resetButton = document.querySelector<HTMLButtonElement>("#reset-button")!;
const statusIndicator =
  document.querySelector<HTMLElement>("#status-indicator")!;
const statusLabel = document.querySelector<HTMLElement>("#status-label")!;
const statusDetail = document.querySelector<HTMLElement>("#status-detail")!;
const activityMode =
  document.querySelector<HTMLSelectElement>("#activity-mode")!;
const automationStart =
  document.querySelector<HTMLButtonElement>("#automation-start")!;
const automationStop =
  document.querySelector<HTMLButtonElement>("#automation-stop")!;
const automationDetail =
  document.querySelector<HTMLElement>("#automation-detail")!;

let gameAvailable = false;
let frameIdentified = false;
let selecting = false;
let previewing = false;
let selected = false;
let automationRunning = false;
let automationMessage = "";

function setStatus(state: string, label: string, detail: string): void {
  statusIndicator.dataset.state = state;
  statusLabel.textContent = label;
  statusDetail.textContent = detail;
}

function render(): void {
  selectButton.setAttribute("aria-pressed", String(selecting));
  selectButton.textContent = selecting ? "Cancel selection" : "Select surface";
  confirmButton.disabled = !(selecting && previewing);
  automationStart.disabled = !selected || !gameAvailable || automationRunning;
  automationStop.disabled = !automationRunning;
  automationDetail.textContent = automationMessage;
  if (automationRunning) {
    setStatus(
      "preview",
      "Automation active",
      automationMessage || `Monitoring ${activityMode.value}`,
    );
    return;
  }
  if (selected)
    setStatus(
      "ready",
      "Game surface selected",
      "Selection is for this session",
    );
  else if (!frameIdentified)
    setStatus(
      "error",
      "Game surface unavailable",
      "Waiting for a uniquely identified Bit Heroes frame",
    );
  else if (!gameAvailable)
    setStatus(
      "loading",
      "Bit Heroes frame identified",
      "Start the game to make its surface selectable",
    );
  else if (selecting && previewing)
    setStatus(
      "preview",
      "Verified game surface",
      "Confirm to select this frame",
    );
  else if (selecting)
    setStatus(
      "ready",
      "Selection mode active",
      "Hover over the verified game frame",
    );
  else setStatus("ready", "Bit Heroes frame verified", "Selection is idle");
}

selectButton.addEventListener("click", () => {
  if (!gameAvailable) return;
  selecting = !selecting;
  previewing = false;
  window.selector.setSelectionMode(selecting);
  render();
});

confirmButton.addEventListener("click", () => {
  if (selecting && previewing) window.selector.confirmSelection();
});

resetButton.addEventListener("click", () => {
  window.selector.resetSelection();
  selected = false;
  selecting = false;
  previewing = false;
  window.selector.setSelectionMode(false);
  render();
});

automationStart.addEventListener("click", () => {
  window.selector.startAutomation(
    activityMode.value as "raid" | "pvp" | "expedition" | "trial",
  );
});

automationStop.addEventListener("click", () =>
  window.selector.stopAutomation(),
);

window.selector.onCandidateState((payload) => {
  const state = payload as CandidateState;
  gameAvailable = Boolean(state?.available);
  frameIdentified = Boolean(state?.identified);
  if (!gameAvailable) previewing = false;
  render();
});

window.selector.onHoverState((payload) => {
  const state = payload as HoverState;
  previewing = Boolean(state?.accepted);
  if (selecting && !previewing) {
    const message =
      state?.reason === "game-unavailable"
        ? "No uniquely verified game frame"
        : "That is not the verified game surface";
    setStatus("error", "Selection rejected", message);
  } else render();
});

window.selector.onSelectionConfirmed((payload) => {
  const state = payload as SelectionState;
  selected = Boolean(state?.selected);
  selecting = false;
  previewing = false;
  render();
});

window.selector.onSelectionCleared(() => {
  selected = false;
  selecting = false;
  previewing = false;
  render();
});

window.selector.onPageStatus((payload) => {
  const state = payload as { status?: string };
  if (state?.status === "loading")
    setStatus("loading", "Opening Kongregate…", "Inspecting the game frame");
  if (state?.status === "error")
    setStatus(
      "error",
      "Page could not be loaded",
      "Check your connection and reload the app",
    );
});

window.selector.onAutomationStatus((payload) => {
  const state = payload as AutomationStatus;
  automationRunning = ["starting", "running", "monitoring"].includes(
    state?.state ?? "",
  );
  automationMessage = state?.detail ?? "";
  if (
    state?.state === "defeat" ||
    state?.state === "energy" ||
    state?.state === "purchase" ||
    state?.state === "ambiguous" ||
    state?.state === "unknown" ||
    state?.state === "error" ||
    state?.state === "paused"
  ) {
    automationRunning = false;
    setStatus("error", "Automation paused", automationMessage);
  } else render();
});

render();
