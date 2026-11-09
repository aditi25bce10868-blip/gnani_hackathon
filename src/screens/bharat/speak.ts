import { BHARAT_API } from '../../services/bharat/config';
import { SERVER_TTS_LANGS, synthesize } from '../../services/bharat/serverVoice';
import { log } from '../../services/log/logStore';
import { playWav, stopWav } from '../../services/native/bharatSystem';
import { nativeTTSService, type SpeakOutcome } from '../../services/tts/NativeTTSService';

// Bumped by every new request and by stopSpeaking(), so a slow download of
// audio can never start playing after the user already moved on.
let token = 0;

/**
 * Read `text` aloud in `lang`, replacing anything playing.
 * Gnani voice (through the server) where it has one; the phone's own voice for
 * other languages, or whenever the server voice fails (no credits, offline).
 */
export async function speakText(text: string, lang: string): Promise<SpeakOutcome> {
  const mine = ++token;
  nativeTTSService.stop();
  stopWav();

  if (BHARAT_API.baseUrl !== '' && BHARAT_API.serverTts && SERVER_TTS_LANGS.has(lang)) {
    try {
      const t0 = Date.now();
      const wav = await synthesize(BHARAT_API, text, lang);
      log.info(`[speak] voice ready in ${Date.now() - t0} ms (${lang}, ${text.length} chars)`);
      if (mine !== token) return 'spoken';
      await playWav(wav);
      return 'spoken';
    } catch (e) {
      if (mine !== token) return 'spoken';
      log.warn(`[speak] server voice failed, using phone voice: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (mine !== token) return 'spoken';
  // Phones have no "Hinglish" voice; an Indian-English one reads Roman-script Hindi best.
  return nativeTTSService.speakChunk(text, lang === 'hi-hinglish' ? 'en-IN' : lang);
}

export function stopSpeaking(): void {
  token += 1;
  stopWav();
  nativeTTSService.stop();
}
