import { Platform, NativeModules } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const BRIDGE = NativeModules?.WidgetBridge;

async function ensureNoMedia() {
  try {
    const p = FileSystem.documentDirectory + '.nomedia';
    await FileSystem.writeAsStringAsync(p, '');
  } catch {}
}

async function copyOverwriteAsync(fromUri, toUri) {
  try {
    const info = await FileSystem.getInfoAsync(toUri);
    if (info.exists) await FileSystem.deleteAsync(toUri, { idempotent: true });
  } catch {}
  await FileSystem.copyAsync({ from: fromUri, to: toUri });
  return toUri;
}

async function setPref(key, val) {
  try {
    if (Platform.OS === 'android' && BRIDGE?.setPref) BRIDGE.setPref(String(key), String(val ?? ''));
  } catch {}
}

async function updateAllWidgets() {
  try {
    if (Platform.OS === 'android' && BRIDGE?.updateAllWidgets) BRIDGE.updateAllWidgets();
  } catch {}
}

/**
 * 1×1 도넛 스냅샷 저장 + Prefs 반영
 * opts.title 있으면 제목 캐시도 함께 저장
 */
export async function writeDonut1x1Image(challengeId, tmpUri, opts = {}) {
  if (!challengeId || !tmpUri) return null;
  await ensureNoMedia();
  const out = FileSystem.documentDirectory + `donut_1x1_${challengeId}.png`;
  const saved = await copyOverwriteAsync(tmpUri, out);
  await setPref(`SNAPSHOT_1x1_${challengeId}`, saved);
  if (opts?.title) await setPref(`CH_SUMMARY_${challengeId}_TITLE`, String(opts.title));
  await updateAllWidgets();
  return saved;
}
