import {
  RotationRoutineError,
  normalizeRotationRoutine,
  recordRotationTime,
  undoLastRotationAction,
} from './rotationRoutine';

const idOf = (value) => String(value ?? '');
const fail = (code, message) => {
  throw new RotationRoutineError(code, message);
};

function getContext(routine, entries, entryId) {
  const base = normalizeRotationRoutine(routine);
  if (!base) fail('INVALID_ROTATION_ROUTINE', '순환 루틴을 찾을 수 없습니다.');
  if (!Array.isArray(entries)) fail('INVALID_ENTRIES', '기록을 읽을 수 없습니다.');
  const index = entries.findIndex((entry) => idOf(entry?.id) === idOf(entryId));
  if (index < 0) fail('ENTRY_NOT_FOUND', '기록이 존재하지 않습니다.');
  const entry = entries[index];
  const cycle = base.rotation.activeCycle;
  const latest = index === entries.length - 1;
  const completed = Boolean(entry.completedItem) || Boolean(entry.completedCycle);
  const current = Number(entry.cycleNumber) === cycle.number
    && idOf(entry.itemId) === idOf(cycle.queue[0]);
  const action = base.rotation.lastAction;
  return {
    base,
    entry,
    index,
    cycle,
    canEditTime: latest && current && !completed,
    canCancelCompletion: latest && completed
      && action?.type === 'time'
      && idOf(action.entryId) === idOf(entry.id)
      && Boolean(action.beforeActiveCycle),
  };
}

export function getRotationEntryEditPolicy(routine, entries, entryId) {
  const context = getContext(routine, entries, entryId);
  return {
    canEditTime: context.canEditTime,
    canDelete: context.canEditTime,
    canCancelCompletion: context.canCancelCompletion,
    reason: context.canEditTime
      ? ''
      : '시간 수정과 삭제는 현재 활동의 가장 최근 미완료 기록에서만 가능합니다.',
  };
}

export function getRotationEntryEditRevision(routine, entries, entryId) {
  const context = getContext(routine, entries, entryId);
  return JSON.stringify([
    context.base.status,
    context.base.rotation,
    context.entry,
    entries.map((entry) => idOf(entry?.id)),
  ]);
}

function checkRevision(routine, entries, entryId, options) {
  if (options.expectedRevision === undefined) return;
  const actual = getRotationEntryEditRevision(routine, entries, entryId);
  if (actual !== options.expectedRevision) {
    fail('ENTRY_CHANGED', '기록이나 진행 상태가 변경되었습니다. 뒤로 갔다가 기록을 다시 열어주세요.');
  }
}

function requireSeconds(value) {
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds)) {
    fail('DURATION_INVALID', '시간을 올바르게 입력해주세요.');
  }
  if (seconds < 1) fail('DURATION_INVALID', '시간은 0보다 커야 합니다.');
  if (seconds > 86400) fail('DURATION_INVALID', '시간은 1440분 이내로 입력해주세요.');
  return seconds;
}

function subtractCurrentEntry(context, now) {
  const { base, entry, cycle } = context;
  const itemId = entry.itemId;
  const actual = Number(entry.durationSeconds);
  const credited = Number(entry.creditedSeconds);
  if (!Number.isSafeInteger(actual)) fail('ENTRY_INVALID', '기록 시간을 확인할 수 없습니다.');
  if (!Number.isSafeInteger(credited)) fail('ENTRY_INVALID', '반영 시간을 확인할 수 없습니다.');
  if (actual < 1) fail('ENTRY_INVALID', '기록 시간이 올바르지 않습니다.');
  if (credited !== actual) fail('ENTRY_INVALID', '미완료 기록의 시간이 일치하지 않습니다.');
  const progress = cycle.progressSecondsByItem[itemId] - credited;
  const itemActual = cycle.actualSecondsByItem[itemId] - actual;
  const cycleActual = cycle.actualSecondsTotal - actual;
  const totalActual = base.rotation.totalActualSeconds - actual;
  if (![progress, itemActual, cycleActual, totalActual].every(
    (value) => Number.isSafeInteger(value) && value >= 0,
  )) {
    fail('ENTRY_OUT_OF_SYNC', '기록과 진행 상태가 일치하지 않아 변경할 수 없습니다.');
  }
  return {
    ...base,
    updatedAt: now,
    rotation: {
      ...base.rotation,
      activeCycle: {
        ...cycle,
        progressSecondsByItem: { ...cycle.progressSecondsByItem, [itemId]: progress },
        actualSecondsByItem: { ...cycle.actualSecondsByItem, [itemId]: itemActual },
        actualSecondsTotal: cycleActual,
      },
      totalActualSeconds: totalActual,
      lastAction: null,
    },
  };
}

export function editRotationEntry(routine, entries, entryId, changes, options = {}) {
  checkRevision(routine, entries, entryId, options);
  const context = getContext(routine, entries, entryId);
  const now = options.now ?? Date.now();
  const entry = context.entry;
  const edited = {
    ...entry,
    text: String(changes.text ?? entry.text ?? '').trim().slice(0, 500),
    imageUri: Object.prototype.hasOwnProperty.call(changes, 'imageUri')
      ? changes.imageUri
      : entry.imageUri,
  };
  if (edited.imageUri != null && typeof edited.imageUri !== 'string') {
    fail('IMAGE_INVALID', '사진 정보가 올바르지 않습니다.');
  }
  let nextRoutine = context.base;
  let nextEntry = edited;
  let result = { completedItem: false, completedCycle: false };
  const hasTimeChange = changes.durationSeconds !== undefined
    && Number(changes.durationSeconds) !== Number(entry.durationSeconds);
  if (hasTimeChange) {
    if (!context.canEditTime) {
      fail('ENTRY_TIME_LOCKED', '현재 활동의 가장 최근 미완료 기록만 시간을 수정할 수 있습니다.');
    }
    const seconds = requireSeconds(changes.durationSeconds);
    const before = subtractCurrentEntry(context, now);
    const transition = recordRotationTime(
      { ...before, status: 'active' },
      seconds,
      { now, entryId: entry.id },
    );
    nextRoutine = { ...transition.routine, status: context.base.status };
    nextEntry = {
      ...edited,
      duration: transition.entry.duration,
      durationSeconds: transition.entry.durationSeconds,
      creditedSeconds: transition.entry.creditedSeconds,
      completedItem: transition.entry.completedItem,
      completedCycle: transition.entry.completedCycle,
    };
    result = transition.result;
  }
  const nextEntries = [...entries];
  nextEntries[context.index] = nextEntry;
  return { routine: nextRoutine, entries: nextEntries, entry: nextEntry, result };
}

export function deleteRotationEntry(routine, entries, entryId, options = {}) {
  checkRevision(routine, entries, entryId, options);
  const context = getContext(routine, entries, entryId);
  if (!context.canEditTime) {
    fail('ENTRY_DELETE_LOCKED', '현재 활동의 가장 최근 미완료 기록만 삭제할 수 있습니다.');
  }
  return {
    routine: subtractCurrentEntry(context, options.now ?? Date.now()),
    entries: entries.slice(0, -1),
  };
}

export function cancelRotationCompletionEntry(routine, entries, entryId, options = {}) {
  checkRevision(routine, entries, entryId, options);
  const context = getContext(routine, entries, entryId);
  if (!context.canCancelCompletion) {
    fail('COMPLETION_CANCEL_LOCKED', '후속 진행이 있어 이 완료 기록을 취소할 수 없습니다.');
  }
  const transition = undoLastRotationAction(context.base, options);
  if (idOf(transition.entryIdToRemove) !== idOf(entryId)) {
    fail('UNDO_ENTRY_OUT_OF_SYNC', '취소할 기록이 일치하지 않습니다.');
  }
  return { routine: transition.routine, entries: entries.slice(0, -1) };
}
