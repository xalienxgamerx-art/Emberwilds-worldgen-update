/**
 * The tamer sprite and its scarf coloring system.
 *
 * The hero art (public/player/hero.png) is a single front-facing pose whose
 * scarf is painted in perfectly neutral whites and grays — a signature nothing
 * else on the sprite shares (sleeves and trousers are warm beige, outlines are
 * black, hair is brown). That lets us dye the scarf at load time: neutral,
 * bright pixels below the face line are remapped onto the chosen scarf color
 * as one solid fill, so the scarf reads as a single piece of dyed cloth in
 * any palette.
 *
 * The hero art loads through the sprite background-removal system (spritebg.ts),
 * so its baked black background never reaches the screen.
 */

import { getCleanSprite, onCleanSpriteReady } from "./spritebg";

export const HERO_SRC = "/player/hero.png";
/** Width / height of the hero art. */
export const HERO_ASPECT = 930 / 1692;

/** Scarf pixels sit below the eyes; the face line guards the eye whites. */
const FACE_LINE = 0.22;
/** Luminance floor: scarf paint starts around 0.63, black outlines sit far below. */
const SCARF_LUM = 0.6;
/** Max channel spread for a "neutral" (r≈g≈b) pixel. */
const SCARF_NEUTRAL = 10;

export type Rgb = [number, number, number];

/** Parse #rgb / #rrggbb (the forms the scarf palette uses). */
export function parseHex(hex: string): Rgb {
  const h = hex.replace("#", "");
  const s = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminance 0..1 of a pixel color. */
export function lum(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Is this pixel part of the scarf? Scarf paint is neutral (r≈g≈b) and bright
 * (white squares plus gray weave), and sits below the face line — sleeves and
 * trousers are warm beige, outlines are black, eye whites sit above the line.
 */
export function isScarfPixel(r: number, g: number, b: number, a: number, nyFrac: number): boolean {
  if (a === 0) return false;
  if (nyFrac < FACE_LINE) return false;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx - mn <= SCARF_NEUTRAL && lum(r, g, b) >= SCARF_LUM;
}

/**
 * Solid dye: every scarf pixel takes the scarf color outright — the weave's
 * checker shading is flattened so the scarf reads as one piece of cloth.
 */
export function scarfShade(_l: number, scarf: Rgb): Rgb {
  return [...scarf];
}

// --- browser-side sprite building (never imported by tests) ---

const tamerCache = new Map<string, HTMLCanvasElement>();
const tamerListeners = new Set<() => void>();
let heroHooked = false;

const notify = (): void => tamerListeners.forEach((l) => l());

/** Route the hero through the background-removal system; repaint when it is ready. */
function ensureHeroHooked(): void {
  if (heroHooked) return;
  heroHooked = true;
  onCleanSpriteReady(notify);
  getCleanSprite(HERO_SRC);
}

function buildTamer(scarf: string): HTMLCanvasElement | null {
  const hero = getCleanSprite(HERO_SRC);
  if (!hero) return null;
  const cv = document.createElement("canvas");
  cv.width = hero.width;
  cv.height = hero.height;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(hero, 0, 0);
  const data = ctx.getImageData(0, 0, cv.width, cv.height);
  const px = data.data;
  const scarfRgb = parseHex(scarf);
  for (let y = 0; y < cv.height; y++) {
    const ny = y / cv.height;
    for (let x = 0; x < cv.width; x++) {
      const i = (y * cv.width + x) * 4;
      if (!isScarfPixel(px[i], px[i + 1], px[i + 2], px[i + 3], ny)) continue;
      const [nr, ng, nb] = scarfShade(lum(px[i], px[i + 1], px[i + 2]), scarfRgb);
      px[i] = nr;
      px[i + 1] = ng;
      px[i + 2] = nb;
    }
  }
  ctx.putImageData(data, 0, 0);
  return cv;
}

/** The tamer sprite with its scarf dyed, or null while the variant is still loading. */
export function getTamerSprite(scarf: string): HTMLCanvasElement | null {
  const hit = tamerCache.get(scarf);
  if (hit) {
    tamerCache.delete(scarf);
    tamerCache.set(scarf, hit); // LRU refresh
    return hit;
  }
  ensureHeroHooked();
  const cv = buildTamer(scarf);
  if (!cv) return null;
  tamerCache.set(scarf, cv);
  if (tamerCache.size > 5) tamerCache.delete(tamerCache.keys().next().value as string);
  return cv;
}

/** Subscribe to sprite readiness (hero loaded or a new scarf variant built). */
export function onTamerReady(l: () => void): () => void {
  tamerListeners.add(l);
  return () => {
    tamerListeners.delete(l);
  };
}
