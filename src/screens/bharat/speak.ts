import { nativeTTSService, type SpeakOutcome } from '../../services/tts/NativeTTSService';

/** Read `text` aloud in `lang` with the device voice, replacing anything playing. */
export async function speakText(text: string, lang: string): Promise<SpeakOutcome> {
  nativeTTSService.stop();
  return nativeTTSService.speakChunk(text, lang);
}

export function stopSpeaking(): void {
  nativeTTSService.stop();
}
