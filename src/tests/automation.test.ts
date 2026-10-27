import assert from "node:assert/strict";
import test from "node:test";
import {
  decideAutomationAction,
  hasGreenRerunButton,
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

test("clicks a unique green rerun even when the cleared banner is missed", () => {
  assert.deepEqual(
    decideAutomationAction([word("Cleared"), word("Rerun", 100)], 2, 2, true),
    { action: "click", x: 260, y: 60, label: "rerun" },
  );
  assert.deepEqual(
    decideAutomationAction([word("Cleared"), word("Rerun")], 1, 1),
    { action: "wait", reason: "cleared" },
  );
  assert.deepEqual(decideAutomationAction([word("Rerun", 100)], 2, 2, true), {
    action: "click",
    x: 260,
    y: 60,
    label: "rerun",
  });
  assert.deepEqual(
    decideAutomationAction([word("Cleared"), word("Rerun")], 1, 1, true, true),
    { action: "wait", reason: "cleared" },
  );
  assert.deepEqual(decideAutomationAction([word("Rerun")], 1, 1), {
    action: "wait",
    reason: "cleared",
  });
});

test("detects a green background around the visible rerun label", () => {
  const width = 200;
  const height = 100;
  const bitmap = new Uint8Array(width * height * 4);
  for (let offset = 3; offset < bitmap.length; offset += 4)
    bitmap[offset] = 255;
  for (let y = 20; y < 80; y++) {
    for (let x = 20; x < 180; x++) {
      const offset = (y * width + x) * 4;
      bitmap[offset] = 30;
      bitmap[offset + 1] = 190;
      bitmap[offset + 2] = 40;
    }
  }
  assert.equal(
    hasGreenRerunButton([word("Rerun", 80)], bitmap, width, height),
    true,
  );
  assert.equal(
    hasGreenRerunButton(
      [word("Rerun", 80)],
      new Uint8Array(width * height * 4),
      width,
      height,
    ),
    false,
  );
});

test("stops on defeat, depleted resources, and purchase language before clicking", () => {
  assert.deepEqual(
    decideAutomationAction([word("Defeat"), word("Rerun")], 1, 1),
    { action: "stop", reason: "defeat" },
  );
  for (const resource of [
    "energy",
    "raid shards",
    "boss xeals",
    "badges",
    "token",
  ]) {
    const shortage = [
      word("Not"),
      word("enough"),
      ...resource.split(" ").map((part) => word(part)),
    ];
    assert.deepEqual(decideAutomationAction(shortage, 1, 1), {
      action: "stop",
      reason: "resources",
    });
  }
  assert.deepEqual(
    decideAutomationAction(
      [word("Boss"), word("Xeals"), word("depleted")],
      1,
      1,
    ),
    { action: "stop", reason: "resources" },
  );
  assert.deepEqual(
    decideAutomationAction([word("Player"), word("died")], 1, 1),
    {
      action: "stop",
      reason: "defeat",
    },
  );
  assert.deepEqual(
    decideAutomationAction([word("Purchase"), word("Rerun")], 1, 1),
    { action: "stop", reason: "purchase" },
  );
  assert.deepEqual(decideAutomationAction([word("Buy"), word("Rerun")], 1, 1), {
    action: "stop",
    reason: "purchase",
  });
});

test("does not click unrelated controls and halts ambiguous rerun labels", () => {
  assert.deepEqual(
    decideAutomationAction([word("Chat", 20), word("Close", 40)], 1, 1),
    { action: "stop", reason: "unknown" },
  );
  assert.deepEqual(
    decideAutomationAction(
      [word("Cleared"), word("Rerun", 10), word("Rerun", 200)],
      1,
      1,
    ),
    { action: "stop", reason: "ambiguous" },
  );
});
