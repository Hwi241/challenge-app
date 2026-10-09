import { getChallengeType, CHALLENGE_TYPE } from './challengeType';
import { KOREAN_WEEKDAYS } from './weekdays';

const ANALYSIS_DAYS = 30;

const startOfLocalDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfLocalDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const addLocalDays = (value, amount) => {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
};

const toLocalDateKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const differenceInLocalDays = (later, earlier) => {
  const laterDay = startOfLocalDay(later);
  const earlierDay = startOfLocalDay(earlier);
  const laterUtc = Date.UTC(laterDay.getFullYear(), laterDay.getMonth(), laterDay.getDate());
  const earlierUtc = Date.UTC(earlierDay.getFullYear(), earlierDay.getMonth(), earlierDay.getDate());
  return Math.round((laterUtc - earlierUtc) / 86400000);
};

export const getRecordRoomAnalysisPeriods = (now = new Date(), mode = 'rolling30') => {
  const currentEnd = endOfLocalDay(now);
  if (mode === 'monthly') {
    const currentStart = startOfLocalDay(new Date(currentEnd.getFullYear(), currentEnd.getMonth(), 1));
    const previousStart = startOfLocalDay(new Date(currentEnd.getFullYear(), currentEnd.getMonth() - 1, 1));
    const previousMonthLastDay = new Date(currentEnd.getFullYear(), currentEnd.getMonth(), 0).getDate();
    const previousEndDay = Math.min(currentEnd.getDate(), previousMonthLastDay);
    const previousEnd = endOfLocalDay(new Date(previousStart.getFullYear(), previousStart.getMonth(), previousEndDay));
    return {
      mode: 'monthly',
      current: { start: currentStart, end: currentEnd, days: differenceInLocalDays(currentEnd, currentStart) + 1 },
      previous: { start: previousStart, end: previousEnd, days: differenceInLocalDays(previousEnd, previousStart) + 1 },
    };
  }
  const currentStart = startOfLocalDay(addLocalDays(currentEnd, -(ANALYSIS_DAYS - 1)));
  const previousEnd = endOfLocalDay(addLocalDays(currentStart, -1));
  const previousStart = startOfLocalDay(addLocalDays(previousEnd, -(ANALYSIS_DAYS - 1)));

  return {
    mode: 'rolling30',
    current: { start: currentStart, end: currentEnd, days: ANALYSIS_DAYS },
    previous: { start: previousStart, end: previousEnd, days: ANALYSIS_DAYS },
  };
};

export const buildRecordRoomActivityCalendar = (analysis) => {
  const days = Array.isArray(analysis?.activity) ? analysis.activity : [];
  if (!days.length) return { cells: [], months: [] };
  const mode = analysis?.periods?.mode || 'rolling30';
  const firstPeriodDate = new Date(`${days[0].key}T12:00:00`);
  const lastPeriodDate = new Date(`${days[days.length - 1].key}T12:00:00`);
  const displayStart = mode === 'monthly'
    ? new Date(lastPeriodDate.getFullYear(), lastPeriodDate.getMonth(), 1, 12)
    : firstPeriodDate;
  const displayEnd = mode === 'monthly'
    ? new Date(lastPeriodDate.getFullYear(), lastPeriodDate.getMonth() + 1, 0, 12)
    : lastPeriodDate;
  const gridStart = new Date(displayStart);
  gridStart.setDate(displayStart.getDate() - displayStart.getDay());
  const gridEnd = new Date(displayEnd);
  gridEnd.setDate(displayEnd.getDate() + (6 - displayEnd.getDay()));
  const byKey = new Map(days.map((item) => [item.key, item]));
  const cells = [];
  for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor = addLocalDays(cursor, 1)) {
    const key = toLocalDateKey(cursor);
    const inDisplayRange = cursor >= displayStart && cursor <= displayEnd;
    cells.push({
      key,
      date: new Date(cursor),
      item: byKey.get(key),
      filler: !inDisplayRange,
      future: mode === 'monthly' && inDisplayRange && cursor > lastPeriodDate,
      monthBoundary: mode === 'rolling30' && inDisplayRange && cursor.getDate() === 1 && cursor > firstPeriodDate,
    });
  }
  return {
    cells,
    months: Array.from(new Set(days.map((item) => `${new Date(`${item.key}T12:00:00`).getMonth() + 1}월`))),
  };
};

const entriesInPeriod = (entries, period) => entries.filter((entry) => {
  const time = new Date(entry?.timestamp).getTime();
  return Number.isFinite(time) && time >= period.start.getTime() && time <= period.end.getTime();
});

const createDailySeries = (entries, period) => {
  const countByDate = new Map();
  entries.forEach((entry) => {
    const key = toLocalDateKey(entry.timestamp);
    if (key) countByDate.set(key, (countByDate.get(key) || 0) + 1);
  });

  return Array.from({ length: period.days }, (_, index) => {
    const date = addLocalDays(period.start, index);
    const key = toLocalDateKey(date);
    return { key, date, count: countByDate.get(key) || 0 };
  });
};

const getCurrentStreak = (daily, now) => {
  const activeKeys = new Set(daily.filter((day) => day.count > 0).map((day) => day.key));
  const today = startOfLocalDay(now);
  const start = activeKeys.has(toLocalDateKey(today)) ? today : addLocalDays(today, -1);
  let streak = 0;
  let cursor = start;
  while (activeKeys.has(toLocalDateKey(cursor))) {
    streak += 1;
    cursor = addLocalDays(cursor, -1);
  }
  return streak;
};

const getLongestInactiveRun = (daily, now) => {
  const todayKey = toLocalDateKey(now);
  let longest = 0;
  let current = 0;
  daily.forEach((day) => {
    if (day.key === todayKey && day.count === 0) return;
    if (day.count > 0) {
      current = 0;
      return;
    }
    current += 1;
    longest = Math.max(longest, current);
  });
  return longest;
};

const scoreStreak = (days) => {
  if (days >= 14) return 25;
  if (days >= 10) return 22;
  if (days >= 7) return 18;
  if (days >= 4) return 13;
  if (days >= 2) return 8;
  if (days >= 1) return 4;
  return 0;
};

const scoreLongestGap = (days) => {
  if (days === 0) return 15;
  if (days === 1) return 13;
  if (days === 2) return 10;
  if (days === 3) return 7;
  if (days <= 5) return 4;
  return 0;
};

const getConsistencyStatus = (score) => {
  if (score >= 90) return '매우 안정적';
  if (score >= 75) return '좋은 흐름';
  if (score >= 60) return '안정적인 편';
  if (score >= 40) return '흐름 만들기';
  return '다시 이어가기';
};

const getActivityDaysComparison = (current, previous) => {
  const delta = current - previous;
  if (delta >= 3) return `이전 30일보다 활동일이 ${delta}일 늘었어요.`;
  if (delta >= 1) return '이전보다 활동일이 조금 늘었어요.';
  if (delta === 0) return '이전 30일과 같은 활동일을 유지했어요.';
  if (delta >= -2) return '이전보다 활동일이 조금 줄었어요.';
  return `이전 30일보다 활동일이 ${Math.abs(delta)}일 줄었어요.`;
};

const scoreChangeRate = (rate) => {
  if (rate >= 30) return 100;
  if (rate >= 20) return 90;
  if (rate >= 10) return 80;
  if (rate >= 5) return 65;
  if (rate >= -4) return 50;
  if (rate >= -9) return 40;
  if (rate >= -19) return 30;
  if (rate >= -29) return 15;
  return 0;
};

const calculateGrowthMetric = (current, previous) => {
  if (previous === 0) {
    if (current === 0) return { comparable: false, rate: null, score: null, isNew: false };
    return { comparable: true, rate: null, score: 100, isNew: true };
  }
  const rate = ((current - previous) / previous) * 100;
  return { comparable: true, rate, score: scoreChangeRate(rate), isNew: false };
};

const getGrowthStatus = (score) => {
  if (score >= 90) return '빠르게 상승';
  if (score >= 75) return '상승 중';
  if (score >= 60) return '완만한 상승';
  if (score >= 45) return '비슷하게 유지';
  if (score >= 30) return '조금 감소';
  return '감소 중';
};

const getGrowthSummary = (activityDaysMetric, countMetric) => {
  const activityDirection = activityDaysMetric.rate == null
    ? (activityDaysMetric.isNew ? 1 : 0)
    : activityDaysMetric.rate > 4 ? 1 : activityDaysMetric.rate < -4 ? -1 : 0;
  const countDirection = countMetric.rate == null
    ? (countMetric.isNew ? 1 : 0)
    : countMetric.rate > 4 ? 1 : countMetric.rate < -4 ? -1 : 0;

  if (activityDirection > 0 && countDirection > 0) {
    return '최근 30일은 이전 기간보다 활동일과 기록량이 모두 늘었어요.';
  }
  if (activityDirection > 0 && countDirection <= 0) {
    return '활동한 날은 늘었지만 하루에 쌓는 기록량은 이전과 비슷하거나 조금 줄었어요.';
  }
  if (activityDirection < 0 && countDirection > 0) {
    return '활동일은 줄었지만 활동한 날에는 더 집중적으로 기록했어요.';
  }
  if (activityDirection === 0 && countDirection > 0) {
    return '활동일은 비슷하지만 활동한 날의 기록량은 늘었어요.';
  }
  if (activityDirection === 0 && countDirection === 0) {
    return '최근 흐름이 이전 30일과 비슷하게 유지되고 있어요.';
  }
  if (activityDirection < 0 && countDirection < 0) {
    return '최근에는 활동일과 기록량이 이전 기간보다 줄었어요.';
  }
  return '활동일은 줄었지만 기록량은 이전 기간과 비슷하게 유지됐어요.';
};

const createCumulativeSeries = (daily) => {
  let total = 0;
  return daily.map((day) => {
    total += day.count;
    return total;
  });
};

const getLongestActivityStreak = (entries) => {
  const activityDays = [...new Set(entries.map((entry) => toLocalDateKey(entry?.timestamp)).filter(Boolean))]
    .map((key) => startOfLocalDay(`${key}T12:00:00`))
    .sort((a, b) => a.getTime() - b.getTime());
  let longest = 0;
  let current = 0;
  let previous = null;
  activityDays.forEach((date) => {
    current = previous && differenceInLocalDays(date, previous) === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = date;
  });
  return longest;
};

const BALANCE_TYPES = [
  { key: CHALLENGE_TYPE.HABIT, label: '습관' },
  { key: CHALLENGE_TYPE.ROTATION, label: '루틴' },
  { key: CHALLENGE_TYPE.CHALLENGE, label: '도전' },
];

const normalizeBalanceActivities = (entries, cards, hallCards = []) => {
  const currentCardById = new Map(cards.filter((card) => card?.id != null).map((card) => [String(card.id), card]));
  const hallCardById = new Map(hallCards.filter((card) => card?.id != null || card?.challengeId != null).map((card) => [String(card.id ?? card.challengeId), card]));
  const seen = new Set();
  const unresolvedCardIds = new Set();
  const activities = [];
  entries.forEach((entry) => {
    const challengeId = String(entry?.challengeId ?? '');
    const currentCard = currentCardById.get(challengeId);
    const hallCard = hallCardById.get(challengeId);
    const card = currentCard || hallCard;
    let type = null;
    if (currentCard) {
      type = getChallengeType(currentCard);
    } else if (hallCard?.type === CHALLENGE_TYPE.HABIT || hallCard?.type === CHALLENGE_TYPE.ROTATION || hallCard?.type === CHALLENGE_TYPE.CHALLENGE || hallCard?.rotation) {
      type = getChallengeType(hallCard);
    } else if ([CHALLENGE_TYPE.HABIT, CHALLENGE_TYPE.ROTATION, CHALLENGE_TYPE.CHALLENGE].includes(entry?.type)) {
      type = entry.type;
    }
    if (!card || !type) {
      if (challengeId) unresolvedCardIds.add(challengeId);
      return;
    }
    const dateKey = toLocalDateKey(entry?.timestamp);
    if (!dateKey) return;
    let key = '';
    if (type === CHALLENGE_TYPE.HABIT) {
      key = `habit|${challengeId}|${dateKey}`;
    } else if (type === CHALLENGE_TYPE.ROTATION) {
      if (entry?.completedCycle !== true) return;
      const cycleIdentity = entry?.cycleNumber ?? entry?.id;
      if (cycleIdentity == null) return;
      key = `rotation|${challengeId}|${cycleIdentity}`;
    } else {
      key = `challenge|${entry?.id ?? `${challengeId}|${entry.timestamp}`}`;
    }
    if (seen.has(key)) return;
    seen.add(key);
    activities.push({ key, type, timestamp: entry.timestamp, challengeId });
  });
  return { activities, unresolvedCardCount: unresolvedCardIds.size };
};

const largestRemainderPercents = (items, total) => {
  if (total <= 0) return items.map(() => 0);
  const raw = items.map((item) => (item.count / total) * 100);
  const floors = raw.map(Math.floor);
  let remaining = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, remainder: value - floors[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const result = [...floors];
  for (let index = 0; index < remaining; index += 1) result[order[index].index] += 1;
  return result;
};

const classifyBalance = (items, total) => {
  const active = items.filter((item) => item.count > 0).sort((a, b) => b.share - a.share);
  if (total === 0) return { type: '기록 없음', kind: 'empty', primary: [] };
  if (total < 10) return { type: '분석 준비 중', kind: 'preparing', primary: active };
  if (active.length === 1) {
    return { type: `${active[0].label} 활동 중`, kind: 'singleOnly', primary: [active[0]] };
  }
  const [top, second] = active;
  if (active.length === 2) {
    if (top.share >= 0.65) return { type: `${top.label} 중심`, kind: 'singleCenter', primary: [top] };
    if (top.share >= 0.55) return { type: `${top.label} 비중이 높은 편`, kind: 'high', primary: [top] };
    return { type: `${top.label}·${second.label} 고른 편`, kind: 'evenPair', primary: [top, second] };
  }
  const third = active[2];
  if (top.share - third.share <= 0.15) {
    return { type: '고르게 활동 중', kind: 'even', primary: active };
  }
  if (top.share >= 0.5 && top.share - second.share >= 0.15) {
    return { type: `${top.label} 중심`, kind: 'singleCenter', primary: [top] };
  }
  if (top.share >= 0.4 && top.share - second.share >= 0.1) {
    return { type: `${top.label} 비중이 높은 편`, kind: 'high', primary: [top] };
  }
  if (top.share + second.share >= 0.8 && top.share - second.share <= 0.15) {
    return { type: `${top.label}·${second.label} 중심`, kind: 'dualCenter', primary: [top, second] };
  }
  return { type: '여러 활동에 분산', kind: 'distributed', primary: active };
};

const analyzeBalancePeriod = (activities, period) => {
  const periodActivities = entriesInPeriod(activities, period);
  const counts = Object.fromEntries(BALANCE_TYPES.map((item) => [item.key, 0]));
  periodActivities.forEach((activity) => { counts[activity.type] += 1; });
  const total = periodActivities.length;
  const baseItems = BALANCE_TYPES.map((item) => ({
    ...item,
    count: counts[item.key],
    share: total > 0 ? counts[item.key] / total : 0,
  }));
  const displayPercents = largestRemainderPercents(baseItems, total);
  const items = baseItems.map((item, index) => ({ ...item, displayPercent: displayPercents[index] }));
  return { total, items, classification: classifyBalance(items, total) };
};

const CUMULATIVE_COMPOSITION_TYPES = [
  { key: CHALLENGE_TYPE.CHALLENGE, label: '도전' },
  { key: CHALLENGE_TYPE.HABIT, label: '습관' },
  { key: CHALLENGE_TYPE.ROTATION, label: '루틴' },
];

const getCompositionCardId = (card) => {
  const raw = card?.id ?? card?.challengeId;
  return raw == null ? '' : String(raw);
};

const getCompositionEndTime = (rawEndDate) => {
  if (!rawEndDate) return null;

  const value = String(rawEndDate);
  const localDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (localDateMatch) {
    const [, year, month, day] = localDateMatch;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      23,
      59,
      59,
      999
    );
    return date.getTime();
  }

  const parsed = new Date(rawEndDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
};

const isCurrentCompositionCard = (card, now = new Date()) => {
  if (!card || typeof card !== 'object') return false;

  if (
    card.status === 'completed'
    || card.archived === true
    || card.rewardClaimed === true
  ) {
    return false;
  }

  const goalScore = Number(card.goalScore);
  const currentScore = Number(card.currentScore);

  if (
    Number.isFinite(goalScore)
    && goalScore > 0
    && Number.isFinite(currentScore)
    && currentScore >= goalScore
  ) {
    return false;
  }

  const endTime = getCompositionEndTime(card.endDate);
  if (endTime != null && endTime < startOfLocalDay(now).getTime()) {
    return false;
  }

  return true;
};

const getCompositionFallbackId = (card, source, index) => [
  source,
  getChallengeType(card),
  String(card?.title ?? ''),
  String(card?.createdAt ?? ''),
  String(card?.startDate ?? ''),
  String(card?.endDate ?? ''),
  String(index),
].join('|');

const buildCumulativeCompositionCards = ({ cards = [], hallCards = [], now = new Date() } = {}) => {
  const unique = new Map();

  const add = (card, source, index) => {
    if (!card || typeof card !== 'object') return;

    const id = getCompositionCardId(card);
    const key = id ? `id:${id}` : getCompositionFallbackId(card, source, index);
    if (!unique.has(key)) {
      unique.set(key, card);
    }
  };

  cards
    .filter((card) => isCurrentCompositionCard(card, now))
    .forEach((card, index) => add(card, 'current', index));

  hallCards.forEach((card, index) => add(card, 'hall', index));

  return [...unique.values()];
};

const buildCumulativeComposition = ({ cards = [], hallCards = [], now = new Date() } = {}) => {
  const cumulativeCards = buildCumulativeCompositionCards({ cards, hallCards, now });
  const counts = Object.fromEntries(
    CUMULATIVE_COMPOSITION_TYPES.map((item) => [item.key, 0])
  );

  cumulativeCards.forEach((card) => {
    const type = getChallengeType(card);
    if (Object.prototype.hasOwnProperty.call(counts, type)) {
      counts[type] += 1;
    }
  });

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const items = CUMULATIVE_COMPOSITION_TYPES.map((item) => {
    const count = counts[item.key];
    const share = total > 0 ? count / total : 0;

    return {
      ...item,
      count,
      share,
      displayPercent: total > 0 ? Math.round(share * 1000) / 10 : 0,
    };
  });

  return { total, counts, items };
};

const getBalanceShift = (current, previous) => {
  if (previous.total < 10) return null;
  const currentClass = current.classification;
  const previousClass = previous.classification;
  if (previousClass.kind === 'singleCenter' && currentClass.kind === 'singleCenter') {
    const previousLabel = previousClass.primary[0].label;
    const currentLabel = currentClass.primary[0].label;
    return previousLabel === currentLabel
      ? `최근 두 기간 모두 ${currentLabel} 활동의 비중이 가장 높아요.`
      : `최근 활동의 중심이 ${previousLabel}에서 ${currentLabel}으로 이동했어요.`;
  }
  if (previousClass.kind === 'singleCenter' && currentClass.kind === 'even') {
    return '최근에는 다른 활동의 비중도 늘며 활동 구성이 고르게 바뀌었어요.';
  }
  if (previousClass.kind === 'even' && currentClass.kind === 'singleCenter') {
    return `최근에는 ${currentClass.primary[0].label} 활동의 비중이 뚜렷하게 높아졌어요.`;
  }
  return null;
};

const RHYTHM_BUCKETS = [
  { key: 'dawn', label: '새벽', start: 0, end: 5 },
  { key: 'morning', label: '오전', start: 6, end: 10 },
  { key: 'midday', label: '점심', start: 11, end: 13 },
  { key: 'afternoon', label: '오후', start: 14, end: 17 },
  { key: 'evening', label: '저녁', start: 18, end: 21 },
  { key: 'night', label: '밤', start: 22, end: 23 },
];

const FINAL_RHYTHM_BUCKETS = [
  { key: 'morning', label: '아침', range: '06:00 — 10:59', shortRange: '06—10시', matches: (hour) => hour >= 6 && hour <= 10 },
  { key: 'daytime', label: '낮', range: '11:00 — 17:59', shortRange: '11—17시', matches: (hour) => hour >= 11 && hour <= 17 },
  { key: 'evening', label: '저녁', range: '18:00 — 21:59', shortRange: '18—21시', matches: (hour) => hour >= 18 && hour <= 21 },
  { key: 'night', label: '밤', range: '22:00 — 05:59', shortRange: '22—05시', matches: (hour) => hour >= 22 || hour <= 5 },
];

const WEEKDAY_LABELS = KOREAN_WEEKDAYS;
const WEEKDAY_FULL_LABELS = KOREAN_WEEKDAYS.map((label) => `${label}요일`);

const getSundayFirstWeekday = (date) => date.getDay();
const isWeekendWeekdayIndex = (weekday) => weekday === 0 || weekday === 6;

const classifyRhythmDistribution = (timeShares) => {
  const sorted = [...timeShares].sort((a, b) => b.share - a.share);
  const [top, second] = sorted;
  const gap = top.share - second.share;
  if (top.share >= 0.45 && gap >= 0.15) {
    return {
      kind: 'single',
      type: `${top.label}형`,
      primary: [top],
      patternStrength: top.share >= 0.55 ? '패턴이 매우 뚜렷해요' : '패턴이 뚜렷해요',
    };
  }
  if (top.share + second.share >= 0.65 && gap < 0.1) {
    return {
      kind: 'dual',
      type: `${top.label}·${second.label}형`,
      primary: [top, second],
      patternStrength: '두 시간대에 활동이 집중돼요',
    };
  }
  if (top.share >= 0.35 && gap >= 0.1) {
    return {
      kind: 'center',
      type: `${top.label} 중심`,
      primary: [top],
      patternStrength: '약한 경향이 있어요',
    };
  }
  return {
    kind: 'mixed',
    type: '혼합형',
    primary: [],
    patternStrength: '여러 시간대에 활동이 분산돼 있어요',
  };
};

const analyzeRhythmPeriod = (entries, period) => {
  const periodEntries = entriesInPeriod(entries, period);
  const activityDays = new Set(periodEntries.map((entry) => toLocalDateKey(entry.timestamp)).filter(Boolean)).size;
  const timeShares = FINAL_RHYTHM_BUCKETS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    range: bucket.range,
    shortRange: bucket.shortRange,
    count: 0,
    share: 0,
  }));
  const heatmap = FINAL_RHYTHM_BUCKETS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    values: Array(7).fill(0),
  }));
  const weekdayTotals = Array(7).fill(0);
  const weekdayOccurrences = Array(7).fill(0);
  let weekdayCalendarDayCount = 0;
  let weekendCalendarDayCount = 0;

  for (let index = 0; index < period.days; index += 1) {
    const date = addLocalDays(period.start, index);
    const weekday = getSundayFirstWeekday(date);
    weekdayOccurrences[weekday] += 1;
    if (isWeekendWeekdayIndex(weekday)) weekendCalendarDayCount += 1;
    else weekdayCalendarDayCount += 1;
  }

  let weekdayActivityCount = 0;
  let weekendActivityCount = 0;
  periodEntries.forEach((entry) => {
    const date = new Date(entry.timestamp);
    const weekday = getSundayFirstWeekday(date);
    const bucketIndex = FINAL_RHYTHM_BUCKETS.findIndex((bucket) => bucket.matches(date.getHours()));
    if (bucketIndex < 0) return;
    timeShares[bucketIndex].count += 1;
    heatmap[bucketIndex].values[weekday] += 1;
    weekdayTotals[weekday] += 1;
    if (isWeekendWeekdayIndex(weekday)) weekendActivityCount += 1;
    else weekdayActivityCount += 1;
  });

  timeShares.forEach((item) => {
    item.share = periodEntries.length > 0 ? item.count / periodEntries.length : 0;
  });
  const classification = classifyRhythmDistribution(timeShares);
  const weekdayAverage = weekdayCalendarDayCount > 0 ? weekdayActivityCount / weekdayCalendarDayCount : 0;
  const weekendAverage = weekendCalendarDayCount > 0 ? weekendActivityCount / weekendCalendarDayCount : 0;
  let weekdayPattern = '평일·주말 고른 편';
  if (weekendAverage > 0 && weekdayAverage === 0) weekdayPattern = '주말 중심';
  else if (weekdayAverage > 0 && weekendAverage === 0) weekdayPattern = '평일 중심';
  else if (weekendAverage >= weekdayAverage * 1.5) weekdayPattern = '주말 중심';
  else if (weekdayAverage >= weekendAverage * 1.5) weekdayPattern = '평일 중심';

  const weekdayAverages = weekdayTotals.map((total, index) => (
    weekdayOccurrences[index] > 0 ? total / weekdayOccurrences[index] : 0
  ));
  const weekdayAverageTotal = weekdayAverages.reduce((sum, value) => sum + value, 0);
  const normalizedWeekdays = weekdayAverages.map((average, index) => ({
    index,
    label: WEEKDAY_LABELS[index],
    fullLabel: WEEKDAY_FULL_LABELS[index],
    average,
    share: weekdayAverageTotal > 0 ? average / weekdayAverageTotal : 0,
  })).sort((a, b) => b.share - a.share);
  const [topDay, secondDay] = normalizedWeekdays;
  let weekdaySummary = '';
  let topWeekdays = [];
  if (topDay.share >= 0.25 && topDay.share - secondDay.share >= 0.08) {
    topWeekdays = [topDay];
    weekdaySummary = `${topDay.fullLabel}에 특히 활발해요.`;
  } else if (topDay.share + secondDay.share >= 0.4) {
    topWeekdays = [topDay, secondDay];
    weekdaySummary = `${topDay.fullLabel}과 ${secondDay.fullLabel} 활동이 많은 편이에요.`;
  }

  return {
    totalRecords: periodEntries.length,
    activeDays: activityDays,
    timeShares,
    classification,
    weekdayPattern,
    weekdayAverages,
    topWeekdays,
    weekdaySummary,
    heatmap,
  };
};

const getRhythmComparison = (current, previous) => {
  if (previous.totalRecords < 15 || previous.activeDays < 7) return null;
  const currentClass = current.classification;
  const previousClass = previous.classification;
  if (currentClass.kind === 'single' && previousClass.kind === 'single') {
    const currentPrimary = currentClass.primary[0];
    const previousPrimary = previousClass.primary[0];
    if (currentPrimary.key !== previousPrimary.key) {
      return `활동 중심 시간이 ${previousPrimary.label}에서 ${currentPrimary.label}으로 이동했어요.`;
    }
    const previousShare = previous.timeShares.find((item) => item.key === currentPrimary.key)?.share || 0;
    if (currentPrimary.share - previousShare >= 0.1) {
      return `최근에는 ${currentPrimary.label} 활동 경향이 더 뚜렷해졌어요.`;
    }
  }
  if (previousClass.kind === 'single' && currentClass.kind === 'mixed') {
    return '최근에는 특정 시간대 집중이 줄고 여러 시간대로 활동이 분산됐어요.';
  }
  if (previousClass.kind === 'mixed' && currentClass.kind === 'single') {
    return `최근에는 ${currentClass.primary[0].label} 시간의 활동 경향이 새롭게 뚜렷해졌어요.`;
  }
  return null;
};

const createRhythmDistribution = (entries) => {
  const buckets = RHYTHM_BUCKETS.map((bucket) => ({ ...bucket, count: 0, ratio: 0 }));
  entries.forEach((entry) => {
    const date = new Date(entry?.timestamp);
    if (Number.isNaN(date.getTime())) return;
    const bucket = buckets.find((item) => date.getHours() >= item.start && date.getHours() <= item.end);
    if (bucket) bucket.count += 1;
  });
  const total = entries.length;
  buckets.forEach((bucket) => {
    bucket.ratio = total > 0 ? bucket.count / total : 0;
  });
  return buckets;
};

const createBalanceDistribution = (entries, cards) => {
  const cardById = new Map(
    cards
      .filter((card) => card?.id != null)
      .map((card) => [String(card.id), card])
  );
  const counts = {
    [CHALLENGE_TYPE.CHALLENGE]: 0,
    [CHALLENGE_TYPE.HABIT]: 0,
    [CHALLENGE_TYPE.ROTATION]: 0,
  };
  let classifiedTotal = 0;

  entries.forEach((entry) => {
    const card = cardById.get(String(entry?.challengeId ?? ''));
    if (!card) return;
    counts[getChallengeType(card)] += 1;
    classifiedTotal += 1;
  });

  return [
    { key: CHALLENGE_TYPE.CHALLENGE, label: '도전' },
    { key: CHALLENGE_TYPE.HABIT, label: '습관' },
    { key: CHALLENGE_TYPE.ROTATION, label: '루틴' },
  ].map((item) => ({
    ...item,
    count: counts[item.key],
    ratio: classifiedTotal > 0 ? counts[item.key] / classifiedTotal : 0,
  }));
};

export const buildRecordRoomIndexSummary = ({ entries = [], cards = [], now = new Date(), mode = 'rolling30' } = {}) => {
  const periods = getRecordRoomAnalysisPeriods(now, mode);
  const validEntries = entries.filter((entry) => Number.isFinite(new Date(entry?.timestamp).getTime()));
  const currentEntries = entriesInPeriod(validEntries, periods.current);
  const previousEntries = entriesInPeriod(validEntries, periods.previous);
  const daily = createDailySeries(currentEntries, periods.current);
  const rhythm = createRhythmDistribution(currentEntries);
  const balance = createBalanceDistribution(currentEntries, cards);

  return {
    periods,
    currentEntries,
    previousEntries,
    daily,
    activityDays: daily.filter((day) => day.count > 0).length,
    currentCount: currentEntries.length,
    previousCount: previousEntries.length,
    countDelta: currentEntries.length - previousEntries.length,
    rhythm,
    balance,
    cumulativeCount: validEntries.length,
  };
};

export const calculateConsistencyAnalysis = ({ entries = [], now = new Date(), mode = 'rolling30' } = {}) => {
  const summary = buildRecordRoomIndexSummary({ entries, now, mode });
  const activity = summary.daily.map((day) => ({
    key: day.key,
    count: day.count,
    isToday: day.key === toLocalDateKey(now),
  }));
  const validTimes = entries
    .map((entry) => new Date(entry?.timestamp))
    .filter((date) => !Number.isNaN(date.getTime()) && date.getTime() <= new Date(now).getTime());
  const firstTrackedAt = validTimes.length > 0
    ? new Date(Math.min(...validTimes.map((date) => date.getTime())))
    : null;
  const trackedDays = firstTrackedAt ? differenceInLocalDays(now, firstTrackedAt) + 1 : 0;
  const previousActivityDays = new Set(
    summary.previousEntries.map((entry) => toLocalDateKey(entry.timestamp)).filter(Boolean)
  ).size;
  const currentStreak = getCurrentStreak(summary.daily, now);
  const longestGap = getLongestInactiveRun(summary.daily, now);
  const metrics = {
    trackedDays,
    activityDays: summary.activityDays,
    previousActivityDays,
    currentStreak,
    longestGap,
    periodDays: summary.periods.current.days,
  };
  const activityDelta = summary.activityDays - previousActivityDays;
  const factualSummary = activityDelta === 0
    ? '활동일이 비교 기간과 같아요.'
    : `활동일이 비교 기간보다 ${Math.abs(activityDelta)}일 ${activityDelta > 0 ? '늘었어요.' : '줄었어요.'}`;

  if (trackedDays < 7) {
    return {
      status: '분석 준비 중',
      score: null,
      components: null,
      metrics,
      comparison: null,
      activity,
      periods: summary.periods,
      summary: summary.currentEntries.length > 0 ? factualSummary : '현재 분석 기간에 기록된 활동이 없어요.',
    };
  }

  const components = {
    activityDays: Math.max(0, Math.min(60, Math.round((summary.activityDays / 30) * 60))),
    streak: scoreStreak(currentStreak),
    gap: scoreLongestGap(longestGap),
  };
  const score = components.activityDays + components.streak + components.gap;

  return {
    status: getConsistencyStatus(score),
    score,
    components,
    metrics,
    comparison: {
      delta: summary.activityDays - previousActivityDays,
      text: getActivityDaysComparison(summary.activityDays, previousActivityDays),
    },
    activity,
    periods: summary.periods,
    summary: factualSummary,
  };
};

export const calculateGrowthAnalysis = ({ entries = [], now = new Date(), mode = 'rolling30' } = {}) => {
  const indexSummary = buildRecordRoomIndexSummary({ entries, now, mode });
  const validTimes = entries
    .map((entry) => new Date(entry?.timestamp))
    .filter((date) => !Number.isNaN(date.getTime()) && date.getTime() <= new Date(now).getTime());
  const firstTrackedAt = validTimes.length > 0
    ? new Date(Math.min(...validTimes.map((date) => date.getTime())))
    : null;
  const trackedDays = firstTrackedAt ? differenceInLocalDays(now, firstTrackedAt) + 1 : 0;
  const previousDaily = createDailySeries(indexSummary.previousEntries, indexSummary.periods.previous);
  const previousActivityDays = previousDaily.filter((day) => day.count > 0).length;
  const activityDays = calculateGrowthMetric(indexSummary.activityDays, previousActivityDays);
  const activityCount = calculateGrowthMetric(indexSummary.currentCount, indexSummary.previousCount);
  const metrics = {
    trackedDays,
    currentActivityDays: indexSummary.activityDays,
    previousActivityDays,
    currentCount: indexSummary.currentCount,
    previousCount: indexSummary.previousCount,
  };
  const flow = {
    current: createCumulativeSeries(indexSummary.daily),
    previous: createCumulativeSeries(previousDaily),
  };
  const activityDelta = metrics.currentActivityDays - metrics.previousActivityDays;
  const countDelta = metrics.currentCount - metrics.previousCount;
  const factualGrowthSummary = `활동일은 ${activityDelta === 0 ? '변화 없고' : `${Math.abs(activityDelta)}일 ${activityDelta > 0 ? '늘고' : '줄고'}`} 기록량은 ${countDelta === 0 ? '변화 없어요.' : `${Math.abs(countDelta)}회 ${countDelta > 0 ? '늘었어요.' : '줄었어요.'}`}`;

  if (trackedDays < 60) {
    return {
      status: '분석 준비 중',
      score: null,
      components: null,
      metrics,
      comparison: { activityDays, activityCount },
      flow,
      periods: indexSummary.periods,
      summary: indexSummary.previousCount === 0 ? '비교할 이전 기록이 아직 충분하지 않아요.' : factualGrowthSummary,
    };
  }

  const comparableMetrics = [activityDays, activityCount].filter((metric) => metric.comparable);
  if (comparableMetrics.length === 0) {
    return {
      status: '분석 준비 중',
      score: null,
      components: null,
      metrics,
      comparison: { activityDays, activityCount },
      flow,
      periods: indexSummary.periods,
      summary: '비교할 수 있는 활동 기록이 아직 없어요.',
    };
  }

  const score = Math.round(
    comparableMetrics.reduce((sum, metric) => sum + metric.score, 0) / comparableMetrics.length
  );

  return {
    status: getGrowthStatus(score),
    score,
    components: {
      activityDays: activityDays.score,
      activityCount: activityCount.score,
    },
    metrics,
    comparison: { activityDays, activityCount },
    flow,
    periods: indexSummary.periods,
    summary: factualGrowthSummary,
  };
};

export const calculateRhythmAnalysis = ({ entries = [], now = new Date(), mode = 'rolling30' } = {}) => {
  const periods = getRecordRoomAnalysisPeriods(now, mode);
  const validEntries = entries.filter((entry) => Number.isFinite(new Date(entry?.timestamp).getTime()));
  const current = analyzeRhythmPeriod(validEntries, periods.current);
  const previous = analyzeRhythmPeriod(validEntries, periods.previous);
  const hasEnoughData = current.totalRecords >= 15 && current.activeDays >= 7;

  if (!hasEnoughData) {
    return {
      status: '분석 준비 중',
      score: null,
      totalRecords: current.totalRecords,
      activeDays: current.activeDays,
      timeShares: current.timeShares,
      rhythmType: null,
      rhythmKind: null,
      patternStrength: null,
      weekdayPattern: null,
      topWeekdays: [],
      heatmap: current.heatmap,
      comparison: null,
      summaryLines: ['조금 더 기록이 쌓이면 활동 시간과 요일 패턴을 보여드릴게요.'],
      periods,
    };
  }

  const comparison = getRhythmComparison(current, previous);
  const primary = current.classification.primary;
  const timeSummary = current.classification.kind === 'mixed'
    ? current.classification.patternStrength
    : current.classification.kind === 'dual'
      ? `${primary[0].label} ${Math.round(primary[0].share * 100)}% · ${primary[1].label} ${Math.round(primary[1].share * 100)}%`
      : `최근 활동의 ${Math.round(primary[0].share * 100)}%가 ${primary[0].label} 시간에 이루어졌어요.`;
  const summaryLines = [timeSummary, current.weekdaySummary, comparison].filter(Boolean).slice(0, 3);

  return {
    status: current.classification.type,
    score: null,
    totalRecords: current.totalRecords,
    activeDays: current.activeDays,
    timeShares: current.timeShares,
    rhythmType: current.classification.type,
    rhythmKind: current.classification.kind,
    primary: current.classification.primary,
    patternStrength: current.classification.patternStrength,
    weekdayPattern: current.weekdayPattern,
    topWeekdays: current.topWeekdays,
    heatmap: current.heatmap,
    comparison,
    summaryLines,
    periods,
  };
};

export const calculateBalanceAnalysis = ({
  cards = [],
  hallCards = [],
  now = new Date(),
} = {}) => {
  const composition = buildCumulativeComposition({ cards, hallCards, now });

  return {
    status: '',
    score: null,
    total: composition.total,
    counts: composition.counts,
    shares: composition.items,
    activeTypes: composition.items.filter((item) => item.count > 0).map((item) => item.key),
    balanceType: null,
    balanceKind: null,
    primary: [],
    deltas: [],
    previousTotal: null,
    previousType: null,
    shift: null,
    summaryLines: [],
  };
};

export const calculateAchievementAnalysis = ({
  entries = [],
  hallCards = [],
  now = new Date(),
} = {}) => {
  const nowTime = new Date(now).getTime();
  const validEntries = entries.filter((entry) => {
    const time = new Date(entry?.timestamp).getTime();
    return Number.isFinite(time) && time <= nowTime;
  });
  const indexSummary = buildRecordRoomIndexSummary({ entries: validEntries, now });
  const totalActivityDays = new Set(
    validEntries.map((entry) => toLocalDateKey(entry.timestamp)).filter(Boolean)
  ).size;
  const previousCount = indexSummary.previousCount;
  const recentDelta = indexSummary.currentCount - previousCount;

  return {
    status: validEntries.length > 0 ? '지금까지 쌓은 기록' : '기록 없음',
    score: null,
    components: null,
    metrics: {
      totalCount: validEntries.length,
      totalActivityDays,
      longestStreak: getLongestActivityStreak(validEntries),
      hallOfFameCount: Array.isArray(hallCards) ? hallCards.length : 0,
      recentCount: indexSummary.currentCount,
      recentActivityDays: indexSummary.activityDays,
      previousCount,
    },
    comparison: {
      recentCountDelta: recentDelta,
    },
    summary: validEntries.length > 0
      ? `최근 30일 동안 기록 ${indexSummary.currentCount}회 · 활동 ${indexSummary.activityDays}일`
      : '아직 쌓인 기록이 없어요.',
  };
};

export const buildRecordRoomHomeSummary = ({ consistency, growth, rhythm, balance } = {}) => {
  const activityDelta = Number(growth?.metrics?.currentActivityDays || 0) - Number(growth?.metrics?.previousActivityDays || 0);
  const countDelta = Number(growth?.metrics?.currentCount || 0) - Number(growth?.metrics?.previousCount || 0);
  const activityText = activityDelta === 0 ? '활동일은 비슷하게 유지되고' : `활동일이 비교 기간보다 ${Math.abs(activityDelta)}일 ${activityDelta > 0 ? '늘고' : '줄고'}`;
  const countText = countDelta === 0 ? '기록량도 비슷해요.' : `기록량은 ${Math.abs(countDelta)}회 ${countDelta > 0 ? '늘었어요.' : '줄었어요.'}`;
  const first = `${activityText} ${countText}`;

  let second = '';
  const rhythmReady = Boolean(rhythm?.rhythmType);
  const balanceReady = Boolean(balance?.balanceType);
  if (rhythmReady && balanceReady && rhythm.rhythmKind === 'single' && balance.balanceKind === 'singleCenter') {
    second = `${rhythm.primary[0].label} 시간과 ${balance.primary[0].label} 활동의 비중이 가장 높아요.`;
  } else if (rhythmReady && rhythm.rhythmKind === 'mixed') {
    second = '활동 시간은 여러 시간대에 분산되어 있어요.';
  } else if (rhythmReady && rhythm.rhythmKind === 'dual') {
    second = `${rhythm.primary[0].label}과 ${rhythm.primary[1].label} 두 시간대에 활동이 집중돼 있어요.`;
  } else if (balanceReady && balance.balanceKind === 'even') {
    second = '도전·습관·루틴 활동은 비교적 고르게 분포되어 있어요.';
  } else if (balanceReady && balance.balanceKind === 'singleOnly') {
    second = `최근에는 ${balance.primary[0].label} 활동이 기록의 중심이에요.`;
  }

  return [first, second].filter(Boolean);
};
