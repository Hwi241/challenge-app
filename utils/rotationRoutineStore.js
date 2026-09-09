import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  editRotationEntry,
  deleteRotationEntry,
  cancelRotationCompletionEntry,
} from './rotationRoutineEntryEditing';

import { syncWidgetChallengeList } from './widgetSync';
import {
  RotationRoutineError,
  createRotationRoutine,
  deferCurrentRotationItem,
  getRotationRoutineSummary,
  normalizeRotationRoutine,
  recordRotationTime,
  reorderRotationCycleItems,
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

    const cached = parseObject(
      valueByKey.get(challengeKey(id)),
      challengeKey(id)
    );
    const listedUpdatedAt = Number(listed?.updatedAt ?? 0);
    const cachedUpdatedAt = Number(cached?.updatedAt ?? 0);
    let routineSource = listed ?? cached;

    if (cached) {
      const shouldUseCached = !listed
        ? true
        : cachedUpdatedAt >= listedUpdatedAt;
      if (shouldUseCached) routineSource = cached;
    }

    const routine = normalizeRotationRoutine(routineSource);
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
      const cycle = bundle.routine.rotation.activeCycle;
      const currentItemId = cycle.queue[0];
      const currentProgress = cycle.progressSecondsByItem[currentItemId];
      const stateChanged = [
        options.expectedItemId !== undefined
          && cleanId(options.expectedItemId) !== cleanId(currentItemId),
        options.expectedCycleNumber !== undefined
          && Number(options.expectedCycleNumber) !== cycle.number,
        options.expectedProgressSeconds !== undefined
          && Number(options.expectedProgressSeconds) !== currentProgress,
      ].some(Boolean);
      if (stateChanged) {
        fail(
          'ROTATION_RECORD_STATE_CHANGED',
          '현재 활동이나 진행 상태가 변경되었습니다. 입력 내용을 확인한 뒤 다시 기록해주세요.'
        );
      }

      const entryContent = {};
      if (Object.prototype.hasOwnProperty.call(options, 'text')) {
        if (typeof options.text !== 'string') {
          fail('ENTRY_TEXT_INVALID', '기록 내용이 올바르지 않습니다.');
        }
        const entryText = options.text.trim();
        if (entryText.length > 500) {
          fail('ENTRY_TEXT_TOO_LONG', '기록 내용은 500자 이내로 입력해주세요.');
        }
        entryContent.text = entryText;
      }
      if (Object.prototype.hasOwnProperty.call(options, 'imageUri')) {
        if (options.imageUri != null && typeof options.imageUri !== 'string') {
          fail('ENTRY_IMAGE_INVALID', '사진 정보가 올바르지 않습니다.');
        }
        entryContent.imageUri = options.imageUri == null ? null : options.imageUri;
      }

      const transition = recordRotationTime(
        bundle.routine,
        durationSeconds,
        options
      );
      transition.entry = { ...transition.entry, ...entryContent };
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

  const mutateEntry = (routineId, entryId, transitionFn) =>
    enqueueMutation(async () => {
      const bundle = await readBundle(routineId);
      const transition = transitionFn(bundle.routine, bundle.entries, entryId);
      const saved = await persistRoutine({
        challenges: bundle.challenges,
        routine: transition.routine,
        entries: transition.entries,
      });
      return {
        ...transition,
        routine: saved,
        summary: getRotationRoutineSummary(saved),
      };
    });

  const editEntry = (routineId, entryId, changes, options = {}) =>
    mutateEntry(routineId, entryId, (routine, entries, id) =>
      editRotationEntry(routine, entries, id, changes, options));

  const deleteEntry = (routineId, entryId, options = {}) =>
    mutateEntry(routineId, entryId, (routine, entries, id) =>
      deleteRotationEntry(routine, entries, id, options));

  const cancelCompletionEntry = (routineId, entryId, options = {}) =>
    mutateEntry(routineId, entryId, (routine, entries, id) =>
      cancelRotationCompletionEntry(routine, entries, id, options));

  const reorderCurrentCycle = (routineId, orderedItemIds, options = {}) => {
    const requestedQueue = Array.isArray(orderedItemIds)
      ? [...orderedItemIds]
      : orderedItemIds;
    const requestOptions = {
      ...options,
      expectedQueue: Array.isArray(options.expectedQueue)
        ? [...options.expectedQueue]
        : options.expectedQueue,
    };
    return enqueueMutation(async () => {
      const bundle = await readBundle(routineId);
      const transition = reorderRotationCycleItems(
        bundle.routine,
        requestedQueue,
        requestOptions,
      );
      if (!transition.result.changed) {
        return {
          ...transition,
          summary: getRotationRoutineSummary(bundle.routine),
        };
      }
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
  };

  return {
    reorderCurrentCycle,
    editEntry,
    deleteEntry,
    cancelCompletionEntry,
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

export const reorderRotationCycleItemsAndSave = (...args) =>
  defaultStore.reorderCurrentCycle(...args);

export const editRotationEntryAndSave = (...args) =>
  defaultStore.editEntry(...args);

export const deleteRotationEntryAndSave = (...args) =>
  defaultStore.deleteEntry(...args);

export const cancelRotationCompletionEntryAndSave = (...args) =>
  defaultStore.cancelCompletionEntry(...args);

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
