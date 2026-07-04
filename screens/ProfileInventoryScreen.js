import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppState,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';

import { DASHBOARD_TARGETS, getDefaultDashboardLayout } from '../constants/widgetCatalog';
import {
  DASHBOARD_ROW_GAP_DEFAULT,
  getDashboardLayoutStateForChallenge,
  getDashboardRowGapForChallenge,
} from '../utils/dashboardLayout';
import { colors, radius, spacing } from '../styles/common';
import { ensureInitialStars, getStarBalance } from '../utils/starWallet';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';
import { useFoldableLayoutState } from '../utils/foldableLayout';

const CHALLENGES_KEY = 'challenges';
const HOF_STORAGE_KEYS = ['hof', 'hallOfFame', 'hall_of_fame', 'HOF'];
const RECORD_ROOM_MEMO_KEY = 'record_room_memo';
const RECORD_ROOM_HOF_GOAL_KEY = 'record_room_hof_goal';
const RECORD_ROOM_PROFILE_KEY = 'record_room_profile';
const RECORD_ROOM_IMAGE_KEY = 'record_room_image';

const RECORD_ROOM_DASHBOARD_TARGET = DASHBOARD_TARGETS.RECORD_ROOM;
const RECORD_ROOM_DASHBOARD_CHALLENGE_ID = 'recordRoom';

const PHONE_GRID_COLUMNS = 6;
const WIDE_GRID_COLUMNS = 12;
const CARD_ROW_HEIGHT = 60;
const CARD_GAP = 10;

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

const TIME_BUCKETS = [
  { label: '새벽', start: 0, end: 5 },
  { label: '오전', start: 6, end: 10 },
  { label: '점심', start: 11, end: 13 },
  { label: '오후', start: 14, end: 17 },
  { label: '저녁', start: 18, end: 21 },
  { label: '밤', start: 22, end: 23 },
];

const CONNECT_ITEMS = [
  { id: 'samsung-health', title: 'Samsung Health', status: '준비중' },
  { id: 'google-fit', title: 'Google Fit', status: '준비중' },
  { id: 'apple-health', title: 'Apple Health', status: '준비중' },
];

const pad2 = (value) => String(value).padStart(2, '0');

const parseJsonSafe = (raw, fallback) => {
  try {
    if (typeof raw !== 'string' || raw.length === 0) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeProfileDraft = (value) => ({
 name: normalizeText(value?.name),
 headline: normalizeText(value?.headline),
 bio: normalizeText(value?.bio),
});

const stringifyProfileDraft = (value) => JSON.stringify(normalizeProfileDraft(value));

const normalizeHofGoalValue = (value) => (
 Math.max(1, Math.floor(Number(value) || 1))
);

const getDateKey = (dateLike) => {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

const getMonthKey = (dateLike) => {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
};

const getCardTitle = (item) => (
  normalizeText(item?.title) ||
  normalizeText(item?.name) ||
  normalizeText(item?.challengeTitle) ||
  normalizeText(item?.label) ||
  '이름 없는 카드'
);

const isRecordCard = (item) => {
  const rawType = String(
    item?.type ??
    item?.cardType ??
    item?.challengeType ??
    item?.mode ??
    ''
  ).toLowerCase();

  return (
    rawType === 'record' ||
    rawType === 'entry' ||
    rawType === 'log' ||
    rawType === 'habit'
  );
};

const isChallengeCard = (item) => !isRecordCard(item);

const isCompletedCard = (item) => {
  const rawStatus = String(item?.status ?? item?.state ?? '').toLowerCase();

  return Boolean(
    item?.completed ||
    item?.isCompleted ||
    item?.done ||
    item?.finished ||
    item?.rewardClaimed ||
    item?.claimed ||
    rawStatus === 'completed' ||
    rawStatus === 'done' ||
    rawStatus === 'finished'
  );
};

const isExpiredCard = (item) => {
  const endRaw = item?.endDate ?? item?.endAt ?? item?.deadline;
  if (!endRaw) return false;

  const endDate = new Date(endRaw);
  if (Number.isNaN(endDate.getTime())) return false;

  endDate.setHours(23, 59, 59, 999);
  return endDate.getTime() < Date.now();
};

const isDeletedCard = (item) => {
  if (!item || typeof item !== 'object') return false;

  const rawStatus = String(item?.status ?? item?.state ?? item?.cardStatus ?? '').toLowerCase();
  const rawType = String(item?.type ?? item?.cardType ?? item?.mode ?? '').toLowerCase();

  return Boolean(
    item?.deleted ||
    item?.isDeleted ||
    item?.removed ||
    item?.isRemoved ||
    item?.trashed ||
    item?.isTrashed ||
    item?.archived ||
    item?.isArchived ||
    item?.deletedAt ||
    item?.removedAt ||
    item?.trashedAt ||
    rawStatus === 'deleted' ||
    rawStatus === 'removed' ||
    rawStatus === 'trashed' ||
    rawStatus === 'trash' ||
    rawStatus === 'archived' ||
    rawType === 'deleted' ||
    rawType === 'trash'
  );
};

const isRewardClaimedCard = (item) => {
  if (!item || typeof item !== 'object') return false;

  const rawStatus = String(item?.status ?? item?.state ?? item?.cardStatus ?? '').toLowerCase();

  return Boolean(
    item?.rewardClaimed ||
    item?.claimed ||
    item?.isClaimed ||
    item?.rewardReceived ||
    item?.rewardClaimedAt ||
    item?.claimedAt ||
    rawStatus === 'claimed' ||
    rawStatus === 'reward_claimed' ||
    rawStatus === 'rewarded' ||
    rawStatus === 'hof' ||
    rawStatus === 'hall' ||
    rawStatus === 'hall_of_fame'
  );
};

const isRewardPendingCard = (item) => (
  isCompletedCard(item) &&
  !isRewardClaimedCard(item) &&
  !isDeletedCard(item) &&
  !isExpiredCard(item)
);

const isVisibleRecordRoomCard = (item) => (
  !isDeletedCard(item) &&
  !isExpiredCard(item) &&
  !isRewardClaimedCard(item)
);

const getCreatedTime = (item) => {
  const raw = item?.createdAt ?? item?.createdDate ?? item?.updatedAt ?? item?.startDate;
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
};

const collectArraysDeep = (value, depth = 0) => {
  if (depth > 3) return [];
  if (Array.isArray(value)) return [value];
  if (!value || typeof value !== 'object') return [];

  const result = [];
  Object.values(value).forEach((next) => {
    if (Array.isArray(next)) {
      result.push(next);
      return;
    }

    if (next && typeof next === 'object') {
      result.push(...collectArraysDeep(next, depth + 1));
    }
  });

  return result;
};

const looksLikeEntry = (item) => {
  if (!item || typeof item !== 'object') return false;

  const hasTime = Boolean(
    item.timestamp ||
    item.date ||
    item.createdAt ||
    item.updatedAt
  );

  const hasContent = Boolean(
    typeof item.text === 'string' ||
    typeof item.memo === 'string' ||
    typeof item.note === 'string' ||
    item.imageUri ||
    item.photoUri ||
    item.duration ||
    item.minutes
  );

  return hasTime && hasContent;
};

const normalizeEntry = (item, sourceKey, index) => {
  const rawTime = item?.timestamp ?? item?.date ?? item?.createdAt ?? item?.updatedAt;
  const date = rawTime ? new Date(rawTime) : null;
  if (!date || Number.isNaN(date.getTime())) return null;

  return {
    id: String(item?.id ?? `${sourceKey}-${index}-${date.getTime()}`),
    challengeId: String(item?.challengeId ?? item?.cid ?? item?.cardId ?? ''),
    text: normalizeText(item?.text ?? item?.memo ?? item?.note),
    timestamp: date.toISOString(),
    duration: Number(item?.duration ?? item?.minutes ?? 0) || 0,
  };
};

const dedupeEntries = (entries) => {
  const seen = new Set();
  const result = [];

  entries.forEach((entry) => {
    if (!entry) return;
    const key = `${entry.id}|${entry.timestamp}|${entry.text}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(entry);
  });

  return result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

const loadAllEntriesFromStorage = async () => {
  const keys = await AsyncStorage.getAllKeys();
  const pairs = await AsyncStorage.multiGet(keys);
  const found = [];

  pairs.forEach(([key, raw]) => {
    if (!raw || typeof raw !== 'string') return;

    const parsed = parseJsonSafe(raw, null);
    if (!parsed) return;

    const arrays = collectArraysDeep(parsed);
    arrays.forEach((arr) => {
      const entryLikeCount = arr.filter(looksLikeEntry).length;
      if (entryLikeCount === 0) return;
      if (entryLikeCount < Math.max(1, Math.ceil(arr.length * 0.35))) return;

      arr.forEach((item, index) => {
        const normalized = normalizeEntry(item, key, index);
        if (normalized) found.push(normalized);
      });
    });
  });

  return dedupeEntries(found);
};

const loadTrashCountFromStorage = async () => {
  const keys = await AsyncStorage.getAllKeys();
  const trashKeys = keys.filter((key) => /trash|deleted|remove|removed/i.test(key));

  if (!trashKeys.length) {
    return { count: 0, hasSource: false };
  }

  const pairs = await AsyncStorage.multiGet(trashKeys);
  let count = 0;

  pairs.forEach(([, raw]) => {
    const parsed = parseJsonSafe(raw, null);

    if (Array.isArray(parsed)) {
      count += parsed.length;
      return;
    }

    if (parsed && typeof parsed === 'object') {
      collectArraysDeep(parsed).forEach((arr) => {
        count += arr.length;
      });
    }
  });

  return { count, hasSource: true };
};

const loadStarHistoryFromStorage = async () => {
  const keys = await AsyncStorage.getAllKeys();
  const candidateKeys = keys.filter((key) => /star|token|wallet|history/i.test(key));
  if (!candidateKeys.length) return [];

  const pairs = await AsyncStorage.multiGet(candidateKeys);
  const points = [];

  pairs.forEach(([key, raw]) => {
    const parsed = parseJsonSafe(raw, null);
    const arrays = collectArraysDeep(parsed);

    arrays.forEach((arr) => {
      arr.forEach((item, index) => {
        if (!item || typeof item !== 'object') return;

        const amount = Number(item.balance ?? item.total ?? item.value ?? item.stars ?? item.tokens);
        const rawTime = item.timestamp ?? item.createdAt ?? item.date ?? item.time;
        const date = rawTime ? new Date(rawTime) : null;

        if (!Number.isFinite(amount) || !date || Number.isNaN(date.getTime())) return;

        points.push({
          id: `${key}-${index}`,
          date: date.toISOString(),
          value: amount,
        });
      });
    });
  });

  return points.sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-12);
};

const createRecentSevenDays = (baseDate = new Date()) => {
  const days = [];
  const today = new Date(baseDate);
  today.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    days.push({
      key: getDateKey(date),
      label: DAY_LABELS[date.getDay()],
      date,
      count: 0,
    });
  }

  return days;
};

const createMonthlyBuckets = () => {
  const result = [];
  const now = new Date();

  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      key: getMonthKey(date),
      label: `${date.getMonth() + 1}월`,
      count: 0,
    });
  }

  return result;
};

const getWeekRangeLabel = (days) => {
  if (!Array.isArray(days) || days.length === 0) return '';
  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;
  if (!first || !last) return '';
  return `${first.getMonth() + 1}.${first.getDate()} ~ ${last.getMonth() + 1}.${last.getDate()}`;
};

const getMonthLabel = (dateLike) => {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
};

const addDays = (dateLike, amount) => {
  const date = new Date(dateLike);
  date.setDate(date.getDate() + amount);
  return date;
};

const addMonths = (dateLike, amount) => {
  const date = new Date(dateLike);
  date.setMonth(date.getMonth() + amount);
  return date;
};

const looksLikeHallCard = (item) => {
  if (!item || typeof item !== 'object') return false;
  return Boolean(
    item.completed || item.isCompleted || item.rewardClaimed || item.claimed ||
    item.completedAt || item.claimedAt || item.title || item.name
  );
};

const normalizeHallCard = (item, sourceKey, index) => ({
  ...item,
  id: String(item?.id ?? item?.challengeId ?? `${sourceKey}-${index}`),
  title: getCardTitle(item),
  completed: true,
  _recordRoomHall: true,
});

const loadHallCardsFromStorage = async () => {
  const primaryKey = HOF_STORAGE_KEYS[0];
  const legacyKeys = HOF_STORAGE_KEYS.slice(1);

  const readArrayFromKey = async (key) => {
    const raw = await AsyncStorage.getItem(key);
    const parsed = parseJsonSafe(raw, null);
    if (!parsed) return [];

    if (Array.isArray(parsed)) return parsed;

    const arrays = collectArraysDeep(parsed);
    return arrays.find((arr) => Array.isArray(arr) && arr.length > 0) || [];
  };

  let sourceKey = primaryKey;
  let sourceList = await readArrayFromKey(primaryKey);

  if (sourceList.length === 0) {
    for (const key of legacyKeys) {
      const legacyList = await readArrayFromKey(key);
      if (legacyList.length > 0) {
        sourceKey = key;
        sourceList = legacyList;

        try {
          await AsyncStorage.setItem(primaryKey, JSON.stringify(legacyList));
        } catch (error) {
          console.warn('Failed to migrate HOF storage for record room', error);
        }

        break;
      }
    }
  }

  const found = [];
  const seen = new Set();

  sourceList.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;

    const n = normalizeHallCard(item, sourceKey, index);
    if (seen.has(n.id)) return;

    seen.add(n.id);
    found.push(n);
  });

  return found;
};


const createCurrentMonthDays = (entries, baseDate = new Date()) => {
  const result = [];
  const now = new Date(baseDate);
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const startBlank = first.getDay();

  for (let i = 0; i < startBlank; i += 1) {
    result.push({ key: `blank-${i}`, label: '', count: 0, blank: true });
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), day);
    const key = getDateKey(date);
    const count = entries.filter((entry) => getDateKey(entry.timestamp) === key).length;
    result.push({ key, label: String(day), count, blank: false });
  }

  return result;
};

const calcStats = ({ cards, entries, trashInfo, stars, starHistory, hofGoal, hallCards, weekBaseDate, calendarBaseDate }) => {
  const activeCards = cards.filter(isVisibleRecordRoomCard);
  const visibleHallCards = asArray(hallCards);
  const rewardPendingCards = activeCards.filter(isRewardPendingCard);
  const progressCards = activeCards.filter((item) => !isRewardPendingCard(item));
  const challengeCards = progressCards.filter(isChallengeCard);
  const recordCards = progressCards.filter(isRecordCard);
  const completedCards = visibleHallCards;
  const expiredFailedCards = cards.filter((item) => !isDeletedCard(item) && isExpiredCard(item) && !isCompletedCard(item));
  const rewardPendingCount = rewardPendingCards.length;

  const todayKey = getDateKey(new Date());
  const todayEntries = entries.filter((entry) => getDateKey(entry.timestamp) === todayKey);

  const weekly = createRecentSevenDays(weekBaseDate);
  const weeklyMap = new Map(weekly.map((item) => [item.key, item]));

  entries.forEach((entry) => {
    const key = getDateKey(entry.timestamp);
    const item = weeklyMap.get(key);
    if (item) item.count += 1;
  });

  const monthly = createMonthlyBuckets();
  const monthlyMap = new Map(monthly.map((item) => [item.key, item]));

  entries.forEach((entry) => {
    const key = getMonthKey(entry.timestamp);
    const item = monthlyMap.get(key);
    if (item) item.count += 1;
  });

  const heatmap = TIME_BUCKETS.map((bucket) => ({
    ...bucket,
    values: DAY_LABELS.map((label) => ({ label, count: 0 })),
  }));

  const weeklyKeySet = new Set(weekly.map((item) => item.key));

  entries.forEach((entry) => {
    const date = new Date(entry.timestamp);
    if (Number.isNaN(date.getTime())) return;
    if (!weeklyKeySet.has(getDateKey(date))) return;

    const day = date.getDay();
    const hour = date.getHours();
    const row = heatmap.find((bucket) => hour >= bucket.start && hour <= bucket.end);

    if (row?.values?.[day]) {
      row.values[day].count += 1;
    }
  });

  return {
    totalCards: activeCards.length,
    challengeCount: challengeCards.length,
    recordCount: recordCards.length,
    completedCount: completedCards.length,
    expiredFailedCount: expiredFailedCards.length,
    deletedCount: trashInfo.count,
    hasTrashSource: trashInfo.hasSource,
    rewardPendingCount,
    stars,
    todayCount: todayEntries.length,
    weekly,
    monthly,
    heatmap,
    calendarDays: createCurrentMonthDays(entries, calendarBaseDate),
    calendarLabel: getMonthLabel(calendarBaseDate || new Date()),
    weekLabel: getWeekRangeLabel(weekly),
    starHistory,
    hofGoal,
    hofProgress: Math.min(1, completedCards.length / Math.max(1, hofGoal)),
  };
};

const DashboardCard = ({ title, subtitle, children, dark = false }) => (
  <View style={[styles.dashboardCard, dark && styles.dashboardCardDark]}>
    {(title || subtitle) && (
      <View style={styles.cardHeader}>
        {!!title && <Text style={[styles.cardTitle, dark && styles.cardTitleDark]} numberOfLines={1}>{title}</Text>}
        {!!subtitle && <Text style={[styles.cardSubtitle, dark && styles.cardSubtitleDark]} numberOfLines={1}>{subtitle}</Text>}
      </View>
    )}
    <View style={styles.cardBody}>{children}</View>
  </View>
);

const KpiCard = ({ label, value, note, dark = false, icon }) => (
  <View style={[styles.dashboardCard, styles.kpiCard, dark && styles.dashboardCardDark]}>
    <Text
      style={[styles.kpiLabel, dark && styles.kpiLabelDark]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.72}
    >
      {label}
    </Text>

    <View style={styles.kpiValueRow}>
      {!!icon && <Text style={[styles.kpiIcon, dark && styles.kpiValueDark]}>{icon}</Text>}
      <Text
        style={[styles.kpiValue, dark && styles.kpiValueDark]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {value}
      </Text>
    </View>

    {!!note && (
      <Text
        style={[styles.kpiNote, dark && styles.kpiNoteDark]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
      >
        {note}
      </Text>
    )}
  </View>
);

const ProfileImageCard = ({ imageUri, onPress }) => (
  <TouchableOpacity style={styles.profileImageTouchable} activeOpacity={0.88} onPress={onPress}>
    <DashboardCard>
      <View style={styles.profileImageBody}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.profilePhoto} resizeMode="cover" />
        ) : (
          <View style={styles.profileAvatar}>
            <View style={styles.profileAvatarHead} />
            <View style={styles.profileAvatarBody} />
          </View>
        )}
        <Text style={styles.profileImageText}>{imageUri ? '사진 변경' : '사진 선택'}</Text>
      </View>
    </DashboardCard>
  </TouchableOpacity>
);

const ProfileInfoCard = ({ profile, onPress }) => (
  <TouchableOpacity style={styles.profileInfoTouchable} activeOpacity={0.88} onPress={onPress}>
    <DashboardCard>
      <Text style={styles.profileInfoName} numberOfLines={1}>
        {profile?.name || '이름을 적어주세요'}
      </Text>
      <Text style={styles.profileInfoMain} numberOfLines={2}>
        {profile?.headline || '내가 계속 밀고 가는 이유'}
      </Text>
      <Text style={styles.profileInfoSub} numberOfLines={4}>
        {profile?.bio || '목표, 다짐, 나를 설명하는 문장을 자유롭게 적을 수 있습니다.'}
      </Text>
      <Text style={styles.profileEditHint}>눌러서 수정</Text>
    </DashboardCard>
  </TouchableOpacity>
);

const WeeklyBarCard = ({ data, label, onPrev, onNext }) => {
  const max = Math.max(1, ...data.map((item) => item.count));

  return (
    <DashboardCard title="일주일 인증 횟수" subtitle={label || '최근 7일'}>
      <View style={styles.cardPagerRow}>
        <TouchableOpacity style={styles.cardPagerBtn} onPress={onPrev} activeOpacity={0.8}>
          <Text style={styles.cardPagerText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.cardPagerLabel}>{label}</Text>
        <TouchableOpacity style={styles.cardPagerBtn} onPress={onNext} activeOpacity={0.8}>
          <Text style={styles.cardPagerText}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.barChartRow}>
        {data.map((item) => (
          <View key={item.key} style={styles.barColumn}>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { height: `${Math.max(8, (item.count / max) * 100)}%` }]} />
            </View>
            <Text style={styles.chartSmallValue}>{item.count}</Text>
            <Text style={styles.chartAxisLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </DashboardCard>
  );
};

const RatioDonutCard = ({ challengeCount, recordCount }) => {
  const total = challengeCount + recordCount;
  const challengeRatio = total > 0 ? challengeCount / total : 0;
  const size = 96;
  const stroke = 14;
  const radiusValue = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radiusValue;
  const dash = challengeRatio * circumference;

  return (
    <DashboardCard title="도전/기록 비율" subtitle="카드 유형">
      <View style={styles.donutRow}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radiusValue}
            stroke="#E5E7EB"
            strokeWidth={stroke}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radiusValue}
            stroke="#111"
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={styles.donutTextLayer}>
          <Text style={styles.donutMainText}>{total}</Text>
          <Text style={styles.donutSubText}>전체</Text>
        </View>
      </View>
      <View style={styles.legendRow}>
        <Text style={styles.legendText}>도전 {challengeCount}</Text>
        <Text style={styles.legendText}>기록 {recordCount}</Text>
      </View>
    </DashboardCard>
  );
};

const TokenTrendCard = ({ data, stars }) => {
  if (!Array.isArray(data) || data.length < 2) {
    return (
      <DashboardCard title="누적토큰 추이" subtitle="이력 수집 전">
        <Text style={styles.emptyCardText}>현재 별 {stars}개</Text>
        <Text style={styles.emptyCardSubText}>변화 이력이 쌓이면 선형 그래프로 표시됩니다.</Text>
      </DashboardCard>
    );
  }

  const width = 220;
  const height = 86;
  const values = data.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  const points = data.map((item, index) => {
    const x = data.length === 1 ? 0 : (index / (data.length - 1)) * width;
    const y = height - ((item.value - min) / range) * height;
    return { x, y };
  });

  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');

  return (
    <DashboardCard title="누적토큰 추이" subtitle="최근 이력">
      <Svg width="100%" height={110} viewBox={`0 0 ${width} ${height + 24}`}>
        <Path d={path} stroke="#111" strokeWidth={3} fill="none" strokeLinecap="round" />
        {points.map((point, index) => (
          <Circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r={3} fill="#111" />
        ))}
      </Svg>
    </DashboardCard>
  );
};

const CalendarCard = ({ days, label, onPrev, onNext }) => {
  const max = Math.max(1, ...days.map((day) => day.count));

  return (
    <DashboardCard title="인증 달력" subtitle={label}>
      <View style={styles.cardPagerRow}>
        <TouchableOpacity style={styles.cardPagerBtn} onPress={onPrev} activeOpacity={0.8}>
          <Text style={styles.cardPagerText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.cardPagerLabel}>{label}</Text>
        <TouchableOpacity style={styles.cardPagerBtn} onPress={onNext} activeOpacity={0.8}>
          <Text style={styles.cardPagerText}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.calendarGrid}>
        {DAY_LABELS.map((dayLabel) => (
          <Text key={dayLabel} style={styles.calendarWeekLabel}>{dayLabel}</Text>
        ))}
        {days.map((day) => {
          const opacity = day.blank ? 0 : 0.18 + (day.count / max) * 0.82;
          return (
            <View key={day.key} style={[styles.calendarCell, day.blank ? styles.calendarCellBlank : { backgroundColor: `rgba(17,17,17,${opacity})` }]}>
              <Text style={[styles.calendarCellText, day.count > 0 && styles.calendarCellTextActive]}>{day.label}</Text>
            </View>
          );
        })}
      </View>
    </DashboardCard>
  );
};

const HeatmapCard = ({ data, label, onPrev, onNext }) => {
  const max = Math.max(1, ...data.flatMap((row) => row.values.map((item) => item.count)));

  return (
    <DashboardCard title="인증 시간 패턴" subtitle={label || '요일 × 시간대'}>
      <View style={styles.cardPagerRow}>
        <TouchableOpacity style={styles.cardPagerBtn} onPress={onPrev} activeOpacity={0.8}>
          <Text style={styles.cardPagerText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.cardPagerLabel}>{label}</Text>
        <TouchableOpacity style={styles.cardPagerBtn} onPress={onNext} activeOpacity={0.8}>
          <Text style={styles.cardPagerText}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.heatmapHeader}>
        <View style={styles.heatmapTimeLabel} />
        {DAY_LABELS.map((label) => (
          <Text key={label} style={styles.heatmapDayLabel}>{label}</Text>
        ))}
      </View>
      {data.map((row) => (
        <View key={row.label} style={styles.heatmapRow}>
          <Text style={styles.heatmapTimeLabel}>{row.label}</Text>
          {row.values.map((item) => {
            const opacity = 0.08 + (item.count / max) * 0.82;
            return (
              <View
                key={`${row.label}-${item.label}`}
                style={[styles.heatmapCell, { backgroundColor: `rgba(17,17,17,${opacity})` }]}
              />
            );
          })}
        </View>
      ))}
    </DashboardCard>
  );
};

const MonthlyBarCard = ({ data }) => {
  const max = Math.max(1, ...data.map((item) => item.count));

  return (
    <DashboardCard title="월별 인증 갯수" subtitle="최근 6개월">
      <View style={styles.monthlyBarRow}>
        {data.map((item) => (
          <View key={item.key} style={styles.monthlyColumn}>
            <View style={styles.monthlyTrack}>
              <View style={[styles.monthlyFill, { height: `${Math.max(7, (item.count / max) * 100)}%` }]} />
            </View>
            <Text style={styles.chartSmallValue}>{item.count}</Text>
            <Text style={styles.chartAxisLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </DashboardCard>
  );
};

const HallBatteryCard = ({ completedCount, goal, progress, onPress }) => (
  <TouchableOpacity style={styles.goalTouchable} activeOpacity={0.88} onPress={onPress}>
    <DashboardCard title="명예의 전당 목표" subtitle={`${completedCount}/${goal}`}>
      <View style={styles.goalBarTrack}>
        <View style={[styles.goalBarFill, { width: `${Math.max(2, Math.min(100, progress * 100))}%` }]} />
      </View>
      <Text style={styles.batteryText}>{Math.round(progress * 100)}% 채움 · 눌러서 목표 설정</Text>
    </DashboardCard>
  </TouchableOpacity>
);

const ConnectStatusCard = () => (
  <DashboardCard title="커넥트 현황" subtitle="외부 앱 연동 준비">
    {CONNECT_ITEMS.map((item) => (
      <View key={item.id} style={styles.connectRow}>
        <Text style={styles.connectTitle}>{item.title}</Text>
        <Text style={styles.connectStatus}>{item.status}</Text>
      </View>
    ))}
  </DashboardCard>
);

const MemoCard = ({ memo, onPress }) => (
  <TouchableOpacity style={styles.memoTouchable} activeOpacity={0.88} onPress={onPress}>
    <DashboardCard title="메모" subtitle="나에게 남기는 말">
      <Text style={memo ? styles.memoText : styles.memoPlaceholder} numberOfLines={4}>
        {memo || '누르면 메모를 남길 수 있습니다.'}
      </Text>
    </DashboardCard>
  </TouchableOpacity>
);

const CardListSection = ({ cards, hallCards }) => {
  const [tab, setTab] = useState('all');

  const mergedCards = useMemo(() => [
    ...cards.filter(isVisibleRecordRoomCard),
    ...asArray(hallCards)
      .map((item) => ({ ...item, completed: true, _recordRoomHall: true })),
  ], [cards, hallCards]);

  const filtered = useMemo(() => {
    if (tab === 'challenge') {
      return mergedCards.filter((item) => !item?._recordRoomHall && !isRewardPendingCard(item) && isChallengeCard(item));
    }
    if (tab === 'record') {
      return mergedCards.filter((item) => !item?._recordRoomHall && !isRewardPendingCard(item) && isRecordCard(item));
    }
    if (tab === 'hall') {
      return mergedCards.filter((item) => item?._recordRoomHall === true);
    }
    return mergedCards;
  }, [mergedCards, tab]);

  const sorted = useMemo(() => {
    const hallItems = [...filtered].filter((item) => item._recordRoomHall).sort((a, b) => getCreatedTime(b) - getCreatedTime(a));
    const regularItems = [...filtered].filter((item) => !item._recordRoomHall).sort((a, b) => getCreatedTime(b) - getCreatedTime(a));
    return [...regularItems, ...hallItems];
  }, [filtered]);

  return (
    <View style={styles.listSection}>
      <Text style={styles.listTitle}>카드 목록</Text>

      <View style={styles.tabRow}>
        {[
          { id: 'all', label: '전체' },
          { id: 'challenge', label: '도전' },
          { id: 'record', label: '기록' },
          { id: 'hall', label: '명예의 전당' },
        ].map((item) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.85}
            onPress={() => setTab(item.id)}
            style={[styles.tabButton, tab === item.id && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, tab === item.id && styles.tabButtonTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {sorted.length === 0 ? (
        <Text style={styles.listEmpty}>표시할 카드가 없습니다.</Text>
      ) : (
        <ScrollView
          style={styles.listScroll}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
        {sorted.map((item, index) => {
          const isHallItem = item?._recordRoomHall === true;
          const isRewardPending = !isHallItem && isRewardPendingCard(item);
          const typeLabel = isRecordCard(item) ? '기록' : '도전';
          const categoryLabel = isHallItem ? '명예의 전당' : typeLabel;
          const statusLabel = isHallItem ? '완료' : isRewardPending ? '보상대기' : '진행중';
          const statusBadge = isHallItem ? '완료' : isRewardPending ? '보상대기' : '진행';
          const baseKey = String(item?.id ?? item?.uuid ?? getCardTitle(item));
          const listKey = `${isHallItem ? 'hall' : 'card'}-${baseKey}-${index}`;

          return (
            <View key={listKey} style={styles.listItem}>
              <View style={styles.listItemMain}>
                <Text
                  style={[styles.listItemTitle, isHallItem && styles.listItemTitleMuted]}
                  numberOfLines={1}
                >
                  {getCardTitle(item)}
                </Text>
                <Text style={styles.listItemMeta}>
                  {categoryLabel} · {statusLabel}
                </Text>
              </View>
              <Text style={[styles.listItemStatus, isHallItem && styles.listItemStatusMuted]}>
                {statusBadge}
              </Text>
            </View>
          );
        })}
        </ScrollView>
      )}
    </View>
  );
};

const GridItem = ({ item, columns, children }) => {
  const safeW = Math.max(1, Math.min(columns, Number(item.w) || columns));
  const safeH = Math.max(1, Number(item.h) || 1);
  const width = `${(safeW / columns) * 100}%`;
  const height = safeH * CARD_ROW_HEIGHT;

  return (
    <View style={[styles.gridItem, { width, height }]}>
      {children}
    </View>
  );
};

const RecordRoomEditIcon = () => (
  <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
    <Rect x={2} y={2} width={28} height={28} rx={8} fill="#111" />
    <Path
      d="M11.9 20.4L12.55 17.3L19.65 10.2C20.16 9.69 20.98 9.69 21.49 10.2L21.8 10.51C22.31 11.02 22.31 11.84 21.8 12.35L14.7 19.45L11.9 20.4Z"
      stroke="#FFFFFF"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M18.7 11.3L20.7 13.3"
      stroke="#FFFFFF"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default function ProfileInventoryScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [recordRoomFrameWidth, setRecordRoomFrameWidth] = useState(0);
  const recordRoomLayoutWidth = recordRoomFrameWidth || windowWidth;
  const recordRoomLayoutKey = Math.round(Number(recordRoomLayoutWidth || 0));
  const foldableLayoutRefreshKey = `${recordRoomLayoutKey}:${Math.round(windowHeight || 0)}`;
  const { refresh: refreshFoldableLayoutState } = useFoldableLayoutState(foldableLayoutRefreshKey);
  const isWideRecordRoomLayout = recordRoomLayoutWidth >= 600;
  const columns = isWideRecordRoomLayout ? WIDE_GRID_COLUMNS : PHONE_GRID_COLUMNS;

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      const refreshNow = async () => {
        try {
          await refreshFoldableLayoutState();
        } catch (error) {
          console.warn('[ProfileInventory][foldableRefresh][focus] failed:', error);
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
        console.warn('[ProfileInventory][foldableRefresh][active] failed:', error);
      });

      setTimeout(() => {
        refreshFoldableLayoutState().catch((error) => {
          console.warn('[ProfileInventory][foldableRefresh][activeDelayed] failed:', error);
        });
      }, 350);
    });

    return () => subscription.remove();
  }, [refreshFoldableLayoutState]);

  const [stars, setStars] = useState(0);
  const [cards, setCards] = useState([]);
  const [hallCards, setHallCards] = useState([]);
  const [entries, setEntries] = useState([]);
  const [trashInfo, setTrashInfo] = useState({ count: 0, hasSource: false });
  const [starHistory, setStarHistory] = useState([]);
  const [memo, setMemo] = useState('');
  const [memoDraft, setMemoDraft] = useState('');
  const [memoVisible, setMemoVisible] = useState(false);
  const [profileInfo, setProfileInfo] = useState({ name: '', headline: '', bio: '' });
  const [profileDraft, setProfileDraft] = useState({ name: '', headline: '', bio: '' });
  const [profileVisible, setProfileVisible] = useState(false);
  const [profileImageUri, setProfileImageUri] = useState('');
  const [hofGoal, setHofGoal] = useState(10);
  const [hofGoalDraft, setHofGoalDraft] = useState('10');
  const [hofGoalVisible, setHofGoalVisible] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
  const [recordRoomLayout, setRecordRoomLayout] = useState(() =>
    getDefaultDashboardLayout(RECORD_ROOM_DASHBOARD_TARGET)
  );
  const [recordRoomRowGap, setRecordRoomRowGap] = useState(DASHBOARD_ROW_GAP_DEFAULT);

  const reload = useCallback(async () => {
    await ensureInitialStars();

    const [
      nextStars,
      rawChallenges,
      nextEntries,
      nextTrashInfo,
      nextStarHistory,
      nextHallCards,
      storedMemo,
      storedProfile,
      storedImageUri,
      storedHofGoal,
    ] = await Promise.all([
      getStarBalance(),
      AsyncStorage.getItem(CHALLENGES_KEY),
      loadAllEntriesFromStorage(),
      loadTrashCountFromStorage(),
      loadStarHistoryFromStorage(),
      loadHallCardsFromStorage(),
      AsyncStorage.getItem(RECORD_ROOM_MEMO_KEY),
      AsyncStorage.getItem(RECORD_ROOM_PROFILE_KEY),
      AsyncStorage.getItem(RECORD_ROOM_IMAGE_KEY),
      AsyncStorage.getItem(RECORD_ROOM_HOF_GOAL_KEY),
    ]);

    const parsedCards = parseJsonSafe(rawChallenges, []);
    const parsedProfile = parseJsonSafe(storedProfile, { name: '', headline: '', bio: '' });
    const goalNumber = Number(storedHofGoal);

    setStars(Number(nextStars) || 0);
    setCards(asArray(parsedCards));
    setHallCards(asArray(nextHallCards));
    setEntries(nextEntries);
    setTrashInfo(nextTrashInfo);
    setStarHistory(nextStarHistory);
    setMemo(storedMemo || '');
    setMemoDraft(storedMemo || '');
    setProfileInfo(parsedProfile);
    setProfileDraft(parsedProfile);
    setProfileImageUri(storedImageUri || '');
    const safeGoal = Number.isFinite(goalNumber) && goalNumber > 0 ? goalNumber : 10;
    setHofGoal(safeGoal);
    setHofGoalDraft(String(safeGoal));
  }, []);

  const loadRecordRoomDashboardLayout = useCallback(async () => {
    try {
      const [layoutState, storedRowGap] = await Promise.all([
        getDashboardLayoutStateForChallenge(RECORD_ROOM_DASHBOARD_CHALLENGE_ID, RECORD_ROOM_DASHBOARD_TARGET),
        getDashboardRowGapForChallenge(RECORD_ROOM_DASHBOARD_CHALLENGE_ID, RECORD_ROOM_DASHBOARD_TARGET),
      ]);
      const nextLayout =
        Array.isArray(layoutState?.layout) && layoutState.layout.length > 0
          ? layoutState.layout
          : getDefaultDashboardLayout(RECORD_ROOM_DASHBOARD_TARGET);
      setRecordRoomLayout(nextLayout);
      setRecordRoomRowGap(storedRowGap);
    } catch (error) {
      console.warn('Failed to load record room dashboard layout', error);
      setRecordRoomLayout(getDefaultDashboardLayout(RECORD_ROOM_DASHBOARD_TARGET));
      setRecordRoomRowGap(DASHBOARD_ROW_GAP_DEFAULT);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
      loadRecordRoomDashboardLayout();
    }, [reload, loadRecordRoomDashboardLayout])
  );

  const weekBaseDate = useMemo(() => addDays(new Date(), weekOffset * 7), [weekOffset]);
  const calendarBaseDate = useMemo(() => addMonths(new Date(), calendarMonthOffset), [calendarMonthOffset]);

  const stats = useMemo(() => calcStats({
    cards,
    entries,
    trashInfo,
    stars,
    starHistory,
    hofGoal,
    hallCards,
    weekBaseDate,
    calendarBaseDate,
  }), [cards, entries, trashInfo, stars, starHistory, hofGoal, hallCards, weekBaseDate, calendarBaseDate]);

  const hasModalUnsavedChanges = useCallback(() => {
    if (memoVisible) {
      return memoDraft !== memo;
    }

    if (profileVisible) {
      return stringifyProfileDraft(profileDraft) !== stringifyProfileDraft(profileInfo);
    }

    if (hofGoalVisible) {
      return normalizeHofGoalValue(hofGoalDraft) !== normalizeHofGoalValue(hofGoal);
    }

    return false;
  }, [
    hofGoal,
    hofGoalDraft,
    hofGoalVisible,
    memo,
    memoDraft,
    memoVisible,
    profileDraft,
    profileInfo,
    profileVisible,
  ]);

  const { confirmSave, markAsSaved, resetGuard } = useUnsavedChangesGuard({
    navigation,
    hasUnsavedChanges: false,
    title: '수정 중인 내용이 있어요',
    message: '닫으면 변경한 내용이 저장되지 않습니다.',
    stayText: '계속 수정',
    leaveText: '닫기',
  });

  const confirmCloseModal = useCallback((onClose) => {
    if (typeof onClose !== 'function') return;

    Alert.alert(
      '수정 중인 내용이 있어요',
      '닫으면 변경한 내용이 저장되지 않습니다.',
      [
        {
          text: '계속 수정',
          style: 'cancel',
        },
        {
          text: '닫기',
          style: 'destructive',
          onPress: onClose,
        },
      ]
    );
  }, []);

  const openMemo = useCallback(() => {
    resetGuard();
    setMemoDraft(memo);
    setMemoVisible(true);
  }, [memo, resetGuard]);

  const closeMemoModal = useCallback(() => {
    const close = () => {
      setMemoDraft(memo);
      setMemoVisible(false);
    };

    if (!hasModalUnsavedChanges()) {
      close();
      return;
    }

    confirmCloseModal(close);
  }, [confirmCloseModal, hasModalUnsavedChanges, memo]);

  const saveMemo = useCallback(() => {
    confirmSave({
      title: '저장하시겠습니까?',
      message: '메모를 저장할까요?',
      onConfirm: async () => {
        await AsyncStorage.setItem(RECORD_ROOM_MEMO_KEY, memoDraft);
        setMemo(memoDraft);
        markAsSaved();
        setMemoVisible(false);
      },
    });
  }, [confirmSave, markAsSaved, memoDraft]);

  const openProfile = useCallback(() => {
    resetGuard();
    setProfileDraft(profileInfo);
    setProfileVisible(true);
  }, [profileInfo, resetGuard]);

  const closeProfileModal = useCallback(() => {
    const close = () => {
      setProfileDraft(profileInfo);
      setProfileVisible(false);
    };

    if (!hasModalUnsavedChanges()) {
      close();
      return;
    }

    confirmCloseModal(close);
  }, [confirmCloseModal, hasModalUnsavedChanges, profileInfo]);

  const saveProfile = useCallback(() => {
    confirmSave({
      title: '저장하시겠습니까?',
      message: '내 정보를 저장할까요?',
      onConfirm: async () => {
        const nextProfile = normalizeProfileDraft(profileDraft);
        await AsyncStorage.setItem(RECORD_ROOM_PROFILE_KEY, JSON.stringify(nextProfile));
        setProfileInfo(nextProfile);
        setProfileDraft(nextProfile);
        markAsSaved();
        setProfileVisible(false);
      },
    });
  }, [confirmSave, markAsSaved, profileDraft]);

  const pickProfileImage = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    const uri = result.assets?.[0]?.uri;
    if (!uri) return;
    await AsyncStorage.setItem(RECORD_ROOM_IMAGE_KEY, uri);
    setProfileImageUri(uri);
  }, []);

  const openHofGoal = useCallback(() => {
    resetGuard();
    setHofGoalDraft(String(hofGoal));
    setHofGoalVisible(true);
  }, [hofGoal, resetGuard]);

  const closeHofGoalModal = useCallback(() => {
    const close = () => {
      setHofGoalDraft(String(hofGoal));
      setHofGoalVisible(false);
    };

    if (!hasModalUnsavedChanges()) {
      close();
      return;
    }

    confirmCloseModal(close);
  }, [confirmCloseModal, hasModalUnsavedChanges, hofGoal]);

  const saveHofGoal = useCallback(() => {
    confirmSave({
      title: '저장하시겠습니까?',
      message: '명예의 전당 목표를 저장할까요?',
      onConfirm: async () => {
        const nextGoal = normalizeHofGoalValue(hofGoalDraft);
        await AsyncStorage.setItem(RECORD_ROOM_HOF_GOAL_KEY, String(nextGoal));
        setHofGoal(nextGoal);
        setHofGoalDraft(String(nextGoal));
        markAsSaved();
        setHofGoalVisible(false);
      },
    });
  }, [confirmSave, hofGoalDraft, markAsSaved]);

  const openRecordRoomLayoutEdit = useCallback(() => {
    navigation.navigate('DashboardEdit', {
      target: 'recordRoom',
      dashboardTarget: 'recordRoom',
      title: '내 기록실',
    });
  }, [navigation]);

  const recordRoomItemMap = useMemo(() => {
    const sourceItems = [
    { id: 'profile-image', render: () => <ProfileImageCard imageUri={profileImageUri} onPress={pickProfileImage} /> },
    { id: 'profile-info', render: () => <ProfileInfoCard profile={profileInfo} onPress={openProfile} /> },
    { id: 'total-cards', render: () => <KpiCard label="현재 도전/기록" value={stats.totalCards} note={`도전 ${stats.challengeCount} · 기록 ${stats.recordCount}`} dark /> },
    { id: 'hall-count', render: () => <KpiCard label="명예의 전당" value={stats.completedCount} note="완료 카드" /> },
    { id: 'stars', render: () => <KpiCard label="별 갯수" value={stats.stars} note="현재 보유" icon="★" /> },
    { id: 'today-count', render: () => <KpiCard label="오늘 기록" value={stats.todayCount} note="오늘 인증/기록" /> },
    { id: 'deleted-count', render: () => <KpiCard label="삭제 갯수" value={stats.deletedCount} note={stats.hasTrashSource ? '휴지통 기준' : '이력 없음'} /> },
    { id: 'expired-fail', render: () => <KpiCard label="만료 실패" value={stats.expiredFailedCount} note="미완료 만료" /> },
    { id: 'weekly-bars', render: () => <WeeklyBarCard data={stats.weekly} label={stats.weekLabel} onPrev={() => setWeekOffset((v) => v - 1)} onNext={() => setWeekOffset((v) => Math.min(0, v + 1))} /> },
    { id: 'ratio-donut', render: () => <RatioDonutCard challengeCount={stats.challengeCount} recordCount={stats.recordCount} /> },
    { id: 'token-line', render: () => <TokenTrendCard data={stats.starHistory} stars={stats.stars} /> },
    { id: 'calendar', render: () => <CalendarCard days={stats.calendarDays} label={stats.calendarLabel} onPrev={() => setCalendarMonthOffset((v) => v - 1)} onNext={() => setCalendarMonthOffset((v) => Math.min(0, v + 1))} /> },
    { id: 'heatmap', render: () => <HeatmapCard data={stats.heatmap} label={stats.weekLabel} onPrev={() => setWeekOffset((v) => v - 1)} onNext={() => setWeekOffset((v) => Math.min(0, v + 1))} /> },
    { id: 'monthly-bars', render: () => <MonthlyBarCard data={stats.monthly} /> },
    { id: 'hall-battery', render: () => <HallBatteryCard completedCount={stats.completedCount} goal={stats.hofGoal} progress={stats.hofProgress} onPress={openHofGoal} /> },
    { id: 'connect-status', render: () => <ConnectStatusCard /> },
    { id: 'memo', render: () => <MemoCard memo={memo} onPress={openMemo} /> },
    { id: 'record-room-card-list', render: () => <CardListSection cards={cards} hallCards={hallCards} /> },
    ];
    return new Map(sourceItems.map((item) => [item.id, item]));
  }, [cards, hallCards, stats, memo, openMemo, profileImageUri, pickProfileImage, profileInfo, openProfile, openHofGoal]);

  const dashboardItems = useMemo(() => {
    const sourceLayout =
      Array.isArray(recordRoomLayout) && recordRoomLayout.length > 0
        ? recordRoomLayout
        : getDefaultDashboardLayout(RECORD_ROOM_DASHBOARD_TARGET);
    return sourceLayout
      .map((layoutItem, index) => {
        const widgetId = layoutItem?.widgetId || layoutItem?.id;
        const sourceItem = recordRoomItemMap.get(widgetId);
        if (!widgetId || !sourceItem) return null;
        const safeW = Math.max(1, Math.min(PHONE_GRID_COLUMNS, Number(layoutItem?.w) || PHONE_GRID_COLUMNS));
        const safeH = Math.max(1, Number(layoutItem?.h) || 1);
        const safeX = Math.max(0, Math.min(PHONE_GRID_COLUMNS - safeW, Number(layoutItem?.x) || 0));
        const safeY = Number.isFinite(Number(layoutItem?.y)) ? Math.max(0, Number(layoutItem.y)) : index;
        return { ...sourceItem, id: widgetId, widgetId, x: safeX, y: safeY, w: safeW, h: safeH };
      })
      .filter(Boolean)
      .sort((a, b) => (a.y - b.y) || (a.x - b.x));
  }, [recordRoomLayout, recordRoomItemMap, columns]);

  const dashboardRows = useMemo(() => {
    if (!Array.isArray(dashboardItems) || dashboardItems.length === 0) {
      return [];
    }

    if (columns <= PHONE_GRID_COLUMNS) {
      return [];
    }

    const rows = [];
    let currentRow = [];
    let currentWidth = 0;

    dashboardItems.forEach((item) => {
      const itemW = Math.max(1, Math.min(PHONE_GRID_COLUMNS, Number(item?.w) || PHONE_GRID_COLUMNS));
      const nextItem = { ...item, w: itemW };

      if (currentRow.length > 0 && currentWidth + itemW > columns) {
        rows.push(currentRow);
        currentRow = [];
        currentWidth = 0;
      }

      currentRow.push(nextItem);
      currentWidth += itemW;
    });

    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    return rows;
  }, [dashboardItems, columns]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerSideBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>MY</Text>
        <View style={styles.headerSideBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.recordRoomInternalTitle}>내 기록실</Text>
<TouchableOpacity
              onPress={openRecordRoomLayoutEdit}
              activeOpacity={0.85}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="기록실 배치 수정"
            >
              <RecordRoomEditIcon />
            </TouchableOpacity>
          </View>
        </View>


        <View
          key={`record-room-grid-${recordRoomLayoutKey}-${columns}`}
          style={[styles.gridWrap, { rowGap: recordRoomRowGap }]}
          onLayout={(event) => setRecordRoomFrameWidth(event.nativeEvent.layout.width || 0)}
        >
          {columns > PHONE_GRID_COLUMNS
            ? dashboardRows.map((row, rowIndex) => (
                <View key={`record-room-row-${rowIndex}`} style={styles.gridRow}>
                  {row.map((item) => (
                    <GridItem key={item.id} item={item} columns={columns}>
                      {item.render()}
                    </GridItem>
                  ))}
                </View>
              ))
            : dashboardItems.map((item) => (
                <GridItem key={item.id} item={item} columns={PHONE_GRID_COLUMNS}>
                  {item.render()}
                </GridItem>
              ))}
        </View>


      </ScrollView>

      <TouchableOpacity
        style={[styles.shopFloatingBtn, { bottom: Math.max(insets.bottom, 16) + CARD_GAP }]}
        onPress={() => navigation.navigate('GraphShop')}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel="상점 열기"
      >
        <Text style={styles.shopFloatingText}>상점</Text>
      </TouchableOpacity>

      <Modal visible={memoVisible} transparent animationType="fade" onRequestClose={closeMemoModal}>
        <TouchableWithoutFeedback onPress={closeMemoModal}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>
        <View style={styles.memoModalCard}>
          <Text style={styles.memoModalTitle}>메모</Text>
          <TextInput
            value={memoDraft}
            onChangeText={setMemoDraft}
            multiline
            textAlignVertical="top"
            placeholder="나에게 남기고 싶은 말이나 다짐을 적어보세요."
            placeholderTextColor={colors.textTertiary}
            style={styles.memoInput}
          />
          <View style={styles.memoModalActions}>
            <TouchableOpacity style={styles.memoCancelBtn} onPress={closeMemoModal} activeOpacity={0.85}>
              <Text style={styles.memoCancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.memoSaveBtn} onPress={saveMemo} activeOpacity={0.9}>
              <Text style={styles.memoSaveText}>저장</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={profileVisible} transparent animationType="fade" onRequestClose={closeProfileModal}>
        <TouchableWithoutFeedback onPress={closeProfileModal}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>
        <View style={styles.memoModalCard}>
          <Text style={styles.memoModalTitle}>내 정보 수정</Text>
          <TextInput
            value={profileDraft.name}
            onChangeText={(value) => setProfileDraft((prev) => ({ ...prev, name: value }))}
            placeholder="이름 또는 별명"
            placeholderTextColor={colors.textTertiary}
            style={styles.profileInput}
          />
          <TextInput
            value={profileDraft.headline}
            onChangeText={(value) => setProfileDraft((prev) => ({ ...prev, headline: value }))}
            placeholder="나를 밀어주는 한 문장"
            placeholderTextColor={colors.textTertiary}
            style={styles.profileInput}
          />
          <TextInput
            value={profileDraft.bio}
            onChangeText={(value) => setProfileDraft((prev) => ({ ...prev, bio: value }))}
            multiline
            textAlignVertical="top"
            placeholder="목표, 다짐, 나에 대한 설명을 적어보세요."
            placeholderTextColor={colors.textTertiary}
            style={[styles.memoInput, { minHeight: 120 }]}
          />
          <View style={styles.memoModalActions}>
            <TouchableOpacity style={styles.memoCancelBtn} onPress={closeProfileModal} activeOpacity={0.85}>
              <Text style={styles.memoCancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.memoSaveBtn} onPress={saveProfile} activeOpacity={0.9}>
              <Text style={styles.memoSaveText}>저장</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={hofGoalVisible} transparent animationType="fade" onRequestClose={closeHofGoalModal}>
        <TouchableWithoutFeedback onPress={closeHofGoalModal}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>
        <View style={styles.memoModalCard}>
          <Text style={styles.memoModalTitle}>명예의 전당 목표</Text>
          <TextInput
            value={hofGoalDraft}
            onChangeText={setHofGoalDraft}
            keyboardType="number-pad"
            placeholder="목표 갯수"
            placeholderTextColor={colors.textTertiary}
            style={styles.profileInput}
          />
          <View style={styles.memoModalActions}>
            <TouchableOpacity style={styles.memoCancelBtn} onPress={closeHofGoalModal} activeOpacity={0.85}>
              <Text style={styles.memoCancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.memoSaveBtn} onPress={saveHofGoal} activeOpacity={0.9}>
              <Text style={styles.memoSaveText}>저장</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSideBtn: {
    width: 44,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backText: { fontSize: 34, color: colors.textPrimary, fontWeight: '300', lineHeight: 34 },
  starPill: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignSelf: 'center',
    marginHorizontal: 110,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 7,
  },
  starIcon: { color: colors.textInverse, fontSize: 15, fontWeight: '900' },
  starText: { color: colors.textInverse, fontSize: 16, fontWeight: '900' },
  shopFloatingBtn: {
    position: 'absolute',
    right: 12,
    backgroundColor: colors.primary,
    borderRadius: 14,
    width: 52,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  shopFloatingText: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: '900',
    includeFontPadding: false,
  },
  recordRoomInternalTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
  },



  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -CARD_GAP / 2,
  },
  gridRow: {
    width: '100%',
    flexDirection: 'row',
  },
  gridItem: {
    paddingHorizontal: CARD_GAP / 2,
    paddingBottom: CARD_GAP,
  },
  dashboardCard: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    shadowColor: colors.primary,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  dashboardCardDark: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  cardHeader: {
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '900',
  },
  cardTitleDark: {
    color: colors.textInverse,
  },
  cardSubtitle: {
    marginTop: 3,
    fontSize: 10.5,
    color: colors.textTertiary,
    fontWeight: '700',
  },
  cardSubtitleDark: {
    color: colors.gray300,
  },
  cardBody: {
    flex: 1,
    minHeight: 0,
  },
  kpiCard: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  kpiLabel: {
    fontSize: 10.5,
    color: colors.textSecondary,
    fontWeight: '900',
    lineHeight: 13,
  },
  kpiLabelDark: {
    color: colors.border,
  },
  kpiValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  kpiIcon: {
    marginRight: 5,
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '900',
  },
  kpiValue: {
    flexShrink: 1,
    fontSize: 22,
    color: colors.textPrimary,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 25,
  },
  kpiValueDark: {
    color: colors.textInverse,
  },
  kpiNote: {
    fontSize: 9.5,
    color: colors.textTertiary,
    fontWeight: '700',
    lineHeight: 12,
  },
  kpiNoteDark: {
    color: colors.gray300,
  },
  profileImageTouchable: {
    width: '100%',
    height: '100%',
  },
  profileImageBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePhoto: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: colors.surfaceMuted,
  },
  profileAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileAvatarHead: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  profileAvatarBody: {
    width: 48,
    height: 28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  profileImageText: {
    marginTop: 10,
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '700',
    textAlign: 'center',
  },
  profileInfoTouchable: {
    width: '100%',
    height: '100%',
  },
  profileInfoName: {
    fontSize: 13,
    color: colors.textTertiary,
    fontWeight: '800',
    marginBottom: 6,
  },
  profileInfoMain: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  profileInfoSub: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  profileEditHint: {
    marginTop: 10,
    fontSize: 11,
    color: colors.textDisabled,
    fontWeight: '800',
  },
  infoPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  infoPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  infoPillText: {
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  infoPillDark: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  infoPillDarkText: {
    fontSize: 11,
    color: colors.textInverse,
    fontWeight: '900',
  },
  cardPagerRow: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xxs,
  },
  cardPagerBtn: {
    width: 26,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPagerText: {
    fontSize: 22,
    lineHeight: 22,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  cardPagerLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: colors.gray600,
    fontWeight: '800',
  },
  barChartRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barTrack: {
    width: 13,
    height: 98,
    borderRadius: 7,
    backgroundColor: '#F3F4F6',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
    backgroundColor: '#111',
  },
  chartSmallValue: {
    marginTop: 5,
    fontSize: 10,
    color: colors.gray700,
    fontWeight: '800',
  },
  chartAxisLabel: {
    marginTop: 2,
    fontSize: 10,
    color: colors.gray400,
    fontWeight: '700',
  },
  donutRow: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutTextLayer: {
    position: 'absolute',
    alignItems: 'center',
  },
  donutMainText: {
    fontSize: 22,
    color: '#111',
    fontWeight: '900',
  },
  donutSubText: {
    fontSize: 10,
    color: colors.gray500,
    fontWeight: '800',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 2,
  },
  legendText: {
    fontSize: 11,
    color: colors.gray600,
    fontWeight: '800',
  },
  emptyCardText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111',
  },
  emptyCardSubText: {
    marginTop: 6,
    fontSize: 11,
    color: colors.gray500,
    fontWeight: '700',
    lineHeight: 15,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarWeekLabel: {
    width: '14.2857%',
    marginBottom: 6,
    textAlign: 'center',
    fontSize: 10,
    color: colors.gray400,
    fontWeight: '800',
  },
  calendarCell: {
    width: '14.2857%',
    aspectRatio: 1,
    borderRadius: 8,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarCellBlank: {
    backgroundColor: 'transparent',
  },
  calendarCellText: {
    fontSize: 10,
    color: colors.gray400,
    fontWeight: '700',
  },
  calendarCellTextActive: {
    color: '#fff',
    fontWeight: '900',
  },
  heatmapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  heatmapDayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    color: colors.gray400,
    fontWeight: '800',
  },
  heatmapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  heatmapTimeLabel: {
    width: 34,
    fontSize: 10,
    color: colors.gray500,
    fontWeight: '800',
  },
  heatmapCell: {
    flex: 1,
    height: 18,
    borderRadius: 5,
    marginHorizontal: 2,
  },
  monthlyBarRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  monthlyColumn: {
    flex: 1,
    alignItems: 'center',
  },
  monthlyTrack: {
    width: 18,
    height: 104,
    borderRadius: 9,
    backgroundColor: '#F3F4F6',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  monthlyFill: {
    width: '100%',
    borderRadius: 9,
    backgroundColor: '#111',
  },
  goalTouchable: {
    width: '100%',
    height: '100%',
  },
  goalBarTrack: {
    width: '100%',
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    marginTop: 8,
  },
  goalBarFill: {
    height: '100%',
    borderRadius: 11,
    backgroundColor: '#111',
  },
  batteryOuter: {
    marginTop: 4,
    height: 40,
    borderWidth: 2,
    borderColor: '#111',
    borderRadius: 12,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  batteryCells: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    gap: 3,
  },
  batteryCell: {
    flex: 1,
    borderRadius: 5,
    backgroundColor: '#E5E7EB',
  },
  batteryCellFilled: {
    backgroundColor: '#111',
  },
  batteryHead: {
    width: 5,
    height: 18,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: '#111',
    marginLeft: 4,
    marginRight: -9,
  },
  batteryText: {
    marginTop: 10,
    fontSize: 12,
    color: colors.gray600,
    fontWeight: '800',
  },
  connectRow: {
    minHeight: 30,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  connectTitle: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  connectStatus: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '800',
  },
  memoTouchable: {
    width: '100%',
    height: '100%',
  },
  memoText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '700',
    lineHeight: 19,
  },
  memoPlaceholder: {
    fontSize: 13,
    color: colors.textDisabled,
    fontWeight: '700',
    lineHeight: 19,
  },
  listSection: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    overflow: 'hidden',
  },
  listScroll: {
    flex: 1,
    minHeight: 0,
  },
  listTitle: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '900',
    marginBottom: 10,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tabButton: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabButtonText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '900',
  },
  tabButtonTextActive: {
    color: colors.textInverse,
  },
  listEmpty: {
    marginVertical: spacing.xl,
    textAlign: 'center',
    color: colors.textDisabled,
    fontWeight: '700',
  },
  listItem: {
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItemMain: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.md,
  },
  listItemTitle: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '900',
  },
  listItemTitleMuted: {
    color: colors.textDisabled,
  },
  listItemMeta: {
    marginTop: 3,
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '700',
  },
  listItemStatus: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '900',
  },
  listItemStatusMuted: {
    color: colors.textDisabled,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  memoModalCard: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: '22%',
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: 18,
  },
  memoModalTitle: {
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '900',
    marginBottom: spacing.md,
  },
  profileInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 10,
  },
  memoInput: {
    minHeight: 150,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
    lineHeight: 20,
  },
  memoModalActions: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  memoCancelBtn: {
    height: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoCancelText: {
    color: colors.textSecondary,
    fontWeight: '900',
  },
  memoSaveBtn: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoSaveText: {
    color: colors.textInverse,
    fontWeight: '900',
  },
});
