// overlayLayout — where each translated block goes on the photo, and at what
// font size, so nothing is cut off at the photo's edge.
//
// Pure functions: no React, no native modules.

export interface BlockBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface Placed<T> {
  readonly block: T;
  /** Position and size in the displayed photo's own units (dp). */
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
}

const MAX_FONT = 16;
const MIN_FONT = 7;
const LINE = 1.25;
const GLYPH = 0.55; // average glyph width, in em (Devanagari and Latin alike)
const PAD_X = 6;
const PAD_Y = 2;
/** A block may grow downward to fit longer text, but never past this multiple. */
const MAX_GROW = 2.5;

/**
 * Which coordinate space the OCR boxes live in. `upright` is the photo's size
 * as seen (from the file header). The boxes can never legitimately extend past
 * the photo, so if they do, that size cannot be the space they were measured
 * in: try the other orientation, then a uniform multiple that contains them.
 */
export function chooseImageSpace(
  upright: { readonly w: number; readonly h: number },
  blocks: readonly BlockBox[],
): { readonly w: number; readonly h: number; readonly adjusted: boolean } {
  let maxR = 0;
  let maxB = 0;
  for (const b of blocks) {
    maxR = Math.max(maxR, b.left + b.width);
    maxB = Math.max(maxB, b.top + b.height);
  }
  const SLACK = 1.02;
  const fits = (w: number, h: number): boolean => maxR <= w * SLACK && maxB <= h * SLACK;
  if (fits(upright.w, upright.h)) return { ...upright, adjusted: false };
  if (fits(upright.h, upright.w)) return { w: upright.h, h: upright.w, adjusted: true };
  const k = Math.max(maxR / upright.w, maxB / upright.h);
  return { w: upright.w * k, h: upright.h * k, adjusted: true };
}

function linesNeeded(text: string, width: number, font: number): number {
  const perLine = Math.max(1, Math.floor(width / (font * GLYPH)));
  return Math.max(1, Math.ceil(text.length / perLine));
}

/**
 * Lay every translated block out on a photo box of boxW × boxH.
 * `sx` / `sy` convert photo pixels to the box's units. Each block stays inside
 * the photo, and may grow downward — into free space only — when the
 * translation is longer than the text it replaces (Hindi usually is).
 */
export function layoutOverlays<T extends BlockBox & { readonly translated: string }>(
  blocks: readonly T[],
  sx: number,
  sy: number,
  boxW: number,
  boxH: number,
): Placed<T>[] {
  const rects = blocks.map(b => {
    const left = Math.min(Math.max(0, b.left * sx), Math.max(0, boxW - 24));
    const top = Math.min(Math.max(0, b.top * sy), Math.max(0, boxH - 10));
    const width = Math.max(24, Math.min(b.width * sx, boxW - left));
    const height = Math.max(10, Math.min(b.height * sy, boxH - top));
    return { left, top, width, height };
  });

  return blocks.map((block, i) => {
    const r = rects[i];
    // Free room below: up to the next block that overlaps this one's columns.
    let limit = boxH;
    for (let j = 0; j < rects.length; j++) {
      if (j === i) continue;
      const o = rects[j];
      const overlapX = Math.min(r.left + r.width, o.left + o.width) - Math.max(r.left, o.left);
      if (overlapX > Math.min(r.width, o.width) * 0.2 && o.top >= r.top + r.height * 0.5) {
        limit = Math.min(limit, o.top - 1);
      }
    }
    const maxH = Math.max(r.height, Math.min(limit - r.top, r.height * MAX_GROW));

    let font = MIN_FONT;
    let height = r.height;
    for (let f = MAX_FONT; f >= MIN_FONT; f--) {
      const need = linesNeeded(block.translated, r.width - PAD_X, f) * f * LINE + PAD_Y;
      if (need <= maxH) {
        font = f;
        height = Math.max(r.height, need);
        break;
      }
      if (f === MIN_FONT) height = maxH;
    }
    return { block, left: r.left, top: r.top, width: r.width, height, fontSize: font };
  });
}
