export type ActivityMode = "raid" | "pvp" | "expedition" | "trial";

export interface OcrWord {
  text: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AutomationDecision =
  | { action: "click"; x: number; y: number; label: string }
  | {
      action: "stop";
      reason: "defeat" | "energy" | "purchase" | "ambiguous" | "unknown";
    }
  | { action: "wait"; reason: "battle" };

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function wordsText(words: OcrWord[]): string {
  return normalize(
    words
      .filter((word) => word.confidence >= 45)
      .map((word) => word.text)
      .join(" "),
  );
}

function uniqueLabel(
  words: OcrWord[],
  labels: string[],
  confidence: number,
): OcrWord | null | "ambiguous" {
  const matches = words.filter(
    (word) =>
      word.confidence >= confidence && labels.includes(normalize(word.text)),
  );
  if (matches.length > 1) return "ambiguous";
  return matches[0] ?? null;
}

export function decideAutomationAction(
  mode: ActivityMode,
  words: OcrWord[],
  scaleX: number,
  scaleY: number,
): AutomationDecision {
  const text = wordsText(words);
  if (/\b(defeat|defeated|you lose|battle failed)\b/.test(text))
    return { action: "stop", reason: "defeat" };
  if (
    /\bnot enough\b/.test(text) ||
    /\benergy\s+(depleted|empty|exhausted)\b/.test(text)
  ) {
    return { action: "stop", reason: "energy" };
  }
  if (/\b(purchase|buy|premium|spend|kreds|gems)\b/.test(text)) {
    return { action: "stop", reason: "purchase" };
  }

  const close = uniqueLabel(words, ["close", "dismiss", "x"], 82);
  const chat = words.find(
    (word) =>
      word.confidence >= 55 && /\b(chat|message)\b/.test(normalize(word.text)),
  );
  if (close === "ambiguous") return { action: "stop", reason: "ambiguous" };
  if (close && chat && Math.hypot(close.x - chat.x, close.y - chat.y) < 420) {
    return {
      action: "click",
      x: Math.round((close.x + close.width / 2) * scaleX),
      y: Math.round((close.y + close.height / 2) * scaleY),
      label: "chat-close",
    };
  }

  const rerun = uniqueLabel(words, ["rerun", "re run", "retry"], 88);
  if (rerun === "ambiguous") return { action: "stop", reason: "ambiguous" };
  const modeLabel = mode === "pvp" ? "pvp" : mode;
  const modeVisible =
    text.includes(modeLabel) ||
    (mode === "trial" && text.includes("trials")) ||
    (mode === "expedition" && text.includes("expeditions"));
  if (rerun && modeVisible) {
    return {
      action: "click",
      x: Math.round((rerun.x + rerun.width / 2) * scaleX),
      y: Math.round((rerun.y + rerun.height / 2) * scaleY),
      label: "rerun",
    };
  }

  if (/\b(battle|combat|auto)\b/.test(text))
    return { action: "wait", reason: "battle" };
  return { action: "stop", reason: "unknown" };
}
