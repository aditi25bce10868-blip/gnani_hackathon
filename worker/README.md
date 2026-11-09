# BharatConnect Worker

A tiny free Cloudflare Worker. The app talks to it; it talks to Groq (Qwen3.8). The Groq key never reaches the phone.

| Route | Does |
|---|---|
| `GET /health` | `{ "ok": true }` (no token needed) |
| `POST /translate` | `{text, source, target, context?, mix?}` → `{text}`  ·  `{texts:[…], source, target}` → `{texts:[…]}` |
| `POST /stt` | `{audio_base64 (WAV), language, mix?}` → `{text, detected?}` — Gnani; free Whisper for languages Gnani lacks |
| `POST /tts` | `{text, language}` → `{audio_base64 (WAV)}` — Gnani voices (10 languages) |

Everything except `/health` needs header `X-App-Token`.

`src/prompt.ts` is the **auto-correction / context** file — your teammate's.

## Deploy (once)

```powershell
cd worker
npm install
npx wrangler login                      # opens the browser; free Cloudflare account
npx wrangler secret put GROQ_API_KEY    # paste your Groq key when asked
npx wrangler secret put GNANI_API_KEY   # paste your Gnani key
npx wrangler secret put APP_TOKEN       # invent a long random string, remember it
npx wrangler deploy                     # prints https://bharatconnect-api.<you>.workers.dev
```

## Check it works

```powershell
Invoke-RestMethod https://bharatconnect-api.<you>.workers.dev/health

Invoke-RestMethod -Uri https://bharatconnect-api.<you>.workers.dev/translate -Method Post `
  -Headers @{ 'x-app-token' = '<APP_TOKEN>' } -ContentType 'application/json' `
  -Body '{"text":"Thank you","source":"en","target":"hi"}'
```

## Point the app at it

Edit `src/services/bharat/config.ts`:

```ts
export const BHARAT_API = {
  baseUrl: 'https://bharatconnect-api.<you>.workers.dev',
  appToken: '<APP_TOKEN>',
};
```

Reload the app (no rebuild). The "demo engine" note on the Translate tab disappears when the real engine is on.

## Local testing without deploying

Create `worker/.dev.vars` (git-ignored):

```
GROQ_API_KEY=...
APP_TOKEN=test
```

then `npx wrangler dev` (serves on http://localhost:8787; a phone needs your PC's IP instead).

## Saving Gnani credits

- `STT_ENGINE` in `wrangler.toml`: `"gnani"` (best accuracy) or `"groq"` (free Whisper for everyday testing). Change it, run `npx wrangler deploy`.
- Languages Gnani doesn't have (Odia, Assamese, Urdu …): listening falls back to Whisper (Odia has none); speaking falls back to the phone's own voice.
- The app caches spoken replies and Worker rejects text over 600 characters.
- App side: `serverTts: false` in `config.ts` turns Gnani voices off entirely (phone voice only).

## Mixed-language speech (Hindi + English, Tamil + English …)

- `POST /stt` with `"mix": ["en"]` asks Gnani's **Prisma v3.0** to listen for the language *and* English at once
  (`language_code=hi-IN,en-IN`, `format=transcribe`: English words stay in Latin letters, numbers become digits).
  Up to 4 languages. Without `mix` the request is exactly as before.
- `language: "hi-hinglish"` is heard as **Romanised** text (`format=transliterate`). Gnani notes the accuracy of
  Romanised output is not yet measured — check it on your own audio.
- `POST /translate` with `"mix": ["en"]` tells the model the source is code-mixed (`src/prompt.ts`, one added sentence in `sourceLine`).
- Needs `GNANI_STT_MODEL` to stay `prisma-v3.0` (the default). Older models get the plain single-language request.
- `STT_ENGINE="groq"` (free Whisper) ignores `mix` and listens in the main language only.

