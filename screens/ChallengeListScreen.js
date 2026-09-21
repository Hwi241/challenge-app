// screens/ChallengeListScreen.js
import React, { useEffect, useState, useCallback, useMemo, memo, useRef } from 'react';
import { AppState, View, Text, StyleSheet, TouchableOpacity, Alert, BackHandler, Platform, ScrollView, UIManager, LayoutAnimation, Animated, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';

import {
  buttonStyles,
  card as canonicalCardStyles,
  color,
  layout as canonicalLayoutStyles,
  primitive,
  radius,
  space,
  surface as canonicalSurfaceStyles,
  text as canonicalTextStyles,
} from '../styles/common';
import { cancelAllForChallenge } from '../utils/notificationScheduler';
import { syncWidgetChallengeList } from '../utils/widgetSync';
import { isRotationRoutine } from '../utils/challengeType';
import { getRotationRoutineSummary } from '../utils/rotationRoutine';
import { loadRotationRoutine } from '../utils/rotationRoutineStore';
import { moveToTrash } from '../utils/trash';
import { useFoldableLayoutState } from '../utils/foldableLayout';
import FocusSessionStartModal from '../components/FocusSessionStartModal';
import MainDock from '../components/MainDock';
import { loadActiveFocusSession, startFocusSession } from '../utils/focusSessionStore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ---------- 상수 ---------- */
const CARD_COLLAPSE_ANIM_MS = 320;

const ORDER_KEY = 'ch_order';
const CHALLENGES_KEY = 'challenges';
const COLLAPSED_CARDS_KEY = 'ch_collapsed_cards';
const TODAY_PUSH_KEY = 'ch_today_push_id';

const MANAGE_ROW_HEIGHT = 64;
const MANAGE_ROW_GAP = 8;
const MANAGE_ROW_STEP = (
  MANAGE_ROW_HEIGHT + MANAGE_ROW_GAP
);

const HERO_RING_SIZE = 108;
const HERO_RING_STROKE = 8;
const HERO_RING_RADIUS = 43;
const HERO_RING_CENTER = HERO_RING_SIZE / 2;
const HERO_RING_CIRCUMFERENCE = (
  2 * Math.PI * HERO_RING_RADIUS
);

const MINI_RING_SIZE = 34;
const MINI_RING_STROKE = 3;
const MINI_RING_RADIUS = 13;
const MINI_RING_CENTER = MINI_RING_SIZE / 2;
const MINI_RING_CIRCUMFERENCE = (
  2 * Math.PI * MINI_RING_RADIUS
);

const CHALLENGE_CARD_VARIANTS = {
  LIST: 'list',
  COMPACT: 'compact',
};

const SORT_LABELS = {
  manual: '사용자 지정',
  newest: '최신순',
  oldest: '오래된순',
  challengeFirst: '도전 먼저',
  habitFirst: '습관 먼저',
  rotationFirst: '순환루틴 먼저',
};

const SORT_OPTIONS = [
  { key: 'manual', label: SORT_LABELS.manual },
  { key: 'newest', label: SORT_LABELS.newest },
  { key: 'oldest', label: SORT_LABELS.oldest },
  {
    key: 'challengeFirst',
    label: SORT_LABELS.challengeFirst,
  },
  {
    key: 'habitFirst',
    label: SORT_LABELS.habitFirst,
  },
  {
    key: 'rotationFirst',
    label: SORT_LABELS.rotationFirst,
  },
];

const FILTER_SORT_MODES = new Set([
  'newest',
  'oldest',
  'challengeFirst',
  'habitFirst',
  'rotationFirst',
]);

const isFilterSortMode = (mode) => (
  FILTER_SORT_MODES.has(mode)
);

const itemKind = (item) => {
  if (isRotationRoutine(item)) return 'rotation';
  if (item?.type === 'habit') return 'habit';
  return 'challenge';
};

const buildDisplayData = (
  source = [],
  mode = 'manual'
) => {
  const arr = Array.isArray(source)
    ? [...source]
    : [];

  if (mode === 'manual') {
    return arr;
  }

  const active = arr.filter(isCurrentCard);

  const expired = arr.filter((item) => {
    const flags = asDoneFlags(item);

    return (
      !flags._isDone
      && !item?.archived
      && flags._isExpired
    );
  });

  const done = arr.filter((item) => {
    const flags = asDoneFlags(item);

    return (
      flags._isDone
      || !!item?.archived
    );
  });

  if (
    mode === 'newest'
    || mode === 'oldest'
  ) {
    active.sort((a, b) => (
      mode === 'newest'
        ? (b.createdAt || 0) - (a.createdAt || 0)
        : (a.createdAt || 0) - (b.createdAt || 0)
    ));

    return [
      ...active,
      ...expired,
      ...done,
    ];
  }

  const firstKind = (
    mode === 'challengeFirst'
      ? 'challenge'
      : mode === 'habitFirst'
        ? 'habit'
        : mode === 'rotationFirst'
          ? 'rotation'
          : null
  );

  if (firstKind) {
    const first = active.filter(
      (item) => itemKind(item) === firstKind
    );

    const rest = active.filter(
      (item) => itemKind(item) !== firstKind
    );

    return [
      ...first,
      ...rest,
      ...expired,
      ...done,
    ];
  }

  return arr;
};

/* ---------- 유틸 ---------- */
const safeStringId = (v) => (v == null ? '' : String(v));

const ensureItemId = (it, idx = 0) => {
  if (!it || typeof it !== 'object') return it;
  const before = it.id;
  const raw = it.id ?? it.challengeId ?? it.uuid ?? it.key ?? (Number.isFinite(it.createdAt) ? `gen_${it.createdAt}` : null);
  const id = raw != null && String(raw).length ? String(raw) : `gen_${Date.now()}_${idx}`;
  return before === id ? it : { ...it, id };
};

const parseJson = (s) => { try { return JSON.parse(s); } catch { return null; } };

const dedupeById = (arr = []) => {
  const map = new Map();
  arr.forEach((raw, i) => {
    const it = ensureItemId(raw, i);
    const id = safeStringId(it?.id);
    if (!id) return;
    if (!map.has(id)) map.set(id, it);
  });
  return Array.from(map.values());
};

const moveInArray = (arr, from, to) => {
  const copy = arr.slice();
  const [picked] = copy.splice(from, 1);
  copy.splice(to, 0, picked);
  return copy;
};

const readOrderMap = async () => {
  const raw = await AsyncStorage.getItem(ORDER_KEY);
  const obj = raw ? JSON.parse(raw) : {};
  const out = (obj && typeof obj === 'object') ? obj : {};
  console.log('[ChallengeList][readOrderMap] ->', out);
  return out;
};

const writeOrderMap = async (map) => {
  try {
    await AsyncStorage.setItem(ORDER_KEY, JSON.stringify(map || {}));
    console.log('[ChallengeList][writeOrderMap] saved:', map || {});
  } catch (e) {
    console.warn('[ChallengeList][writeOrderMap] failed', e);
  }
};

function asDoneFlags(c) {
  const cs = Number(c?.currentScore ?? 0);
  const gs = Number(c?.goalScore ?? NaN);
  const doneByScore = Number.isFinite(gs) && gs > 0 && cs >= gs;
  const done = c?.status === 'completed' || doneByScore || !!c?.archived;
  let isExpired = false;
  if (!done && c?.endDate) {
    const end = new Date(c.endDate);
    end.setHours(23, 59, 59, 999);
    isExpired = end < new Date();
  }
  return { _isDone: !!done, _completedAt: c?.completedAt ?? 0, _isExpired: isExpired };
}

const isCurrentCard = (item) => {
  const flags = asDoneFlags(item);

  return (
    !flags._isDone
    && !flags._isExpired
    && !item?.archived
  );
};

const keyOfDate = (d) => {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const toDateOnly = (value) => {
  const x = value ? new Date(value) : new Date();
  if (Number.isNaN(x.getTime())) return null;
  x.setHours(0, 0, 0, 0);
  return x;
};

const getEntryDateKey = (entry) => {
  const raw = entry?.timestamp ?? entry?.createdAt ?? entry?.date ?? entry?.day;
  if (!raw) return '';
  return keyOfDate(raw);
};

const WEEK_DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

const EMPTY_HABIT_DAILY_STATE = {
  inRange: false,
  scheduledToday: false,
  hasToday: false,
  streak: 0,
  last7: [false, false, false, false, false, false, false],
};

const isHabitScheduledOnDate = (item = {}, value = new Date()) => {
  const date = toDateOnly(value);
  if (!date) return false;

  const start = toDateOnly(item?.startDate);
  const end = toDateOnly(item?.endDate);

  if (start && date < start) return false;
  if (end && date > end) return false;

  const cycle = item?.habitCycle;

  if (!cycle?.type) return true;

  if (cycle.type === 'weekly') {
    const days = Array.isArray(cycle.days) ? cycle.days : [];
    return days.includes(WEEK_DAY_LABELS[date.getDay()]);
  }

  if (cycle.type === 'monthly') {
    const dates = Array.isArray(cycle.dates)
      ? cycle.dates.map(Number)
      : [];
    return dates.includes(date.getDate());
  }

  return true;
};

const getHabitDailyState = (
  entries = [],
  item = {},
  now = new Date()
) => {
  const arr = Array.isArray(entries) ? entries : [];
  const today = toDateOnly(now);

  if (!today) return { ...EMPTY_HABIT_DAILY_STATE };

  const start = toDateOnly(item?.startDate);
  const end = toDateOnly(item?.endDate);

  const inRange = (
    (!start || today >= start)
    && (!end || today <= end)
  );

  const scheduledToday = (
    inRange && isHabitScheduledOnDate(item, today)
  );

  const recordedDays = new Set();

  for (const entry of arr) {
    const key = getEntryDateKey(entry);
    if (key) recordedDays.add(key);
  }

  const todayKey = keyOfDate(today);
  const hasToday = recordedDays.has(todayKey);

  const last7 = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    day.setHours(0, 0, 0, 0);
    last7.push(recordedDays.has(keyOfDate(day)));
  }

  let streak = 0;
  const streakCursor = new Date(today);

  if (!hasToday) {
    streakCursor.setDate(streakCursor.getDate() - 1);
  }

  streakCursor.setHours(0, 0, 0, 0);

  while (!start || streakCursor >= start) {
    if (!recordedDays.has(keyOfDate(streakCursor))) break;

    streak += 1;
    streakCursor.setDate(streakCursor.getDate() - 1);
    streakCursor.setHours(0, 0, 0, 0);
  }

  return {
    inRange,
    scheduledToday,
    hasToday,
    streak,
    last7,
  };
};

/**
 * 정렬 규칙
 * - mode='respectArray'  : 들어온 배열에서 활성 카드 등장 순서를 그대로 사용하여 저장(저장 시 사용)
 * - mode='respectMap'    : orderMap 기반으로 활성 카드를 재정렬(로드 시 사용)
 * - 완료 카드는 항상 아래로 보내고, 완료 섹션은 completedAt desc
 */
function normalizeWithOrder(arrRaw = [], orderMapIn = {}, mode = 'respectMap') {
  const raw = (arrRaw || []).map((c, i) => ({ ...ensureItemId(c, i), ...asDoneFlags(c) }));

  const done = raw.filter(c => c._isDone || c.archived).map(c => ({ ...c, archived: true }));
  const expired = raw.filter(c => !c._isDone && !c.archived && c._isExpired);
  const active = raw.filter(c => !(c._isDone || c.archived) && !c._isExpired);

  let mergedActive;
  if (mode === 'respectArray') {
    // ✅ 현재 배열에서의 활성 등장 순서를 그대로 유지
    mergedActive = active;
  } else {
    // 기존: orderMap 우선 정렬
    const known = [];
    const unknown = [];
    active.forEach(c => {
      const id = safeStringId(c.id);
      const idx = Number.isFinite(orderMapIn[id]) ? orderMapIn[id] : null;
      if (idx === null) unknown.push(c); else known.push({ idx, item: c });
    });
    known.sort((a, b) => a.idx - b.idx);
    unknown.sort((a, b) => {
      const aHas = Number.isFinite(a.sortIndex); const bHas = Number.isFinite(b.sortIndex);
      if (aHas && bHas) return a.sortIndex - b.sortIndex;
      if (aHas) return -1;
      if (bHas) return 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    // orderMap에 없는 새 활성 카드는 방금 생성된 카드일 가능성이 높으므로 기존 카드 앞에 둔다.
    mergedActive = [...unknown, ...known.map(k => k.item)];

    const activeKnownIds = active
      .filter(c => Number.isFinite(orderMapIn[safeStringId(c.id)]))
      .sort((a,b)=>orderMapIn[safeStringId(a.id)]-orderMapIn[safeStringId(b.id)])
      .map(c=>safeStringId(c.id));
    const activeUnknownIds = active
      .filter(c => !Number.isFinite(orderMapIn[safeStringId(c.id)]))
      .map(c=>safeStringId(c.id));

    console.log('[ChallengeList][normalizeWithOrder]');
    console.log('  mode=respectMap activeKnownIds :', activeKnownIds);
    console.log('  mode=respectMap activeUnknownIds:', activeUnknownIds);
  }

  const newOrderMap = {};
  const activeNormalized = mergedActive.map((c, i) => {
    newOrderMap[safeStringId(c.id)] = i;
    return { ...c, sortIndex: i, archived: false };
  });

  const doneSorted = done.sort((a, b) => (b._completedAt || 0) - (a._completedAt || 0));
  const expiredSorted = expired.sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
  const arranged = [...activeNormalized, ...expiredSorted, ...doneSorted];

  if (mode === 'respectArray') {
    console.log('[ChallengeList][normalizeWithOrder]');
    console.log('  mode=respectArray activeInArrOrder:', active.map(c=>safeStringId(c.id)));
  }
  console.log('  arrangedIds    :', arranged.map(c => `${c._isDone ? 'D' : 'A'}:${safeStringId(c.id)}`));
  console.log('  newOrderMap    :', newOrderMap);

  return { arranged, newOrderMap };
}

/* ---------- HOF 저장(단일 키 'hof') ---------- */
async function upsertHof(record) {
  try {
    const raw = await AsyncStorage.getItem('hof');
    const list = parseJson(raw) || [];
    const arr = Array.isArray(list) ? list : [];
    const id = safeStringId(record.id || record.challengeId);
    const rec = {
      id,
      challengeId: id,
      title: record.title ?? '(제목 없음)',
      startDate: record.startDate ?? null,
      endDate: record.endDate ?? null,
      goalScore: record.goalScore ?? 0,
      currentScore: record.currentScore ?? 0,
      rewardTitle: record.rewardTitle ?? record.reward ?? null,
      reward: record.reward ?? record.rewardTitle ?? null,
      status: 'completed',
      completedAt: record.completedAt ?? Date.now(),
      rewardClaimed: true,
      rewardClaimedAt: record.rewardClaimedAt ?? Date.now(),
      archived: true,
      ...record,
    };
    const filtered = arr.filter(h => safeStringId(h.id) !== id && safeStringId(h.challengeId) !== id);
    filtered.unshift(rec);
    await AsyncStorage.setItem('hof', JSON.stringify(filtered));
    console.log('[ChallengeList][HOF] upserted:', id);
  } catch (e) {
    console.warn('[ChallengeList][HOF] save failed', e);
  }
}

/* ---------- 빈 상태 ---------- */
const EmptyState = memo(() => (
  <View style={styles.emptyWrap}>
    <Text style={styles.emptyText}>
      아직 만든 도전·습관·루틴이 없어요.
    </Text>
  </View>
));

const rotationSummaryOf = (item) => {
  if (!isRotationRoutine(item)) return null;
  try { return getRotationRoutineSummary(item); } catch { return null; }
};

const formatRotationDuration = (seconds) => {
  const totalSeconds = Math.max(
    0,
    Math.round(Number(seconds) || 0)
  );

  const minutes = Math.floor(totalSeconds / 60);
  const remainSeconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${remainSeconds}초`;
  }

  if (remainSeconds === 0) {
    return `${minutes}분`;
  }

  return `${minutes}분 ${remainSeconds}초`;
};

const formatRotationProgress = (
  progressSeconds,
  targetSeconds
) => {
  const progress = Math.max(
    0,
    Math.round(Number(progressSeconds) || 0)
  );

  const target = Math.max(
    0,
    Math.round(Number(targetSeconds) || 0)
  );

  if (progress <= 0) {
    return formatRotationDuration(target);
  }

  return (
    `${formatRotationDuration(progress)}`
    + '/'
    + `${formatRotationDuration(target)}`
  );
};

const clampProgress = (value) => (
  Math.min(100, Math.max(0, Number(value) || 0))
);

const getCardTypeLabel = (item) => {
  if (isRotationRoutine(item)) return '순환루틴';
  if (item?.type === 'habit') return '습관';
  return '도전';
};

const CardProgressBar = memo(function CardProgressBar({
  value = 0,
}) {
  const pct = clampProgress(value);

  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          { width: `${pct}%` },
        ]}
      />
    </View>
  );
});

const HeroProgressRing = memo(function HeroProgressRing({
  value = null,
  mainText,
  subText,
  dark = false,
}) {
  const hasProgress = Number.isFinite(Number(value));
  const pct = hasProgress
    ? clampProgress(Number(value))
    : 0;

  const dashOffset = (
    HERO_RING_CIRCUMFERENCE
    * (1 - pct / 100)
  );

  const trackColor = dark
    ? primitive.neutral[700]
    : color.border;

  const progressColor = dark
    ? color.textInverse
    : color.primary;

  return (
    <View style={styles.heroRingWrap}>
      <Svg
        width={HERO_RING_SIZE}
        height={HERO_RING_SIZE}
        viewBox={`0 0 ${HERO_RING_SIZE} ${HERO_RING_SIZE}`}
      >
        <Circle
          cx={HERO_RING_CENTER}
          cy={HERO_RING_CENTER}
          r={HERO_RING_RADIUS}
          fill="none"
          stroke={trackColor}
          strokeWidth={HERO_RING_STROKE}
        />

        {hasProgress && (
          <Circle
            cx={HERO_RING_CENTER}
            cy={HERO_RING_CENTER}
            r={HERO_RING_RADIUS}
            fill="none"
            stroke={progressColor}
            strokeWidth={HERO_RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={
              HERO_RING_CIRCUMFERENCE
            }
            strokeDashoffset={dashOffset}
            rotation="-90"
            origin={`${HERO_RING_CENTER},${HERO_RING_CENTER}`}
          />
        )}
      </Svg>

      <View style={styles.heroRingTextLayer}>
        <Text
          style={[
            styles.heroRingMainText,
            dark && styles.heroRingMainTextDark,
          ]}
          numberOfLines={1}
        >
          {mainText}
        </Text>

        {!!subText && (
          <Text
            style={[
              styles.heroRingSubText,
              dark && styles.heroRingSubTextDark,
            ]}
            numberOfLines={1}
          >
            {subText}
          </Text>
        )}
      </View>
    </View>
  );
});

const MiniProgressRing = memo(function MiniProgressRing({
  value = 0,
}) {
  const pct = clampProgress(Number(value) || 0);

  const dashOffset = (
    MINI_RING_CIRCUMFERENCE
    * (1 - pct / 100)
  );

  return (
    <View style={styles.miniRing}>
      <Svg
        width={MINI_RING_SIZE}
        height={MINI_RING_SIZE}
        viewBox={`0 0 ${MINI_RING_SIZE} ${MINI_RING_SIZE}`}
      >
        <Circle
          cx={MINI_RING_CENTER}
          cy={MINI_RING_CENTER}
          r={MINI_RING_RADIUS}
          fill="none"
          stroke={color.border}
          strokeWidth={MINI_RING_STROKE}
        />

        <Circle
          cx={MINI_RING_CENTER}
          cy={MINI_RING_CENTER}
          r={MINI_RING_RADIUS}
          fill="none"
          stroke={color.primary}
          strokeWidth={MINI_RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={MINI_RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          rotation="-90"
          origin={`${MINI_RING_CENTER},${MINI_RING_CENTER}`}
        />
      </Svg>

      <Text style={styles.miniRingText}>
        {pct}
      </Text>
    </View>
  );
});

const CompactHabitStrip = memo(
  function CompactHabitStrip({
    last7 = EMPTY_HABIT_DAILY_STATE.last7,
  }) {
    const source = Array.isArray(last7)
      ? last7.slice(-7)
      : EMPTY_HABIT_DAILY_STATE.last7;

    return (
      <View style={styles.compactHabitStrip}>
        {source.map((done, index) => (
          <View
            key={`compact-habit-${index}`}
            style={[
              styles.compactHabitCell,
              done && styles.compactHabitCellDone,
            ]}
          />
        ))}
      </View>
    );
  }
);

const CompactPlayIcon = memo(function CompactPlayIcon() {
  return (
    <Svg
      width={14}
      height={14}
      viewBox="0 0 14 14"
    >
      <Path
        d="M4 2.6L11 7 4 11.4Z"
        fill={color.textInverse}
      />
    </Svg>
  );
});

const HabitWeekStrip = memo(function HabitWeekStrip({
  last7 = EMPTY_HABIT_DAILY_STATE.last7,
}) {
  const values = Array.isArray(last7)
    ? last7.slice(-7)
    : [];

  while (values.length < 7) values.unshift(false);

  return (
    <View style={styles.habitWeekRow}>
      {values.map((done, index) => (
        <View
          key={index}
          style={[
            styles.habitDayCell,
            done && styles.habitDayCellDone,
          ]}
        />
      ))}
    </View>
  );
});

const ChallengeCardHeader = memo(function ChallengeCardHeader({
  item,
  pct,
  rotationSummary,
}) {
  const metric = rotationSummary
    ? `${rotationSummary.currentCycleNumber}회차`
    : item?.type === 'habit'
      ? null
      : `${pct}%`;

  return (
    <>
      <View style={styles.cardTypeRow}>
        <Text style={styles.cardTypeLabel}>
          {getCardTypeLabel(item)}
        </Text>

        {!!metric && (
          <Text style={styles.cardMetric}>
            {metric}
          </Text>
        )}
      </View>

      <Text
        style={styles.cardTitle}
        numberOfLines={2}
      >
        {item?.title ?? '(제목 없음)'}
      </Text>
    </>
  );
});

const CardFoldHandle = memo(function CardFoldHandle({
  collapsed = false,
  onPress,
}) {
  return (
    <TouchableOpacity
      style={styles.cardFoldHandle}
      onPress={onPress}
      activeOpacity={0.65}
      hitSlop={{
        top: 6,
        bottom: 6,
        left: 18,
        right: 18,
      }}
      accessibilityRole="button"
      accessibilityLabel={
        collapsed ? '카드 펼치기' : '카드 접기'
      }
    >
      <Text
        style={[
          styles.cardFoldChevron,
          {
            transform: [
              {
                rotate: collapsed
                  ? '-90deg'
                  : '90deg',
              },
              { scaleY: 0.82 },
            ],
          },
        ]}
      >
        ‹
      </Text>
    </TouchableOpacity>
  );
});

const ChallengeCardStatus = memo(function ChallengeCardStatus({
  item,
  pct,
  rotationSummary,
  habitDailyState = EMPTY_HABIT_DAILY_STATE,
}) {
  if (rotationSummary) {
    const current = rotationSummary.currentItem;
    const next = rotationSummary.nextItem;

    const progressSeconds = Number(
      current?.progressSeconds || 0
    );

    const targetSeconds = Number(
      current?.targetSeconds || 0
    );

    return (
      <View style={styles.cardInfoPanel}>
        <Text style={styles.cardInfoLabel}>
          현재
        </Text>

        <Text
          style={styles.rotationCurrentName}
          numberOfLines={1}
        >
          {current?.name ?? '-'}
        </Text>

        <Text
          style={styles.rotationTimeText}
          numberOfLines={1}
        >
          {formatRotationProgress(
            progressSeconds,
            targetSeconds
          )}
        </Text>

        <CardProgressBar
          value={rotationSummary.progressPct ?? 0}
        />

        <View style={styles.cardInfoFooterRow}>
          <Text style={styles.cardInfoSecondary}>
            {rotationSummary.currentCycleNumber}회차 진행{' '}
            {rotationSummary.progressPct ?? 0}%
          </Text>

          <Text
            style={[
              styles.cardInfoSecondary,
              styles.cardInfoSecondaryRight,
            ]}
            numberOfLines={1}
          >
            다음 · {next?.name ?? '이번 회전 완료'}
          </Text>
        </View>
      </View>
    );
  }

  if (item?.type === 'habit') {
    const {
      scheduledToday,
      hasToday,
      streak,
      last7,
    } = habitDailyState;

    const todayMessage = !scheduledToday
      ? '오늘은 목표일이 아니에요'
      : hasToday
        ? '오늘 기록 완료'
        : '오늘 아직 기록하지 않았어요';

    const streakMessage = streak > 0
      ? `${streak}일 연속`
      : '연속 기록 없음';

    return (
      <View style={styles.cardInfoPanel}>
        <View style={styles.cardInfoMainRow}>
          <Text
            style={[
              styles.cardInfoValue,
              styles.cardInfoValueFlexible,
            ]}
            numberOfLines={1}
          >
            {todayMessage}
          </Text>

          <Text style={styles.cardInfoMetric}>
            {streakMessage}
          </Text>
        </View>

        <HabitWeekStrip last7={last7} />
      </View>
    );
  }

  const current = Math.max(
    0,
    Number(item?.currentScore || 0)
  );

  const goal = Number(item?.goalScore || 0);

  const hasGoal = (
    Number.isFinite(goal) && goal > 0
  );

  const remaining = hasGoal
    ? Math.max(0, goal - current)
    : null;

  return (
    <View style={styles.cardInfoPanel}>
      {hasGoal && (
        <CardProgressBar value={pct} />
      )}

      <View style={styles.cardInfoFooterRow}>
        <Text style={styles.cardInfoValue}>
          {hasGoal
            ? `${current}회 완료`
            : `현재 ${current}회`}
        </Text>

        {hasGoal && (
          <Text style={styles.cardInfoMetric}>
            {remaining}회 남음
          </Text>
        )}
      </View>

      {!!(item?.rewardTitle || item?.reward) && (
        <Text
          style={styles.rewardText}
          numberOfLines={1}
        >
          보상 · {item.rewardTitle ?? item.reward}
        </Text>
      )}
    </View>
  );
});

const ChallengeCardPrimaryAction = memo(
  function ChallengeCardPrimaryAction({
    item,
    isDone = false,
    isExpired = false,
    rotationSummary,
    habitDailyState = EMPTY_HABIT_DAILY_STATE,
    onPressCard,
    onPressClaim,
    onPressFocus,
  }) {
    if (isDone) {
      return (
        <TouchableOpacity
          style={styles.outlineBigBtn}
          onPress={() => onPressClaim?.(item)}
          activeOpacity={0.9}
        >
          <Text style={styles.outlineBigText}>
            보상 받기
          </Text>
        </TouchableOpacity>
      );
    }

    if (isExpired) {
      return (
        <TouchableOpacity
          style={styles.expiredBtn}
          disabled
          activeOpacity={1}
        >
          <Text style={styles.expiredBtnText}>
            기간 만료
          </Text>
        </TouchableOpacity>
      );
    }

    const rotation = isRotationRoutine(item);

    const recordLabel = (
      item?.type === 'habit'
      && habitDailyState.scheduledToday
      && !habitDailyState.hasToday
    )
      ? '오늘 기록'
      : '기록하기';

    return (
      <View style={styles.primaryActionRow}>
        <TouchableOpacity
          style={[
            styles.uploadNowBtn,
            styles.primaryActionMain,
          ]}
          onPress={() => {
            if (rotation) {
              onPressCard?.(item, 'continue');
              return;
            }

            onPressCard?.({
              ...item,
              _upload: true,
            });
          }}
          activeOpacity={0.9}
        >
          <Text style={styles.uploadNowText}>
            {recordLabel}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.focusPlayButton}
          onPress={() => onPressFocus?.(item)}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="타이머 시작"
        >
          <Text style={styles.focusPlayText}>
            타이머 시작
          </Text>
        </TouchableOpacity>
      </View>
    );
  }
);

const ChallengeCardCompactRow = memo(
  function ChallengeCardCompactRow({
    item,
    pct,
    rotationSummary,
    habitDailyState = EMPTY_HABIT_DAILY_STATE,
    isDone = false,
    isExpired = false,
    onPressToggleCollapsed,
    onPressCard,
    onPressClaim,
    onPressFocus,
  }) {
    const rotation = !!rotationSummary;

    const onRecord = () => {
      if (isExpired && !isDone) return;

      if (isDone) {
        onPressClaim?.(item);
        return;
      }

      if (rotation) {
        onPressCard?.(item, 'continue');
        return;
      }

      onPressCard?.({
        ...item,
        _upload: true,
      });
    };

    const recordLabel = isDone
      ? '보상'
      : isExpired
        ? '만료'
        : '기록';

    return (
      <View style={styles.compactCardContent}>
        <View style={styles.compactCardIdentity}>
          <Text style={styles.compactCardType}>
            {getCardTypeLabel(item)}
          </Text>

          <Text
            style={styles.compactCardTitle}
            numberOfLines={1}
          >
            {item?.title ?? '(제목 없음)'}
          </Text>
        </View>

        <View style={styles.compactActionRow}>
          {item?.type === 'habit' ? (
            <CompactHabitStrip
              last7={habitDailyState.last7}
            />
          ) : (
            <MiniProgressRing
              value={
                rotation
                  ? rotationSummary?.progressPct ?? 0
                  : pct
              }
            />
          )}

          <TouchableOpacity
            style={[
              styles.compactRecordButton,
              isExpired
                && !isDone
                && styles.compactActionDisabled,
            ]}
            disabled={isExpired && !isDone}
            onPress={onRecord}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.compactRecordText,
                isExpired
                  && !isDone
                  && styles.compactActionDisabledText,
              ]}
            >
              {recordLabel}
            </Text>
          </TouchableOpacity>

          {!isDone && !isExpired && (
            <TouchableOpacity
              style={styles.compactPlayButton}
              onPress={() => onPressFocus?.(item)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel="타이머 시작"
            >
              <CompactPlayIcon />
            </TouchableOpacity>
          )}
        </View>

        <CardFoldHandle
          collapsed
          onPress={onPressToggleCollapsed}
        />
      </View>
    );
  }
);

/* ---------- 카드 UI ---------- */
const CardBody = React.forwardRef(function CardBody({
  item,
  habitDailyState = EMPTY_HABIT_DAILY_STATE,
  variant = CHALLENGE_CARD_VARIANTS.LIST,
  collapsed = false,
  onPressCard,
  onPressClaim,
  onPressFocus,
  onPressToggleCollapsed,
}, ref) {
  const flags = asDoneFlags(item);
  const isDone = !!flags._isDone;
  const isExpired = !!flags._isExpired;

  const isCompactVariant = (
    variant === CHALLENGE_CARD_VARIANTS.COMPACT
    || !!collapsed
  );

  const rotationSummary = useMemo(
    () => rotationSummaryOf(item),
    [item]
  );

  const pct = rotationSummary?.progressPct
    ?? Math.min(
      100,
      Math.max(
        0,
        Number(item?.goalScore) > 0
          ? Math.round(
              (
                Number(item?.currentScore || 0)
                / Number(item.goalScore)
              )
              * 100
            )
          : 0
      )
    );

  if (isCompactVariant) {
    return (
      <TouchableOpacity
        ref={ref}
        activeOpacity={0.85}
        onPress={() => onPressCard?.(item)}
        style={[
          canonicalCardStyles.list,
          styles.cardCompact,
        ]}
      >
        <ChallengeCardCompactRow
          item={item}
          pct={pct}
          rotationSummary={rotationSummary}
          habitDailyState={habitDailyState}
          isDone={isDone}
          isExpired={isExpired}
          onPressToggleCollapsed={onPressToggleCollapsed}
          onPressCard={onPressCard}
          onPressClaim={onPressClaim}
          onPressFocus={onPressFocus}
        />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      ref={ref}
      activeOpacity={0.85}
      onPress={() => onPressCard?.(item)}
      style={canonicalCardStyles.list}
    >
      <View
        style={[
          styles.cardContent,
          isDone && styles.dimmedContent,
        ]}
      >
        <ChallengeCardHeader
          item={item}
          pct={pct}
          rotationSummary={rotationSummary}
        />

        <ChallengeCardStatus
          item={item}
          pct={pct}
          rotationSummary={rotationSummary}
          habitDailyState={habitDailyState}
        />
      </View>

      <ChallengeCardPrimaryAction
        item={item}
        isDone={isDone}
        isExpired={isExpired}
        rotationSummary={rotationSummary}
        habitDailyState={habitDailyState}
        onPressCard={onPressCard}
        onPressClaim={onPressClaim}
        onPressFocus={onPressFocus}
      />

      <CardFoldHandle
        collapsed={false}
        onPress={onPressToggleCollapsed}
      />
    </TouchableOpacity>
  );
});

/* ---------- 리스트 셀 ---------- */
const ItemCard = memo(
  React.forwardRef(function ItemCard({
    item,
    habitDailyState = EMPTY_HABIT_DAILY_STATE,
    variant = CHALLENGE_CARD_VARIANTS.LIST,
    collapsed = false,
    onPressToggleCollapsed,
    onPressCard,
    onPressClaim,
    onPressFocus,
  }, ref) {
    return (
      <View
        style={styles.cardWrap}
      >
        <CardBody
          ref={ref}
          item={item}
          habitDailyState={habitDailyState}
          variant={variant}
          collapsed={collapsed}
          onPressCard={onPressCard}
          onPressClaim={onPressClaim}
          onPressFocus={onPressFocus}
          onPressToggleCollapsed={
            onPressToggleCollapsed
          }
        />
      </View>
    );
  })
);

const ManageCardRow = memo(function ManageCardRow({
  item,
  index,
  featured = false,
  onToggleFeatured,
  onEdit,
  onDuplicate,
  onDelete,
  onDrop,
  onDragStateChange,
}) {
  const dragY = useRef(
    new Animated.Value(0)
  ).current;

  const [dragging, setDragging] = useState(false);

  const dragGesture = useMemo(
    () => (
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(2)
        .onBegin(() => {
          setDragging(true);
          onDragStateChange?.(safeStringId(item?.id));
        })
        .onUpdate((event) => {
          dragY.setValue(
            Number(event?.translationY) || 0
          );
        })
        .onFinalize((event) => {
          const translationY = (
            Number(event?.translationY) || 0
          );

          dragY.setValue(0);
          setDragging(false);
          onDragStateChange?.(null);

          onDrop?.(
            item,
            index,
            translationY
          );
        })
    ),
    [
      dragY,
      index,
      item,
      onDragStateChange,
      onDrop,
    ]
  );

  return (
    <Animated.View
      style={[
        styles.manageCardRow,
        dragging && styles.manageCardRowDragging,
        {
          transform: [
            { translateY: dragY },
          ],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.manageStarButton}
        onPress={() => onToggleFeatured?.(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={
          featured
            ? '오늘의 PUSH 해제'
            : '오늘의 PUSH 설정'
        }
      >
        <Text
          style={[
            styles.manageStarText,
            featured && styles.manageStarTextSelected,
          ]}
        >
          {featured ? '★' : '☆'}
        </Text>
      </TouchableOpacity>

      <View style={styles.manageIdentity}>
        <Text style={styles.manageTypeText}>
          {getCardTypeLabel(item)}
        </Text>

        <Text
          style={styles.manageTitleText}
          numberOfLines={1}
        >
          {item?.title ?? '(제목 없음)'}
        </Text>
      </View>

      <View style={styles.manageActions}>
        <TouchableOpacity
          style={styles.manageActionButton}
          onPress={() => onEdit?.(item)}
          activeOpacity={0.75}
        >
          <Text style={styles.manageActionText}>
            수정
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.manageActionButton}
          onPress={() => onDuplicate?.(item)}
          activeOpacity={0.75}
        >
          <Text style={styles.manageActionText}>
            복제
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.manageActionButton}
          onPress={() => onDelete?.(item)}
          activeOpacity={0.75}
        >
          <Text style={styles.manageActionText}>
            삭제
          </Text>
        </TouchableOpacity>
      </View>

      <GestureDetector gesture={dragGesture}>
        <View
          style={styles.manageDragHandle}
          accessibilityRole="button"
          accessibilityLabel="순서 변경"
        >
          <Text style={styles.manageDragHandleText}>
            ≡
          </Text>
        </View>
      </GestureDetector>
    </Animated.View>
  );
});

/* ---------- Home Hero ---------- */
const HomeHero = memo(function HomeHero({
  item,
  habitDailyState = EMPTY_HABIT_DAILY_STATE,
  rotationSummary,
  onRecord,
  onFocus,
}) {
  if (!item) {
    return (
      <View style={styles.homeHeroEmptySection}>
        <Text style={styles.heroEmptyEyebrow}>
          오늘의 PUSH
        </Text>

        <View style={styles.heroEmptyBox}>
          <Text style={styles.heroEmptyText}>
            카드 수정을 눌러 오늘의 PUSH를 선정하세요
          </Text>
        </View>
      </View>
    );
  }

  if (isRotationRoutine(item)) {
    const current = rotationSummary?.currentItem;
    const next = rotationSummary?.nextItem;
    const pct = rotationSummary?.progressPct ?? 0;

    return (
      <View style={styles.homeHeroSpotlight}>
        <View style={styles.heroSpotlightTop}>
          <Text style={styles.heroSpotlightEyebrow}>
            TODAY'S PUSH
          </Text>
          <Text style={styles.heroSpotlightStar}>★</Text>
        </View>

        <View style={styles.heroMainRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroSpotlightType}>
              순환루틴
            </Text>

            <Text
              style={styles.heroSpotlightTitle}
              numberOfLines={2}
            >
              {item?.title ?? '순환루틴'}
            </Text>

            <Text
              style={styles.heroSpotlightMessage}
              numberOfLines={1}
            >
              현재 · {current?.name ?? '-'}
            </Text>

            <Text
              style={styles.heroSpotlightSub}
              numberOfLines={1}
            >
              다음 · {next?.name ?? '이번 회전 완료'}
            </Text>
          </View>

          <HeroProgressRing
            dark
            value={pct}
            mainText={`${pct}%`}
            subText={
              `${rotationSummary?.currentCycleNumber ?? 1}회차`
            }
          />
        </View>

        <TouchableOpacity
          style={styles.heroSpotlightAction}
          onPress={() => onFocus?.(item)}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="타이머 시작"
        >
          <Text style={styles.heroSpotlightActionText}>
            타이머 시작
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (item?.type === 'habit') {
    const {
      scheduledToday,
      hasToday,
      streak,
    } = habitDailyState;

    const todayMessage = !scheduledToday
      ? '오늘은 목표일이 아니에요'
      : hasToday
        ? '오늘 기록 완료'
        : '오늘 아직 기록하지 않았어요';

    return (
      <View style={styles.homeHeroSpotlight}>
        <View style={styles.heroSpotlightTop}>
          <Text style={styles.heroSpotlightEyebrow}>
            TODAY'S PUSH
          </Text>
          <Text style={styles.heroSpotlightStar}>★</Text>
        </View>

        <View style={styles.heroMainRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroSpotlightType}>
              습관
            </Text>

            <Text
              style={styles.heroSpotlightTitle}
              numberOfLines={2}
            >
              {item?.title ?? '(제목 없음)'}
            </Text>

            <Text
              style={styles.heroSpotlightMessage}
              numberOfLines={2}
            >
              {todayMessage}
            </Text>
          </View>

          <HeroProgressRing
            dark
            value={null}
            mainText={`${streak}`}
            subText="일 연속"
          />
        </View>

        <TouchableOpacity
          style={styles.heroSpotlightAction}
          onPress={() => onRecord?.(item)}
          activeOpacity={0.9}
        >
          <Text style={styles.heroSpotlightActionText}>
            {hasToday
              ? '기록하기'
              : '오늘 기록하기'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const current = Math.max(
    0,
    Number(item?.currentScore || 0)
  );

  const goal = Number(item?.goalScore || 0);

  const validGoal = (
    Number.isFinite(goal) && goal > 0
  );

  const pct = validGoal
    ? clampProgress(
        Math.round((current / goal) * 100)
      )
    : 0;

  const remaining = validGoal
    ? Math.max(0, goal - current)
    : null;

  return (
    <View style={styles.homeHeroSpotlight}>
      <View style={styles.heroSpotlightTop}>
        <Text style={styles.heroSpotlightEyebrow}>
          TODAY'S PUSH
        </Text>
        <Text style={styles.heroSpotlightStar}>★</Text>
      </View>

      <View style={styles.heroMainRow}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroSpotlightType}>
            도전
          </Text>

          <Text
            style={styles.heroSpotlightTitle}
            numberOfLines={2}
          >
            {item?.title ?? '(제목 없음)'}
          </Text>

          <Text style={styles.heroSpotlightMessage}>
            {validGoal
              ? `${current}회 완료`
              : `현재 ${current}회`}
          </Text>

          {validGoal && (
            <Text style={styles.heroSpotlightSub}>
              목표까지 {remaining}회 남음
            </Text>
          )}
        </View>

        <HeroProgressRing
          dark
          value={validGoal ? pct : null}
          mainText={
            validGoal ? `${pct}%` : `${current}`
          }
          subText={
            validGoal ? '진행' : '회'
          }
        />
      </View>

      <TouchableOpacity
        style={styles.heroSpotlightAction}
        onPress={() => onRecord?.(item)}
        activeOpacity={0.9}
      >
        <Text style={styles.heroSpotlightActionText}>
          기록하기
        </Text>
      </TouchableOpacity>
    </View>
  );
});

const ChallengeListControls = memo(
  function ChallengeListControls({
    editing = false,
    sortLabel,
    onPressSort,
    onPressEdit,
  }) {
    return (
      <View style={styles.sectionHeaderRow}>
        <TouchableOpacity
          style={[
            styles.sectionControlButton,
            editing
              && styles.sectionControlButtonDisabled,
          ]}
          onPress={onPressSort}
          disabled={editing}
          activeOpacity={0.75}
        >
          <Text style={styles.sectionControlText}>
            정렬 · {sortLabel}
          </Text>

          <Text style={styles.sectionControlArrow}>
            ▾
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sectionControlButton}
          onPress={onPressEdit}
          activeOpacity={0.75}
        >
          <Text style={styles.sectionControlText}>
            {editing ? '완료' : '카드 수정'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }
);

const ChallengeSortDropdown = memo(
  function ChallengeSortDropdown({
    visible,
    sortMode,
    onSelect,
  }) {
    if (!visible) return null;

    return (
      <View style={styles.sortDropdown}>
        {SORT_OPTIONS.map((option, index) => {
          const selected = (
            sortMode === option.key
          );

          return (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.sortDropdownOption,
                index === SORT_OPTIONS.length - 1
                  && styles.sortDropdownOptionLast,
                selected
                  && styles.sortDropdownOptionSelected,
              ]}
              onPress={() => onSelect(option.key)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.sortDropdownText,
                  selected
                    && styles.sortDropdownTextSelected,
                ]}
              >
                {option.label}
              </Text>

              {selected && (
                <Text style={styles.sortDropdownCheck}>
                  ✓
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }
);

/* ---------- 화면 ---------- */
export default function ChallengeListScreen() {
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [data, setData] = useState([]);
  const [habitDailyStateMap, setHabitDailyStateMap] = useState({});
  const [listFrameWidth, setListFrameWidth] = useState(0);
  const [focusTarget, setFocusTarget] = useState(null);
  const [focusStarting, setFocusStarting] = useState(false);
  const [cardEditMode, setCardEditMode] = useState(false);
  const [featuredPushId, setFeaturedPushId] = useState(null);
  const [briefNotice, setBriefNotice] = useState('');
  const [draggingManageId, setDraggingManageId] = useState(null);

  const briefNoticeTimerRef = useRef(null);
  const responsiveFade = useRef(
    new Animated.Value(1)
  ).current;
  const previousWideLayoutRef = useRef(null);

  /* 정렬 상태 */
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [sortMode, setSortMode] = useState('manual');
  const [collapsedIds, setCollapsedIds] = useState({});
  const collapsedIdsRef = useRef({});

  const persistCollapsedIds = useCallback(async (nextMap) => {
    try {
      await AsyncStorage.setItem(COLLAPSED_CARDS_KEY, JSON.stringify(nextMap || {}));
    } catch (e) {
      console.warn('[ChallengeList][collapsed] save failed', e);
    }
  }, []);

  useEffect(() => {
    collapsedIdsRef.current = collapsedIds;
  }, [collapsedIds]);

  useEffect(() => {
    if (!isFocused) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(COLLAPSED_CARDS_KEY);
        const parsed = parseJson(raw);
        const next = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        collapsedIdsRef.current = next;
        setCollapsedIds(next);
      } catch (e) {
        console.warn('[ChallengeList][collapsed] load failed', e);
      }
    })();
  }, [isFocused]);

  const dataRef = useRef([]);
  useEffect(() => { dataRef.current = data; }, [data]);

  const showBriefNotice = useCallback((message) => {
    if (briefNoticeTimerRef.current) {
      clearTimeout(briefNoticeTimerRef.current);
    }

    setBriefNotice(String(message || ''));

    briefNoticeTimerRef.current = setTimeout(() => {
      setBriefNotice('');
      briefNoticeTimerRef.current = null;
    }, 1600);
  }, []);

  useEffect(() => {
    return () => {
      if (briefNoticeTimerRef.current) {
        clearTimeout(briefNoticeTimerRef.current);
        briefNoticeTimerRef.current = null;
      }
    };
  }, []);

  /* 저장/정리 — 저장 시엔 배열 우선(respectArray) */
  const persistChallenges = useCallback(async (arr, tag = '') => {
    const ensured = (Array.isArray(arr) ? arr : []).map(ensureItemId);
    const clean = dedupeById(ensured);

    const currentOrder = await readOrderMap();
    const { arranged, newOrderMap } = normalizeWithOrder(clean, currentOrder, 'respectArray');

    try {
      await Promise.all([
        AsyncStorage.setItem(CHALLENGES_KEY, JSON.stringify(arranged)),
        AsyncStorage.setItem(ORDER_KEY, JSON.stringify(newOrderMap)),
      ]);
      await syncWidgetChallengeList();
      console.log(`[ChallengeList][persistChallenges${tag ? ':'+tag : ''}] saved arrangedIds=`, arranged.map(c => `${c._isDone?'D':'A'}:${safeStringId(c.id)}`));
      console.log(`[ChallengeList][persistChallenges] orderMap=`, newOrderMap);
    } catch (e) {
      console.warn('[ChallengeList][persistChallenges] save failed', e);
    }
    return arranged;
  }, []);

  const toggleFeaturedPush = useCallback(async (item) => {
    const id = safeStringId(item?.id);

    if (!id || !isCurrentCard(item)) return;

    if (safeStringId(featuredPushId) === id) {
      try {
        await AsyncStorage.removeItem(
          TODAY_PUSH_KEY
        );
      } catch {}

      setFeaturedPushId(null);

      showBriefNotice(
        '오늘의 PUSH 설정을 해제했습니다.'
      );

      return;
    }

    try {
      await AsyncStorage.setItem(
        TODAY_PUSH_KEY,
        id
      );
    } catch {}

    setFeaturedPushId(id);

    showBriefNotice(
      '오늘의 PUSH로 설정했습니다.'
    );
  }, [
    featuredPushId,
    showBriefNotice,
  ]);

  const clearFeaturedPushIfNeeded = useCallback(
    async (itemId, {
      showNotice = false,
    } = {}) => {
      const id = safeStringId(itemId);

      if (
        !id
        || safeStringId(featuredPushId) !== id
      ) {
        return;
      }

      try {
        await AsyncStorage.removeItem(
          TODAY_PUSH_KEY
        );
      } catch {}

      setFeaturedPushId(null);

      if (showNotice) {
        showBriefNotice(
          '오늘의 PUSH 설정을 해제했습니다.'
        );
      }
    },
    [
      featuredPushId,
      showBriefNotice,
    ]
  );

  /* 데이터 로드 — 로드시엔 맵 우선(respectMap) */
  useEffect(() => {
    if (!isFocused) return;
    (async () => {
      const [
        rawStr,
        storedFeaturedPushId,
      ] = await Promise.all([
        AsyncStorage.getItem(CHALLENGES_KEY),
        AsyncStorage.getItem(TODAY_PUSH_KEY),
      ]);
      const raw = parseJson(rawStr) || [];
      const ensured = (Array.isArray(raw) ? raw : []).map(ensureItemId);
      const deduped = dedupeById(ensured);
      const refreshed = await Promise.all(
        deduped.map(async (item) => {
          if (!isRotationRoutine(item)) return item;
          try {
            const latest = await loadRotationRoutine(item.id);
            return latest ?? item;
          } catch (error) {
            console.warn('[ChallengeList][rotationRefresh] failed:', error);
            return item;
          }
        })
      );

      const orderMap = await readOrderMap();
      const { arranged, newOrderMap } = normalizeWithOrder(refreshed, orderMap, 'respectMap');

      console.log('[ChallengeList][load] rawIds=', (raw||[]).map(it=>safeStringId(it?.id||it?.challengeId)));
      console.log('[ChallengeList][load] arrangedIds=', arranged.map(c => `${c._isDone?'D':'A'}:${safeStringId(c.id)}`));

      const nextHabitDailyStateMap = {};

      await Promise.all(
        arranged
          .filter((c) => c?.type === 'habit')
          .map(async (c) => {
            const id = safeStringId(c.id);

            if (!id) return;

            try {
              const rawEntries = await AsyncStorage.getItem(
                `entries_${id}`
              );

              const parsedEntries = parseJson(rawEntries);

              const entries = Array.isArray(parsedEntries)
                ? parsedEntries
                : [];

              nextHabitDailyStateMap[id] = (
                getHabitDailyState(entries, c)
              );
            } catch {
              nextHabitDailyStateMap[id] = {
                ...EMPTY_HABIT_DAILY_STATE,
              };
            }
          })
      );

      const storedFeaturedId = safeStringId(
        storedFeaturedPushId
      );

      const validFeaturedItem = storedFeaturedId
        ? arranged.find(
            (item) => (
              safeStringId(item?.id)
              === storedFeaturedId
              && isCurrentCard(item)
            )
          )
        : null;

      if (storedFeaturedId && !validFeaturedItem) {
        try {
          await AsyncStorage.removeItem(
            TODAY_PUSH_KEY
          );
        } catch {}

        setFeaturedPushId(null);
      } else {
        setFeaturedPushId(
          validFeaturedItem
            ? safeStringId(validFeaturedItem.id)
            : null
        );
      }

      setData(arranged);
      setHabitDailyStateMap(nextHabitDailyStateMap);
      try {
        await AsyncStorage.setItem(CHALLENGES_KEY, JSON.stringify(arranged));
        await writeOrderMap(newOrderMap);
      } catch {}
    })().catch(e => console.warn('[ChallengeList][load] error', e));
  }, [isFocused]);

  /* 화면 blur 시 강제 저장 (dataRef.snapshot 기반) */
  useEffect(() => {
    if (isFocused) return;
    (async () => {
      const snapshot = dataRef.current || [];
      console.log('[ChallengeList][blur] snapshotIds=', snapshot.map(c => `${c._isDone?'D':'A'}:${safeStringId(c.id)}`));
      try { await persistChallenges(snapshot, 'blur'); } catch {}
    })();
  }, [isFocused, persistChallenges]);

  const applySortMode = useCallback((mode) => {
    setShowSortDropdown(false);

    if (
      mode === 'manual'
      || isFilterSortMode(mode)
    ) {
      setSortMode(mode);
    }
  }, []);


  useEffect(() => {
    if (!isFocused || Platform.OS !== 'android') return;
    const onBackPress = () => {
      if (cardEditMode) {
        setCardEditMode(false);
        setDraggingManageId(null);
        return true;
      }
      Alert.alert('앱 종료', '정말 종료할까요?', [
        { text: '취소', style: 'cancel' },
        { text: '종료', style: 'destructive', onPress: () => BackHandler.exitApp() },
      ]);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [isFocused, cardEditMode]);

  /* 애니메이션 */
  const animateList = useCallback(() => {
    LayoutAnimation.configureNext({
      duration: 180,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
  }, []);

  const animateCardResize = useCallback((duration = CARD_COLLAPSE_ANIM_MS) => {
    LayoutAnimation.configureNext({
      duration,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
  }, []);

  const toggleCollapsed = useCallback((item) => {
    const id = safeStringId(item?.id);
    if (!id) return;
    animateCardResize();
    setCollapsedIds((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      persistCollapsedIds(next);
      return next;
    });
  }, [animateCardResize, persistCollapsedIds]);

  /* CRUD/네비 */
  const navigationRef = useRef(navigation);

  const onDelete = useCallback(async (item) => {
    Alert.alert('삭제 확인', `'${item.title}'을 삭제할까요?\n설정 > 휴지통에서 30일간 보관됩니다.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          try { await cancelAllForChallenge(item.id).catch(() => {}); } catch {}
          animateList();

          const prev = dataRef.current || [];
          const nextArr = prev.filter(c => safeStringId(c.id) !== safeStringId(item.id));

          console.log('[ChallengeList][onDelete] nextArrIds=', nextArr.map(c => `${c._isDone?'D':'A'}:${safeStringId(c.id)}`));

          setData(nextArr);
          try { await persistChallenges(nextArr, 'delete'); } catch {}
          try { await moveToTrash(item); } catch {}
          await clearFeaturedPushIfNeeded(
            item.id,
            { showNotice: true }
          );
        },
      },
    ]);
  }, [animateList, persistChallenges, clearFeaturedPushIfNeeded]);

  const onDuplicate = useCallback((item) => {
    if (!isCurrentCard(item)) return;
    animateList();

    const source = ensureItemId(item);

    setCardEditMode(false);
    setDraggingManageId(null);
    setShowSortDropdown(false);

    if (isRotationRoutine(source)) {
      navigationRef.current.push(
        'AddRotationRoutine',
        {
          duplicateTemplate: source,
          duplicateNonce: Date.now(),
        }
      );

      return;
    }

    const duplicateTemplate = {
      ...source,
      id: undefined,
      challengeId: undefined,
      title: `${source?.title || '새 도전'} (복제)`,
      currentScore: 0,
      status: 'active',
      createdAt: undefined,
      completedAt: 0,
      sortIndex: 0,
      _isDone: false,
      _completedAt: 0,
      _isExpired: false,
      archived: false,
      rewardClaimed: false,
      rewardClaimedAt: undefined,
    };

    console.log('[ChallengeList][onDuplicateTemplate]', {
      sourceId: safeStringId(source?.id),
      title: duplicateTemplate.title,
      type: duplicateTemplate.type || 'challenge',
    });

    navigationRef.current.navigate('AddChallenge', {
      duplicateTemplate,
      duplicateSourceId: safeStringId(source?.id),
      duplicateNonce: Date.now(),
    });
  }, [animateList]);

  const openCardEditScreen = useCallback((item) => {
    if (!item) return;

    setCardEditMode(false);
    setDraggingManageId(null);
    setShowSortDropdown(false);

    if (isRotationRoutine(item)) {
      navigationRef.current.navigate(
        'EditRotationRoutine',
        {
          routineId: item.id,
        }
      );

      return;
    }

    navigationRef.current.navigate(
      'AddChallenge',
      {
        editChallenge: item,
        editNonce: Date.now(),
        initialType: (
          item?.type === 'habit'
            ? 'habit'
            : 'challenge'
        ),
      }
    );
  }, []);

  const goEntryList = useCallback((item, action) => {
    if (isRotationRoutine(item)) {
      if (action === 'continue') {
        navigationRef.current.navigate('RotationRoutineDetail', {
          routineId: item.id,
        });
        return;
      }
      navigationRef.current.navigate('EntryList', {
        challengeId: item.id,
        title: item.title,
        type: 'rotation',
        challengeType: 'rotation',
        item,
        challenge: item,
      });
      return;
    }
    if (item?._upload) { navigationRef.current.navigate('Upload', { challengeId: item.id }); return; }
    navigationRef.current.navigate('EntryList', {
      challengeId: item.id,
      title: item.title,
      startDate: item.startDate,
      endDate: item.endDate,
      targetScore: item.goalScore,
      rewardTitle: item.rewardTitle,
      reward: item.reward,
      type: item.type,
      challengeType: item.type,
      description: item.description,
    });
  }, []);

  const openFocusStart = useCallback(async (item) => {
    try {
      const active = await loadActiveFocusSession();
      if (active) {
        Alert.alert('집중 타이머 실행 중', `'${active.targetTitle}' 타이머가 이미 실행 중입니다.`, [
          { text: '닫기', style: 'cancel' },
          {
            text: '현재 타이머 보기',
            onPress: () => navigationRef.current.navigate('FocusTimer', { sessionId: active.id }),
          },
        ]);
        return;
      }
      let nextTarget = item;
      if (isRotationRoutine(item)) {
        nextTarget = await loadRotationRoutine(String(item.id));
      }
      setFocusTarget(nextTarget);
    } catch (error) {
      Alert.alert('확인 실패', error?.message || '집중 타이머 상태를 확인하지 못했습니다.');
    }
  }, []);

  const beginFocusSession = useCallback(async ({ mode, targetSeconds, alarmEnabled }) => {
    if (!focusTarget || focusStarting) return;
    setFocusStarting(true);
    try {
      let targetForSession = focusTarget;
      let rotationSummary = null;
      if (isRotationRoutine(focusTarget)) {
        targetForSession = await loadRotationRoutine(String(focusTarget.id));
        rotationSummary = getRotationRoutineSummary(targetForSession);
        if (!rotationSummary.currentItem) {
          throw new Error('현재 실행할 순환루틴 활동이 없습니다.');
        }
      }
      const session = await startFocusSession({
        targetType: targetForSession.type === 'habit' ? 'habit' : 'challenge',
        ...(rotationSummary ? {
          targetSubtype: 'rotation',
          rotationItemId: rotationSummary.currentItem.id,
          rotationItemTitle: rotationSummary.currentItem.name,
          rotationCycleNumber: rotationSummary.currentCycleNumber,
          rotationStartProgressSeconds: rotationSummary.currentItem.progressSeconds,
        } : {}),
        targetId: String(targetForSession.id),
        targetTitle: String(targetForSession.title || '').trim(),
        mode,
        targetSeconds,
        alarmEnabled,
      });
      setFocusTarget(null);
      navigationRef.current.navigate('FocusTimer', { sessionId: session.id });
    } catch (error) {
      if (error?.code === 'FOCUS_SESSION_ACTIVE' && error.session) {
        setFocusTarget(null);
        Alert.alert('집중 타이머 실행 중', '새 타이머를 만들지 않고 기존 타이머로 이동합니다.', [
          { text: '닫기', style: 'cancel' },
          {
            text: '현재 타이머 보기',
            onPress: () => navigationRef.current.navigate('FocusTimer', { sessionId: error.session.id }),
          },
        ]);
      } else {
        Alert.alert('시작 실패', error?.message || '집중 타이머를 시작하지 못했습니다.');
      }
    } finally {
      setFocusStarting(false);
    }
  }, [focusStarting, focusTarget]);

  /* 보상 수령 */
  const onClaimReward = useCallback(async (item) => {
    const flags = asDoneFlags(item);
    if (!flags._isDone) {
      Alert.alert('아직 완료 전이에요', '목표를 달성하면 보상을 받을 수 있어요.');
      return;
    }
    const completedAtTs = Date.now();

    const prev = dataRef.current || [];
    const nextArr = prev.map(c =>
      String(c.id) === String(item.id)
        ? {
            ...c,
            status: 'completed',
            completedAt: completedAtTs,
            rewardClaimed: true,
            rewardClaimedAt: completedAtTs,
            archived: true
          }
        : c
    );

    console.log('[ChallengeList][onClaimReward] nextArrIds=', nextArr.map(c => `${c._isDone?'D':'A'}:${safeStringId(c.id)}`));

    // 보상 완료 후 해당 카드를 목록에서 즉시 제거
    const withoutClaimed = nextArr.filter(c => String(c.id) !== String(item.id));
    const enriched = withoutClaimed.map(c => ({ ...c, ...asDoneFlags(c) }));
    setData(enriched);
    try { await persistChallenges(nextArr, 'claim'); } catch {}
    await clearFeaturedPushIfNeeded(
      item.id,
      { showNotice: true }
    );

    try { await cancelAllForChallenge(item.id).catch(() => {}); } catch {}

    const hofRecord = {
      ...item,
      id: String(item.id),
      challengeId: String(item.id),
      status: 'completed',
      completedAt: completedAtTs,
      rewardClaimed: true,
      rewardClaimedAt: completedAtTs,
      archived: true,
    };
    await upsertHof(hofRecord);

    navigationRef.current.navigate('HallOfFameScreen', {
      highlightId: hofRecord.id,
      justClaimed: true,
      ts: completedAtTs,
    });
  }, [persistChallenges, clearFeaturedPushIfNeeded]);

  /* 렌더 */
  const displayData = useMemo(
    () => buildDisplayData(data, sortMode),
    [data, sortMode]
  );

  const heroItem = useMemo(() => {
    const id = safeStringId(featuredPushId);

    if (!id) return null;

    return (
      data.find(
        (item) => (
          safeStringId(item?.id) === id
          && isCurrentCard(item)
        )
      )
      || null
    );
  }, [
    data,
    featuredPushId,
  ]);

  const heroHabitDailyState = (
    heroItem?.type === 'habit'
      ? (
          habitDailyStateMap[
            safeStringId(heroItem.id)
          ]
          || EMPTY_HABIT_DAILY_STATE
        )
      : EMPTY_HABIT_DAILY_STATE
  );

  const heroRotationSummary = useMemo(
    () => (
      heroItem && isRotationRoutine(heroItem)
        ? rotationSummaryOf(heroItem)
        : null
    ),
    [heroItem]
  );

  const onHeroRecord = useCallback((item) => {
    if (!item?.id) return;

    navigationRef.current.navigate('Upload', {
      challengeId: item.id,
    });
  }, []);

  const editableItems = useMemo(
    () => data.filter(isCurrentCard),
    [data]
  );

  const enterCardEditMode = useCallback(() => {
    const source = dataRef.current || [];

    if (sortMode !== 'manual') {
      const currentDisplay = buildDisplayData(
        source,
        sortMode
      );

      dataRef.current = currentDisplay;
      setData(currentDisplay);
      setSortMode('manual');

      persistChallenges(
        currentDisplay,
        'edit-mode-order'
      ).catch(() => {});
    }

    setCardEditMode(true);
    setDraggingManageId(null);
  }, [
    persistChallenges,
    sortMode,
  ]);

  const exitCardEditMode = useCallback(() => {
    setCardEditMode(false);
    setDraggingManageId(null);
  }, []);

  const toggleCardEditMode = useCallback(() => {
    if (cardEditMode) {
      exitCardEditMode();
      return;
    }

    enterCardEditMode();
  }, [
    cardEditMode,
    enterCardEditMode,
    exitCardEditMode,
  ]);

  const moveManageCard = useCallback(
    (item, visibleIndex, translationY) => {
      const source = dataRef.current || [];
      const activeItems = source.filter(isCurrentCard);
      const inactiveItems = source.filter(
        (candidate) => !isCurrentCard(candidate)
      );
      const id = safeStringId(item?.id);
      const from = activeItems.findIndex(
        (candidate) => (
          safeStringId(candidate?.id) === id
        )
      );

      if (from < 0) return;

      const dragSteps = Math.round(
        (Number(translationY) || 0)
        / MANAGE_ROW_STEP
      );

      if (dragSteps === 0) return;

      const to = Math.max(
        0,
        Math.min(
          activeItems.length - 1,
          from + dragSteps
        )
      );

      if (to === from) return;

      const movedActive = moveInArray(
        activeItems,
        from,
        to
      );
      const next = [
        ...movedActive,
        ...inactiveItems,
      ];

      LayoutAnimation.configureNext({
        duration: 180,
        update: {
          type: LayoutAnimation.Types.easeInEaseOut,
        },
      });

      dataRef.current = next;
      setData(next);
      setSortMode('manual');
      setShowSortDropdown(false);

      persistChallenges(
        next,
        'manage-drag'
      ).catch((error) => {
        console.warn(
          '[ChallengeList][manageDrag] save failed',
          error
        );
      });
    },
    [persistChallenges]
  );

  const keyExtractor = useCallback((it) => safeStringId(it?.id ?? it?.challengeId ?? it?.uuid ?? it?.key ?? ''), []);
  const listBottomPad = space.lg;
  const foldableLayoutRefreshKey = `${Math.round(windowWidth || 0)}:${Math.round(windowHeight || 0)}`;
  const { refresh: refreshFoldableLayoutState } = useFoldableLayoutState(foldableLayoutRefreshKey);
  const layoutWidth = listFrameWidth || windowWidth;
  const isWideChallengeList = layoutWidth >= 600;

  useEffect(() => {
    if (previousWideLayoutRef.current == null) {
      previousWideLayoutRef.current = (
        isWideChallengeList
      );
      return;
    }

    if (
      previousWideLayoutRef.current
      === isWideChallengeList
    ) {
      return;
    }

    previousWideLayoutRef.current = (
      isWideChallengeList
    );

    LayoutAnimation.configureNext({
      duration: 230,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });

    responsiveFade.stopAnimation();
    responsiveFade.setValue(0.86);

    Animated.timing(
      responsiveFade,
      {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }
    ).start();
  }, [
    isWideChallengeList,
    responsiveFade,
  ]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      const refreshNow = async () => {
        try {
          await refreshFoldableLayoutState();
        } catch (error) {
          console.warn('[ChallengeList][foldableRefresh][focus] failed:', error);
        }
      };

      refreshNow();

      const delayedRefreshTimer = setTimeout(() => {
        if (alive) {
          refreshNow();
        }
      }, 350);

      return () => {
        alive = false;
        clearTimeout(delayedRefreshTimer);
      };
    }, [refreshFoldableLayoutState])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;

      refreshFoldableLayoutState().catch((error) => {
        console.warn('[ChallengeList][foldableRefresh][active] failed:', error);
      });

      setTimeout(() => {
        refreshFoldableLayoutState().catch((error) => {
          console.warn('[ChallengeList][foldableRefresh][activeDelayed] failed:', error);
        });
      }, 350);
    });

    return () => subscription.remove();
  }, [refreshFoldableLayoutState]);

  const renderRow = useCallback(
    ({ item }) => {
      const id = safeStringId(item.id);
      const isCollapsed = !!collapsedIds[id];

      return (
        <ItemCard
          item={item}
          habitDailyState={
            habitDailyStateMap[id]
            || EMPTY_HABIT_DAILY_STATE
          }
          variant={CHALLENGE_CARD_VARIANTS.LIST}
          collapsed={isCollapsed}
          onPressToggleCollapsed={() => (
            toggleCollapsed(item)
          )}
          onPressCard={(it, action) => {
            if (it?._isExpired) {
              Alert.alert(
                '기간 만료',
                '이 도전의 기간이 만료되었습니다.'
              );
              return;
            }

            if (it?._upload) {
              navigationRef.current.navigate(
                'Upload',
                {
                  challengeId: it.id,
                }
              );
              return;
            }

            goEntryList(it, action);
          }}
          onPressClaim={onClaimReward}
          onPressFocus={openFocusStart}
        />
      );
    },
    [
      collapsedIds,
      habitDailyStateMap,
      goEntryList,
      onClaimReward,
      openFocusStart,
      toggleCollapsed,
    ]
  );

  const renderManageRow = useCallback(
    ({ item, index }) => (
      <ManageCardRow
        item={item}
        index={index}
        featured={
          safeStringId(featuredPushId)
          === safeStringId(item?.id)
        }
        onToggleFeatured={toggleFeaturedPush}
        onEdit={openCardEditScreen}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onDrop={moveManageCard}
        onDragStateChange={setDraggingManageId}
      />
    ),
    [
      featuredPushId,
      moveManageCard,
      onDelete,
      onDuplicate,
      openCardEditScreen,
      toggleFeaturedPush,
    ]
  );

  const homeListHeader = (
    <>
      <HomeHero
        item={heroItem}
        habitDailyState={heroHabitDailyState}
        rotationSummary={heroRotationSummary}
        onRecord={onHeroRecord}
        onFocus={openFocusStart}
      />

      <View style={styles.sectionControlsWrap}>
        <ChallengeListControls
          editing={cardEditMode}
          sortLabel={
            SORT_LABELS[sortMode]
            || SORT_LABELS.manual
          }
          onPressSort={() => (
            setShowSortDropdown(
              (current) => !current
            )
          )}
          onPressEdit={() => {
            setShowSortDropdown(false);
            toggleCardEditMode();
          }}
        />

        <ChallengeSortDropdown
          visible={
            showSortDropdown
            && !cardEditMode
          }
          sortMode={sortMode}
          onSelect={applySortMode}
        />
      </View>
    </>
  );

  return (
    <SafeAreaView style={canonicalSurfaceStyles.screen}>
      {/* 고정 헤더 */}
      <View
        style={[
          canonicalLayoutStyles.rowBetween,
          styles.header,
        ]}
      >
        <TouchableOpacity
          style={styles.hamburgerBtn}
          onPress={() => (
            navigationRef.current.navigate('Settings')
          )}
          activeOpacity={0.8}
          hitSlop={{
            top: 8,
            bottom: 8,
            left: 8,
            right: 8,
          }}
        >
          <Text style={styles.hamburgerIcon}>
            ☰
          </Text>
        </TouchableOpacity>

        <Text
          pointerEvents="none"
          style={[
            canonicalTextStyles.headerTitle,
            styles.headerTitleLayout,
          ]}
        >
          THE - PUSH
        </Text>

        <TouchableOpacity
          style={[
            buttonStyles.compactRight,
            styles.hofBtn,
          ]}
          onPress={() => (
            navigationRef.current.navigate(
              'HallOfFameScreen'
            )
          )}
          activeOpacity={0.9}
          hitSlop={{
            top: 6,
            bottom: 6,
            left: 6,
            right: 6,
          }}
        >
          <Text
            style={[
              buttonStyles.compactRightText,
              styles.hofBtnText,
            ]}
          >
            명예의 전당
          </Text>
        </TouchableOpacity>
      </View>

      {/* 홈 + 카드 목록 */}
      <View
        style={styles.listFrame}
        onLayout={(event) => (
          setListFrameWidth(
            event.nativeEvent.layout.width || 0
          )
        )}
      >
        <ScrollView
          style={styles.listFlex}
          scrollEnabled={!draggingManageId}
          contentContainerStyle={[
            styles.challengeResponsiveContent,
            {
              paddingBottom: listBottomPad,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {homeListHeader}

          {cardEditMode ? (
            editableItems.length === 0 ? (
              <View style={styles.manageEmptyWrap}>
                <Text style={styles.manageEmptyText}>
                  수정할 현재 카드가 없어요.
                </Text>
              </View>
            ) : (
              <Animated.View
                style={[
                  styles.manageResponsiveWrap,
                  {
                    opacity: responsiveFade,
                  },
                ]}
              >
                {editableItems.map((item, index) => (
                  <View key={keyExtractor(item)}>
                    {renderManageRow({
                      item,
                      index,
                    })}
                  </View>
                ))}
              </Animated.View>
            )
          ) : (
            displayData.length === 0 ? (
              <EmptyState />
            ) : (
              <Animated.View
                style={[
                  styles.challengeResponsiveGrid,
                  {
                    opacity: responsiveFade,
                  },
                ]}
              >
                {displayData.map((item) => (
                  <View
                    key={keyExtractor(item)}
                    style={[
                      styles.challengeResponsiveCell,
                      isWideChallengeList
                        && styles.challengeResponsiveCellWide,
                    ]}
                  >
                    {renderRow({ item })}
                  </View>
                ))}
              </Animated.View>
            )
          )}
        </ScrollView>
      </View>

      <MainDock active="home" />

      {!!briefNotice && (
        <View
          pointerEvents="none"
          style={styles.briefNotice}
        >
          <Text style={styles.briefNoticeText}>
            {briefNotice}
          </Text>
        </View>
      )}

      <FocusSessionStartModal
        visible={!!focusTarget}
        target={focusTarget}
        busy={focusStarting}
        onClose={() => { if (!focusStarting) setFocusTarget(null); }}
        onStart={beginFocusSession}
      />
    </SafeAreaView>
  );
}

/* ---------- 스타일 ---------- */
const styles = StyleSheet.create({
  listFlex: {
    flex: 1,
  },

  listFrame: {
    flex: 1,
  },

  /* Home Hero */
  homeHeroEmptySection: {
    paddingTop: space.xl,
    paddingBottom: space.xl,
  },

  heroEmptyEyebrow: {
    marginBottom: space.md,
    color: color.textSecondary,
    fontSize: 12,
    fontWeight: '900',
  },

  heroEmptyBox: {
    minHeight: 118,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.border,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },

  heroEmptyText: {
    color: color.textDisabled,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
  },

  homeHeroSpotlight: {
    marginTop: space.lg,
    marginBottom: space.xl,
    padding: 18,
    borderRadius: 24,
    backgroundColor: primitive.black,
  },

  heroSpotlightTop: {
    minHeight: 22,
    marginBottom: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  heroSpotlightEyebrow: {
    color: primitive.neutral[400],
    fontSize: 10,
    letterSpacing: 0.8,
    fontWeight: '900',
  },

  heroSpotlightStar: {
    color: color.textInverse,
    fontSize: 14,
    fontWeight: '900',
  },

  heroMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space.md,
  },

  heroCopy: {
    flex: 1,
    minWidth: 0,
  },

  heroSpotlightType: {
    marginBottom: 5,
    color: primitive.neutral[400],
    fontSize: 11,
    fontWeight: '900',
  },

  heroSpotlightTitle: {
    color: color.textInverse,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '900',
    letterSpacing: -0.6,
  },

  heroSpotlightMessage: {
    marginTop: space.sm,
    color: color.textInverse,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },

  heroSpotlightSub: {
    marginTop: 4,
    color: primitive.neutral[400],
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '700',
  },

  heroRingWrap: {
    width: HERO_RING_SIZE,
    height: HERO_RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  heroRingTextLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroRingMainText: {
    color: color.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    includeFontPadding: false,
  },

  heroRingSubText: {
    marginTop: 2,
    color: color.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    includeFontPadding: false,
  },

  heroRingMainTextDark: {
    color: color.textInverse,
  },

  heroRingSubTextDark: {
    color: primitive.neutral[400],
  },

  heroSpotlightAction: {
    height: 48,
    marginTop: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.textInverse,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroSpotlightActionText: {
    color: primitive.black,
    fontSize: 14,
    fontWeight: '900',
  },

  /* 목록 Section Header */
  sectionHeaderRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },

  sectionControlButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },

  sectionControlButtonDisabled: {
    opacity: 0.35,
  },

  sectionControlText: {
    color: color.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },

  sectionControlArrow: {
    marginLeft: 4,
    color: color.textDisabled,
    fontSize: 10,
    fontWeight: '700',
  },

  sectionControlsWrap: {
    position: 'relative',
    zIndex: 100,
    elevation: 100,
    overflow: 'visible',
  },

  sortDropdown: {
    position: 'absolute',
    top: 38,
    left: 0,
    width: 176,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    overflow: 'hidden',
    zIndex: 500,
    elevation: 500,
    shadowColor: primitive.black,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },

  sortDropdownOption: {
    minHeight: 38,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },

  sortDropdownOptionLast: {
    borderBottomWidth: 0,
  },

  sortDropdownOptionSelected: {
    backgroundColor: color.surfaceMuted,
  },

  sortDropdownText: {
    color: color.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },

  sortDropdownTextSelected: {
    color: color.textPrimary,
    fontWeight: '900',
  },

  sortDropdownCheck: {
    color: color.textPrimary,
    fontSize: 12,
    fontWeight: '900',
  },

  /* 새 카드 정보계층 */
  cardTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cardTypeLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: color.textSecondary,
  },

  cardMetric: {
    fontSize: 12,
    fontWeight: '900',
    color: color.textPrimary,
  },

  cardTitle: {
    marginTop: 5,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
    color: color.textPrimary,
    letterSpacing: -0.2,
  },

  cardInfoPanel: {
    marginTop: space.md,
    paddingHorizontal: space.sm,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: color.surfaceMuted,
  },

  cardInfoMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: space.sm,
  },

  cardInfoLabel: {
    marginRight: 7,
    color: color.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },

  cardInfoValue: {
    color: color.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },

  cardInfoValueFlexible: {
    flex: 1,
    minWidth: 0,
  },

  cardInfoMetric: {
    flexShrink: 0,
    color: color.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '800',
  },

  rotationCurrentName: {
    marginTop: 2,
    color: color.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
  },

  rotationTimeText: {
    marginTop: 4,
    color: color.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  cardInfoFooterRow: {
    marginTop: space.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: space.sm,
  },

  cardInfoSecondary: {
    flex: 1,
    minWidth: 0,
    color: color.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },

  cardInfoSecondaryRight: {
    textAlign: 'right',
  },

  cardFoldHandle: {
    alignSelf: 'center',
    width: 48,
    height: 22,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardFoldChevron: {
    color: color.textTertiary,
    fontSize: 27,
    lineHeight: 27,
    fontWeight: '300',
    includeFontPadding: false,
  },

  rewardText: {
    marginTop: space.xs,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    color: color.textSecondary,
  },

  progressTrack: {
    width: '100%',
    height: 7,
    marginTop: space.xs,
    borderRadius: 999,
    backgroundColor: color.surfaceMuted,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: color.primary,
  },

  habitWeekRow: {
    flexDirection: 'row',
    columnGap: 5,
    marginTop: space.sm,
  },

  habitDayCell: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceMuted,
  },

  habitDayCellDone: {
    borderColor: color.primary,
    backgroundColor: color.primary,
  },

  miniRing: {
    width: MINI_RING_SIZE,
    height: MINI_RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  miniRingText: {
    position: 'absolute',
    color: color.textPrimary,
    fontSize: 8,
    fontWeight: '900',
    includeFontPadding: false,
  },

  compactHabitStrip: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 2,
  },

  compactHabitCell: {
    width: 7,
    height: 7,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceMuted,
  },

  compactHabitCellDone: {
    borderColor: color.primary,
    backgroundColor: color.primary,
  },

  hofBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },

  hofBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  header: {
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.xs,
    zIndex: 0,
  },
  headerTitleLayout: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 0,
    textAlign: 'center',
  },

  /* 카드 */
  cardWrap: { marginTop: space.sm },
  challengeResponsiveContent: {
    paddingHorizontal: space.md,
  },

  challengeResponsiveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },

  challengeResponsiveCell: {
    width: '100%',
    paddingHorizontal: 4,
  },

  challengeResponsiveCellWide: {
    width: '50%',
  },

  manageResponsiveWrap: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  cardCompact: {
    paddingTop: 10,
    paddingBottom: 5,
  },

  compactCardContent: {
    minHeight: 76,
  },

  compactCardIdentity: {
    minWidth: 0,
  },

  compactCardType: {
    marginBottom: 2,
    color: color.textSecondary,
    fontSize: 11,
    fontWeight: '900',
  },

  compactCardTitle: {
    color: color.textPrimary,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },

  compactActionRow: {
    minHeight: 36,
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    columnGap: 7,
  },

  compactRecordButton: {
    minWidth: 46,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  compactRecordText: {
    color: color.textInverse,
    fontSize: 11,
    fontWeight: '900',
  },

  compactPlayButton: {
    width: 32,
    height: 30,
    borderRadius: radius.md,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  compactActionDisabled: {
    backgroundColor: color.surfaceMuted,
    borderWidth: 1,
    borderColor: color.border,
  },

  compactActionDisabledText: {
    color: color.textDisabled,
  },
  cardContent: { },
  dimmedContent: { opacity: 0.55 },


  uploadNowBtn: {
    flex: 1,
    height: 46,
    borderRadius: radius.lg,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space.xs,
    marginTop: space.md,
  },
  primaryActionMain: {
    flex: 1,
  },
  focusPlayButton: {
    flex: 1,
    height: 46,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.primary,
    backgroundColor: color.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusPlayText: {
    color: color.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  uploadNowText: {
    fontSize: 14,
    fontWeight: '900',
    color: color.textInverse,
  },

  outlineBigBtn: {
    backgroundColor: color.background,
    borderWidth: 2, borderColor: color.primary,
    borderRadius: radius.lg, paddingVertical: 14, alignSelf: 'stretch', marginTop: space.xs,
  },
  outlineBigText: { color: color.primary, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  expiredBtn: {
    backgroundColor: color.surfaceMuted,
    borderWidth: 1, borderColor: color.border,
    borderRadius: radius.lg, paddingVertical: 14, alignSelf: 'stretch', marginTop: space.xs,
  },
  expiredBtnText: { color: primitive.black, fontSize: 16, fontWeight: '800', textAlign: 'center' },

  manageCardRow: {
    height: MANAGE_ROW_HEIGHT,
    marginBottom: MANAGE_ROW_GAP,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.background,
    zIndex: 1,
  },

  manageCardRowDragging: {
    zIndex: 30,
    elevation: 8,
    shadowColor: primitive.black,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: {
      width: 0,
      height: 3,
    },
  },

  manageStarButton: {
    width: 32,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  manageStarText: {
    color: color.textTertiary,
    fontSize: 21,
    fontWeight: '400',
    includeFontPadding: false,
  },

  manageStarTextSelected: {
    color: primitive.black,
  },

  manageIdentity: {
    flex: 1,
    minWidth: 0,
    paddingRight: 6,
  },

  manageTypeText: {
    marginBottom: 1,
    color: color.textTertiary,
    fontSize: 9,
    fontWeight: '900',
  },

  manageTitleText: {
    color: color.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },

  manageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },

  manageActionButton: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },

  manageActionText: {
    color: color.textSecondary,
    fontSize: 10,
    fontWeight: '800',
  },

  manageDragHandle: {
    width: 35,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  manageDragHandleText: {
    color: color.textPrimary,
    fontSize: 23,
    lineHeight: 24,
    fontWeight: '700',
    includeFontPadding: false,
  },

  manageEmptyWrap: {
    paddingVertical: space.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },

  manageEmptyText: {
    color: color.textDisabled,
    fontSize: 13,
    fontWeight: '700',
  },

  briefNotice: {
    position: 'absolute',
    left: space.xl,
    right: space.xl,
    bottom: 68,
    minHeight: 38,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: primitive.black,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 10,
  },

  briefNoticeText: {
    color: color.textInverse,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },

  /* 빈 상태 */
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xxl,
  },
  emptyText: { fontSize: 14, color: color.textDisabled },

  hamburgerBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  hamburgerIcon: { fontSize: 22, color: color.textPrimary, fontWeight: '400' },

});
