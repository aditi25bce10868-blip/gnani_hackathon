// jpegInfo — the true pixel size and rotation of a photo, read from the JPEG
// file itself (its first few KB), so the Camera overlay does not depend on what
// the image component reports.
//
// Why: the text boxes ML Kit returns are in pixels of the UPRIGHT image (EXIF
// rotation applied). If the size used to scale them is off — we measured exactly
// 2× on a device — every translated box lands in the wrong place and size.
// The file header cannot be off.

export interface JpegInfo {
  /** Stored size, before any rotation. */
  readonly width: number;
  readonly height: number;
  /** EXIF orientation 1–8 (1 = as stored). */
  readonly orientation: number;
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX: Record<string, number> = {};
for (let i = 0; i < BASE64.length; i++) B64_INDEX[BASE64[i]] = i;

/** Base64 → bytes. Ignores padding, whitespace and anything not in the alphabet. */
export function base64ToBytes(b64: string): Uint8Array {
  const out = new Uint8Array(Math.floor((b64.length * 3) / 4));
  let bits = 0;
  let acc = 0;
  let n = 0;
  for (let i = 0; i < b64.length; i++) {
    const v = B64_INDEX[b64[i]];
    if (v === undefined) continue;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[n++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, n);
}

function readOrientation(b: Uint8Array, tiff: number, end: number): number | null {
  if (tiff + 8 > end) return null;
  const little = b[tiff] === 0x49 && b[tiff + 1] === 0x49;
  const big = b[tiff] === 0x4d && b[tiff + 1] === 0x4d;
  if (!little && !big) return null;
  const u16 = (o: number): number => (little ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const u32 = (o: number): number =>
    little
      ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
      : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  if (u16(tiff + 2) !== 42) return null;
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > end) return null;
  const count = u16(ifd);
  for (let k = 0; k < count; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > end) return null;
    if (u16(e) === 0x0112) {
      const v = u16(e + 8);
      return v >= 1 && v <= 8 ? v : null;
    }
  }
  return null;
}

/** Reads size and orientation from the start of a JPEG, or null if it is not one. */
export function parseJpeg(b: Uint8Array): JpegInfo | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let orientation = 1;
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const m = b[i + 1];
    if (m === 0xff) {
      i++; // fill byte
      continue;
    }
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
      i += 2; // markers with no length
      continue;
    }
    if (m === 0xd9 || m === 0xda) break; // end of image / start of scan: no size found
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2) return null;
    const seg = i + 4;
    const end = Math.min(i + 2 + len, b.length);
    // "Exif\0\0" then the TIFF block.
    if (m === 0xe1 && b[seg] === 0x45 && b[seg + 1] === 0x78 && b[seg + 2] === 0x69 && b[seg + 3] === 0x66) {
      orientation = readOrientation(b, seg + 6, end) ?? orientation;
    }
    // Start-of-frame markers carry the size (C4, C8 and CC are not frames).
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      if (seg + 5 > b.length) return null;
      const height = (b[seg + 1] << 8) | b[seg + 2];
      const width = (b[seg + 3] << 8) | b[seg + 4];
      return width > 0 && height > 0 ? { width, height, orientation } : null;
    }
    i = i + 2 + len;
  }
  return null;
}

/** Size as the photo is seen: width and height swap for orientations 5–8. */
export function uprightSize(info: JpegInfo): { readonly w: number; readonly h: number } {
  return info.orientation >= 5 ? { w: info.height, h: info.width } : { w: info.width, h: info.height };
}
