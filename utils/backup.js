// utils/backup.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** 수집 대상 키 */
const KEY_CHALLENGES = 'challenges';
const KEY_HOF = 'hallOfFame';
const ENTRY_PREFIX = 'entries_';

const nowIso = () => new Date().toISOString();

/** entries_* 키 전체 목록 */
export async function getAllEntryKeys() {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter((k) => k.startsWith(ENTRY_PREFIX));
}

/** JSON 스냅샷 구성 */
export async function buildSnapshot() {
  const [chRaw, hofRaw] = await Promise.all([
    AsyncStorage.getItem(KEY_CHALLENGES),
    AsyncStorage.getItem(KEY_HOF),
  ]);

  const challenges = chRaw ? JSON.parse(chRaw) : [];
  const hallOfFame = hofRaw ? JSON.parse(hofRaw) : [];

  const entryKeys = await getAllEntryKeys();
  const entries = {};
  if (entryKeys.length) {
    const values = await AsyncStorage.multiGet(entryKeys);
    for (const [k, v] of values) {
      entries[k.replace(ENTRY_PREFIX, '')] = v ? JSON.parse(v) : [];
    }
  }

  return {
    format: 'the-push.backup.v1',
    exportedAt: nowIso(),
    challenges,
    hallOfFame,
    entries, // { [challengeId]: Entry[] }
  };
}

/** 내보내기: 파일 생성 + 공유 */
export async function exportBackup() {
  const snap = await buildSnapshot();
  const json = JSON.stringify(snap, null, 2);

  const filename = `the-push-backup-${Date.now()}.json`;
  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });

  // 공유 시도 (안되면 단순 URI 반환)
  try {
    const isAvail = await Sharing.isAvailableAsync();
    if (isAvail) {
      await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: '백업 파일 공유' });
    }
  } catch {}
  return { uri, filename };
}

/** 유효성 검사(필드 존재/타입만 간단 체크) */
export function validateSnapshot(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, reason: 'INVALID_JSON' };
  if (obj.format !== 'the-push.backup.v1') return { ok: false, reason: 'UNSUPPORTED_FORMAT' };
  if (!Array.isArray(obj.challenges) || !Array.isArray(obj.hallOfFame)) {
    return { ok: false, reason: 'BAD_SHAPE' };
  }
  if (!obj.entries || typeof obj.entries !== 'object') return { ok: false, reason: 'BAD_ENTRIES' };
  return { ok: true };
}

/** 덮어쓰기 전 기존 entries_* 전체 삭제 */
async function clearAllEntries() {
  const keys = await getAllEntryKeys();
  if (keys.length) await AsyncStorage.multiRemove(keys);
}

/** 배열을 id 기준 병합/중복제거 */
function mergeById(oldArr = [], newArr = []) {
  const map = new Map();
  for (const it of oldArr) if (it && it.id) map.set(String(it.id), it);
  for (const it of newArr) if (it && it.id) map.set(String(it.id), it);
  return Array.from(map.values());
}

/**
 * 복원
 * @param {'replace'|'merge'} mode replace=완전치환, merge=ID 기준 병합
 */
export async function importSnapshot(data, mode = 'replace') {
  const v = validateSnapshot(data);
  if (!v.ok) throw new Error(v.reason);

  // 기존 데이터 로드
  const cur = await buildSnapshot();

  let challenges, hallOfFame, entriesPairs = [];

  if (mode === 'merge') {
    challenges = mergeById(cur.challenges, data.challenges);
    hallOfFame = mergeById(cur.hallOfFame, data.hallOfFame);

    // entries: 챌린지별로 병합
    const allIds = new Set([
      ...Object.keys(cur.entries || {}),
      ...Object.keys(data.entries || {}),
    ]);
    for (const id of allIds) {
      const a = cur.entries?.[id] || [];
      const b = data.entries?.[id] || [];
      const merged = mergeById(a, b);
      entriesPairs.push([`${ENTRY_PREFIX}${id}`, JSON.stringify(merged)]);
    }
  } else {
    // replace
    challenges = data.challenges || [];
    hallOfFame = data.hallOfFame || [];
    // 기존 entries_* 싹 지우고 새로 쓰기
    await clearAllEntries();
    for (const [id, arr] of Object.entries(data.entries || {})) {
      entriesPairs.push([`${ENTRY_PREFIX}${id}`, JSON.stringify(arr || [])]);
    }
  }

  const ops = [];
  ops.push(AsyncStorage.setItem(KEY_CHALLENGES, JSON.stringify(challenges)));
  ops.push(AsyncStorage.setItem(KEY_HOF, JSON.stringify(hallOfFame)));
  if (entriesPairs.length) ops.push(AsyncStorage.multiSet(entriesPairs));
  await Promise.all(ops);

  return { ok: true };
}
