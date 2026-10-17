import AsyncStorage from
  '@react-native-async-storage/async-storage';

import {
  CHALLENGE_TYPE,
  getChallengeType,
} from './challengeType';

import {
  loadRecordRoomEntries,
} from './recordRoomEntries';

import {
  getTogetherRoomDateKeyV3,
} from './togetherRoomOverviewV3';

const safeArray = (value) =>
  Array.isArray(value) ? value : [];

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const toDateKey = (value) => {
  const text = String(value ?? '').slice(0, 10);
  return datePattern.test(text) ? text : '';
};

const shiftDay = (dateKey, amount) => {
  if (!datePattern.test(dateKey)) return '';

  const date = new Date(`${dateKey}T00:00:00Z`);

  if (!Number.isFinite(date.getTime())) return '';

  date.setUTCDate(date.getUTCDate() + amount);

  return date.toISOString().slice(0, 10);
};

const scheduledHabitDay = (card, dateKey) => {
  const cycle = card?.habitCycle;

  if (!cycle?.type) return true;

  const date = new Date(`${dateKey}T00:00:00Z`);

  if (!Number.isFinite(date.getTime())) return null;

  if (cycle.type === 'weekly') {
    const labels = [
      '일', '월', '화', '수', '목', '금', '토',
    ];

    if (!Array.isArray(cycle.days)) return null;

    return cycle.days.map(String).includes(
      labels[date.getUTCDay()]
    );
  }

  if (cycle.type === 'monthly') {
    if (!Array.isArray(cycle.dates)) return null;

    return cycle.dates.map(Number).includes(
      date.getUTCDate()
    );
  }

  return null;
};

const completionEntry = (card, entry) => {
  if (!entry?.timestamp) return false;

  if (getChallengeType(card) === CHALLENGE_TYPE.ROTATION) {
    return entry.completedCycle === true;
  }

  return true;
};

export const buildTogetherWeekDaysV3 = ({
  card,
  entries = [],
  joinedAt,
  timezone = 'Asia/Seoul',
  now = Date.now(),
} = {}) => {
  if (!card) return null;

  const joinedTime = new Date(joinedAt).getTime();

  if (!joinedAt || !Number.isFinite(joinedTime)) {
    return null;
  }

  const today = getTogetherRoomDateKeyV3(
    now,
    timezone
  );

  const joinedDate = getTogetherRoomDateKeyV3(
    joinedTime,
    timezone
  );

  if (!today || !joinedDate) return null;

  const nowTime = new Date(now).getTime();

  const completionDays = new Set(
    safeArray(entries)
      .filter((entry) => completionEntry(card, entry))
      .filter((entry) => {
        const timestamp = new Date(entry.timestamp).getTime();

        return Number.isFinite(timestamp)
          && timestamp >= joinedTime
          && timestamp <= nowTime;
      })
      .map((entry) => getTogetherRoomDateKeyV3(
        entry.timestamp,
        timezone
      ))
      .filter(Boolean)
  );

  const type = getChallengeType(card);

  const startDate = toDateKey(card.startDate);
  const endDate = toDateKey(card.endDate);

  const days = [];

  for (let offset = -6; offset <= 0; offset += 1) {
    const localDate = shiftDay(today, offset);

    if (!localDate || localDate < joinedDate) {
      continue;
    }

    if (
      (startDate && localDate < startDate)
      || (endDate && localDate > endDate)
    ) {
      days.push({
        localDate,
        status: 'off',
      });
      continue;
    }

    if (completionDays.has(localDate)) {
      days.push({
        localDate,
        status: 'done',
      });
      continue;
    }

    if (type !== CHALLENGE_TYPE.HABIT) {
      days.push({
        localDate,
        status: 'pending',
      });
      continue;
    }

    const scheduled = scheduledHabitDay(
      card,
      localDate
    );

    if (scheduled === null) continue;

    days.push({
      localDate,
      status: scheduled ? 'pending' : 'off',
    });
  }

  return days;
};

export const loadTogetherWeekDaysV3 = async ({
  challengeId,
  joinedAt,
  timezone = 'Asia/Seoul',
  now = Date.now(),
  storage = AsyncStorage,
} = {}) => {
  const id = String(challengeId ?? '').trim();

  if (!id) return null;

  let cards;

  try {
    cards = JSON.parse(
      await storage.getItem('challenges') || '[]'
    );
  } catch {
    return null;
  }

  if (!Array.isArray(cards)) return null;

  const card = cards.find(
    (item) => String(item?.id ?? '') === id
  );

  if (!card) return null;

  const entries = await loadRecordRoomEntries({
    storage,
    cards: [card],
    hallCards: [],
    trashCards: [],
  });

  return buildTogetherWeekDaysV3({
    card,
    entries,
    joinedAt,
    timezone,
    now,
  });
};
