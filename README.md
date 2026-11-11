<div align="center">

# BharatConnect

### Different Languages. One Conversation.

![Android](https://img.shields.io/badge/Platform-Android-3DDC84?logo=android&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.84-61DAFB?logo=react&logoColor=black)
![Gnani](https://img.shields.io/badge/Speech-Gnani_AI-6C4CF1)
![Qwen](https://img.shields.io/badge/LLM-Qwen3.8_on_Groq-F55036)
![Cloudflare](https://img.shields.io/badge/Backend-Cloudflare_Workers-F38020?logo=cloudflare&logoColor=white)

### ▶️ Watch the demo

[![BharatConnect demo: click to watch](docs/demo-thumbnail.png)](https://drive.google.com/file/d/1FB_rXFCuCJMPpT-uhyUYG1DMFcJy3zA7/view?usp=sharing)

**[Watch the demo video](https://drive.google.com/file/d/1FB_rXFCuCJMPpT-uhyUYG1DMFcJy3zA7/view?usp=sharing)** · **[Solution pitch](Solution_Pitch.pdf)** · **[How it works](#how-it-works)** · **[Run it](#getting-started)**

</div>

---

**A traveller in Tamil Nadu speaks Hindi. A vendor replies in Tamil. Neither
knows the other's language. BharatConnect lets them just talk.**

It's an Android app that listens, understands, translates and speaks aloud, in
both directions, keeping the speaker's **tone**, remembering the
**conversation**, and handling **Hinglish**, the way people actually speak.

## See it in action

*(Illustrative example)*

| | Says | Hears |
|---|---|---|
| 🧳 Traveller (Hinglish) | "Bhaiya, yeh kitne ka hai?" | 🔊 "அண்ணா, இது எவ்வளவு?" |
| 🛒 Vendor (Tamil) | "நூறு ரூபாய்" | 🔊 "सौ रुपये।" |
| 🧳 Traveller | "Thoda kam karo na, please" | 🔊 a **polite** Tamil request to lower the price |

No restarting between turns, and the follow-up is understood because the app
remembers what was just said.

## Why it's different

- **Understands Hinglish.** Mixed Hindi–English speech is a first-class
  language, not an error.
- **Keeps meaning and tone.** Politeness and intent survive translation
  instead of word-for-word output.
- **Remembers the conversation.** Names and earlier turns help fix
  mishearings and keep follow-ups natural.
- **Two ways to talk.** Hold-to-talk on a shared phone, or **hands-free**
  automatic turn-taking.
- **Sounds natural.** Indian-language voices speak the reply, with the phone's
  own voice as an offline backup.
- **Key-safe.** No API key lives in the app; a Cloudflare Worker holds them all.

> **Read the full story:** [Solution pitch →](Solution_Pitch.pdf)

---

## What's inside

| Tab | What it does |
|---|---|
| 🎙 **Converse** | Two people, one phone. Hold to talk, with a split screen facing each person |
| 🔊 **Voice** | Speak once, hear the translation |
| 🌐 **Translate** | Type or paste, auto-detect, live translation, history. Also translates text shared or selected from **any app** |
| 📷 **Camera** | Photograph a sign or menu, then read and translate it over the photo |
| 👂 **Hands-free** | The app detects who's speaking and takes turns by itself (best in quiet places) |

## How it works

```
 Android app
    │  speech · text · photo text
    ▼
 Cloudflare Worker ── holds every API key
    ├── Gnani Prisma ........ speech-to-text (Indian languages + Hinglish)
    ├── Qwen3.8 on Groq ..... context, intent, tone, translation
    └── Gnani Timbre ........ text-to-speech (Indian-language voices)
```

1. **Listen:** Gnani Prisma turns speech into text. For Hinglish it listens for
   Hindi and English together. In hands-free mode it listens for both people's
   languages at once.
2. **Understand:** Qwen translates for meaning and tone, using the recent turns
   and known names as context.
3. **Speak:** Gnani voices read the translation aloud.

## Languages

| | |
|---|---|
| **Speech in and out** | English, Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Punjabi, Bengali, Gujarati |
| **Mixed-language** | Hinglish (Hindi + English) |
| **Camera (on-device reading)** | Latin and Devanagari scripts (English, Hindi, Marathi). Other Indian scripts need a cloud OCR, which is planned |

## Getting started

```bash
# 1. Deploy the Worker (it holds the API keys)
cd worker && npm install
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put GNANI_API_KEY
npx wrangler secret put APP_TOKEN
npx wrangler deploy

# 2. Set baseUrl and appToken in src/services/bharat/config.ts

# 3. Run the app
npm install
npm start
npm run android      # second terminal, device attached
```

Worker details: [`worker/README.md`](worker/README.md)

## Evaluation

Compared against a plain speech → translation → speech baseline on real
conversations (names, code-switching, follow-ups).

| Measure | Question |
|---|---|
| Meaning | Is the intended meaning kept? |
| Tone | Is the requested politeness kept? |
| Speech correction | Are mishearings fixed without new errors? |
| Continuity | Can both people finish several turns without restarting? |
| Speed | How long does each turn take? |

Results: **[add results]**

## Tech stack

React Native 0.84 · TypeScript · Zustand · Reanimated · Silero VAD (ONNX) ·
ML Kit · VisionCamera · Cloudflare Workers · Gnani Prisma and Timbre ·
Qwen3.8 on Groq · Jest

## Known limits

- Android only.
- Camera is snap-and-read, not a live overlay.
- Hands-free works best in quiet places.
- Speech and translation need an internet connection (only the voice has an
  offline backup).

---

<div align="center">

*In a country where languages change every 100 kilometres, BharatConnect aims
to be the constant that helps people connect wherever they go.*

**BharatConnect: Different Languages. One Conversation.**

</div>
