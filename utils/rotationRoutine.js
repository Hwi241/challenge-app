export const ROTATION_ROUTINE_TYPE = 'rotation';
export const ROTATION_ROUTINE_VERSION = 1;
export const ROTATION_TIME_ENTRY_KIND = 'rotation_time';

const ACTIVE_STATUS = 'active';
const PAUSED_STATUS = 'paused';

export class RotationRoutineError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RotationRoutineError';
    this.code = code;
  }
}

const fail = (code, message) => {
  throw new RotationRoutineError(code, message);
};

const toInteger = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
};

const toNonNegativeInteger = (value, fallback = 0) =>
  Math.max(0, toInteger(value, fallback));

const toPositiveInteger = (value, fallback = 0) => {
  const number = toInteger(value, fallback);
  return number > 0 ? number : fallback;
};

const cleanText = (value) => String(value ?? '').trim();

const targetSecondsOf = (item) => {
  const seconds = Number(item?.targetSeconds);
  if (Number.isFinite(seconds)) return Math.round(seconds);

  const minutes = Number(item?.targetMinutes);
  if (Number.isFinite(minutes)) return Math.round(minutes * 60);

  return 0;
};

export function createRotationId(prefix = 'rotation', now = Date.now()) {
  const safePrefix = cleanText(prefix) || 'rotation';
  const timestamp = toNonNegativeInteger(now, Date.now());
  const random = Math.random().toString(36).slice(2, 10);
  return [safePrefix, timestamp, random].join('_');
}

const getIdFactory = (options = {}) =>
  typeof options.idFactory === 'function'
    ? options.idFactory
    : (prefix) => createRotationId(prefix, options.now ?? Date.now());

export function validateRotationRoutineInput({ title, items } = {}) {
  if (!cleanText(title)) {
    return { ok: false, reason: 'TITLE_EMPTY' };
  }

  if (!Array.isArray(items) || items.length < 2) {
    return { ok: false, reason: 'ITEMS_MIN_TWO' };
  }

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!(item && typeof item === 'object' && cleanText(item.name ?? item.title))) {
      return { ok: false, reason: 'ITEM_NAME_EMPTY', itemIndex: index };
    }
    if (targetSecondsOf(item) <= 0) {
      return { ok: false, reason: 'ITEM_TARGET_INVALID', itemIndex: index };
    }
  }

  return { ok: true };
}

export function normalizeRotationItems(items, options = {}) {
  if (!Array.isArray(items)) return [];

  const idFactory = getIdFactory(options);
  const seenIds = new Set();

  return items
    .map((raw, index) => {
      if (!raw || typeof raw !== 'object') return null;

      const name = cleanText(raw.name ?? raw.title);
      const targetSeconds = targetSecondsOf(raw);
      if (!name || targetSeconds <= 0) return null;

      let id = cleanText(raw.id ?? raw.itemId);
      let idAttempt = 0;
      while (!id || seenIds.has(id)) {
        const generated = cleanText(idFactory('rotation_item'));
        id = generated && !seenIds.has(generated)
          ? generated
          : ['rotation_item', index, idAttempt].join('_');
        idAttempt += 1;
      }
      seenIds.add(id);

      const sourceOrder = Number.isFinite(Number(raw.order))
        ? Number(raw.order)
        : index;

      return {
        id,
        name,
        targetSeconds,
        sourceOrder,
        sourceIndex: index,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sourceOrder - b.sourceOrder || a.sourceIndex -
b.sourceIndex)
    .map(({ sourceOrder, sourceIndex, ...item }, order) => ({ ...item, order }));
}

const snapshotItems = (items) =>
  items.map((item, order) => ({
    id: String(item.id),
    name: cleanText(item.name),
    targetSeconds: toPositiveInteger(item.targetSeconds),
    order,
  }));

export function createRotationCycle(items, cycleNumber = 1, now = Date.now()) {
  const itemSnapshots = snapshotItems(items);
  const progressSecondsByItem = {};
  const actualSecondsByItem = {};

  for (const item of itemSnapshots) {
    progressSecondsByItem[item.id] = 0;
    actualSecondsByItem[item.id] = 0;
  }

  return {
    number: Math.max(1, toInteger(cycleNumber, 1)),
    startedAt: toNonNegativeInteger(now, Date.now()),
    itemSnapshots,
    queue: itemSnapshots.map((item) => item.id),
    progressSecondsByItem,
    actualSecondsByItem,
    actualSecondsTotal: 0,
  };
}

const normalizeCycle = (rawCycle, configuredItems, completedCycleCount, options = {}) => {
  const now = toNonNegativeInteger(options.now, Date.now());
  const rawSnapshots = Array.isArray(rawCycle?.itemSnapshots)
    ? rawCycle.itemSnapshots
    : configuredItems;
  const itemSnapshots = normalizeRotationItems(rawSnapshots, options);

  if (!itemSnapshots.length) {
    return createRotationCycle(configuredItems, completedCycleCount + 1, now);
  }

  const snapshotById = new Map(itemSnapshots.map((item) => [item.id, item]));
  const progressSecondsByItem = {};
  const actualSecondsByItem = {};

  for (const item of itemSnapshots) {
    progressSecondsByItem[item.id] = Math.min(
      item.targetSeconds,
      toNonNegativeInteger(rawCycle?.progressSecondsByItem?.[item.id])
    );
    actualSecondsByItem[item.id] = toNonNegativeInteger(
      rawCycle?.actualSecondsByItem?.[item.id]
    );
  }

  const queue = [];
  const queuedIds = new Set();
  const rawQueue = Array.isArray(rawCycle?.queue) ? rawCycle.queue : [];

  for (const rawId of rawQueue) {
    const id = cleanText(rawId);
    const item = snapshotById.get(id);
    if (!item || queuedIds.has(id)) continue;
    if (progressSecondsByItem[id] >= item.targetSeconds) continue;
    queuedIds.add(id);
    queue.push(id);
  }

  for (const item of itemSnapshots) {
    if (
      !queuedIds.has(item.id) &&
      progressSecondsByItem[item.id] < item.targetSeconds
    ) {
      queuedIds.add(item.id);
      queue.push(item.id);
    }
  }

  return {
    number: Math.max(1, toInteger(rawCycle?.number, completedCycleCount + 1)),
    startedAt: toNonNegativeInteger(rawCycle?.startedAt, now),
    itemSnapshots,
    queue,
    progressSecondsByItem,
    actualSecondsByItem,
    actualSecondsTotal: Object.values(actualSecondsByItem).reduce(
      (sum, seconds) => sum + seconds,
      0
    ),
  };
};

const normalizeCycleHistory = (history) =>
  (Array.isArray(history) ? history : [])
    .filter((record) => record && typeof record === 'object')
    .map((record) => ({
      ...record,
      number: Math.max(1, toInteger(record.number, 1)),
      startedAt: toNonNegativeInteger(record.startedAt),
      completedAt: toNonNegativeInteger(record.completedAt),
      targetSeconds: toNonNegativeInteger(record.targetSeconds),
      actualSeconds: toNonNegativeInteger(record.actualSeconds),
      items: Array.isArray(record.items)
        ? record.items.map((item) => ({
            ...item,
            itemId: cleanText(item?.itemId ?? item?.id),
            name: cleanText(item?.name),
            targetSeconds: toNonNegativeInteger(item?.targetSeconds),
            creditedSeconds: toNonNegativeInteger(item?.creditedSeconds),
            actualSeconds: toNonNegativeInteger(item?.actualSeconds),
          }))
        : [],
    }));

const cloneCycle = (cycle) => ({
  ...cycle,
  itemSnapshots: cycle.itemSnapshots.map((item) => ({ ...item })),
  queue: [...cycle.queue],
  progressSecondsByItem: { ...cycle.progressSecondsByItem },
  actualSecondsByItem: { ...cycle.actualSecondsByItem
},
});

export function normalizeRotationRoutine(rawRoutine, options = {}) {
  if (!rawRoutine || typeof rawRoutine !== 'object') return null;
  if (
    rawRoutine.type !== ROTATION_ROUTINE_TYPE &&
    (!rawRoutine.rotation || typeof rawRoutine.rotation !== 'object')
  ) {
    return null;
  }

  const now = toNonNegativeInteger(options.now, Date.now());
  const rawRotation = rawRoutine.rotation || {};
  const items = normalizeRotationItems(rawRotation.items, options);
  if (items.length < 2) return null;

  const cycleHistory = normalizeCycleHistory(rawRotation.cycleHistory);
  const completedCycleCount = Math.max(
    toNonNegativeInteger(rawRotation.completedCycleCount),
    cycleHistory.length
  );
  const activeCycle = normalizeCycle(
    rawRotation.activeCycle,
    items,
    completedCycleCount,
    options
  );
  const derivedTotalActualSeconds =
    cycleHistory.reduce((sum, cycle) => sum + cycle.actualSeconds, 0) +
    activeCycle.actualSecondsTotal;

  return {
    ...rawRoutine,
    id: cleanText(rawRoutine.id),
    type: ROTATION_ROUTINE_TYPE,
    title: cleanText(rawRoutine.title) || '순환 루틴',
    description: cleanText(rawRoutine.description),
    goalScore: 0,
    currentScore: 0,
    startDate: null,
    endDate: null,
    reward: '',
    notification: { mode: null, payload: null },
    status: rawRoutine.status === PAUSED_STATUS ? PAUSED_STATUS : ACTIVE_STATUS,
    createdAt: toNonNegativeInteger(rawRoutine.createdAt, now),
    completedAt: 0,
    updatedAt: toNonNegativeInteger(rawRoutine.updatedAt, now),
    rotation: {
      ...rawRotation,
      version: ROTATION_ROUTINE_VERSION,
      items,
      activeCycle,
      completedCycleCount,
      totalActualSeconds: Math.max(
        toNonNegativeInteger(rawRotation.totalActualSeconds),
        derivedTotalActualSeconds
      ),
      cycleHistory,
      lastAction:
        rawRotation.lastAction && typeof rawRotation.lastAction === 'object'
          ? rawRotation.lastAction
          : null,
    },
  };
}

const requireRoutine = (routine, options = {}) => {
  const normalized = normalizeRotationRoutine(routine, options);
  if (!normalized?.id) {
    fail('INVALID_ROTATION_ROUTINE', '유효한 순환 루틴이 아닙니다.');
  }
  return normalized;
};

export function createRotationRoutine(input = {}, options = {}) {
  const validation = validateRotationRoutineInput(input);
  if (!validation.ok) {
    fail(validation.reason, '순환 루틴 입력값이 올바르지 않습니다.');
  }

  const now = toNonNegativeInteger(options.now, Date.now());
  const idFactory = getIdFactory({ ...options, now });
  const items = normalizeRotationItems(input.items, { ...options, now, idFactory });
  const id = cleanText(input.id) || cleanText(idFactory('ch'));

  if (!id || items.length < 2) {
    fail('INVALID_ROTATION_ROUTINE', '순환 루틴을 만들 수 없습니다.');
  }

  return {
    id,
    type: ROTATION_ROUTINE_TYPE,
    title: cleanText(input.title),
    description: cleanText(input.description),
    goalScore: 0,
    currentScore: 0,
    startDate: null,
    endDate: null,
    reward: '',
    notification: { mode: null, payload: null },
    status: ACTIVE_STATUS,
    createdAt: now,
    completedAt: 0,
    updatedAt: now,
    rotation: {
      version: ROTATION_ROUTINE_VERSION,
      items,
      activeCycle: createRotationCycle(items, 1, now),
      completedCycleCount: 0,
      totalActualSeconds: 0,
      cycleHistory: [],
      lastAction: null,
    },
  };
}

const itemState = (item, cycle, currentItemId, queueIndexById) => {
  const progressSeconds = toNonNegativeInteger(
    cycle.progressSecondsByItem[item.id]
  );
  const actualSeconds = toNonNegativeInteger(
    cycle.actualSecondsByItem[item.id]
  );
  const remainingSeconds = Math.max(0, item.targetSeconds - progressSeconds);
  const completed = remainingSeconds === 0;

  return {
    ...item,
    progressSeconds,
    actualSeconds,
    remainingSeconds,
    progressPct: item.targetSeconds > 0
      ? Math.min(100,
Math.round((progressSeconds / item.targetSeconds) * 100))
      : 0,
    completed,
    current: item.id === currentItemId,
    queueIndex: queueIndexById.has(item.id)
      ? queueIndexById.get(item.id)
      : -1,
  };
};

export function getRotationRoutineSummary(routine) {
  const normalized = requireRoutine(routine);
  const cycle = normalized.rotation.activeCycle;
  const currentItemId = cycle.queue[0] || null;
  const nextItemId = cycle.queue[1] || null;
  const queueIndexById = new Map(cycle.queue.map((id, index) => [id, index]));
  const cycleItems = cycle.itemSnapshots.map((item) =>
    itemState(item, cycle, currentItemId, queueIndexById)
  );
  const stateById = new Map(cycleItems.map((item) => [item.id, item]));
  const remainingItems = cycle.queue
    .map((id) => stateById.get(id))
    .filter(Boolean);
  const totalTargetSeconds = cycleItems.reduce(
    (sum, item) => sum + item.targetSeconds,
    0
  );
  const totalProgressSeconds = cycleItems.reduce(
    (sum, item) => sum + item.progressSeconds,
    0
  );

  return {
    routineId: normalized.id,
    title: normalized.title,
    paused: normalized.status === PAUSED_STATUS,
    currentCycleNumber: cycle.number,
    completedCycleCount: normalized.rotation.completedCycleCount,
    currentItem: currentItemId ? stateById.get(currentItemId) || null : null,
    nextItem: nextItemId ? stateById.get(nextItemId) || null : null,
    cycleItems,
    remainingItems,
    completedItemsCount: cycleItems.filter((item) => item.completed).length,
    totalTargetSeconds,
    totalProgressSeconds,
    totalRemainingSeconds: Math.max(0, totalTargetSeconds - totalProgressSeconds),
    progressPct: totalTargetSeconds > 0
      ? Math.min(100, Math.round((totalProgressSeconds / totalTargetSeconds) * 100))
      : 0,
    totalActualSeconds: normalized.rotation.totalActualSeconds,
    canDefer: cycle.queue.length > 1,
    canUndo: !!normalized.rotation.lastAction,
  };
}

const createLastAction = (routine, type, entryId = null) => ({
  type,
  entryId,
  beforeActiveCycle: cloneCycle(routine.rotation.activeCycle),
  beforeCompletedCycleCount: routine.rotation.completedCycleCount,
  beforeTotalActualSeconds: routine.rotation.totalActualSeconds,
  beforeCycleHistoryLength: routine.rotation.cycleHistory.length,
});

const createCompletedCycleRecord = (routineId, cycle, completedAt) => {
  const targetSeconds = cycle.itemSnapshots.reduce(
    (sum, item) => sum + item.targetSeconds,
    0
  );

  return {
    id: ['rotation_cycle', routineId, cycle.number].join('_'),
    number: cycle.number,
    startedAt: cycle.startedAt,
    completedAt,
    targetSeconds,
    actualSeconds: cycle.actualSecondsTotal,
    items: cycle.itemSnapshots.map((item) => ({
      itemId: item.id,
      name: item.name,
      targetSeconds: item.targetSeconds,
      creditedSeconds: toNonNegativeInteger(
        cycle.progressSecondsByItem[item.id]
      ),
      actualSeconds: toNonNegativeInteger(
        cycle.actualSecondsByItem[item.id]
      ),
    })),
  };
};

export function recordRotationTime(routine, durationSeconds, options = {}) {
  const now = toNonNegativeInteger(options.now, Date.now());
  const base = requireRoutine(routine, { ...options, now });

  if (base.status === PAUSED_STATUS) {
    fail('ROUTINE_PAUSED', '일시정지된 순환 루틴입니다.');
  }

  const duration = toPositiveInteger(durationSeconds);
  if (!duration) {
    fail('DURATION_INVALID', '기록 시간은 0보다 커야 합니다.');
  }

  const activeCycle = cloneCycle(base.rotation.activeCycle);
  const itemId = activeCycle.queue[0];
  const item = activeCycle.itemSnapshots.find((candidate) => candidate.id === itemId);
  if (!item) {
    fail('CURRENT_ITEM_MISSING', '현재 활동을 찾을 수 없습니다.');
  }

  const idFactory = getIdFactory({ ...options, now });
  const entryId = cleanText(options.entryId) || cleanText(idFactory('rotation_entry'));
  if (!entryId) {
    fail('ENTRY_ID_INVALID', '기록 ID를 만들 수 없습니다.');
  }

  const previousProgress =
toNonNegativeInteger(
    activeCycle.progressSecondsByItem[itemId]
  );
  const remainingBefore = Math.max(0, item.targetSeconds - previousProgress);
  const creditedSeconds = Math.min(duration, remainingBefore);
  const nextProgress = Math.min(
    item.targetSeconds,
    previousProgress + creditedSeconds
  );

  activeCycle.progressSecondsByItem[itemId] = nextProgress;
  activeCycle.actualSecondsByItem[itemId] =
    toNonNegativeInteger(activeCycle.actualSecondsByItem[itemId]) + duration;
  activeCycle.actualSecondsTotal += duration;

  const completedItem = nextProgress >= item.targetSeconds;
  if (completedItem) activeCycle.queue.shift();

  const lastAction = createLastAction(base, 'time', entryId);
  let completedCycle = false;
  let completedCycleCount = base.rotation.completedCycleCount;
  let cycleHistory = [...base.rotation.cycleHistory];
  let nextActiveCycle = activeCycle;

  if (activeCycle.queue.length === 0) {
    completedCycle = true;
    cycleHistory.push(createCompletedCycleRecord(base.id, activeCycle, now));
    completedCycleCount = Math.max(completedCycleCount + 1, activeCycle.number);
    nextActiveCycle = createRotationCycle(
      base.rotation.items,
      activeCycle.number + 1,
      now
    );
  }

  const nextRoutine = {
    ...base,
    updatedAt: now,
    rotation: {
      ...base.rotation,
      activeCycle: nextActiveCycle,
      completedCycleCount,
      totalActualSeconds: base.rotation.totalActualSeconds + duration,
      cycleHistory,
      lastAction,
    },
  };

  const entry = {
    id: entryId,
    kind: ROTATION_TIME_ENTRY_KIND,
    routineId: base.id,
    itemId,
    itemName: item.name,
    cycleNumber: activeCycle.number,
    timestamp: now,
    createdAt: now,
    duration: Math.round((duration / 60) * 100) / 100,
    durationSeconds: duration,
    creditedSeconds,
    completedItem,
    completedCycle,
  };

  return {
    routine: nextRoutine,
    entry,
    result: {
      itemId,
      completedItem,
      completedCycle,
      creditedSeconds,
      overflowSeconds: Math.max(0, duration - creditedSeconds),
      nextItemId: nextActiveCycle.queue[0] || null,
      nextCycleNumber: nextActiveCycle.number,
    },
  };
}

export function reorderRotationCycleItems(routine, orderedItemIds, options = {}) {
  const now = toNonNegativeInteger(options.now, Date.now());
  const base = requireRoutine(routine, { ...options, now });
  const cycle = base.rotation.activeCycle;
  const expectedQueue = options.expectedQueue;

  if (!Array.isArray(expectedQueue)) {
    fail('ORDER_EXPECTATION_REQUIRED', '순서를 변경하기 전 상태가 필요합니다.');
  }
  const sameExpectedQueue = expectedQueue.length === cycle.queue.length
    && expectedQueue.every((id, index) => id === cycle.queue[index]);
  if (options.expectedCycleNumber !== cycle.number) {
    fail('ORDER_STATE_CHANGED', '회전이 변경되었습니다. 최신 순서를 확인하고 다시 변경해주세요.');
  }
  if (!sameExpectedQueue) {
    fail('ORDER_STATE_CHANGED', '진행 순서가 변경되었습니다. 최신 순서를 확인하고 다시 변경해주세요.');
  }
  if (!Array.isArray(orderedItemIds)) {
    fail('ORDER_INVALID', '활동 순서가 올바르지 않습니다.');
  }
  const requestedQueue = [...orderedItemIds];
  const validIds = requestedQueue.every(
    (id) => typeof id === 'string' && id.length > 0,
  );
  if (!validIds) {
    fail('ORDER_INVALID', '활동 ID가 올바르지 않습니다.');
  }
  const uniqueIds = new Set(requestedQueue);
  const currentIds = new Set(cycle.queue);
  const completePermutation = requestedQueue.length === cycle.queue.length
    && uniqueIds.size === cycle.queue.length
    && requestedQueue.every((id) => currentIds.has(id));
  if (!completePermutation) {
    fail('ORDER_INVALID', '미완료 활동을 빠짐없이 한 번씩 포함해야 합니다.');
  }
  const unchanged = requestedQueue.every((id, index) => id === cycle.queue[index]);
  if (unchanged) {
    return {
      routine: base,
      result: { changed: false, currentItemId: cycle.queue[0] ?? null },
    };
  }
  return {
    routine: {
      ...base,
      updatedAt: now,
      rotation: {
        ...base.rotation,
        activeCycle: {
          ...cycle,
          queue: requestedQueue,
        },
        lastAction: null,
      },
    },
    result: {
      changed: true,
      currentItemId: requestedQueue[0] ?? null,
      nextItemId: requestedQueue[1] ?? null,
    },
  };
}

export function deferCurrentRotationItem(routine, options = {}) {
  const now = toNonNegativeInteger(options.now, Date.now());
  const base = requireRoutine(routine, { ...options, now });

  if (base.status === PAUSED_STATUS) {
    fail('ROUTINE_PAUSED', '일시정지된 순환 루틴입니다.');
  }

  const activeCycle = cloneCycle(base.rotation.activeCycle);
  if (activeCycle.queue.length <= 1) {
    fail('NOTHING_TO_DEFER', '미룰 수 있는 다른 활동이 없습니다.');
  }

  const deferredItemId = activeCycle.queue.shift();
  activeCycle.queue.push(deferredItemId);

  const nextRoutine = {
    ...base,
    updatedAt: now,
    rotation: {
      ...base.rotation,
      activeCycle,
      lastAction: createLastAction(base, 'defer'),
    },
  };

  return {
    routine: nextRoutine,
    result: {
      deferredItemId,
      currentItemId: activeCycle.queue[0] || null,
      nextItemId: activeCycle.queue[1] || null,
    },
  };
}

export function undoLastRotationAction(routine, options = {}) {
  const now = toNonNegativeInteger(options.now, Date.now());
  const base = requireRoutine(routine, { ...options, now });
  const lastAction = base.rotation.lastAction;

  if (!lastAction || !lastAction.beforeActiveCycle) {
    fail('NOTHING_TO_UNDO', '취소할 작업이 없습니다.');
  }

  const restoredCycle = normalizeCycle(
    lastAction.beforeActiveCycle,
    base.rotation.items,
    toNonNegativeInteger(lastAction.beforeCompletedCycleCount),
    { ...options, now }
  );
  const historyLength = Math.min(
    base.rotation.cycleHistory.length,
    toNonNegativeInteger(lastAction.beforeCycleHistoryLength)
  );

  return {
    routine: {
      ...base,
      updatedAt: now,
      rotation: {
        ...base.rotation,
        activeCycle: restoredCycle,

completedCycleCount: toNonNegativeInteger(
          lastAction.beforeCompletedCycleCount
        ),
        totalActualSeconds: toNonNegativeInteger(
          lastAction.beforeTotalActualSeconds
        ),
        cycleHistory: base.rotation.cycleHistory.slice(0, historyLength),
        lastAction: null,
      },
    },
    entryIdToRemove:
      lastAction.type === 'time' ? cleanText(lastAction.entryId) || null : null,
    undoneType: lastAction.type,
  };
}

export function setRotationRoutinePaused(routine, paused, options = {}) {
  const now = toNonNegativeInteger(options.now, Date.now());
  const base = requireRoutine(routine, { ...options, now });

  return {
    ...base,
    status: paused ? PAUSED_STATUS : ACTIVE_STATUS,
    updatedAt: now,
  };
}
