// utils/exportImport.js
// UI 변경 없이 데이터 백업/복원에만 쓰는 유틸
// 사용처 예) 임시로 DevMenu에서 호출하거나, 필요할 때 간단한 임시 버튼을 만들어 호출

import AsyncStorage from '@react-native-async-storage/async-storage';

const TAG = '[Backup]';
const KEY_CHALLENGES = 'challenges';
const KEY_HOF = 'hallOfFame';
const KEY_LAST_CLAIMED = 'lastClaimedId';

// 현재 앱에서 사용하는 prefix
const ENTRY_PREFIX = 'entries_';
const CHALLENGE_PREFIX = 'challenge_';

// 내부: 특정 키의 JSON 파싱 로드
async function loadJson(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// 내부: 키 존재 여부
async function hasKey(key) {
  const v = await AsyncStorage.getItem(key);
  return v != null;
}

// 백업 파일 스키마 버전 (필요 시 마이그레이션 용)
const BACKUP_VERSION = 1;

/**
 * 앱 전 데이터 백업(JSON 텍스트 반환)
 * - challenges
 * - hallOfFame
 * - lastClaimedId
 * - entries_*
 * - challenge_* (개별 캐시)
 */
export async function exportAll() {
  const ts = Date.now();
  const [challenges, hof, lastClaimedId] = await Promise.all([
    loadJson(KEY_CHALLENGES, []),
    loadJson(KEY_HOF, []),
    AsyncStorage.getItem(KEY_LAST_CLAIMED),
  ]);

  const allKeys = await AsyncStorage.getAllKeys();
  const entryKeys = allKeys.filter((k) => k.startsWith(ENTRY_PREFIX));
  const challengeCacheKeys = allKeys.filter((k) => k.startsWith(CHALLENGE_PREFIX));

  const entryPairs = entryKeys.length ? await AsyncStorage.multiGet(entryKeys) : [];
  const challengePairs = challengeCacheKeys.length
    ? await AsyncStorage.multiGet(challengeCacheKeys)
    : [];

  const entries = {};
  for (const [k, v] of entryPairs) {
    try { entries[k] = v ? JSON.parse(v) : []; } catch { entries[k] = []; }
  }

  const challengeCache = {};
  for (const [k, v] of challengePairs) {
    try { challengeCache[k] = v ? JSON.parse(v) : null; } catch { challengeCache[k] = null; }
  }

  const payload = {
    _meta: {
      version: BACKUP_VERSION,
      exportedAt: ts,
    },
    data: {
      [KEY_CHALLENGES]: challenges,
      [KEY_HOF]: hof,
      [KEY_LAST_CLAIMED]: lastClaimedId || null,
      entries,
      challengeCache,
    },
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * 백업 JSON을 앱에 반영
 * @param {string} jsonText - exportAll()로 만든 문자열
 * @param {{mode:'merge'|'replace'}} options
 *   - merge: 기존 데이터에 합치기(중복 id는 최신(백업)으로 교체)
 *   - replace: 기존 데이터 삭제 후 백업 내용으로 전면 교체
 * 동작:
 *   - 현재 저장 데이터는 먼저 안전 백업으로 보존: _backup_{timestamp}_*
 */
export async function importAll(jsonText, options = { mode: 'merge' }) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error('INVALID_JSON');
  }

  // 구조 검증
  if (!parsed || typeof parsed !== 'object' || !parsed.data) {
    throw new Error('INVALID_STRUCTURE');
  }
  const d = parsed.data;
  const hasBasic =
    Array.isArray(d[KEY_CHALLENGES]) &&
    Array.isArray(d[KEY_HOF]) &&
    d.entries && typeof d.entries === 'object';
  if (!hasBasic) {
    throw new Error('MISSING_REQUIRED_KEYS');
  }

  const ts = Date.now();
  const BACKUP_PREFIX = `_backup_${ts}_`;

  // 0) 현재 데이터 안전 백업
  await backupCurrentTo(BACKUP_PREFIX);

  // 1) 모드별 병합 로직
  const mode = options.mode === 'replace' ? 'replace' : 'merge';

  // challenges
  const currentChallenges = await loadJson(KEY_CHALLENGES, []);
  const nextChallenges = (mode === 'replace')
    ? d[KEY_CHALLENGES]
    : mergeById(currentChallenges, d[KEY_CHALLENGES]);

  // hallOfFame
  const currentHof = await loadJson(KEY_HOF, []);
  const nextHof = (mode === 'replace')
    ? d[KEY_HOF]
    : mergeById(currentHof, d[KEY_HOF]);

  // lastClaimedId
  const nextLastClaimed = (typeof d[KEY_LAST_CLAIMED] === 'string' || d[KEY_LAST_CLAIMED] === null)
    ? d[KEY_LAST_CLAIMED]
    : null;

  // entries_*
  const allKeys = await AsyncStorage.getAllKeys();
  const currentEntryKeys = allKeys.filter(k => k.startsWith(ENTRY_PREFIX));
  const ops = [];

  if (mode === 'replace') {
    // 기존 entries_* 모두 삭제
    if (currentEntryKeys.length) {
      await AsyncStorage.multiRemove(currentEntryKeys);
    }
    // 백업의 entries_* 전량 쓰기
    const pairs = Object.entries(d.entries).map(([k, arr]) => [k, JSON.stringify(arr || [])]);
    if (pairs.length) ops.push(AsyncStorage.multiSet(pairs));
  } else {
    // merge: entries는 날짜순 append가 아니라 id 기준으로 병합
    // 각 key별로 가져와서 병합
    const targetKeys = Array.from(new Set([...currentEntryKeys, ...Object.keys(d.entries || {})]));
    for (const key of targetKeys) {
      const cur = await loadJson(key, []);
      const incoming = Array.isArray(d.entries?.[key]) ? d.entries[key] : [];
      const merged = mergeById(cur, incoming);
      ops.push(AsyncStorage.setItem(key, JSON.stringify(merged)));
    }
  }

  // challenge_* 캐시
  const cacheKeys = allKeys.filter(k => k.startsWith(CHALLENGE_PREFIX));
  if (mode === 'replace' && cacheKeys.length) {
    await AsyncStorage.multiRemove(cacheKeys);
  }
  if (d.challengeCache && typeof d.challengeCache === 'object') {
    const pairs = Object.entries(d.challengeCache).map(([k, v]) => [k, JSON.stringify(v)]);
    if (pairs.length) ops.push(AsyncStorage.multiSet(pairs));
  }

  // 2) 최종 쓰기
  await AsyncStorage.setItem(KEY_CHALLENGES, JSON.stringify(nextChallenges));
  await AsyncStorage.setItem(KEY_HOF, JSON.stringify(nextHof));
  if (nextLastClaimed === null) {
    await AsyncStorage.removeItem(KEY_LAST_CLAIMED);
  } else {
    await AsyncStorage.setItem(KEY_LAST_CLAIMED, String(nextLastClaimed));
  }

  if (ops.length) await Promise.all(ops);
  return { ok: true, mode, backupPrefix: BACKUP_PREFIX };
}

// ===== 내부 유틸 =====

// 기존 데이터 백업 (동일 구조로 _backup_{ts}_ 접두어로 저장)
async function backupCurrentTo(prefix) {
  const allKeys = await AsyncStorage.getAllKeys();

  const pairs = await AsyncStorage.multiGet(allKeys);
  // 전부 백업 (용량 커질 수 있으니 필요 시 범위를 제한해도 됨)
  const backupPairs = pairs.map(([k, v]) => [`${prefix}${k}`, v]);
  if (backupPairs.length) {
    await AsyncStorage.multiSet(backupPairs);
  }
}

function mergeById(curArr, nextArr) {
  const map = new Map();
  const insert = (arr) => {
    for (const it of (arr || [])) {
      if (it && typeof it === 'object' && it.id) {
        map.set(it.id, it); // 같은 id면 최신(next)의 요소가 덮어씀
      }
    }
  };
  insert(curArr);
  insert(nextArr);
  // 정렬 정책: createdAt/ completedAt/ timestamp가 있으면 최신순, 없으면 as-is
  const result = Array.from(map.values());
  result.sort((a, b) => {
    const ka = (b?.completedAt || b?.createdAt || b?.timestamp || 0);
    const kb = (a?.completedAt || a?.createdAt || a?.timestamp || 0);
    return ka - kb;
  });
  return result;
}
