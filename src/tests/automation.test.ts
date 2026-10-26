import assert from "node:assert/strict";
import test from "node:test";
import {
  decideAutomationAction,
  type OcrWord,
} from "../automation/decision.js";

const word = (text: string, x = 10): OcrWord => ({
  text,
  confidence: 95,
  x,
  y: 20,
  width: 60,
  height: 20,
});

test("clicks a unique rerun only when activity or success context is visible", () => {
  assert.deepEqual(
    decideAutomationAction("raid", [word("Raid"), word("Rerun", 100)], 2, 2),
    { action: "click", x: 260, y: 60, label: "rerun" },
  );
  assert.deepEqual(decideAutomationAction("raid", [word("Rerun")], 1, 1), {
    action: "stop",
    reason: "unknown",
  });
});

test("stops on failure, energy depletion, and purchase language before considering clicks", () => {
  assert.deepEqual(
    decideAutomationAction("trial", [word("Defeat"), word("Rerun")], 1, 1),
    { action: "stop", reason: "defeat" },
  );
  assert.deepEqual(
    decideAutomationAction(
      "raid",
      [word("Not"), word("enough"), word("energy")],
      1,
      1,
    ),
    { action: "stop", reason: "energy" },
  );
  assert.deepEqual(
    decideAutomationAction("pvp", [word("Purchase"), word("Rerun")], 1, 1),
    { action: "stop", reason: "purchase" },
  );
  assert.deepEqual(
    decideAutomationAction("raid", [word("Buy"), word("Rerun")], 1, 1),
    { action: "stop", reason: "purchase" },
  );
});

test("only dismisses a nearby chat close label and halts ambiguous labels", () => {
  assert.deepEqual(
    decideAutomationAction(
      "expedition",
      [word("Chat", 20), word("Close", 40)],
      1,
      1,
    ),
    { action: "click", x: 70, y: 30, label: "chat-close" },
  );
  assert.deepEqual(
    decideAutomationAction("expedition", [word("Close", 20)], 1, 1),
    { action: "stop", reason: "unknown" },
  );
  assert.deepEqual(
    decideAutomationAction(
      "raid",
      [word("Rerun", 10), word("Rerun", 200), word("Raid")],
      1,
      1,
    ),
    { action: "stop", reason: "ambiguous" },
  );
});
