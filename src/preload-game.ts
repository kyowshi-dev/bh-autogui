import { ipcRenderer } from "electron";
import {
  containsPoint,
  uniqueBitHeroesCandidate,
  type FrameCandidate,
  type Rect,
} from "./selection/candidate.js";

if (process.isMainFrame) {
  let selectionMode = false;
  let previewCandidate: FrameCandidate | null = null;
  let selectedCandidate: FrameCandidate | null = null;
  let highlight: HTMLDivElement | null = null;
  let candidates: FrameCandidate[] = [];

  const detailsForFrame = (frame: HTMLIFrameElement): FrameCandidate => {
    const ancestry: Element[] = [];
    let parent: Element | null = frame;
    for (
      let depth = 0;
      parent && depth < 5;
      depth += 1, parent = parent.parentElement
    )
      ancestry.push(parent);
    const gameId =
      ancestry
        .map((element) => element.getAttribute("data-game-id") ?? "")
        .find((value) => value !== "") ?? "";
    const slug = [
      frame.title,
      frame.getAttribute("aria-label") ?? "",
      ...ancestry.map(
        (element) =>
          `${element.id} ${element.className} ${element.getAttribute("data-game") ?? ""}`,
      ),
    ].join(" ");
    const { x, y, width, height } = frame.getBoundingClientRect();
    let host = "";
    try {
      host = new URL(frame.src).hostname;
    } catch {
      host = "";
    }
    return {
      src: frame.src,
      title: frame.title,
      gameId,
      slug,
      host,
      frameClass: frame.className,
      containerId: frame.parentElement?.id ?? "",
      rect: { x, y, width, height },
    };
  };

  const collectCandidates = (): FrameCandidate[] =>
    Array.from(document.querySelectorAll("iframe"), detailsForFrame);
  const getVerifiedCandidate = (): FrameCandidate | null => {
    const pageMatches =
      location.origin === "https://www.kongregate.com" &&
      /\/en\/games\/juppiomenz\/bit-heroes\/?$/.test(location.pathname);
    if (!pageMatches) return null;
    return uniqueBitHeroesCandidate(candidates, location.href);
  };
  const ensureHighlight = (): HTMLDivElement => {
    if (highlight) return highlight;
    highlight = document.createElement("div");
    highlight.setAttribute("aria-hidden", "true");
    Object.assign(highlight.style, {
      position: "fixed",
      zIndex: "2147483647",
      pointerEvents: "none",
      border: "3px solid #25c18a",
      background: "rgba(37, 193, 138, 0.12)",
      boxShadow: "0 0 0 9999px rgba(13, 24, 33, 0.14)",
      boxSizing: "border-box",
    });
    document.documentElement.append(highlight);
    return highlight;
  };
  const updateHighlight = (rect: Rect | null): void => {
    if (!selectionMode || !rect) {
      if (highlight) highlight.style.display = "none";
      return;
    }
    const overlay = ensureHighlight();
    Object.assign(overlay.style, {
      display: "block",
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  };
  const refresh = (): void => {
    candidates = collectCandidates();
    const target = getVerifiedCandidate();
    const available =
      target !== null && target.rect.width > 0 && target.rect.height > 0;
    ipcRenderer.send("candidate-state", {
      identified: target !== null,
      available,
      reason: target ? (available ? "visible" : "hidden") : "unverified",
      rect: target?.rect ?? null,
    });
    if (selectedCandidate) {
      const current = candidates.find(
        (candidate) => candidate.src === selectedCandidate?.src,
      );
      if (!current || !target) {
        selectedCandidate = null;
        ipcRenderer.send("selection-confirmed", {
          selected: false,
          reason: "target-changed",
        });
      } else selectedCandidate = current;
    }
    if (previewCandidate) {
      previewCandidate = target;
      updateHighlight(target?.rect ?? null);
    }
  };
  const preview = (point: { x: number; y: number }): void => {
    if (!selectionMode) return;
    const target = getVerifiedCandidate();
    const accepted = target !== null && containsPoint(target.rect, point);
    previewCandidate = accepted ? target : null;
    updateHighlight(accepted ? target.rect : null);
    ipcRenderer.send("hover-state", {
      accepted,
      reason: accepted
        ? "verified-game"
        : target
          ? "not-game-surface"
          : "game-unavailable",
      rect: accepted ? target?.rect : null,
    });
  };

  const observer = new MutationObserver((mutations) => {
    const pageChanged = mutations.some((mutation) => {
      if (mutation.target === highlight) return false;
      if (mutation.type !== "childList" || !highlight) return true;
      return [...mutation.addedNodes, ...mutation.removedNodes].some(
        (node) => node !== highlight,
      );
    });
    if (pageChanged) refresh();
  });
  document.addEventListener(
    "pointermove",
    (event) => preview({ x: event.clientX, y: event.clientY }),
    true,
  );
  document.addEventListener(
    "pointerover",
    (event) => {
      const target = event.target;
      if (target instanceof HTMLIFrameElement)
        preview({ x: event.clientX, y: event.clientY });
    },
    true,
  );
  window.addEventListener("scroll", refresh, true);
  window.addEventListener("resize", refresh);
  ipcRenderer.on("selection-mode", (_event, enabled: boolean) => {
    selectionMode = Boolean(enabled);
    previewCandidate = null;
    updateHighlight(null);
    ipcRenderer.send("hover-state", {
      accepted: false,
      reason: selectionMode ? "move-to-game" : "idle",
    });
  });
  ipcRenderer.on("confirm-selection", () => {
    const target = getVerifiedCandidate();
    if (!selectionMode || !target || previewCandidate?.src !== target.src)
      return;
    selectedCandidate = target;
    selectionMode = false;
    updateHighlight(null);
    ipcRenderer.send("selection-confirmed", {
      selected: true,
      rect: target.rect,
    });
    ipcRenderer.send("hover-state", { accepted: false, reason: "idle" });
  });
  ipcRenderer.on("reset-selection", () => {
    selectedCandidate = null;
    previewCandidate = null;
    updateHighlight(null);
    ipcRenderer.send("selection-confirmed", {
      selected: false,
      reason: "reset",
    });
  });
  const start = (): void => {
    if (!document.documentElement) return;
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "src",
        "title",
        "id",
        "class",
        "style",
        "data-game-id",
        "data-game",
      ],
    });
    refresh();
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}
