import AsyncStorage from '@react-native-async-storage/async-storage';

import { CHALLENGE_TYPE, getChallengeType } from './challengeType';
import { loadRecordRoomEntries } from './recordRoomEntries';

const pad = (value) => String(value).padStart(2, '0');
const safeArray = (value) => (Array.isArray(value) ? value : []);

const parseArray = (raw) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const getTogetherLocalDateKey = (value = Date.now()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
};

const getLocalDayStart = (value = Date.now()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addLocalDays = (value, amount) => {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
};

const getCardEndTime = (rawEndDate) => {
  if (!rawEndDate) return null;
  const value = String(rawEndDate);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999).getTime();
  }
  const parsed = new Date(rawEndDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
};

export const isTogetherEligibleCard = (card, now = Date.now()) => {
  if (!card || typeof card !== 'object' || card.id == null) return false;
  if (card.status === 'completed' || card.archived === true || card.rewardClaimed === true) return false;

  const goalScore = Number(card.goalScore);
  const currentScore = Number(card.currentScore);
  if (Number.isFinite(goalScore) && goalScore > 0 && Number.isFinite(currentScore) && currentScore >= goalScore) return false;

  const endTime = getCardEndTime(card.endDate);
  if (endTime != null && endTime < getLocalDayStart(now).getTime()) return false;
  return true;
};

export const getTogetherCardTypeLabel = (card) => {
  const type = getChallengeType(card);
  if (type === CHALLENGE_TYPE.HABIT) return '습관';
  if (type === CHALLENGE_TYPE.ROTATION) return '루틴';
  return '도전';
};

const isHabitScheduledOnDate = (card, value = Date.now()) => {
  if (getChallengeType(card) !== CHALLENGE_TYPE.HABIT) return true;
  const cycle = card?.habitCycle;
  if (!cycle?.type) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;

  if (cycle.type === 'weekly') {
    const labels = ['일', '월', '화', '수', '목', '금', '토'];
    return Array.isArray(cycle.days) && cycle.days.map(String).includes(labels[date.getDay()]);
  }
  if (cycle.type === 'monthly') {
    return Array.isArray(cycle.dates) && cycle.dates.map(Number).includes(date.getDate());
  }
  return true;
};

const isCompletionEntry = (card, entry) => {
  if (!entry || !entry.timestamp) return false;
  if (getChallengeType(card) === CHALLENGE_TYPE.ROTATION) return entry.completedCycle === true;
  return true;
};

const calculateCurrentStreak = (dateKeys, now = Date.now()) => {
  const active = new Set(safeArray(dateKeys).filter(Boolean));
  if (active.size === 0) return 0;
  const today = getLocalDayStart(now);
  const todayKey = getTogetherLocalDateKey(today);
  let cursor = active.has(todayKey) ? today : addLocalDays(today, -1);
  let streak = 0;
  while (active.has(getTogetherLocalDateKey(cursor))) {
    streak += 1;
    cursor = addLocalDays(cursor, -1);
  }
  return streak;
};

const getEntryWhenLabel = (timestamp, now = Date.now()) => {
  const entryDate = getLocalDayStart(timestamp);
  const today = getLocalDayStart(now);
  const entryKey = getTogetherLocalDateKey(entryDate);
  const todayKey = getTogetherLocalDateKey(today);
  if (entryKey === todayKey) return '오늘';
  const yesterdayKey = getTogetherLocalDateKey(addLocalDays(today, -1));
  if (entryKey === yesterdayKey) return '어제';
  return `${entryDate.getMonth() + 1}/${entryDate.getDate()}`;
};

const getEntryTimeLabel = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const buildTogetherCardSnapshot = ({ card, entries = [], now = Date.now() } = {}) => {
  if (!card) return null;
  const completionEntries = safeArray(entries)
    .filter((entry) => isCompletionEntry(card, entry))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const todayKey = getTogetherLocalDateKey(now);
  const completionDateKeys = completionEntries
    .map((entry) => getTogetherLocalDateKey(entry.timestamp))
    .filter(Boolean);
  const todayDone = completionDateKeys.includes(todayKey);
  const scheduledToday = isHabitScheduledOnDate(card, now);
  const todayState = todayDone ? 'done' : scheduledToday ? 'pending' : 'off';
  const uniqueDateKeys = [...new Set(completionDateKeys)];
  const streak = calculateCurrentStreak(uniqueDateKeys, now);
  const recentRecords = completionEntries.slice(0, 5).map((entry, index) => ({
    id: entry.id || `local_${String(card.id)}_${String(entry.timestamp || index)}`,
    owner: '나',
    when: getEntryWhenLabel(entry.timestamp, now),
    time: getEntryTimeLabel(entry.timestamp),
    description: '활동을 완료했어요.',
    timestamp: entry.timestamp,
    isLocal: true,
  }));

  return {
    challengeId: String(card.id),
    title: String(card.title || '함께 활동'),
    type: getChallengeType(card),
    typeLabel: getTogetherCardTypeLabel(card),
    mineDone: todayDone,
    todayState,
    scheduledToday,
    streak,
    recentRecords,
  };
};

export const loadTogetherEligibleCards = async ({ storage = AsyncStorage, now = Date.now() } = {}) => {
  const raw = await storage.getItem('challenges');
  return parseArray(raw)
    .filter((card) => isTogetherEligibleCard(card, now))
    .map((card) => ({
      ...card,
      id: String(card.id),
      togetherTypeLabel: getTogetherCardTypeLabel(card),
    }));
};

export const loadTogetherCardSnapshot = async ({ challengeId, storage = AsyncStorage, now = Date.now() } = {}) => {
  const id = String(challengeId ?? '').trim();
  if (!id) return null;
  const rawCards = await storage.getItem('challenges');
  const cards = parseArray(rawCards);
  const card = cards.find((item) => String(item?.id ?? '') === id);
  if (!card || !isTogetherEligibleCard(card, now)) return null;

  const entries = await loadRecordRoomEntries({
    storage,
    cards: [card],
    hallCards: [],
    trashCards: [],
  });

  return buildTogetherCardSnapshot({ card, entries, now });
};
