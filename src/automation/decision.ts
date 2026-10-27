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
      reason: "defeat" | "resources" | "purchase" | "ambiguous" | "unknown";
    }
  | { action: "wait"; reason: "battle" | "cleared" };

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

export function hasGreenRerunButton(
  words: OcrWord[],
  bitmap: Uint8Array,
  imageWidth: number,
  imageHeight: number,
): boolean {
  const rerun = uniqueLabel(words, ["rerun", "re run", "retry"], 45);
  if (!rerun || rerun === "ambiguous") return false;

  const left = Math.max(0, Math.floor(rerun.x - rerun.width * 1.2));
  const right = Math.min(imageWidth, Math.ceil(rerun.x + rerun.width * 2.2));
  const top = Math.max(0, Math.floor(rerun.y - rerun.height * 1.1));
  const bottom = Math.min(imageHeight, Math.ceil(rerun.y + rerun.height * 2.1));
  let sampled = 0;
  let green = 0;

  for (let y = top; y < bottom; y += 3) {
    for (let x = left; x < right; x += 3) {
      const offset = (y * imageWidth + x) * 4;
      const blue = bitmap[offset] ?? 0;
      const greenChannel = bitmap[offset + 1] ?? 0;
      const red = bitmap[offset + 2] ?? 0;
      const alpha = bitmap[offset + 3] ?? 0;
      if (alpha < 200) continue;
      sampled += 1;
      if (
        greenChannel >= 90 &&
        greenChannel > red * 1.25 &&
        greenChannel > blue * 1.15
      ) {
        green += 1;
      }
    }
  }

  return sampled > 0 && green / sampled >= 0.12;
}

export function decideAutomationAction(
  words: OcrWord[],
  scaleX: number,
  scaleY: number,
  rerunIsGreen = false,
  rerunPending = false,
): AutomationDecision {
  const text = wordsText(words);
  if (/\b(defeat|defeated|death|died|dead|you lose|battle failed)\b/.test(text))
    return { action: "stop", reason: "defeat" };
  if (
    /\b(not enough|insufficient)\b/.test(text) ||
    /\b(energy|shards?|seals?|xeals?|badges?|tokens?)\s+(depleted|empty|exhausted)\b/.test(
      text,
    )
  ) {
    return { action: "stop", reason: "resources" };
  }
  if (/\b(purchase|buy|premium|spend|kreds|gems)\b/.test(text)) {
    return { action: "stop", reason: "purchase" };
  }

  const cleared = /\bcleared\b/.test(text);
  const rerun = uniqueLabel(words, ["rerun", "re run", "retry"], 45);
  if (cleared && rerunPending) return { action: "wait", reason: "cleared" };
  if (rerun === "ambiguous") return { action: "stop", reason: "ambiguous" };
  if (rerun && rerunIsGreen) {
    return {
      action: "click",
      x: Math.round((rerun.x + rerun.width / 2) * scaleX),
      y: Math.round((rerun.y + rerun.height / 2) * scaleY),
      label: "rerun",
    };
  }
  if (cleared) return { action: "wait", reason: "cleared" };
  if (rerun) return { action: "wait", reason: "cleared" };

  if (/\b(battle|combat|auto)\b/.test(text))
    return { action: "wait", reason: "battle" };
  return { action: "stop", reason: "unknown" };
}
