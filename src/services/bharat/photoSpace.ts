// photoSpace — the size (and rotation) of the photo file, for the Camera overlay.

import * as RNFS from '@dr.pogodin/react-native-fs';
import { base64ToBytes, parseJpeg, uprightSize } from './jpegInfo';
import { chooseImageSpace, type BlockBox } from './overlayLayout';

/** EXIF and the frame header sit at the start; this is far more than needed. */
const HEADER_BYTES = 256 * 1024;

export interface PhotoSpace {
  /** The space the text boxes are measured in (use to scale them). */
  readonly w: number;
  readonly h: number;
  /** The photo's true shape as displayed (use for its aspect ratio). */
  readonly imageW: number;
  readonly imageH: number;
  /** One line for the log: what was read and whether the boxes forced a correction. */
  readonly note: string;
}

export type ReadHeader = (path: string, bytes: number) => Promise<string>;

const defaultRead: ReadHeader = (path, bytes) => RNFS.read(path, bytes, 0, 'base64');

/**
 * The coordinate space of `blocks` on this photo, or null when the file is not
 * a JPEG we can read (the caller then falls back to what the image reports).
 */
export async function photoSpace(
  uri: string,
  blocks: readonly BlockBox[],
  read: ReadHeader = defaultRead,
): Promise<PhotoSpace | null> {
  const path = uri.replace(/^file:\/\//, '');
  const info = parseJpeg(base64ToBytes(await read(path, HEADER_BYTES)));
  if (!info) return null;
  const upright = uprightSize(info);
  const space = chooseImageSpace(upright, blocks);
  return {
    w: space.w,
    h: space.h,
    imageW: upright.w,
    imageH: upright.h,
    note:
      `photo file ${info.width}x${info.height} exif=${info.orientation} → ${upright.w}x${upright.h} upright` +
      (space.adjusted ? ` · boxes did not fit, using ${Math.round(space.w)}x${Math.round(space.h)}` : ''),
  };
}
