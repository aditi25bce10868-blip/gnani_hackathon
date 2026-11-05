# BharatConnect frontend — overlay

Unzip this INTO the folder that contains `parly/` (it overwrites existing files, adds new ones).
**Delete** `parly/src/screens/tabs/TextScreen.tsx` if you applied the earlier overlay (this one removes it).

New native dependencies for the Camera tab (then rebuild the Android app):

    npm i react-native-vision-camera@4.7.3 @react-native-ml-kit/text-recognition

Then from `parly/`:

    npm install
    npm start            # Metro
    npm run android      # second terminal, device/emulator attached

## Tabs (5)
Converse · Voice · **Translate** (Text + Translate merged) · **Camera** (new) · Hands-free

- Translate = the old Translate screen: auto-detect or pick a source, live as-you-type, Share / selection-menu / clipboard-chip intake, recents. It already covers everything Text did.
- Camera = point, snap, ML Kit reads text blocks, each block is translated and drawn over the photo; full text below with Copy / Speak / Share.

## Round 3
- Welcome screen (LanguagePairScreen.tsx): "Welcome to BharatConnect" + Start. No language picking; Start sets Hindi/English
  only if no language was ever chosen. App.tsx now always opens on it.
- Converse: language bar on the seam (You ⇄ Other, tap to change, ⇄ to swap); discs show a microphone icon (ui/primitives/PTTButton.tsx).
- Converse/Hands-free still need a Mistral API key (Settings) — that is Parly's translation + speech engine.

## Camera limits (be aware)
- Snap-and-read, not a live per-frame overlay (that needs a native frame processor — later).
- On-device OCR (ML Kit) reads Latin, Devanagari (Hindi, Marathi), Chinese, Japanese, Korean ONLY.
  Tamil, Telugu, Kannada, Malayalam, Bengali, Gujarati, Punjabi, Odia, Assamese, Urdu are NOT readable on-device;
  the tab says so. To support them add a cloud OCR (Bhashini OCR or Google Cloud Vision) in
  `src/services/bharat/mlkitOcr.ts` / `providers.ts`.
- Not yet run on a device: check overlay alignment on a real photo (EXIF rotation).

## Changed this round
- src/screens/MainTabs.tsx, TabIcons.tsx (+camera icon, −text), store/bharatStore.ts (pairs: voice/translate/camera)
- src/services/bharat/{types,providers}.ts (+OcrProvider), tests, MainTabs test
- android/.../AndroidManifest.xml (+CAMERA permission)
- REMOVED: src/screens/tabs/TextScreen.tsx
## New this round
- src/screens/tabs/CameraScreen.tsx
- src/services/bharat/{mlkitOcr,ocrScript}.ts
- src/services/native/visionCamera.ts

## Earlier files (unchanged this round)
AndroidManifest share/selection filters, MainActivity.kt, MainApplication.kt, App.tsx, navigation/types.ts,
ConversationScreen.tsx (`variant`), LanguagePairScreen.tsx, languages.ts (+9 Indian languages),
LanguagePickerSheet.tsx, Text.tsx, BharatSystem{Module,Package}.kt, VoiceScreen, TranslateScreen,
bharat/{LangPairBar,ResultCard,ScreenHeader,speak}, services/bharat/{mockProviders,scriptDetect}, services/native/bharatSystem.ts

## Backend swap point (later)
src/services/bharat/providers.ts — replace the mock providers with Gnani / LLM / IndicTrans2 (+ cloud OCR).
