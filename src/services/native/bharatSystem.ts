// Bridge to the small Android module (BharatSystemModule.kt) that gives the
// Translate tab its "translate text written anywhere" reach:
//   • text shared to the app from any other app (Share → BharatConnect),
//   • text selected in any app (selection menu → BharatConnect),
//   • the clipboard, for the "translate copied text" chip.
// Everything degrades to a no-op when the module is absent (Jest, iOS).

import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

interface BharatSystemNative {
  getInitialSharedText(): Promise<string | null>;
  getClipboardText(): Promise<string | null>;
  setClipboardText(text: string): Promise<boolean>;
}

const SHARED_TEXT_EVENT = 'BharatSharedText';

const native: BharatSystemNative | undefined =
  Platform.OS === 'android' ? NativeModules.BharatSystem : undefined;

/** Text the app was launched with (share / text-selection), consumed once. */
export async function getInitialSharedText(): Promise<string | null> {
  if (!native) return null;
  try {
    return (await native.getInitialSharedText()) ?? null;
  } catch {
    return null;
  }
}

export async function readClipboard(): Promise<string> {
  if (!native) return '';
  try {
    return (await native.getClipboardText()) ?? '';
  } catch {
    return '';
  }
}

export async function writeClipboard(text: string): Promise<boolean> {
  if (!native) return false;
  try {
    return await native.setClipboardText(text);
  } catch {
    return false;
  }
}

/** Text arriving while the app is already running. Returns an unsubscribe. */
export function onSharedText(handler: (text: string) => void): () => void {
  if (!native) return () => {};
  const emitter = new NativeEventEmitter(NativeModules.BharatSystem);
  const sub = emitter.addListener(SHARED_TEXT_EVENT, (text: string) => handler(text));
  return () => sub.remove();
}
