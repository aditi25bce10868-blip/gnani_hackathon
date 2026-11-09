// Camera tab — point at printed text, get it translated.
//
//   live preview → shutter → ML Kit reads the text blocks → each block is
//   translated → the translation is drawn over the frozen photo, block by
//   block, and the full text is also offered as a copy/speak/share card.
//
// This is "snap and read", not a continuously updating AR overlay: live
// per-frame OCR needs a native frame processor and is a later step.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { errorMessage } from '../../app/errors';
import { getLanguage } from '../../app/languages';
import { cleanOcrText, isUnchanged } from '../../services/bharat/ocrFilter';
import { layoutOverlays } from '../../services/bharat/overlayLayout';
import { photoSpace } from '../../services/bharat/photoSpace';
import { ocrProvider, translateProvider } from '../../services/bharat/providers';
import { AUTO_LANG, type OcrBlock } from '../../services/bharat/types';
import { log } from '../../services/log/logStore';
import { loadVisionCamera, type CameraHandle } from '../../services/native/visionCamera';
import { useBharatStore } from '../../store/bharatStore';
import type { MainNavigation } from '../../navigation/types';
import { Button, DuskBackdrop, Text, color, haptics, space } from '../../ui';
import { LangPairBar, useLangPicker } from '../bharat/LangPairBar';
import { ResultCard } from '../bharat/ResultCard';
import { ScreenHeader } from '../bharat/ScreenHeader';
import { stopSpeaking } from '../bharat/speak';

const MAX_BLOCKS = 24;
const MAX_PHOTO_CHARS = 3800;
const vision = loadVisionCamera();

/**
 * Translate every block of one photo. The whole photo goes in one request when
 * it can (best context, one quota hit). A single block, or a batch the server
 * could not answer, is translated block by block instead — so the user always
 * gets a translation if the plain /translate route works.
 */
async function translateBlocks(texts: readonly string[], source: string, target: string): Promise<string[]> {
  if (texts.length > 1) {
    try {
      return await translateProvider.translateMany(texts, source, target);
    } catch {
      // fall through to one-by-one below
    }
  }
  const out: string[] = new Array<string>(texts.length).fill('');
  let firstError: unknown = null;
  let failed = 0;
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < texts.length) {
      const i = next++;
      try {
        out[i] = (await translateProvider.translate({ text: texts[i], sourceLang: source, targetLang: target })).text;
      } catch (e) {
        failed += 1;
        firstError ??= e;
        out[i] = texts[i]; // keep the original rather than leave a hole
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  if (failed === texts.length) throw firstError;
  return out;
}

interface Props {
  readonly navigation: MainNavigation;
}

interface Shot {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
  readonly blocks: readonly (OcrBlock & { readonly translated: string })[];
  /** The pixel space the text boxes were measured in, read from the photo file. */
  readonly space?: { readonly w: number; readonly h: number; readonly imageW: number; readonly imageH: number };
}

export function CameraScreen({ navigation }: Props): React.JSX.Element {
  const pair = useBharatStore(s => s.pairs.camera);
  const setSource = useBharatStore(s => s.setSource);
  const setTarget = useBharatStore(s => s.setTarget);
  const swap = useBharatStore(s => s.swap);

  const [shot, setShot] = useState<Shot | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const run = useRef(0);

  const picker = useLangPicker({
    source: pair.source,
    target: pair.target,
    onSource: c => setSource('camera', c),
    onTarget: c => setTarget('camera', c),
  });

  useEffect(
    () => () => {
      run.current += 1;
      stopSpeaking();
    },
    [],
  );

  const onPhoto = useCallback(
    async (path: string, width: number, height: number) => {
      const id = ++run.current;
      const uri = path.startsWith('file://') ? path : `file://${path}`;
      setBusy(true);
      setNote('');
      try {
        const ocr = await ocrProvider.recognize(uri, pair.source);
        if (id !== run.current) return;
        if (ocr.kind === 'unavailable') {
          setNote('Text reading is not installed in this build (@react-native-ml-kit/text-recognition).');
          return;
        }
        if (ocr.kind === 'unsupported') {
          setNote(
            `Reading ${getLanguage(ocr.lang).name} from a photo needs the cloud reader, which is not connected yet. ` +
              'Hindi, Marathi, English and other Latin-script text work now.',
          );
          return;
        }
        // Drop "bash", shell commands, URLs and link chips; keep real sentences.
        const cleaned: OcrBlock[] = [];
        for (const b of ocr.blocks) {
          const text = cleanOcrText(b.text);
          if (text !== '') cleaned.push({ ...b, text });
        }
        if (cleaned.length === 0) {
          setNote('No readable text found. Move closer, hold steady, and try again.');
          return;
        }
        // The server accepts at most ~4000 characters per photo; keep what fits.
        const picked: OcrBlock[] = [];
        let chars = 0;
        for (const b of cleaned.slice(0, MAX_BLOCKS)) {
          if (chars + b.text.length > MAX_PHOTO_CHARS) break;
          picked.push(b);
          chars += b.text.length;
        }
        // The boxes are in the photo file's own pixels; read its true size from
        // the file header rather than trusting the image component (which was
        // measured off by 2× on a device, putting every box in the wrong place).
        let space: Shot['space'];
        try {
          const s = await photoSpace(uri, picked);
          if (s) {
            space = { w: s.w, h: s.h, imageW: s.imageW, imageH: s.imageH };
            log.info(`[camera] ${s.note}`);
          }
        } catch (e) {
          log.warn(`[camera] could not read the photo header: ${errorMessage(e)}`);
        }
        if (id !== run.current) return;
        // One request for the whole photo: the model sees every block together
        // (better translations) and a free-tier quota is not spent per block.
        const translated = await translateBlocks(picked.map(b => b.text), pair.source, pair.target);
        if (id !== run.current) return;
        setShot({ uri, width, height, space, blocks: picked.map((b, i) => ({ ...b, translated: translated[i] })) });
        haptics.done();
      } catch (e) {
        if (id === run.current) setNote(errorMessage(e));
      } finally {
        if (id === run.current) setBusy(false);
      }
    },
    [pair.source, pair.target],
  );

  const retake = () => {
    run.current += 1;
    stopSpeaking();
    setShot(null);
    setNote('');
    setBusy(false);
  };

  const fullText = shot
    ? shot.blocks
        .filter(b => !isUnchanged(b.text, b.translated))
        .map(b => b.translated)
        .join('\n')
    : '';

  return (
    <View style={styles.root}>
      <DuskBackdrop />
      <ScreenHeader
        eyebrow="CAMERA"
        title="Point. Snap. Read."
        engineNote={translateProvider.isMock ? 'demo engine — real translation coming soon' : undefined}
        onSettings={() => navigation.navigate('Settings')}
      />
      <LangPairBar
        source={pair.source}
        target={pair.target}
        onPressSource={picker.openSource}
        onPressTarget={picker.openTarget}
        onSwap={() => swap('camera')}
        swapDisabled={pair.source === AUTO_LANG}
        onAuto={() => setSource('camera', AUTO_LANG)}
      />

      {shot ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <PhotoOverlay shot={shot} />
          <ResultCard
            caption="Translation"
            lang={pair.target}
            text={fullText}
            accent={color.accentB}
          />
          <Button label="Take another" onPress={retake} style={styles.cta} />
        </ScrollView>
      ) : (
        <View style={styles.viewfinder}>
          {vision ? (
            <Viewfinder vision={vision} busy={busy} onPhoto={onPhoto} />
          ) : (
            <Text variant="body" tone="fgMuted" style={styles.centerNote}>
              Camera is not installed in this build. Run: npm i react-native-vision-camera
            </Text>
          )}
          {note !== '' ? (
            <Text variant="bodySmall" tone="error" style={styles.noteBelow}>
              {note}
            </Text>
          ) : null}
        </View>
      )}
      {picker.sheet}
    </View>
  );
}

function Viewfinder({
  vision: vc,
  busy,
  onPhoto,
}: {
  readonly vision: NonNullable<ReturnType<typeof loadVisionCamera>>;
  readonly busy: boolean;
  readonly onPhoto: (path: string, width: number, height: number) => void;
}): React.JSX.Element {
  const { hasPermission, requestPermission } = vc.useCameraPermission();
  const device = vc.useCameraDevice('back');
  const ref = useRef<CameraHandle | null>(null);
  const asked = useRef(false);

  useEffect(() => {
    if (!hasPermission && !asked.current) {
      asked.current = true;
      void requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const snap = async () => {
    if (busy || !ref.current) return;
    haptics.tap();
    try {
      const p = await ref.current.takePhoto({ flash: 'off' });
      onPhoto(p.path, p.width, p.height);
    } catch {
      // A failed capture just leaves the viewfinder up for another try.
    }
  };

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text variant="body" tone="fgMuted" style={styles.centerNote}>
          Camera permission is needed to read text.
        </Text>
        <Button label="Allow camera" onPress={() => void requestPermission()} />
      </View>
    );
  }
  if (!device) {
    return (
      <View style={styles.center}>
        <Text variant="body" tone="fgMuted">
          No camera found.
        </Text>
      </View>
    );
  }

  const Cam = vc.Camera;
  return (
    <View style={styles.cameraWrap}>
      <Cam ref={ref} style={StyleSheet.absoluteFill} device={device} isActive photo />
      <View style={styles.shutterRow}>
        {busy ? (
          <ActivityIndicator color={color.fg} />
        ) : (
          <Pressable
            onPress={() => void snap()}
            style={styles.shutter}
            accessibilityRole="button"
            accessibilityLabel="Capture text"
          />
        )}
      </View>
    </View>
  );
}

/** The photo with each translated block drawn over where the original text was.
 *  Every block stays inside the photo; Hindi, which runs longer than English,
 *  may grow downward into free space or shrink a little, but is never cut off
 *  (see overlayLayout). Tap the photo to hide the overlay and see the original. */
function PhotoOverlay({ shot }: { readonly shot: Shot }): React.JSX.Element {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [showOverlay, setShowOverlay] = useState(true);
  // The file may carry EXIF rotation, so ask the image itself for its size
  // rather than trusting the capture metadata.
  const [size, setSize] = useState({ w: shot.space?.w ?? shot.width, h: shot.space?.h ?? shot.height });
  useEffect(() => {
    Image.getSize(
      shot.uri,
      (w, h) => {
        log.info(`[camera] image component reports ${w}x${h}` + (shot.space ? ` (using file size ${Math.round(shot.space.w)}x${Math.round(shot.space.h)})` : ''));
        // The file's own size wins when we have it.
        if (!shot.space) setSize({ w, h });
      },
      () => {},
    );
  }, [shot.uri, shot.space]);

  const onLayout = (e: LayoutChangeEvent) =>
    setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  // The photo keeps its real shape; the boxes are scaled by the space they were measured in.
  const aspect = shot.space ? shot.space.imageW / shot.space.imageH : size.h > 0 ? size.w / size.h : 1;
  const sx = size.w > 0 && box.w > 0 ? box.w / size.w : 0;
  const sy = size.h > 0 && box.h > 0 ? box.h / size.h : 0;
  const drawn = shot.blocks.filter(b => !isUnchanged(b.text, b.translated));
  return (
    <Pressable
      onPress={() => setShowOverlay(v => !v)}
      accessibilityRole="button"
      accessibilityLabel={showOverlay ? 'Show original text' : 'Show translation'}
      style={[styles.photoBox, { aspectRatio: aspect }]}
      onLayout={onLayout}>
      <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} resizeMode="stretch" />
      {showOverlay && sx > 0 && sy > 0
        ? layoutOverlays(drawn, sx, sy, box.w, box.h).map((p, i) => (
            <View
              key={i}
              style={[styles.overlay, { left: p.left, top: p.top, width: p.width, height: p.height }]}>
              <RNText
                style={[styles.overlayText, { fontSize: p.fontSize, lineHeight: p.fontSize * 1.25 }]}
                adjustsFontSizeToFit
                minimumFontScale={0.6}>
                {p.block.translated}
              </RNText>
            </View>
          ))
        : null}
      <View style={styles.hint} pointerEvents="none">
        <RNText style={styles.hintText}>{showOverlay ? 'tap photo: original' : 'tap photo: translation'}</RNText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: space.md, paddingBottom: space.xl },
  cta: { marginHorizontal: space.xl, marginTop: space.md, alignSelf: 'stretch' },
  viewfinder: { flex: 1, marginHorizontal: space.xl, marginBottom: space.md },
  cameraWrap: { flex: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' },
  shutterRow: { position: 'absolute', bottom: space.lg, left: 0, right: 0, alignItems: 'center' },
  shutter: { width: 68, height: 68, borderRadius: 34, borderWidth: 4, borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.35)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerNote: { textAlign: 'center', marginBottom: space.md },
  noteBelow: { marginTop: space.md },
  photoBox: { marginHorizontal: space.xl, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' },
  overlay: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.86)', paddingHorizontal: 3, justifyContent: 'center', overflow: 'hidden', borderRadius: 3 },
  hint: { position: 'absolute', right: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  hintText: { color: '#fff', fontSize: 10 },
  overlayText: { color: '#fff' },
});