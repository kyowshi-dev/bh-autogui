import assert from "node:assert/strict";
import test from "node:test";
import {
  containsPoint,
  isBitHeroesCandidate,
  uniqueBitHeroesCandidate,
  type FrameCandidate,
} from "../selection/candidate.js";

const page = "https://www.kongregate.com/en/games/juppiomenz/bit-heroes";
const candidate: FrameCandidate = {
  src: "https://www.kongregate.com/games/juppiomenz/bit-heroes/embed",
  title: "Bit Heroes",
  gameId: "266462",
  slug: "bit-heroes",
  host: "www.kongregate.com",
  frameClass: "game-embed-iframe",
  containerId: "game",
  rect: { x: 20, y: 100, width: 800, height: 520 },
};

test("accepts a unique frame with the Bit Heroes route and game identity", () => {
  assert.equal(isBitHeroesCandidate(candidate, page), true);
  assert.deepEqual(uniqueBitHeroesCandidate([candidate], page), candidate);
});

test("requires explicit ID and slug evidence instead of trusting the game host alone", () => {
  assert.equal(
    isBitHeroesCandidate(
      {
        ...candidate,
        src: "https://www.kongregate.com/games/other-game/embed",
        gameId: "",
        slug: "embed",
      },
      page,
    ),
    false,
  );
  assert.equal(
    isBitHeroesCandidate(
      {
        ...candidate,
        src: "https://web.bitheroesgame.com/client",
        gameId: "",
        slug: "",
      },
      page,
    ),
    false,
  );
});

test("accepts the observed exact Kongregate embed route and parent markers without a title or data ID", () => {
  const liveFrame: FrameCandidate = {
    ...candidate,
    src: "https://www.kongregate.com/games/Juppiomenz/bit-heroes/embed",
    title: "",
    gameId: "",
    slug: "game-embed-iframe game",
  };
  assert.equal(isBitHeroesCandidate(liveFrame, page), true);
});

test("rejects the embed route if its parent markers do not match", () => {
  const unverifiedFrame = {
    ...candidate,
    src: "https://www.kongregate.com/games/Juppiomenz/bit-heroes/embed",
    title: "",
    gameId: "",
    slug: "game-embed-iframe",
    containerId: "other",
  };
  assert.equal(isBitHeroesCandidate(unverifiedFrame, page), false);
});

test("rejects unrelated frames and wrong pages", () => {
  assert.equal(
    isBitHeroesCandidate(
      { ...candidate, src: "https://ads.example/ad", title: "Bit Heroes" },
      page,
    ),
    false,
  );
  assert.equal(
    isBitHeroesCandidate(
      candidate,
      "https://www.kongregate.com/en/games/other/game",
    ),
    false,
  );
  assert.equal(
    isBitHeroesCandidate(
      {
        ...candidate,
        src: "https://www.kongregate.com/games/other-game/embed",
        gameId: "",
        title: "A similar game",
        slug: "",
      },
      page,
    ),
    false,
  );
});

test("fails closed when multiple verified frames exist", () => {
  assert.equal(
    uniqueBitHeroesCandidate(
      [candidate, { ...candidate, rect: { ...candidate.rect, x: 900 } }],
      page,
    ),
    null,
  );
});

test("point containment uses the frame rectangle and excludes empty bounds", () => {
  assert.equal(containsPoint(candidate.rect, { x: 20, y: 100 }), true);
  assert.equal(containsPoint(candidate.rect, { x: 900, y: 100 }), false);
  assert.equal(
    containsPoint({ x: 0, y: 0, width: 0, height: 0 }, { x: 0, y: 0 }),
    false,
  );
});
