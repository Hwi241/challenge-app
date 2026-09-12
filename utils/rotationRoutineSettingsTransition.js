import {
  RotationRoutineError,
  createRotationCycle,
  getRotationRoutineSummary,
  normalizeRotationRoutine,
} from './rotationRoutine';
import { updateRotationRoutineSettings } from './rotationRoutineSettings';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function requireRoutine(routine) {
  const base = normalizeRotationRoutine(routine);
  if (!base?.id) {
    throw new RotationRoutineError(
      'INVALID_ROTATION_ROUTINE',
      '유효한 순환 루틴이 아닙니다.',
    );
  }
  return base;
}

// 확인창을 띄운 뒤 진행 상태까지 달라졌는지 검사할 때 사용한다.
export function getRotationSettingsApplyRevision(routine) {
  const base = requireRoutine(routine);
  return JSON.stringify([
    base.id, base.title, base.description, base.status, base.rotation,
  ]);
}

// 기존 목록의 상대 순서를 보존하며 누락된 활동을 기준 순서에 삽입한다.
function insertMissing(existing, reference, allowed) {
  const result = existing.filter((id) => allowed.has(id));
  const included = new Set(result);
  reference.forEach((id, index) => {
    if (!allowed.has(id) || included.has(id)) return;
    const following = reference.slice(index + 1).find((next) => included.has(next));
    const position = following === undefined ? result.length : result.indexOf(following);
    result.splice(position, 0, id);
    included.add(id);
  });
  return result;
}

function completedCycleRecord(routineId, cycle, now) {
  return {
    id: ['rotation_cycle', routineId, cycle.number].join('_'),
    number: cycle.number,
    startedAt: cycle.startedAt,
    completedAt: now,
    targetSeconds: cycle.itemSnapshots.reduce(
      (sum, item) => sum + item.targetSeconds, 0,
    ),
    actualSeconds: cycle.actualSecondsTotal,
    items: cycle.itemSnapshots.map((item) => ({
      itemId: item.id,
      name: item.name,
      targetSeconds: item.targetSeconds,
      creditedSeconds: cycle.progressSecondsByItem[item.id],
      actualSeconds: cycle.actualSecondsByItem[item.id],
    })),
  };
}

export function transitionRotationRoutineSettings(routine, input, options = {}) {
  const base = requireRoutine(routine);
  const settings = updateRotationRoutineSettings(base, input, options);
  const baseResult = {
    changed: settings.result.changed,
    requiresConfirmation: false,
    completedItemIds: [],
    completedCycle: false,
    retainedDeletedItemIds: [],
    removedItemIds: [],
    addedItemIds: [],
    previousProgressPct: getRotationRoutineSummary(base).progressPct,
    previousCycleNumber: base.rotation.activeCycle.number,
  };
  if (!settings.result.changed) {
    return {
      routine: base,
      summary: getRotationRoutineSummary(base),
      result: baseResult,
    };
  }

  const configured = settings.routine.rotation.items;
  // 기본 활동 설정이 같으면 제목·설명만 반영한다.
  if (same(configured, base.rotation.items)) {
    return {
      ...settings,
      summary: getRotationRoutineSummary(settings.routine),
      result: baseResult,
    };
  }

  const oldCycle = base.rotation.activeCycle;
  const configuredById = new Map(configured.map((item) => [item.id, item]));
  const oldSnapshotIds = new Set(oldCycle.itemSnapshots.map((item) => item.id));
  const snapshots = [];
  const progress = {};
  const actual = {};
  const completedItemIds = [];
  const retainedDeletedItemIds = [];
  const removedItemIds = [];
  const addedItemIds = [];

  const append = (item, credited, performed) => {
    snapshots.push({ ...item, order: snapshots.length });
    progress[item.id] = credited;
    actual[item.id] = performed;
  };

  oldCycle.itemSnapshots.forEach((item) => {
    const credited = oldCycle.progressSecondsByItem[item.id] ?? 0;
    const performed = oldCycle.actualSecondsByItem[item.id] ?? 0;
    const completed = credited >= item.targetSeconds;
    const next = configuredById.get(item.id);
    if (!next) {
      if (completed || performed > 0 || credited > 0) {
        append(item, credited, performed);
        retainedDeletedItemIds.push(item.id);
      } else {
        removedItemIds.push(item.id);
      }
      return;
    }
    const targetSeconds = completed ? item.targetSeconds : next.targetSeconds;
    const nextProgress = Math.min(credited, targetSeconds);
    append(
      { ...item, name: next.name, targetSeconds },
      nextProgress,
      performed,
    );
    if (!completed && nextProgress >= targetSeconds) completedItemIds.push(item.id);
  });

  configured.forEach((item) => {
    if (oldSnapshotIds.has(item.id)) return;
    append(item, 0, 0);
    addedItemIds.push(item.id);
  });

  const remaining = new Set(
    snapshots.filter((item) => progress[item.id] < item.targetSeconds)
      .map((item) => item.id),
  );
  const oldDefaultIds = base.rotation.items.map((item) => item.id);
  const newDefaultIds = configured.map((item) => item.id);
  const oldDefaultSet = new Set(oldDefaultIds);
  const newDefaultSet = new Set(newDefaultIds);
  const defaultReordered = !same(
    oldDefaultIds.filter((id) => newDefaultSet.has(id)),
    newDefaultIds.filter((id) => oldDefaultSet.has(id)),
  );

  let queue;
  if (defaultReordered) {
    queue = newDefaultIds.filter((id) => remaining.has(id));
    queue = insertMissing(queue, oldCycle.queue, remaining);
  } else {
    queue = insertMissing(oldCycle.queue, newDefaultIds, remaining);
  }
  queue = insertMissing(queue, snapshots.map((item) => item.id), remaining);
  const currentId = oldCycle.queue[0];
  if (
    remaining.has(currentId)
    && (oldCycle.actualSecondsByItem[currentId] ?? 0) > 0
  ) {
    queue = [currentId, ...queue.filter((id) => id !== currentId)];
  }

  const adjustedCycle = {
    ...oldCycle,
    itemSnapshots: snapshots,
    queue,
    progressSecondsByItem: progress,
    actualSecondsByItem: actual,
    actualSecondsTotal: Object.values(actual).reduce((sum, value) => sum + value, 0),
  };
  const completedCycle = queue.length === 0;
  const currentCycleChanged = !same(adjustedCycle, oldCycle);
  const now = options.now ?? settings.routine.updatedAt;
  const rotation = {
    ...settings.routine.rotation,
    activeCycle: completedCycle
      ? createRotationCycle(configured, oldCycle.number + 1, now)
      : adjustedCycle,
    cycleHistory: completedCycle
      ? [...base.rotation.cycleHistory, completedCycleRecord(base.id, adjustedCycle, now)]
      : base.rotation.cycleHistory,
    completedCycleCount: completedCycle
      ? Math.max(base.rotation.completedCycleCount + 1, oldCycle.number)
      : base.rotation.completedCycleCount,
    lastAction: currentCycleChanged ? null : base.rotation.lastAction,
  };
  const next = { ...settings.routine, rotation };
  return {
    routine: next,
    summary: getRotationRoutineSummary(next),
    result: {
      ...baseResult,
      requiresConfirmation: completedCycle || completedItemIds.length > 0,
      completedItemIds,
      completedCycle,
      retainedDeletedItemIds,
      removedItemIds,
      addedItemIds,
      defaultReordered,
      nextCycleNumber: rotation.activeCycle.number,
      nextItemId: rotation.activeCycle.queue[0] ?? null,
    },
  };
}
