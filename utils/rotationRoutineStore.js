import AsyncStorage from '@react-native-async-storage/async-storage';

import { syncWidgetChallengeList } from './widgetSync';
import {
  RotationRoutineError,
  createRotationRoutine,
  deferCurrentRotationItem,
  getRotationRoutineSummary,
  normalizeRotationRoutine,
  recordRotationTime,
  setRotationRoutinePaused,
  undoLastRotationAction,
} from './rotationRoutine';

const CHALLENGES_KEY = 'challenges';
const challengeKey = (id) => 'challenge_' + id;
const entriesKey = (id) => 'entries_' + id;

const fail = (code, message) => {
  throw new RotationRoutineError(code, message);
};

const cleanId = (value) => String(value ?? '').trim();

const parseArray = (raw, key) => {
  if (raw == null) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  fail('STORAGE_CORRUPT', String(key) + ' 저장 데이터가 올바르지 않습니다.');
};

const parseObject = (raw, key) => {
  if (raw == null) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {}

  fail('STORAGE_CORRUPT', String(key) + ' 저장 데이터가 올바르지 않습니다.');
};

const requireStorage = (storage) => {
  if (
    !storage ||
    typeof storage.getItem !== 'function' ||
    typeof storage.multiGet !== 'function' ||
    typeof storage.multiSet !== 'function'
  ) {
    fail('STORAGE_UNAVAILABLE', '저장소를 사용할 수 없습니다.');
  }
  return storage;
};

export function createRotationRoutineStore({
  storage = AsyncStorage,
  onChallengesChanged = syncWidgetChallengeList,
} = {}) {
  const targetStorage = requireStorage(storage);
  let mutationQueue = Promise.resolve();

  const enqueueMutation = (task) => {
    const next = mutationQueue.catch(() => {}).then(task);
    mutationQueue = next;
    return next;
  };

  const notifyChallengesChanged = async () => {
    if (typeof onChallengesChanged !== 'function') return;

    try {
      await onChallengesChanged();
    } catch (error) {
      console.warn(
        '[RotationRoutineStore] widget sync failed:',
        error?.message || error
      );
    }
  };

  const readBundle = async (routineId) => {
    const id = cleanId(routineId);
    if (!id) fail('ROUTINE_ID_INVALID', '순환 루틴 ID가 없습니다.');

    const keys = [CHALLENGES_KEY, challengeKey(id), entriesKey(id)];
    const values = await targetStorage.multiGet(keys);
    const valueByKey = new Map(Array.isArray(values) ? values : []);
    const challenges = parseArray(valueByKey.get(CHALLENGES_KEY), CHALLENGES_KEY);
    const listed = challenges.find((item) => cleanId(item?.id) === id) || null;

    if (listed && listed.type !== 'rotation' && !listed.rotation) {
      fail('ROUTINE_TYPE_MISMATCH', '해당 항목은 순환 루틴이 아닙니다.');
    }

    const cached = listed
      ? null
      : parseObject(valueByKey.get(challengeKey(id)), challengeKey(id));
    const routine = normalizeRotationRoutine(listed || cached);
    if (!routine?.id) {
      fail('ROTATION_ROUTINE_NOT_FOUND', '순환 루틴을 찾을 수 없습니다.');
    }

    const entries = parseArray(valueByKey.get(entriesKey(id)), entriesKey(id));
    return { challenges, routine, entries };

};

  const persistRoutine = async ({ challenges, routine, entries }) => {
    const normalized = normalizeRotationRoutine(routine);
    if (!normalized?.id) {
      fail('INVALID_ROTATION_ROUTINE', '유효한 순환 루틴이 아닙니다.');
    }

    const nextChallenges = [...challenges];
    const index = nextChallenges.findIndex(
      (item) => cleanId(item?.id) === normalized.id
    );
    if (index >= 0) nextChallenges[index] = normalized;
    else nextChallenges.unshift(normalized);

    const pairs = [
      [CHALLENGES_KEY, JSON.stringify(nextChallenges)],
      [challengeKey(normalized.id), JSON.stringify(normalized)],
    ];
    if (entries !== undefined) {
      pairs.push([entriesKey(normalized.id), JSON.stringify(entries)]);
    }

    await targetStorage.multiSet(pairs);
    await notifyChallengesChanged();
    return normalized;
  };

  const createAndSave = (input, options = {}) =>
    enqueueMutation(async () => {
      const routine = createRotationRoutine(input, options);
      const id = routine.id;
      const keys = [CHALLENGES_KEY, challengeKey(id), entriesKey(id)];
      const values = await targetStorage.multiGet(keys);
      const valueByKey = new Map(Array.isArray(values) ? values : []);
      const challenges = parseArray(valueByKey.get(CHALLENGES_KEY), CHALLENGES_KEY);
      const duplicateInList = challenges.some(
        (item) => cleanId(item?.id) === id
      );

      if (
        duplicateInList ||
        valueByKey.get(challengeKey(id)) != null ||
        valueByKey.get(entriesKey(id)) != null
      ) {
        fail('ROUTINE_ID_DUPLICATE', '이미 사용 중인 순환 루틴 ID입니다.');
      }

      const saved = await persistRoutine({
        challenges,
        routine,
        entries: [],
      });
      return {
        routine: saved,
        summary: getRotationRoutineSummary(saved),
      };
    });

  const load = async (routineId) => {
    const { routine } = await readBundle(routineId);
    return routine;
  };

  const loadEntries = async (routineId) => {
    const { entries } = await readBundle(routineId);
    return entries;
  };

  const loadSnapshot = async (routineId) => {
    const { routine, entries } = await readBundle(routineId);
    return {
      routine,
      entries,
      summary: getRotationRoutineSummary(routine),
    };
  };

  const save = (routine) =>
    enqueueMutation(async () => {
      const id = cleanId(routine?.id);
      const bundle = await readBundle(id);
      const saved = await persistRoutine({
        challenges: bundle.challenges,
        routine,
      });
      return {
        routine: saved,
        summary: getRotationRoutineSummary(saved),
      };
    });

  const recordTime = (routineId, durationSeconds, options = {}) =>
    enqueueMutation(async () => {
      const bundle = await readBundle(routineId);
      const transition = recordRotationTime(
        bundle.routine,
        durationSeconds,
        options
      );
      if (
        bundle.entries.some(
          (entry) => cleanId(entry?.id) === transition.entry.id
        )
      ) {
        fail('ENTRY_ID_DUPLICATE', '이미 사용 중인 시간 기록 ID입니다.');
      }
      const entries = [...bundle.entries, transition.entry];
      const saved = await persistRoutine({
        challenges: bundle.challenges,
        routine: transition.routine,
        entries,
      });

      return {
        ...transition,
        routine: saved,
        summary: getRotationRoutineSummary(saved),
      };
    });

  const deferCurrent = (routineId, options = {}) =>
    enqueueMutation(async () => {
      const bundle = await readBundle(routineId);
      const transition = deferCurrentRotationItem(bundle.routine, options);
      const saved = await persistRoutine({
        challenges: bundle.challenges,
        routine: transition.routine,
      });

      return {
        ...transition,
        routine: saved,
        summary: getRotationRoutineSummary(saved),
      };
    });

  const undoLast =
(routineId, options = {}) =>
    enqueueMutation(async () => {
      const bundle = await readBundle(routineId);
      const transition = undoLastRotationAction(bundle.routine, options);
      let entries;

      if (transition.entryIdToRemove) {
        const lastEntry = bundle.entries[bundle.entries.length - 1];
        if (cleanId(lastEntry?.id) !== transition.entryIdToRemove) {
          fail(
            'UNDO_ENTRY_OUT_OF_SYNC',
            '마지막 시간 기록이 변경되어 취소할 수 없습니다.'
          );
        }
        entries = bundle.entries.slice(0, -1);
      }

      const saved = await persistRoutine({
        challenges: bundle.challenges,
        routine: transition.routine,
        entries,
      });

      return {
        ...transition,
        routine: saved,
        summary: getRotationRoutineSummary(saved),
      };
    });

  const setPaused = (routineId, paused, options = {}) =>
    enqueueMutation(async () => {
      const bundle = await readBundle(routineId);
      const routine = setRotationRoutinePaused(
        bundle.routine,
        paused,
        options
      );
      const saved = await persistRoutine({
        challenges: bundle.challenges,
        routine,
      });

      return {
        routine: saved,
        summary: getRotationRoutineSummary(saved),
      };
    });

  return {
    createAndSave,
    load,
    loadEntries,
    loadSnapshot,
    save,
    recordTime,
    deferCurrent,
    undoLast,
    setPaused,
  };
}

const defaultStore = createRotationRoutineStore();

export const createAndSaveRotationRoutine = (...args) =>
  defaultStore.createAndSave(...args);

export const loadRotationRoutine = (...args) => defaultStore.load(...args);

export const loadRotationRoutineEntries = (...args) =>
  defaultStore.loadEntries(...args);

export const loadRotationRoutineSnapshot = (...args) =>
  defaultStore.loadSnapshot(...args);

export const saveRotationRoutine = (...args) => defaultStore.save(...args);

export const recordRotationTimeAndSave = (...args) =>
  defaultStore.recordTime(...args);

export const deferCurrentRotationItemAndSave = (...args) =>
  defaultStore.deferCurrent(...args);

export const undoLastRotationActionAndSave = (...args) =>
  defaultStore.undoLast(...args);

export const setRotationRoutinePausedAndSave = (...args) =>
  defaultStore.setPaused(...args);
