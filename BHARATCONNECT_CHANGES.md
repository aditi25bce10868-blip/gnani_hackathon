# BharatConnect — Round 6: Converse on Gnani + mixed-language speech

Unzip INTO the folder that contains `parly/` (overwrites; adds new files).
**No new native dependency, no Android rebuild** — JS only. But the **Worker must be redeployed**:

    cd parly/worker
    npx wrangler deploy

Then reload the app (`npm start`, press `r`). Nothing else changes in `config.ts`.

## What Converse does now
Hold your disc → speak → release:  **Gnani listens** (`/stt`) → **Qwen translates** (`/translate`, with the last 3 turns as
context) → **Gnani speaks** (`/tts`, phone voice if Gnani lacks the language or fails).
No Mistral key is needed for Converse any more. If `config.ts` `baseUrl` is empty, Converse falls back to Parly's old
Mistral pipeline. **Hands-free is untouched (still Mistral) — next step.**

## Mixed-language speech (what Gnani supports)
- **+EN switch** on the seam language bar (shows when one side is an Indian language). On = the speaker's language is heard
  *together with* English (`hi-IN,en-IN`, Gnani Prisma v3.0), English words stay Latin, numbers become digits, and the
  translator is told the sentence is code-mixed. Off = plain single-language listening. Remembered (settings).
- **Hinglish** is a new language in every picker. Speaking it: heard as Roman-script text. Translating *into* it:
  casual Roman-script Hindi with English words kept. Spoken with Gnani's Hinglish voice (Poorvi, `hi-en`).
- English needs no switch (Gnani's English model already takes English–Hindi mixed audio).

## Files
New (app):  `services/bharat/{ServerConverse,converse,mixedSpeech}.ts`, tests `ServerConverse.test.ts`, `mixedSpeech.test.ts`
Changed (app): `screens/ConversationScreen.tsx`, `services/bharat/{serverApi,types,httpProviders,serverVoice}.ts`,
  `store/settingsStore.ts` (+`mixedSpeech`), `app/languages.ts` (+Hinglish), `ui/primitives/LanguagePickerSheet.tsx`,
  `i18n/strings.ts` (Hinglish readers get English chrome), `screens/bharat/speak.ts` (Hinglish phone-voice fallback),
  tests `serverVoice.test.ts`, `httpProviders.test.ts` (additive)
Changed (worker): `src/{voice,handler,prompt,languages}.ts`, `test/{voice,handler}.test.ts`, `README.md`
  — `prompt.ts` is the teammate's file: only one added sentence in `sourceLine` + an optional `sourceMix` field.

## Checked / not checked
- Worker: typechecks; 48 tests pass (existing + new).
- App logic (engine, mixed-speech, translate/STT request shape, error kinds): 68 tests pass under strict TypeScript, run against
  the real conversation store with the microphone/network/voice faked.
- NOT run: on a device, `ConversationScreen.tsx` under the full RN typecheck, or the existing MainTabs test.
  Please run `npm run typecheck && npm test` and try one Hindi↔English turn with +EN on and off.
- Gnani's own docs warn that Prisma v3.0 context hints can lower accuracy, so keyterms/previous_text are NOT sent yet.

## Earlier rounds
Unchanged — see the previous notes (Rounds 1–5).
