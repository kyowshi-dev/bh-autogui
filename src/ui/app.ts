type CandidateState = {
  identified: boolean;
  available: boolean;
  reason: string;
  rect: Rect | null;
};
type HoverState = { accepted: boolean; reason: string };
type SelectionState = { selected: boolean; reason?: string };
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

let gameAvailable = false;
let frameIdentified = false;
let selecting = false;
let previewing = false;
let selected = false;

function setStatus(state: string, label: string, detail: string): void {
  statusIndicator.dataset.state = state;
  statusLabel.textContent = label;
  statusDetail.textContent = detail;
}

function render(): void {
  selectButton.setAttribute("aria-pressed", String(selecting));
  selectButton.textContent = selecting ? "Cancel selection" : "Select surface";
  confirmButton.disabled = !(selecting && previewing);
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

render();
