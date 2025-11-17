// utils/widgetSync.js
import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const BRIDGE = NativeModules?.WidgetBridge;
const WIDGET_JSON_PATH = FileSystem.documentDirectory + 'widget_challenges.json';

async function ensureNoMedia() {
  try {
    const p = FileSystem.documentDirectory + '.nomedia';
    await FileSystem.writeAsStringAsync(p, '');
  } catch {}
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

function shapeForWidget(c) {
  const id = String(c?.id ?? '').trim();
  if (!id) return null;
  const title = (c?.title ?? '').toString().trim() || id;
  let pct = 0;
  if (Number.isFinite(c?.progressPct)) pct = Number(c.progressPct);
  else if (Number.isFinite(c?.progress)) pct = Number(c.progress) * 100;
  else if (Number.isFinite(c?.currentScore) && Number.isFinite(c?.goalScore) && c.goalScore > 0) {
    pct = (Number(c.currentScore) / Number(c.goalScore)) * 100;
  }
  pct = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  return { id, title, progressPct: Math.round(pct) };
}

// 목록 JSON + Prefs 동기화
export async function writeChallengeList(challenges = []) {
  try {
    await ensureNoMedia();
    const payload = (challenges || []).map(shapeForWidget).filter(Boolean);
    const s = JSON.stringify(payload);

    // 문서 디렉터리에 JSON 저장
    await FileSystem.writeAsStringAsync(WIDGET_JSON_PATH, s, { encoding: FileSystem.EncodingType.UTF8 });

    // 네이티브 폴백용 Prefs에도 동일 문자열 저장
    await setPref('WIDGET_CHALLENGES_JSON', s);

    // 제목 캐시(Provider가 빠르게 읽도록)
    for (const it of payload) {
      await setPref(`CH_SUMMARY_${it.id}_TITLE`, it.title);
    }

    await updateAllWidgets();
  } catch (e) {
    console.warn('[WidgetSync] writeChallengeList fail:', e?.message || e);
  }
}

// AsyncStorage('challenges')에서 직접 읽어 동기화
export async function syncWidgetChallengeList() {
  try {
    const raw = await AsyncStorage.getItem('challenges');
    const arr = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(arr) ? arr : [];
    const payload = list.map(shapeForWidget).filter(Boolean);
    await writeChallengeList(payload);
    return payload;
  } catch (e) {
    console.warn('[WidgetSync] syncWidgetChallengeList fail:', e?.message || e);
    return [];
  }
}

export async function debugReadChallengeList() {
  try {
    const s = await FileSystem.readAsStringAsync(WIDGET_JSON_PATH, { encoding: FileSystem.EncodingType.UTF8 });
    console.log('[WidgetSync] current json =', s);
  } catch (e) {
    console.warn('[WidgetSync] read fail:', e?.message || e);
  }
}
