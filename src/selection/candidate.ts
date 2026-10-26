export const BIT_HEROES_GAME_ID = "266462";
export const BIT_HEROES_SLUG = "bit-heroes";
export const BIT_HEROES_PAGE =
  "https://www.kongregate.com/en/games/juppiomenz/bit-heroes";

export interface FrameCandidate {
  src: string;
  title: string;
  gameId: string;
  slug: string;
  host: string;
  frameClass: string;
  containerId: string;
  rect: Rect;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function isBitHeroesCandidate(
  candidate: FrameCandidate,
  pageUrl: string,
): boolean {
  try {
    const page = new URL(pageUrl);
    const frame = new URL(candidate.src, page);
    const pageMatches =
      page.hostname === "www.kongregate.com" &&
      /\/games\/juppiomenz\/bit-heroes\/?$/.test(page.pathname);
    const frameHostMatches =
      frame.hostname === "web.bitheroesgame.com" ||
      frame.hostname === "www.kongregate.com";
    const gameIdMatches =
      candidate.gameId === BIT_HEROES_GAME_ID ||
      frame.searchParams.get("game_id") === BIT_HEROES_GAME_ID;
    const slugMatches =
      candidate.slug.toLowerCase().includes(BIT_HEROES_SLUG) ||
      candidate.title.toLowerCase().includes(BIT_HEROES_SLUG) ||
      frame.pathname.toLowerCase().includes(BIT_HEROES_SLUG) ||
      frame.searchParams.get("game") === BIT_HEROES_SLUG;
    const embedPath = frame.pathname.toLowerCase().replace(/\/$/, "");
    const verifiedKongregateEmbed =
      frame.hostname === "www.kongregate.com" &&
      embedPath === "/games/juppiomenz/bit-heroes/embed" &&
      candidate.frameClass.split(/\s+/).includes("game-embed-iframe") &&
      candidate.containerId === "game";

    return (
      pageMatches &&
      frameHostMatches &&
      (verifiedKongregateEmbed || (gameIdMatches && slugMatches))
    );
  } catch {
    return false;
  }
}

export function uniqueBitHeroesCandidate(
  candidates: FrameCandidate[],
  pageUrl: string,
): FrameCandidate | null {
  const matches = candidates.filter((candidate) =>
    isBitHeroesCandidate(candidate, pageUrl),
  );
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

export function containsPoint(
  rect: Rect,
  point: { x: number; y: number },
): boolean {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x <= rect.x + rect.width &&
    point.y <= rect.y + rect.height
  );
}
