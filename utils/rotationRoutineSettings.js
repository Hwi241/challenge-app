import {
  RotationRoutineError,
  createRotationId,
  normalizeRotationRoutine,
} from './rotationRoutine';

const fail = (code, message) => {
  throw new RotationRoutineError(code, message);
};

function requireRoutine(routine) {
  const base = normalizeRotationRoutine(routine);
  if (!base?.id) {
    fail('INVALID_ROTATION_ROUTINE', '유효한 순환 루틴이 아닙니다.');
  }
  return base;
}

function revisionOf(base) {
  return JSON.stringify([
    base.id,
    base.title,
    base.description,
    base.rotation.items.map((item) => [
      item.id, item.name, item.targetSeconds, item.order,
    ]),
  ]);
}

export function getRotationSettingsRevision(routine) {
  return revisionOf(requireRoutine(routine));
}

function readText(value, maximum, required, code, message) {
  if (typeof value !== 'string') fail(code, message);
  const result = value.trim();
  if ((required && !result) || result.length > maximum) {
    fail(code, message);
  }
  return result;
}

export function updateRotationRoutineSettings(routine, input, options = {}) {
  const base = requireRoutine(routine);
  if (typeof options.expectedRevision !== 'string') {
    fail('SETTINGS_EXPECTATION_REQUIRED', '수정 전 설정 정보가 필요합니다.');
  }
  if (options.expectedRevision !== revisionOf(base)) {
    fail(
      'ROTATION_SETTINGS_CHANGED',
      '루틴 설정이 변경되었습니다. 최신 설정을 확인한 뒤 다시 수정해주세요.',
    );
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail('SETTINGS_INPUT_INVALID', '수정할 설정이 올바르지 않습니다.');
  }

  const title = readText(
    input.title, 50, true, 'TITLE_INVALID',
    '루틴 이름을 1~50자로 입력해주세요.',
  );
  const description = readText(
    input.description, 500, false, 'DESCRIPTION_INVALID',
    '설명을 500자 이내로 입력해주세요.',
  );
  if (!Array.isArray(input.items) || input.items.length < 2) {
    fail('ITEMS_MIN_TWO', '활동을 최소 2개 등록해주세요.');
  }

  const existingIds = new Set(base.rotation.items.map((item) => item.id));
  const suppliedIds = new Set();
  const requested = input.items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      fail('ITEM_INVALID', '활동 정보가 올바르지 않습니다.');
    }
    const name = readText(
      item.name, 50, true, 'ITEM_NAME_INVALID',
      '활동 이름을 1~50자로 입력해주세요.',
    );
    const targetSeconds = item.targetSeconds;
    if (!Number.isSafeInteger(targetSeconds) || targetSeconds <= 0) {
      fail('ITEM_TARGET_INVALID', '목표 시간은 0보다 큰 정수 초여야 합니다.');
    }
    let id = null;
    if (item.id != null) {
      if (typeof item.id !== 'string' || !existingIds.has(item.id)) {
        fail('ITEM_ID_INVALID', '기존 활동 ID가 올바르지 않습니다.');
      }
      id = item.id;
      if (suppliedIds.has(id)) {
        fail('ITEM_ID_DUPLICATE', '같은 활동을 중복 등록할 수 없습니다.');
      }
      suppliedIds.add(id);
    }
    return { id, name, targetSeconds };
  });

  const now = options.now ?? Date.now();
  if (!Number.isSafeInteger(now) || now < 0) {
    fail('SETTINGS_TIME_INVALID', '설정 저장 시각이 올바르지 않습니다.');
  }
  const reservedIds = new Set(existingIds);
  const reserve = (id) => {
    if (typeof id === 'string' && id) reservedIds.add(id);
  };
  base.rotation.activeCycle.itemSnapshots.forEach((item) => reserve(item.id));
  base.rotation.cycleHistory.forEach((cycle) => {
    cycle.items.forEach((item) => reserve(item.itemId));
  });
  base.rotation.lastAction?.beforeActiveCycle?.itemSnapshots?.forEach(
    (item) => reserve(item.id),
  );
  const idFactory = typeof options.idFactory === 'function'
    ? options.idFactory
    : (prefix) => createRotationId(prefix, now);

  const items = requested.map((item, order) => {
    let id = item.id;
    if (id === null) {
      for (let attempt = 0; attempt < 32; attempt += 1) {
        const candidate = idFactory('rotation_item');
        if (
          typeof candidate === 'string'
          && candidate.trim()
          && !reservedIds.has(candidate.trim())
        ) {
          id = candidate.trim();
          break;
        }
      }
      if (id === null) {
        fail('ITEM_ID_GENERATION_FAILED', '새 활동 ID를 만들지 못했습니다.');
      }
    }
    reservedIds.add(id);
    return { ...item, id, order };
  });

  const next = {
    ...base,
    title,
    description,
    rotation: { ...base.rotation, items },
  };
  const changed = revisionOf(next) !== revisionOf(base);
  return {
    routine: changed
      ? { ...next, updatedAt: Math.max(now, base.updatedAt + 1) }
      : base,
    result: { changed },
  };
}
