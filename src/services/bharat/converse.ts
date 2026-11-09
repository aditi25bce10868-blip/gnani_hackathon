// The Converse tab's real engine: wires ServerConverse to the phone (microphone,
// files, voice) and to the BharatConnect server. Created on first use.

import * as RNFS from '@dr.pogodin/react-native-fs';
import { audioCaptureService } from '../audio/AudioCaptureService';
import { SileroVadService } from '../vad/SileroVadService';
import { log } from '../log/logStore';
import { speakText, stopSpeaking } from '../../screens/bharat/speak';
import { useConversationStore } from '../../store/conversationStore';
import { useSettingsStore } from '../../store/settingsStore';
import { BHARAT_API } from './config';
import { translateProvider } from './providers';
import { ServerConverse } from './ServerConverse';
import { ServerHandsFree } from './ServerHandsFree';
import { transcribe, transcribeDetailed } from './serverVoice';

/** Converse runs on the server once config.ts points at it; until then it keeps
 *  Parly's own (Mistral) pipeline. */
export const CONVERSE_ON_SERVER = BHARAT_API.baseUrl !== '';

let instance: ServerConverse | null = null;

export function getServerConverse(): ServerConverse {
  if (!instance) {
    instance = new ServerConverse({
      capture: audioCaptureService,
      readBase64: path => RNFS.readFile(path, 'base64'),
      transcribe: (wav, lang, opts) => transcribe(BHARAT_API, wav, lang, undefined, opts),
      translate: req => translateProvider.translate(req),
      speak: speakText,
      stopSpeaking,
      store: useConversationStore,
      mixedSpeech: () => useSettingsStore.getState().mixedSpeech,
      log,
    });
  }
  return instance;
}

/** Silence the VAD must hear after speech before the utterance is sent. There is
 *  no live transcript to double-check against (Gnani takes the finished
 *  recording), so this is just the cost of a breath: long enough not to cut a
 *  sentence in two, short enough to feel answered. This is the largest fixed
 *  delay in hands-free. 400 ms (was 600): if sentences start getting split at
 *  a pause, raise it in 50 ms steps; if it still feels slow, try 300. */
const HF_SILENCE_HANGOVER_MS = 400;

let handsFree: ServerHandsFree | null = null;

/** The Hands-free tab's engine on the server. Its own VAD instance, so it never
 *  loads (or touches) Parly's Mistral orchestrator. */
export function getServerHandsFree(): ServerHandsFree {
  if (!handsFree) {
    handsFree = new ServerHandsFree({
      capture: audioCaptureService,
      vad: new SileroVadService({
        silenceHangoverMs: HF_SILENCE_HANGOVER_MS,
        // Feed the speech model its 64-sample context (see VadConfig.modelContext);
        // without it the model reads ~0 for real speech and only a loud voice
        // (RMS ≥ 0.05) is ever heard. With it, a normal threshold works.
        modelContext: true,
        speechProbThreshold: 0.5,
      }),
      transcribe: (wav, lang, opts) => transcribeDetailed(BHARAT_API, wav, lang, undefined, opts),
      translate: req => translateProvider.translate(req),
      speak: speakText,
      stopSpeaking,
      store: useConversationStore,
      mixedSpeech: () => useSettingsStore.getState().mixedSpeech,
      log,
      // /health needs no token; this only opens the connection for the first sentence.
      warmUp: () => {
        void fetch(`${BHARAT_API.baseUrl.replace(/\/+$/, '')}/health`).catch(() => {});
      },
    });
  }
  return handsFree;
}
