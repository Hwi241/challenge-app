// screens/ChallengeListScreen.js
import React, { useEffect, useState, useCallback, useMemo, memo, useRef } from 'react';
import { AppState, View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, Alert, BackHandler, Platform, FlatList, ScrollView, UIManager, LayoutAnimation, Animated, Easing, Modal, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { SafeAreaView,  useSafeAreaInsets  } from 'react-native-safe-area-context';

import {
  card as canonicalCardStyles,
  color,
  font,
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
import { loadActiveFocusSession, startFocusSession } from '../utils/focusSessionStore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ---------- 상수 ---------- */
const CARD_BORDER = color.border;
const ARROW_SIZE = 40;
const ARROW_GAP = 12;
const CONTROLS_H = 44;
const CARD_COLLAPSE_ANIM_MS = 320;
const CARD_REORDER_EXPAND_ANIM_MS = 180;
const CARD_REORDER_CONTROLS_DELAY_MS = 0;

const ORDER_KEY = 'ch_order';
const CHALLENGES_KEY = 'challenges';
const COLLAPSED_CARDS_KEY = 'ch_collapsed_cards';

const CHALLENGE_CARD_VARIANTS = {
  LIST: 'list',
  FLOATING: 'floating',
  COMPACT: 'compact',
};

const SORT_LABELS = {
  manual: '사용자 지정',
  newest: '최신순',
  oldest: '오래된순',
  habitFirst: '습관/도전',
  challengeFirst: '도전/습관',
};
const FILTER_SORT_MODES = new Set();
const isFilterSortMode = (mode) => FILTER_SORT_MODES.has(mode);

const buildDisplayData = (source = [], mode = 'manual') => {
  let arr = Array.isArray(source) ? [...source] : [];


  if (mode === 'habitFirst') {
    const habits = arr.filter(c => c.type === 'habit');
    const challenges = arr.filter(c => c.type !== 'habit');
    return [...habits, ...challenges];
  }

  if (mode === 'challengeFirst') {
    const habits = arr.filter(c => c.type === 'habit');
    const challenges = arr.filter(c => c.type !== 'habit');
    return [...challenges, ...habits];
  }

  if (mode === 'newest' || mode === 'oldest') {
    const active = arr.filter(c => !c._isDone && !c.archived && !c._isExpired);
    const expired = arr.filter(c => !c._isDone && !c.archived && c._isExpired);
    const done = arr.filter(c => c._isDone || c.archived);

    active.sort((a, b) => (
      mode === 'newest'
        ? (b.createdAt || 0) - (a.createdAt || 0)
        : (a.createdAt || 0) - (b.createdAt || 0)
    ));

    return [...active, ...expired, ...done];
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

const rotationMinutes = (seconds) => {
  const value = Math.round((Number(seconds) || 0) / 6) / 10;
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1);
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
  showCollapseToggle = false,
  onPressToggleCollapsed,
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

        <View style={canonicalLayoutStyles.row}>
          {!!metric && (
            <Text style={styles.cardMetric}>
              {metric}
            </Text>
          )}

          {showCollapseToggle && (
            <TouchableOpacity
              style={styles.cardCollapseToggleBtn}
              onPress={onPressToggleCollapsed}
              activeOpacity={0.85}
              hitSlop={{
                top: 8,
                bottom: 8,
                left: 8,
                right: 8,
              }}
            >
              <Text style={styles.cardCollapseToggleText}>
                ˄
              </Text>
            </TouchableOpacity>
          )}
        </View>
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

    const remainingSeconds = Math.max(
      0,
      targetSeconds - progressSeconds
    );

    return (
      <View style={styles.cardStatusWrap}>
        <Text style={styles.statusPrimary}>
          지금 할 일 · {current?.name ?? '-'}
        </Text>

        <CardProgressBar
          value={rotationSummary.progressPct ?? 0}
        />

        <Text style={styles.statusSecondary}>
          {rotationMinutes(progressSeconds)}
          {' / '}
          {rotationMinutes(targetSeconds)}분
          {remainingSeconds > 0
            ? ` · ${rotationMinutes(remainingSeconds)}분 남음`
            : ''}
        </Text>

        <Text style={styles.statusSecondary}>
          다음 · {next?.name ?? '이번 회전 완료'}
        </Text>
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
      : '연속 기록을 시작해보세요';

    return (
      <View style={styles.cardStatusWrap}>
        <Text style={styles.statusPrimary}>
          {todayMessage}
        </Text>

        <HabitWeekStrip last7={last7} />

        <Text style={styles.statusSecondary}>
          {streakMessage}
        </Text>
      </View>
    );
  }

  const current = Math.max(
    0,
    Number(item?.currentScore || 0)
  );

  const goal = Number(item?.goalScore || 0);

  const hasGoal = Number.isFinite(goal) && goal > 0;

  const remaining = hasGoal
    ? Math.max(0, goal - current)
    : null;

  return (
    <View style={styles.cardStatusWrap}>
      {hasGoal && (
        <CardProgressBar value={pct} />
      )}

      <Text style={styles.statusPrimary}>
        {hasGoal
          ? `${current}회 완료 · ${remaining}회 남음`
          : `현재 ${current}회`}
      </Text>

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

const ChallengeCardReorderControls = memo(
  function ChallengeCardReorderControls({
    item,
    isExpired = false,
    showControls,
    canReorder,
    onPressCard,
    onPressEdit,
    onPressDuplicate,
    onPressDelete,
  }) {
    if (!showControls) return null;

    return (
      <View
        style={[
          canonicalLayoutStyles.rowBetween,
          styles.controlsRow,
        ]}
      >
        <View
          style={[
            canonicalLayoutStyles.row,
            styles.arrowsInline,
          ]}
        >
          <TouchableOpacity
            onPress={
              canReorder
                ? () => onPressCard?.({
                    ...item,
                    __move: 'up',
                  })
                : undefined
            }
            disabled={!canReorder}
            activeOpacity={0.9}
            style={[
              styles.circleArrowSmall,
              !canReorder && styles.controlDisabled,
            ]}
          >
            <Text style={styles.circleArrowTxt}>
              ↑
            </Text>
          </TouchableOpacity>

          <View style={{ width: ARROW_GAP }} />

          <TouchableOpacity
            onPress={
              canReorder
                ? () => onPressCard?.({
                    ...item,
                    __move: 'down',
                  })
                : undefined
            }
            disabled={!canReorder}
            activeOpacity={0.9}
            style={[
              styles.circleArrowSmall,
              !canReorder && styles.controlDisabled,
            ]}
          >
            <Text style={styles.circleArrowTxt}>
              ↓
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={[
            canonicalLayoutStyles.row,
            styles.actionsRight,
          ]}
        >
          <TouchableOpacity
            style={styles.actionDarkBtn}
            onPress={() => onPressEdit?.(item)}
            activeOpacity={0.9}
          >
            <Text style={styles.actionDarkText}>
              수정
            </Text>
          </TouchableOpacity>

          {!isExpired && !isRotationRoutine(item) && (
            <TouchableOpacity
              style={styles.actionDarkBtn}
              onPress={() => onPressDuplicate?.(item)}
              activeOpacity={0.9}
            >
              <Text style={styles.actionDarkText}>
                복제
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionDarkBtn}
            onPress={() => onPressDelete?.(item)}
            activeOpacity={0.9}
          >
            <Text style={styles.actionDarkText}>
              삭제
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
);

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

    const focusLabel = rotation
      ? `▶ ${rotationSummary?.currentItem?.name ?? '시작'} 시작`
      : '▶ 집중 시작';

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
          accessibilityLabel={
            rotation
              ? `${rotationSummary?.currentItem?.name ?? '현재 활동'} 집중 타이머 시작`
              : '집중 타이머 시작'
          }
        >
          <Text
            style={styles.focusPlayText}
            numberOfLines={1}
          >
            {focusLabel}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }
);

const getCompactProgressLabel = (
  item,
  rotationSummary,
  habitDailyState = EMPTY_HABIT_DAILY_STATE,
  isDone = false,
  isExpired = false
) => {
  if (rotationSummary?.currentItem) {
    return `${rotationMinutes(
      rotationSummary.currentItem.progressSeconds
    )}/${rotationMinutes(
      rotationSummary.currentItem.targetSeconds
    )}분`;
  }

  if (isDone) return '완료';
  if (isExpired) return '만료';

  if (item?.type === 'habit') {
    if (!habitDailyState.scheduledToday) {
      return '쉬는 날';
    }

    return habitDailyState.hasToday
      ? '오늘 완료'
      : '미기록';
  }

  return `${Number(item?.currentScore ?? 0)}/${Number(
    item?.goalScore ?? 0
  )}`;
};

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
    const progressLabel = getCompactProgressLabel(
      item,
      rotationSummary,
      habitDailyState,
      isDone,
      isExpired
    );

    const rotation = isRotationRoutine(item);

    const actionLabel = rotation
      ? '기록'
      : item?.type === 'habit'
        ? '기록'
        : isDone
          ? '보상'
          : isExpired
            ? '만료'
            : '기록';

    const actionDisabled = isExpired && !isDone;

    const onPressAction = () => {
      if (rotation) {
        onPressCard?.(item, 'continue');
        return;
      }

      if (item?.type === 'habit') {
        onPressCard?.({
          ...item,
          _upload: true,
        });
        return;
      }

      if (isDone) {
        onPressClaim?.(item);
        return;
      }

      if (!isExpired) {
        onPressCard?.({
          ...item,
          _upload: true,
        });
      }
    };

    return (
      <View
        style={[
          canonicalLayoutStyles.row,
          styles.compactCardRow,
        ]}
      >
        <Text
          style={styles.compactCardTitle}
          numberOfLines={1}
        >
          {item?.title ?? '(제목 없음)'}
        </Text>

        <Text
          style={styles.compactProgressText}
          numberOfLines={1}
        >
          {progressLabel}
        </Text>

        <View style={styles.compactSpacer} />

        <TouchableOpacity
          style={styles.compactExpandBtn}
          onPress={onPressToggleCollapsed}
          activeOpacity={0.85}
          hitSlop={{
            top: 8,
            bottom: 8,
            left: 8,
            right: 8,
          }}
        >
          <Text style={styles.compactExpandText}>
            ˅
          </Text>
        </TouchableOpacity>

        {item?.type !== 'habit' && (
          <Text
            style={styles.compactPctText}
            numberOfLines={1}
          >
            {pct}%
          </Text>
        )}

        <TouchableOpacity
          style={[
            styles.compactActionBtn,
            actionDisabled
              && styles.compactActionBtnDisabled,
            isDone && styles.compactRewardBtn,
          ]}
          disabled={actionDisabled}
          onPress={onPressAction}
          activeOpacity={0.9}
        >
          <Text
            style={[
              styles.compactActionText,
              actionDisabled
                && styles.compactActionTextDisabled,
              isDone
                && styles.compactRewardText,
            ]}
          >
            {actionLabel}
          </Text>
        </TouchableOpacity>

        {!isDone && !isExpired && (
          <TouchableOpacity
            style={styles.compactFocusPlayButton}
            onPress={() => onPressFocus?.(item)}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="집중 타이머 시작"
          >
            <Text style={styles.compactFocusPlayText}>
              ▶
            </Text>
          </TouchableOpacity>
        )}
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
  showControls,
  canReorder,
  onPressCard,
  onPressEdit,
  onPressDuplicate,
  onPressDelete,
  onPressClaim,
  onPressFocus,
  onLongPress,
  onPressToggleCollapsed,
}, ref) {
  const flags = asDoneFlags(item);
  const isDone = !!flags._isDone;
  const isExpired = !!flags._isExpired;

  const isFloatingVariant = (
    variant === CHALLENGE_CARD_VARIANTS.FLOATING
  );

  const isCompactVariant = (
    (
      variant === CHALLENGE_CARD_VARIANTS.COMPACT
      || !!collapsed
    )
    && !isFloatingVariant
    && !showControls
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
        onLongPress={!isDone ? onLongPress : undefined}
        delayLongPress={160}
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
      onLongPress={
        (!showControls && !isDone)
          ? onLongPress
          : undefined
      }
      delayLongPress={160}
      style={[
        canonicalCardStyles.list,
        isFloatingVariant && styles.cardFloating,
        showControls && styles.selectedCard,
      ]}
    >
      {showControls ? (
        <View style={styles.managementContent}>
          <Text style={styles.cardTypeLabel}>
            {getCardTypeLabel(item)}
          </Text>

          <Text
            style={styles.cardTitle}
            numberOfLines={2}
          >
            {item?.title ?? '(제목 없음)'}
          </Text>

          <ChallengeCardReorderControls
            item={item}
            isExpired={isExpired}
            showControls
            canReorder={canReorder}
            onPressCard={onPressCard}
            onPressEdit={onPressEdit}
            onPressDuplicate={onPressDuplicate}
            onPressDelete={onPressDelete}
          />
        </View>
      ) : (
        <>
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
              showCollapseToggle={
                variant
                === CHALLENGE_CARD_VARIANTS.LIST
              }
              onPressToggleCollapsed={
                onPressToggleCollapsed
              }
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
        </>
      )}
    </TouchableOpacity>
  );
});

/* ---------- 리스트 셀 ---------- */
const ItemCard = memo(
  React.forwardRef(function ItemCard({
    item,
    hidden,
    habitDailyState = EMPTY_HABIT_DAILY_STATE,
    variant = CHALLENGE_CARD_VARIANTS.LIST,
    collapsed = false,
    isWide = false,
    onLongPress,
    onPressToggleCollapsed,
    onPressCard,
    onPressEdit,
    onPressDuplicate,
    onPressDelete,
    onPressClaim,
    onPressFocus,
  }, ref) {
    return (
      <View
        style={[
          styles.cardWrap,
          isWide && styles.cardWrapWide,
          hidden && { opacity: 0 },
        ]}
      >
        <CardBody
          ref={ref}
          item={item}
          habitDailyState={habitDailyState}
          variant={variant}
          collapsed={collapsed}
          showControls={false}
          canReorder={!asDoneFlags(item)._isDone}
          onPressCard={onPressCard}
          onPressEdit={onPressEdit}
          onPressDuplicate={onPressDuplicate}
          onPressDelete={onPressDelete}
          onPressClaim={onPressClaim}
          onPressFocus={onPressFocus}
          onLongPress={onLongPress}
          onPressToggleCollapsed={
            onPressToggleCollapsed
          }
        />
      </View>
    );
  })
);

/* ---------- Home Hero ---------- */
const HomeHero = memo(function HomeHero({
  mode,
  item,
  habitDailyState = EMPTY_HABIT_DAILY_STATE,
  rotationSummary,
  onRecord,
  onFocus,
  onCreate,
}) {
  if (mode === 'empty') {
    return (
      <View style={styles.homeHero}>
        <Text style={styles.heroEyebrow}>
          오늘의 PUSH
        </Text>

        <Text style={styles.heroTitle}>
          새로운 PUSH를 만들어보세요
        </Text>

        <TouchableOpacity
          style={styles.heroActionButton}
          onPress={onCreate}
          activeOpacity={0.9}
        >
          <Text style={styles.heroActionText}>
            ＋ 새로 만들기
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (mode === 'done') {
    return (
      <View style={styles.homeHero}>
        <Text style={styles.heroEyebrow}>
          오늘의 PUSH
        </Text>

        <Text style={styles.heroTitle}>
          오늘 예정된 PUSH를 모두 마쳤어요
        </Text>

        <Text style={styles.heroSubMessage}>
          다음 PUSH까지 잠시 쉬어가도 좋아요.
        </Text>
      </View>
    );
  }

  if (!item) return null;

  if (isRotationRoutine(item)) {
    const current = rotationSummary?.currentItem;

    if (!current) {
      return (
        <View style={styles.homeHero}>
          <Text style={styles.heroEyebrow}>
            오늘의 PUSH
          </Text>

          <Text style={styles.heroTitle}>
            {item?.title ?? '순환루틴'}
          </Text>

          <Text style={styles.heroSubMessage}>
            현재 실행할 활동이 없어요.
          </Text>
        </View>
      );
    }

    const progressSeconds = Number(
      current?.progressSeconds || 0
    );

    const targetSeconds = Number(
      current?.targetSeconds || 0
    );

    const remainingSeconds = Math.max(
      0,
      targetSeconds - progressSeconds
    );

    return (
      <View style={styles.homeHero}>
        <Text style={styles.heroEyebrow}>
          오늘의 PUSH
        </Text>

        <Text style={styles.heroKicker}>
          지금은
        </Text>

        <Text
          style={styles.heroTitle}
          numberOfLines={2}
        >
          {current.name}
        </Text>

        <Text style={styles.heroMessage}>
          할 차례예요
        </Text>

        <View style={styles.heroProgressRow}>
          <Text style={styles.heroProgressValue}>
            {rotationMinutes(progressSeconds)}
            {' / '}
            {rotationMinutes(targetSeconds)}분
          </Text>

          <Text style={styles.heroProgressMeta}>
            {rotationSummary.currentCycleNumber}회차
          </Text>
        </View>

        <CardProgressBar
          value={rotationSummary.progressPct ?? 0}
        />

        <Text style={styles.heroSubMessage}>
          {rotationMinutes(remainingSeconds)}분 남음
          {' · '}
          {item?.title ?? '순환루틴'}
        </Text>

        <TouchableOpacity
          style={styles.heroActionButton}
          onPress={() => onFocus?.(item)}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={`${current.name} 시작`}
        >
          <Text
            style={styles.heroActionText}
            numberOfLines={1}
          >
            ▶ {current.name} 시작
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (item?.type === 'habit') {
    const streakText = habitDailyState.streak > 0
      ? `${habitDailyState.streak}일 연속 기록 중`
      : '오늘부터 시작해보세요';

    return (
      <View style={styles.homeHero}>
        <Text style={styles.heroEyebrow}>
          오늘의 PUSH
        </Text>

        <Text
          style={styles.heroTitle}
          numberOfLines={2}
        >
          {item?.title ?? '(제목 없음)'}
        </Text>

        <Text style={styles.heroMessage}>
          오늘 아직 기록하지 않았어요
        </Text>

        <Text style={styles.heroSubMessage}>
          {streakText}
        </Text>

        <TouchableOpacity
          style={styles.heroActionButton}
          onPress={() => onRecord?.(item)}
          activeOpacity={0.9}
        >
          <Text style={styles.heroActionText}>
            오늘 기록하기
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

  const validGoal = Number.isFinite(goal) && goal > 0;

  const pct = validGoal
    ? clampProgress(
        Math.round((current / goal) * 100)
      )
    : 0;

  const remaining = validGoal
    ? Math.max(0, goal - current)
    : null;

  return (
    <View style={styles.homeHero}>
      <Text style={styles.heroEyebrow}>
        오늘의 PUSH
      </Text>

      <Text
        style={styles.heroTitle}
        numberOfLines={2}
      >
        {item?.title ?? '(제목 없음)'}
      </Text>

      <Text style={styles.heroMessage}>
        {validGoal
          ? `목표까지 ${remaining}회 남았어요`
          : `현재 ${current}회 진행 중`}
      </Text>

      {validGoal && (
        <>
          <View style={styles.heroProgressRow}>
            <Text style={styles.heroProgressValue}>
              {current} / {goal}
            </Text>

            <Text style={styles.heroProgressMeta}>
              {pct}%
            </Text>
          </View>

          <CardProgressBar value={pct} />
        </>
      )}

      <TouchableOpacity
        style={styles.heroActionButton}
        onPress={() => onRecord?.(item)}
        activeOpacity={0.9}
      >
        <Text style={styles.heroActionText}>
          기록하기
        </Text>
      </TouchableOpacity>
    </View>
  );
});

const ChallengeListSectionHeader = memo(
  function ChallengeListSectionHeader({
    sortLabel,
    onPressSort,
  }) {
    return (
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeaderTitle}>
          내 도전 · 습관 · 루틴
        </Text>

        <TouchableOpacity
          style={styles.sectionSortButton}
          onPress={onPressSort}
          activeOpacity={0.8}
        >
          <Text style={styles.sectionSortText}>
            정렬 · {sortLabel} ▾
          </Text>
        </TouchableOpacity>
      </View>
    );
  }
);

/* ---------- 화면 ---------- */
export default function ChallengeListScreen() {
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [data, setData] = useState([]);
  const [habitDailyStateMap, setHabitDailyStateMap] = useState({});
  const [listFrameWidth, setListFrameWidth] = useState(0);
  const [focusTarget, setFocusTarget] = useState(null);
  const [focusStarting, setFocusStarting] = useState(false);

  /* 정렬 상태 */
  const [reorderActive, setReorderActive] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [sortMode, setSortMode] = useState('manual'); // manual|newest|oldest|habitFirst|challengeFirst
  const [selectedId, setSelectedId] = useState(null);
  const [reorderPrepared, setReorderPrepared] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState({});
  const collapsedIdsRef = useRef({});
  const restoreCollapsedAfterReorderRef = useRef(null);
  const [reorderExpandVisualId, setReorderExpandVisualId] = useState(null);
  const [reorderExpandVisualHeights, setReorderExpandVisualHeights] = useState({});
  const [reorderFloatingControlsVisible, setReorderFloatingControlsVisible] = useState(false);
  const reorderFloatingHeight = useRef(new Animated.Value(0)).current;
  const reorderFloatingStartedRef = useRef(false);
  const pendingReorderItemRef = useRef(null);

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

  /* 플로팅 복제 */
  const floatLeft = useRef(new Animated.Value(0)).current;
  const floatTop  = useRef(new Animated.Value(0)).current;
  const [floatWidth, setFloatWidth] = useState(0);

  const animLockRef = useRef(false);
  const itemRefs = useRef({});
  const dataRef = useRef([]);
  useEffect(() => { dataRef.current = data; }, [data]);

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

  /* 데이터 로드 — 로드시엔 맵 우선(respectMap) */
  useEffect(() => {
    if (!isFocused) return;
    (async () => {
      const rawStr = await AsyncStorage.getItem(CHALLENGES_KEY);
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
      setReorderActive(false);
      setSelectedId(null);
      setFloatWidth(0);
    })();
  }, [isFocused, persistChallenges]);

  /* 뒤로가기 */
  const finalizeReorder = useCallback(async () => {
    LayoutAnimation.configureNext({
      duration: CARD_COLLAPSE_ANIM_MS,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
    const snapshot = dataRef.current || [];
    console.log('[ChallengeList][finalizeReorder] snapshotIds=', snapshot.map(c => `${c._isDone?'D':'A'}:${safeStringId(c.id)}`));
    try { await persistChallenges(snapshot, 'finalize'); } catch {}
    const restoreId = restoreCollapsedAfterReorderRef.current;
    restoreCollapsedAfterReorderRef.current = null;
    if (restoreId) {
      setCollapsedIds((prev) => {
        const next = { ...prev, [safeStringId(restoreId)]: true };
        persistCollapsedIds(next);
        return next;
      });
    }
    setSelectedId(null);
    setReorderActive(false);
    setReorderPrepared(false);
    setReorderExpandVisualId(null);
    setReorderExpandVisualHeights({});
    setReorderFloatingControlsVisible(false);
    pendingReorderItemRef.current = null;
    reorderFloatingStartedRef.current = false;
    reorderFloatingHeight.stopAnimation();
    reorderFloatingHeight.setValue(0);
    setFloatWidth(0);
    animLockRef.current = false;
  }, [persistChallenges, persistCollapsedIds]);

  const applySortMode = useCallback((mode) => {
    setShowSortModal(false);

    if (isFilterSortMode(mode)) {
      setSortMode(mode);
      return;
    }
    
    const sorted = buildDisplayData(dataRef.current || [], mode);
    dataRef.current = sorted;

    LayoutAnimation.configureNext({ duration: 180, update: { type: LayoutAnimation.Types.easeInEaseOut } });
    setData(sorted);
    setSortMode(mode);

    (async () => {
      try {
        const arranged = await persistChallenges(sorted, `sort:${mode}`);
        dataRef.current = arranged;
        setData(arranged);
      } catch {}
    })();
  }, [persistChallenges]);


  useEffect(() => {
    if (!isFocused || Platform.OS !== 'android') return;
    const onBackPress = () => {
      if (reorderActive) { finalizeReorder(); return true; }
      Alert.alert('앱 종료', '정말 종료할까요?', [
        { text: '취소', style: 'cancel' },
        { text: '종료', style: 'destructive', onPress: () => BackHandler.exitApp() },
      ]);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [isFocused, reorderActive, finalizeReorder]);

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
    if (reorderActive) return;
    const id = safeStringId(item?.id);
    if (!id) return;
    animateCardResize();
    setCollapsedIds((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      persistCollapsedIds(next);
      return next;
    });
  }, [animateCardResize, persistCollapsedIds, reorderActive]);

  /* 좌표 측정 */
  const measureNow = useCallback((id) => {
    const ref = itemRefs.current[safeStringId(id)];
    if (!ref || !ref.measureInWindow) return false;
    let did = false;
    ref.measureInWindow((x, y, width, height) => {
      did = true;
      floatLeft.setValue(x);
      floatTop.setValue(y);
      setFloatWidth(width);
    });
    return did;
  }, [floatLeft, floatTop]);

  const rafMeasureSelected = useCallback((id) => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => measureNow(id))));
  }, [measureNow]);

  const updateReorderExpandVisualHeight = useCallback((id, key, height) => {
    const safeId = safeStringId(id);
    const nextHeight = Math.ceil(Number(height || 0));
    if (!safeId || nextHeight <= 0) return;

    setReorderExpandVisualHeights((prev) => {
      const current = prev[safeId] || {};
      if (current[key] === nextHeight) return prev;
      return {
        ...prev,
        [safeId]: {
          ...current,
          [key]: nextHeight,
        },
      };
    });
  }, []);

  useEffect(() => {
    const safeId = safeStringId(reorderExpandVisualId);
    if (!safeId || reorderFloatingStartedRef.current) return;

    const heights = reorderExpandVisualHeights[safeId] || {};
    const collapsedHeight = Number(heights.collapsed || 0);
    const expandedHeight = Number(heights.expanded || 0);

    if (collapsedHeight <= 0 || expandedHeight <= 0) return;

    reorderFloatingStartedRef.current = true;
    reorderFloatingHeight.stopAnimation();
    reorderFloatingHeight.setValue(collapsedHeight);

    Animated.timing(reorderFloatingHeight, {
      toValue: expandedHeight,
      duration: CARD_REORDER_EXPAND_ANIM_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;

      const pendingItem = pendingReorderItemRef.current;
      if (!pendingItem) return;

      setTimeout(() => {
        setReorderFloatingControlsVisible(true);
        setReorderPrepared(false);
        setReorderActive(true);
        rafMeasureSelected(pendingItem.id);
        pendingReorderItemRef.current = null;
        reorderFloatingStartedRef.current = false;
      }, CARD_REORDER_CONTROLS_DELAY_MS);
    });
  }, [reorderExpandVisualId, reorderExpandVisualHeights, reorderFloatingHeight, rafMeasureSelected]);

  /* CRUD/네비 */
  const navigationRef = useRef(navigation);

  const onDelete = useCallback(async (item) => {
    Alert.alert('삭제 확인', `'${item.title}' 도전을 삭제할까요?\n설정 > 휴지통에서 30일간 보관됩니다.`, [
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
          await finalizeReorder();
        },
      },
    ]);
  }, [finalizeReorder, animateList, persistChallenges]);

  const onDuplicate = useCallback((item) => {
    if (asDoneFlags(item)._isDone) return;
    animateList();

    const source = ensureItemId(item);
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

    setSelectedId(null);
    setReorderActive(false);
    setFloatWidth(0);
    animLockRef.current = false;

    navigationRef.current.navigate('AddChallenge', {
      duplicateTemplate,
      duplicateSourceId: safeStringId(source?.id),
      duplicateNonce: Date.now(),
    });
  }, [animateList]);

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
  }, [persistChallenges]);

  /* 정렬 모드 (활성 0..activeCount-1) */
  const doneCount = data.reduce((acc, c) => acc + (asDoneFlags(c)._isDone ? 1 : 0), 0);
  const activeCount = Math.max(0, data.length - doneCount);

  const moveSelected = useCallback((dir) => {
    if (!reorderActive || !selectedId) return;
    if (animLockRef.current) return;
    animLockRef.current = true;

    const prev = sortMode === 'manual'
      ? (dataRef.current || [])
      : buildDisplayData(dataRef.current || [], sortMode);
    const idx = prev.findIndex(c => safeStringId(c.id) === safeStringId(selectedId));
    if (idx < 0) { animLockRef.current = false; return; }

    const activeCountInPrev = prev.reduce((acc, c) => acc + (!asDoneFlags(c)._isDone && !c.archived && !c._isExpired ? 1 : 0), 0);
    const minIdx = 0;
    const maxIdx = Math.max(0, activeCountInPrev - 1);
    const to = Math.max(minIdx, Math.min(maxIdx, idx + (dir === 'up' ? -1 : +1)));
    if (to === idx) { animLockRef.current = false; return; }

    LayoutAnimation.configureNext({ duration: 180, update: { type: LayoutAnimation.Types.easeInEaseOut } });

    const nextArr = moveInArray(prev, idx, to);

    console.log('[ChallengeList][moveSelected]', { selectedId, dir, from: idx, to, activeCount });

    dataRef.current = nextArr;
    setData(nextArr);
    if (sortMode !== 'manual') setSortMode('manual');
    (async () => { try { await persistChallenges(nextArr, 'move'); } catch {} })();

    setTimeout(() => {
      const ref = itemRefs.current[safeStringId(selectedId)];
      if (ref && ref.measureInWindow) {
        ref.measureInWindow((x, y, width) => {
          setFloatWidth(width);
          Animated.parallel([
            Animated.timing(floatLeft, {
              toValue: x,
              duration: 180,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            }),
            Animated.timing(floatTop, {
              toValue: y,
              duration: 180,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            }),
          ]).start(() => { animLockRef.current = false; });
        });
      } else {
        animLockRef.current = false;
      }
    }, 16);
  }, [reorderActive, selectedId, activeCount, insets.top, floatTop, persistChallenges, sortMode]);

    const enterReorder = useCallback((item) => {
    if (asDoneFlags(item)._isDone) {
      Alert.alert('안내', '완료된 도전은 순서를 변경할 수 없어요.');
      return;
    }
    setReorderFloatingControlsVisible(true);
    // 수정모드 진입만으로는 현재 정렬을 풀지 않는다.
    // 실제 순서 변경 시점에만 현재 표시 순서를 저장 순서로 확정한다.
    // 만료 도전은 수정/삭제만 가능 (복제 버튼은 플로팅 카드에서 숨김)
    const id = item.id;
    const ref = itemRefs.current[safeStringId(id)];
    if (ref && ref.measureInWindow) {
      ref.measureInWindow((x, y, width, height) => {
        console.log('[Reorder] measureInWindow x:', x, 'y:', y, 'width:', width, 'height:', height, 'insets.top:', insets.top);
        floatLeft.setValue(x);
        floatTop.setValue(y);
        setFloatWidth(width);
        setSelectedId(id);
        setReorderActive(true);
      });
    } else {
      setSelectedId(id);
      setReorderActive(true);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const r = itemRefs.current[safeStringId(id)];
        if (r && r.measureInWindow) {
          r.measureInWindow((x, y, width) => {
            floatLeft.setValue(x);
            floatTop.setValue(y);
            setFloatWidth(width);
          });
        }
      }));
    }
    console.log('[ChallengeList][enterReorder] id=', safeStringId(id));
  }, [floatLeft, floatTop, sortMode]);

  const onOverlayPress = useCallback(() => { finalizeReorder(); }, [finalizeReorder]);

  /* 렌더 */
    // sortMode에 따라 표시할 데이터 계산
  const displayData = useMemo(() => {
    if (isFilterSortMode(sortMode)) {
      return buildDisplayData(data, sortMode);
    }
    return data;
  }, [data, sortMode]);

  const activeHomeItems = useMemo(
    () => data.filter((item) => {
      const flags = asDoneFlags(item);

      return (
        !flags._isDone
        && !flags._isExpired
        && !item?.archived
      );
    }),
    [data]
  );

  const heroItem = useMemo(
    () => (
      activeHomeItems.find((item) => {
        if (item?.type !== 'habit') return true;

        const habitState = (
          habitDailyStateMap[safeStringId(item.id)]
          || EMPTY_HABIT_DAILY_STATE
        );

        return (
          habitState.scheduledToday
          && !habitState.hasToday
        );
      })
      || null
    ),
    [activeHomeItems, habitDailyStateMap]
  );

  const heroMode = heroItem
    ? 'item'
    : activeHomeItems.length > 0
      ? 'done'
      : 'empty';

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

  const onHeroCreate = useCallback(() => {
    navigationRef.current.navigate(
      'CreateChallengeType'
    );
  }, []);

  const keyExtractor = useCallback((it) => safeStringId(it?.id ?? it?.challengeId ?? it?.uuid ?? it?.key ?? ''), []);
  const listBottomPad = space.lg;
  const foldableLayoutRefreshKey = `${Math.round(windowWidth || 0)}:${Math.round(windowHeight || 0)}`;
  const { refresh: refreshFoldableLayoutState } = useFoldableLayoutState(foldableLayoutRefreshKey);
  const layoutWidth = listFrameWidth || windowWidth;
  const layoutWidthKey = Math.round(Number(layoutWidth || 0));
  const isWideChallengeList = layoutWidth >= 600;

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
      const selectedKey = safeStringId(selectedId);
      const isSelected = reorderActive && id === selectedKey;
      const isFloatingExpanding = reorderExpandVisualId === id;
      const isCollapsed = !!collapsedIds[id] && !(reorderActive && id === selectedKey);

      return (
        <ItemCard
          ref={(el) => { if (el) itemRefs.current[id] = el; }}
          item={item}
          habitDailyState={
            habitDailyStateMap[safeStringId(item.id)]
            || EMPTY_HABIT_DAILY_STATE
          }
          variant={CHALLENGE_CARD_VARIANTS.LIST}
          collapsed={isCollapsed}
          isWide={isWideChallengeList}
          hidden={(isSelected && reorderActive) || isFloatingExpanding}
          onPressToggleCollapsed={() => toggleCollapsed(item)}
          onLongPress={() => {
            if (collapsedIdsRef.current[id]) {
              restoreCollapsedAfterReorderRef.current = id;
              pendingReorderItemRef.current = item;
              reorderFloatingStartedRef.current = false;
              reorderFloatingHeight.stopAnimation();
              reorderFloatingHeight.setValue(0);
              setReorderFloatingControlsVisible(false);
              setSelectedId(item.id);
              setReorderPrepared(true);
              setReorderExpandVisualId(id);
              setReorderExpandVisualHeights({});

              const ref = itemRefs.current[id];
              if (ref && ref.measureInWindow) {
                ref.measureInWindow((x, y, width, height) => {
                  floatLeft.setValue(x);
                  floatTop.setValue(y);
                  setFloatWidth(width);
                  updateReorderExpandVisualHeight(id, 'collapsed', height);
                });
              }

              return;
            }
            restoreCollapsedAfterReorderRef.current = null;
            setReorderExpandVisualId(null);
            setReorderExpandVisualHeights({});
            setReorderFloatingControlsVisible(false);
            pendingReorderItemRef.current = null;
            reorderFloatingStartedRef.current = false;
            reorderFloatingHeight.stopAnimation();
            reorderFloatingHeight.setValue(0);
            setReorderPrepared(false);
            enterReorder(item);
          }}
          onPressCard={(it, action) => {
            if (reorderActive) return;
            if (it?._isExpired) {
              Alert.alert("기간 만료", "이 도전의 기간이 만료되었습니다.\n카드를 꾹 눌러 수정 또는 삭제해주세요.");
              return;
            }
            if (it?._upload) { navigationRef.current.navigate('Upload', { challengeId: it.id }); return; }
            goEntryList(it, action);
          }}
          onPressEdit={() => {}}
          onPressDuplicate={() => {}}
          onPressDelete={() => {}}
          onPressClaim={onClaimReward}
          onPressFocus={openFocusStart}
        />
      );
    },
    [reorderActive, selectedId, collapsedIds, reorderPrepared, reorderExpandVisualId, reorderFloatingHeight, updateReorderExpandVisualHeight, habitDailyStateMap, goEntryList, enterReorder, onClaimReward, openFocusStart, toggleCollapsed, animateCardResize, isWideChallengeList, floatLeft, floatTop, rafMeasureSelected]
  );

  const renderMasonryItem = useCallback(
    (item) => renderRow({ item }),
    [renderRow]
  );

  const masonryLeftData = useMemo(
    () => displayData.filter(
      (_, index) => index % 2 === 0
    ),
    [displayData]
  );

  const masonryRightData = useMemo(
    () => displayData.filter(
      (_, index) => index % 2 === 1
    ),
    [displayData]
  );

  const selected = data.find(
    (d) => (
      safeStringId(d.id)
      === safeStringId(selectedId)
    )
  );

  const homeListHeader = (
    <>
      <HomeHero
        mode={heroMode}
        item={heroItem}
        habitDailyState={heroHabitDailyState}
        rotationSummary={heroRotationSummary}
        onRecord={onHeroRecord}
        onFocus={openFocusStart}
        onCreate={onHeroCreate}
      />

      <ChallengeListSectionHeader
        sortLabel={
          SORT_LABELS[sortMode]
          || SORT_LABELS.manual
        }
        onPressSort={() => setShowSortModal(true)}
      />
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
          disabled={reorderActive}
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
          style={styles.hofIconButton}
          onPress={() => (
            navigationRef.current.navigate(
              'HallOfFameScreen'
            )
          )}
          activeOpacity={0.8}
          hitSlop={{
            top: 8,
            bottom: 8,
            left: 8,
            right: 8,
          }}
          disabled={reorderActive}
          accessibilityRole="button"
          accessibilityLabel="명예의 전당"
        >
          <Text style={styles.hofIconText}>
            🏆
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
        {isWideChallengeList ? (
          <ScrollView
            key={`challenge-list-wide-${layoutWidthKey}`}
            style={styles.listFlex}
            scrollEnabled={!reorderActive}
            contentContainerStyle={[
              styles.challengeListWideContent,
              {
                paddingBottom: listBottomPad,
              },
            ]}
          >
            <HomeHero
              mode={heroMode}
              item={heroItem}
              habitDailyState={
                heroHabitDailyState
              }
              rotationSummary={
                heroRotationSummary
              }
              onRecord={onHeroRecord}
              onFocus={openFocusStart}
              onCreate={onHeroCreate}
            />

            <ChallengeListSectionHeader
              sortLabel={
                SORT_LABELS[sortMode]
                || SORT_LABELS.manual
              }
              onPressSort={() => (
                setShowSortModal(true)
              )}
            />

            {displayData.length === 0 ? (
              <EmptyState />
            ) : (
              <View
                style={
                  styles.challengeListMasonryRow
                }
              >
                <View
                  style={
                    styles.challengeListMasonryColumn
                  }
                >
                  {masonryLeftData.map(
                    (item) => (
                      <View
                        key={keyExtractor(item)}
                      >
                        {renderMasonryItem(item)}
                      </View>
                    )
                  )}
                </View>

                <View
                  style={
                    styles.challengeListMasonryColumn
                  }
                >
                  {masonryRightData.map(
                    (item) => (
                      <View
                        key={keyExtractor(item)}
                      >
                        {renderMasonryItem(item)}
                      </View>
                    )
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        ) : (
          <FlatList
            key={`challenge-list-normal-${layoutWidthKey}`}
            data={displayData}
            keyExtractor={keyExtractor}
            renderItem={renderRow}
            scrollEnabled={!reorderActive}
            removeClippedSubviews={false}
            style={styles.listFlex}
            contentContainerStyle={[
              styles.challengeListContent,
              {
                paddingBottom: listBottomPad,
              },
            ]}
            ListHeaderComponent={homeListHeader}
            ListEmptyComponent={EmptyState}
            initialNumToRender={12}
            windowSize={15}
          />
        )}
      </View>

      {/* 고정 하단 Dock */}
      {!reorderPrepared && !reorderActive && (
        <View style={styles.bottomDock}>
          <TouchableOpacity
            style={styles.dockSecondary}
            onPress={() => (
              navigationRef.current.navigate(
                'ProfileInventory'
              )
            )}
            activeOpacity={0.8}
          >
            <Text style={styles.dockSecondaryText}>
              기록실
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dockSecondary}
            onPress={() => (
              navigationRef.current.navigate(
                'GraphShop'
              )
            )}
            activeOpacity={0.8}
          >
            <Text style={styles.dockSecondaryText}>
              상점
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dockPrimary}
            onPress={() => (
              navigationRef.current.navigate(
                'CreateChallengeType'
              )
            )}
            activeOpacity={0.9}
          >
            <Text style={styles.dockPrimaryText}>
              ＋ 새로 만들기
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 정렬 중 선택 카드 복제본 */}
      {(reorderPrepared || reorderActive) && selected && floatWidth > 0 && (
        <Modal visible transparent animationType="none" onRequestClose={finalizeReorder}>
          {reorderActive && (
            <TouchableWithoutFeedback onPress={onOverlayPress}>
              <View style={styles.fullOverlay} />
            </TouchableWithoutFeedback>
          )}
        <Animated.View
          pointerEvents={reorderActive ? "box-none" : "none"}
          style={[
              styles.floatingCardWrap,
              { left: floatLeft, top: floatTop, width: floatWidth },
              reorderPrepared && !reorderActive && { height: reorderFloatingHeight, overflow: 'hidden' },
            ]}
        >
          {reorderPrepared && !reorderActive && selected && !reorderExpandVisualHeights[safeStringId(selected.id)]?.expanded && (
            <View pointerEvents="none" style={styles.reorderFloatingMeasureProbe}>
              <View
                style={{ width: floatWidth }}
                onLayout={(event) => {
                  updateReorderExpandVisualHeight(selected.id, 'expanded', event?.nativeEvent?.layout?.height);
                }}
              >
                <CardBody
                  item={selected}
                  habitDailyState={
                    habitDailyStateMap[safeStringId(selected.id)]
                    || EMPTY_HABIT_DAILY_STATE
                  }
                  variant={CHALLENGE_CARD_VARIANTS.FLOATING}
                  collapsed={false}
                  showControls
                  canReorder={!asDoneFlags(selected)._isDone}
                  onPressCard={() => {}}
                  onPressEdit={() => {}}
                  onPressDuplicate={() => {}}
                  onPressDelete={() => {}}
                  onPressClaim={onClaimReward}
                />
              </View>
            </View>
          )}

          <CardBody
            item={selected}
            habitDailyState={
              habitDailyStateMap[safeStringId(selected.id)]
              || EMPTY_HABIT_DAILY_STATE
            }
            variant={CHALLENGE_CARD_VARIANTS.FLOATING}
            showControls={reorderActive && reorderFloatingControlsVisible}
            canReorder={!asDoneFlags(selected)._isDone}
            onPressCard={(it) => {
              if (it?.__move === 'up') { moveSelected('up'); return; }
              if (it?.__move === 'down') { moveSelected('down'); return; }
            }}
            onPressEdit={(it) => {
              finalizeReorder();
              if (isRotationRoutine(it)) {
                navigationRef.current.navigate('EditRotationRoutine', { routineId: it.id });
                return;
              }
              navigationRef.current.navigate('EditChallenge', { challenge: it });
            }}
            onPressDuplicate={selected?._isExpired ? undefined : (it) => { onDuplicate(it); finalizeReorder(); }}
            onPressDelete={(it) => { onDelete(it); }}
            onPressClaim={() => {}}
            onLongPress={undefined}
          />
        </Animated.View>
        </Modal>
      )}
      <FocusSessionStartModal
        visible={!!focusTarget}
        target={focusTarget}
        busy={focusStarting}
        onClose={() => { if (!focusStarting) setFocusTarget(null); }}
        onStart={beginFocusSession}
      />
      {/* 정렬 모달 */}
      <Modal visible={showSortModal} transparent animationType="fade" onRequestClose={() => setShowSortModal(false)}>
        <TouchableWithoutFeedback onPress={() => setShowSortModal(false)}>
          <View style={styles.sortModalBackdrop} />
        </TouchableWithoutFeedback>
        <View
        style={[
          canonicalCardStyles.base,
          styles.sortModalCard,
        ]}
      >
          <Text
          style={[
            canonicalTextStyles.value,
            canonicalTextStyles.center,
            styles.sortModalTitle,
          ]}
        >
          정렬 / 필터
        </Text>
          {[
            { key: 'newest', label: '최신순' },
            { key: 'oldest', label: '오래된순' },
            { key: 'habitFirst', label: '습관/도전' },
            { key: 'challengeFirst', label: '도전/습관' },
          ].map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[
            canonicalLayoutStyles.rowBetween,
            styles.sortOption,
            sortMode === opt.key && styles.sortOptionOn,
          ]}
              onPress={() => applySortMode(opt.key)}
              activeOpacity={0.9}
            >
              <Text style={[styles.sortOptionText, sortMode === opt.key && styles.sortOptionTextOn]}>
                {opt.label}
              </Text>
              {sortMode === opt.key && <Text style={styles.sortOptionCheck}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

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
  homeHero: {
    paddingTop: space.xl,
    paddingBottom: space.xxl,
  },

  heroEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: color.textSecondary,
    marginBottom: space.md,
  },

  heroKicker: {
    fontSize: 14,
    fontWeight: '700',
    color: color.textSecondary,
    marginBottom: 4,
  },

  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    color: color.textPrimary,
    letterSpacing: -0.5,
  },

  heroMessage: {
    marginTop: space.xs,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
    color: color.textPrimary,
  },

  heroSubMessage: {
    marginTop: space.xs,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: color.textSecondary,
  },

  heroProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.lg,
    marginBottom: space.xs,
  },

  heroProgressValue: {
    fontSize: 16,
    fontWeight: '900',
    color: color.textPrimary,
  },

  heroProgressMeta: {
    fontSize: 13,
    fontWeight: '800',
    color: color.textSecondary,
  },

  heroActionButton: {
    minHeight: 50,
    marginTop: space.lg,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroActionText: {
    fontSize: 16,
    fontWeight: '900',
    color: color.textInverse,
  },

  /* 목록 Section Header */
  sectionHeaderRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.xxs,
  },

  sectionHeaderTitle: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '900',
    color: color.textPrimary,
  },

  sectionSortButton: {
    marginLeft: space.sm,
    paddingVertical: 8,
    paddingLeft: space.sm,
  },

  sectionSortText: {
    fontSize: 12,
    fontWeight: '700',
    color: color.textSecondary,
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

  cardStatusWrap: {
    marginTop: space.md,
  },

  statusPrimary: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    color: color.textPrimary,
  },

  statusSecondary: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: color.textSecondary,
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

  managementContent: {
    minHeight: 112,
    justifyContent: 'space-between',
  },

  controlDisabled: {
    opacity: 0.35,
  },

  compactRewardText: {
    color: color.textPrimary,
  },

  /* 고정 하단 Dock */
  bottomDock: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space.xs,
    paddingHorizontal: space.md,
    paddingTop: space.xs,
    paddingBottom: space.xs,
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.background,
  },

  dockSecondary: {
    flex: 0.52,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },

  dockSecondaryText: {
    fontSize: 13,
    fontWeight: '800',
    color: color.textPrimary,
  },

  dockPrimary: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dockPrimaryText: {
    fontSize: 14,
    fontWeight: '900',
    color: color.textInverse,
  },

  hofIconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },

  hofIconText: {
    fontSize: 20,
    includeFontPadding: false,
  },

  sortModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: color.overlay },
  sortModalCard: {
    position: 'absolute',
    top: 100,
    left: space.md,
    right: space.md,
    elevation: 8,
  },
  sortModalTitle: {
    marginBottom: space.sm,
  },
  sortOption: {
    paddingVertical: 12,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
  },
  sortOptionOn: { backgroundColor: color.surfaceMuted },
  sortOptionText: {
    fontSize: font.size.body,
    color: color.textPrimary,
    fontWeight: font.weight.semibold,
  },
  sortOptionTextOn: {
    fontWeight: font.weight.heavy,
    color: color.textPrimary,
  },
  sortOptionCheck: { fontSize: 14, color: color.textPrimary, fontWeight: '900' },
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
  cardWrapWide: {
    paddingHorizontal: 4,
  },
  challengeListContent: {
    paddingHorizontal: space.md,
    paddingBottom: 0,
  },
  challengeListWideContent: {
    paddingHorizontal: space.sm,
    paddingBottom: 0,
  },
  challengeListMasonryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  challengeListMasonryColumn: {
    flex: 1,
  },
  cardFloating: {},
  cardCompact: {
    paddingVertical: 8,
  },
  cardContentCompact: {},

  cardCollapseToggleBtn: {
    width: 22,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardCollapseToggleText: {
    fontSize: 15,
    lineHeight: 15,
    fontWeight: '700',
    color: color.textTertiary,
    includeFontPadding: false,
  },
  compactCardRow: {
    minHeight: 36,
  },
  compactCardTitle: {
    maxWidth: '38%',
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '800',
    color: color.textPrimary,
    marginRight: 8,
  },
  compactProgressText: {
    fontSize: 12,
    fontWeight: '800',
    color: color.textSecondary,
  },
  compactSpacer: {
    flex: 1,
    minWidth: 12,
  },
  compactExpandBtn: {
    width: 20,
    height: 30,
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 12,
  },
  compactExpandText: {
    fontSize: 15,
    lineHeight: 15,
    fontWeight: '700',
    color: color.textTertiary,
    includeFontPadding: false,
  },
  compactPctText: {
    width: 38,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '900',
    color: color.textPrimary,
    marginLeft: 4,
  },
  compactActionBtn: {
    height: 30,
    width: 52,
    paddingHorizontal: 0,
    borderRadius: radius.md,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  compactRewardBtn: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.primary,
  },
  compactActionBtnDisabled: {
    backgroundColor: color.surfaceMuted,
    borderWidth: 1,
    borderColor: color.border,
  },
  compactActionText: {
    color: color.textInverse,
    fontSize: 12,
    fontWeight: '900',
    includeFontPadding: false,
  },
  compactActionTextDisabled: {
    color: primitive.black,
  },
  compactFocusPlayButton: {
    width: 36,
    height: 36,
    marginLeft: space.xs,
    borderRadius: radius.md,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactFocusPlayText: { color: color.textInverse, fontSize: 13, marginLeft: 1 },
  cardContent: { },
  dimmedContent: { opacity: 0.55 },


  uploadNowBtn: {
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
    paddingHorizontal: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.primary,
    backgroundColor: color.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusPlayText: {
    color: color.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  uploadNowText: {
    fontSize: 14,
    fontWeight: '900',
    color: color.textInverse,
  },

  selectedCard: { borderColor: CARD_BORDER, borderWidth: 1 },

  controlsRow: {
    marginTop: space.xs,
    minHeight: CONTROLS_H,
  },

  arrowsInline: {
    height: CONTROLS_H,
  },
  circleArrowSmall: {
    width: ARROW_SIZE, height: ARROW_SIZE, borderRadius: 20,
    backgroundColor: primitive.black, borderWidth: 1, borderColor: primitive.black,
    alignItems: 'center', justifyContent: 'center',
    elevation: 3, shadowColor: primitive.black, shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 2 },
  },
  circleArrowTxt: { color: color.background, fontSize: 18, fontWeight: '900', lineHeight: 18, includeFontPadding: false },

  actionsRight: {
    columnGap: 8,
    height: CONTROLS_H,
  },
  actionDarkBtn: {
    backgroundColor: primitive.black, borderWidth: 1, borderColor: primitive.black,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md,
  },
  actionDarkText: { color: color.background, fontSize: 12, fontWeight: '800' },


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

  /* 정렬 스크림 */
  fullOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: color.overlayStrong, zIndex: 2 },

  /* 선택 카드 복제본 */
  floatingCardWrap: { position: 'absolute', zIndex: 3, elevation: 12, shadowColor: primitive.black, shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: {width:0, height:4} },
  reorderFloatingMeasureProbe: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
  },
});
