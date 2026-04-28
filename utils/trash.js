// utils/trash.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const TRASH_KEY = 'trash_challenges';

/**
 * 도전을 휴지통으로 이동
 * - challenges 배열에서 제거하지 않음 (ChallengeListScreen에서 처리)
 * - entries_, challenge_ 캐시는 삭제하지 않음 (복구 시 필요)
 */
export async function moveToTrash(challenge) {
  try {
    const raw = await AsyncStorage.getItem(TRASH_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    // 동일 id가 이미 있으면 덮어쓰기
    const filtered = arr.filter(i => String(i.id) !== String(challenge.id));
    filtered.unshift({ ...challenge, _deletedAt: Date.now() });
    await AsyncStorage.setItem(TRASH_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('[Trash] moveToTrash failed:', e?.message || e);
  }
}

/**
 * 앱 시작 시 호출: days일 이상 지난 항목 자동 영구 삭제
 */
export async function cleanExpiredTrash(days = 30) {
  try {
    const raw = await AsyncStorage.getItem(TRASH_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const surviving = arr.filter(i => (i._deletedAt ?? 0) >= cutoff);
    const expired = arr.filter(i => (i._deletedAt ?? 0) < cutoff);
    
    // 만료 항목의 entries_ 도 정리
    const entryKeys = expired.map(i => `entries_${i.id}`);
    if (entryKeys.length) await AsyncStorage.multiRemove(entryKeys);
    
    await AsyncStorage.setItem(TRASH_KEY, JSON.stringify(surviving));
  } catch (e) {
    console.warn('[Trash] cleanExpiredTrash failed:', e?.message || e);
  }
}

/**
 * 휴지통 전체 목록 로드
 */
export async function loadTrash() {
  try {
    const raw = await AsyncStorage.getItem(TRASH_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * 단일 항목 영구 삭제 (entries_, challenge_ 캐시 포함)
 */
export async function permanentDelete(challengeId) {
  try {
    const raw = await AsyncStorage.getItem(TRASH_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const next = arr.filter(i => String(i.id) !== String(challengeId));
    await AsyncStorage.setItem(TRASH_KEY, JSON.stringify(next));
    await AsyncStorage.multiRemove([
      `entries_${challengeId}`,
      `challenge_${challengeId}`,
    ]);
  } catch (e) {
    console.warn('[Trash] permanentDelete failed:', e?.message || e);
  }
}

/**
 * 휴지통 전체 비우기
 */
export async function emptyTrash(items) {
  try {
    const keys = items.flatMap(i => [
      `entries_${i.id}`,
      `challenge_${i.id}`,
    ]);
    if (keys.length) await AsyncStorage.multiRemove(keys);
    await AsyncStorage.setItem(TRASH_KEY, JSON.stringify([]));
  } catch (e) {
    console.warn('[Trash] emptyTrash failed:', e?.message || e);
  }
}

/**
 * 복구: 휴지통에서 제거 + challenges 배열 맨 앞에 추가
 */
export async function restoreFromTrash(challenge) {
  try {
    // 1) 휴지통에서 제거
    const trashRaw = await AsyncStorage.getItem(TRASH_KEY);
    const trashArr = trashRaw ? JSON.parse(trashRaw) : [];
    const nextTrash = trashArr.filter(i => String(i.id) !== String(challenge.id));
    await AsyncStorage.setItem(TRASH_KEY, JSON.stringify(nextTrash));

    // 2) _deletedAt 제거 후 status 복구
    const { _deletedAt, ...restored } = challenge;
    restored.status = 'active';
    restored.archived = false;
    restored._isDone = false;

    // 3) challenges 배열 맨 앞에 추가
    const challRaw = await AsyncStorage.getItem('challenges');
    const challArr = challRaw ? JSON.parse(challRaw) : [];
    // 혹시 동일 id가 남아있으면 제거 후 추가
    const deduplicated = challArr.filter(i => String(i.id) !== String(restored.id));
    deduplicated.unshift(restored);
    await AsyncStorage.setItem('challenges', JSON.stringify(deduplicated));

    // 4) 개별 캐시 갱신
    await AsyncStorage.setItem(`challenge_${restored.id}`, JSON.stringify(restored));
  } catch (e) {
    console.warn('[Trash] restoreFromTrash failed:', e?.message || e);
    throw e;
  }
}
