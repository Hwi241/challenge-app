// screens/ChallengeListScreen.js
import React, { useEffect, useState, useCallback, memo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, Alert, BackHandler, Platform, FlatList, UIManager, LayoutAnimation, Animated, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { SafeAreaView,  useSafeAreaInsets  } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { buttonStyles, colors, spacing, radius } from '../styles/common';
import { cancelAllForChallenge } from '../utils/notificationScheduler';
import GearIcon from '../assets/icons/gear.svg';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ---------- 상수 ---------- */
const CARD_BORDER = '#E5E7EB';
const ARROW_SIZE = 40;
const ARROW_GAP = 12;
const CONTROLS_H = 44;
const ORDER_KEY = 'ch_order';
const CHALLENGES_KEY = 'challenges';

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
  return { _isDone: !!done, _completedAt: c?.completedAt ?? 0 };
}

/**
 * 정렬 규칙
 * - mode='respectArray'  : 들어온 배열에서 활성 카드 등장 순서를 그대로 사용하여 저장(저장 시 사용)
 * - mode='respectMap'    : orderMap 기반으로 활성 카드를 재정렬(로드 시 사용)
 * - 완료 카드는 항상 아래로 보내고, 완료 섹션은 completedAt desc
 */
function normalizeWithOrder(arrRaw = [], orderMapIn = {}, mode = 'respectMap') {
  const raw = (arrRaw || []).map((c, i) => ({ ...ensureItemId(c, i), ...asDoneFlags(c) }));

  const done = raw.filter(c => c._isDone || c.archived).map(c => ({ ...c, archived: true }));
  const active = raw.filter(c => !(c._isDone || c.archived));

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
    mergedActive = [...known.map(k => k.item), ...unknown];

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
  const arranged = [...activeNormalized, ...doneSorted];

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
    <Text style={styles.emptyText}>새로운 도전을 응원합니다!</Text>
  </View>
));

/* ---------- 카드 UI ---------- */
function CardBody({
  item,
  showControls,
  canReorder,
  onPressCard,
  onPressEdit,
  onPressDuplicate,
  onPressDelete,
  onPressClaim,
  onLongPress,
}) {
  const isDone = !!item._isDone;
  const pct = Math.min(100, Math.max(0,
    item.goalScore > 0 ? Math.round((item.currentScore / item.goalScore) * 100) : 0
  ));

  const Content = (
    <View style={[styles.cardContent, isDone && styles.dimmedContent]}>
      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
        <Text style={[styles.title, { flex:1, marginRight: 8 }]} numberOfLines={2}>
          {item.title ?? '(제목 없음)'}
        </Text>
        <View style={styles.pctCircleWrap}>
          <Svg width={26} height={26}>
            <Circle cx={13} cy={13} r={9} stroke="#E5E7EB" strokeWidth={4.5} fill="none" />
            <Circle
              cx={13} cy={13} r={9}
              stroke="#111" strokeWidth={4.5} fill="none"
              strokeDasharray={`${(pct/100)*(2*Math.PI*9)} ${2*Math.PI*9}`}
              strokeLinecap="round"
              rotation="-90" origin="13,13"
            />
          </Svg>
          <Text style={styles.pctCircleLabel}>{pct}%</Text>
        </View>
      </View>

      <View style={styles.metaWrap}>
        <Text style={styles.meta}>기간 {item.startDate ?? '-'} ~ {item.endDate ?? '-'}</Text>
        <Text style={styles.meta}>진행 {item.currentScore ?? 0} / {item.goalScore ?? 0}</Text>
        {!!(item.rewardTitle || item.reward) && (
          <Text style={styles.meta}>보상 {item.rewardTitle ?? item.reward}</Text>
        )}
      </View>

      <View style={styles.controlsRow}>
        <View style={[styles.arrowsInline, !showControls && { opacity: 0 }]}>
          <TouchableOpacity
            onPress={showControls && canReorder ? () => onPressCard?.({ ...item, __move: 'up' }) : undefined}
            activeOpacity={0.9}
            style={styles.circleArrowSmall}
          >
            <Text style={styles.circleArrowTxt}>↑</Text>
          </TouchableOpacity>
          <View style={{ width: ARROW_GAP }} />
          <TouchableOpacity
            onPress={showControls && canReorder ? () => onPressCard?.({ ...item, __move: 'down' }) : undefined}
            activeOpacity={0.9}
            style={styles.circleArrowSmall}
          >
            <Text style={styles.circleArrowTxt}>↓</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.actionsRight, !showControls && { opacity: 0 }]}>
          <TouchableOpacity style={styles.actionDarkBtn} onPress={showControls ? () => onPressEdit?.(item) : undefined} activeOpacity={0.9}>
            <Text style={styles.actionDarkText}>수정</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionDarkBtn} onPress={showControls ? () => onPressDuplicate?.(item) : undefined} activeOpacity={0.9}>
            <Text style={styles.actionDarkText}>복제</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionDarkBtn} onPress={showControls ? () => onPressDelete?.(item) : undefined} activeOpacity={0.9}>
            <Text style={styles.actionDarkText}>삭제</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPressCard?.(item)}
      onLongPress={(!showControls && !isDone) ? onLongPress : undefined}
      delayLongPress={160}
      style={[
        styles.card,
        showControls && styles.selectedCard
      ]}
    >
      {Content}

      {!isDone ? (
        <TouchableOpacity
          style={[styles.uploadNowBtn, showControls && styles.disabledBig]}
          disabled={!!showControls}
          onPress={() => onPressCard?.({ ...item, _upload: true })}
          activeOpacity={0.9}
        >
          <Text style={styles.uploadNowText}>인증하기</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.outlineBigBtn, showControls && styles.disabledBig]}
          disabled={!!showControls}
          onPress={() => onPressClaim?.(item)}
          activeOpacity={1}
        >
          <Text style={styles.outlineBigText}>보상 받기</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

/* ---------- 리스트 셀 ---------- */
const ItemCard = memo(React.forwardRef(function ItemCard({
  item, hidden,
  onLongPress,
  onPressCard, onPressEdit, onPressDuplicate, onPressDelete, onPressClaim,
}, ref) {
  return (
    <View ref={ref} style={[styles.cardWrap, hidden && { opacity: 0 }]}>
      <CardBody
        item={item}
        showControls={false}
        canReorder={!asDoneFlags(item)._isDone}
        onPressCard={onPressCard}
        onPressEdit={onPressEdit}
        onPressDuplicate={onPressDuplicate}
        onPressDelete={onPressDelete}
        onPressClaim={onPressClaim}
        onLongPress={onLongPress}
      />
    </View>
  );
}));

/* ---------- 화면 ---------- */
export default function ChallengeListScreen() {
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState([]);

  /* 정렬 상태 */
  const [reorderActive, setReorderActive] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  /* 플로팅 복제 */
  const floatLeft = useRef(new Animated.Value(0)).current;
  const floatTop  = useRef(new Animated.Value(0)).current;
  const floatWidthRef = useRef(0);

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

      const orderMap = await readOrderMap();
      const { arranged, newOrderMap } = normalizeWithOrder(deduped, orderMap, 'respectMap');

      console.log('[ChallengeList][load] rawIds=', (raw||[]).map(it=>safeStringId(it?.id||it?.challengeId)));
      console.log('[ChallengeList][load] arrangedIds=', arranged.map(c => `${c._isDone?'D':'A'}:${safeStringId(c.id)}`));

      setData(arranged);
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
    })();
  }, [isFocused, persistChallenges]);

  /* 뒤로가기 */
  const finalizeReorder = useCallback(async () => {
    LayoutAnimation.configureNext({ duration: 180, update: { type: LayoutAnimation.Types.easeInEaseOut } });
    const snapshot = dataRef.current || [];
    console.log('[ChallengeList][finalizeReorder] snapshotIds=', snapshot.map(c => `${c._isDone?'D':'A'}:${safeStringId(c.id)}`));
    try { await persistChallenges(snapshot, 'finalize'); } catch {}
    setSelectedId(null);
    setReorderActive(false);
    animLockRef.current = false;
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

  /* 좌표 측정 */
  const measureNow = useCallback((id) => {
    const ref = itemRefs.current[safeStringId(id)];
    if (!ref || !ref.measureInWindow) return false;
    let did = false;
    ref.measureInWindow((x, y, width) => {
      did = true;
      floatLeft.setValue(x);
      floatTop.setValue(y);
      floatWidthRef.current = width;
    });
    return did;
  }, [floatLeft, floatTop, insets.top]);

  const rafMeasureSelected = useCallback((id) => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => measureNow(id))));
  }, [measureNow]);

  /* CRUD/네비 */
  const navigationRef = useRef(navigation);

  const onDelete = useCallback(async (item) => {
    Alert.alert('삭제 확인', `'${item.title}' 도전을 삭제할까요?`, [
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
          try { await AsyncStorage.removeItem(`entries_${item.id}`); } catch {}
          await finalizeReorder();
        },
      },
    ]);
  }, [finalizeReorder, animateList, persistChallenges]);

  const onDuplicate = useCallback(async (item) => {
    if (asDoneFlags(item)._isDone) return;
    animateList();

    const prev = dataRef.current || [];
    const copy = {
      ...ensureItemId(item),
      id: `ch_${Date.now()}`,
      title: `${item.title} (복제)`,
      currentScore: 0,
      status: 'active',
      createdAt: Date.now(),
      completedAt: undefined,
      sortIndex: 0,
      _isDone: false,
      _completedAt: 0,
      archived: false,
    };
    const nextArr = [copy, ...prev];

    console.log('[ChallengeList][onDuplicate] nextArrIds=', nextArr.map(c => `${c._isDone?'D':'A'}:${safeStringId(c.id)}`));

    setData(nextArr);
    try { await persistChallenges(nextArr, 'duplicate'); } catch {}
    await finalizeReorder();
  }, [persistChallenges, finalizeReorder, animateList]);

  const goEntryList = useCallback((item) => {
    if (item?._upload) { navigationRef.current.navigate('Upload', { challengeId: item.id }); return; }
    navigationRef.current.navigate('EntryList', {
      challengeId: item.id,
      title: item.title,
      startDate: item.startDate,
      endDate: item.endDate,
      targetScore: item.goalScore,
      rewardTitle: item.rewardTitle,
      reward: item.reward,
    });
  }, []);

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

    const enriched = nextArr.map(c => ({ ...c, ...asDoneFlags(c) }));
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

    const prev = dataRef.current || [];
    const idx = prev.findIndex(c => safeStringId(c.id) === safeStringId(selectedId));
    if (idx < 0) { animLockRef.current = false; return; }

    const minIdx = 0;
    const maxIdx = Math.max(0, activeCount - 1);
    const to = Math.max(minIdx, Math.min(maxIdx, idx + (dir === 'up' ? -1 : +1)));
    if (to === idx) { animLockRef.current = false; return; }

    LayoutAnimation.configureNext({ duration: 180, update: { type: LayoutAnimation.Types.easeInEaseOut } });

    const nextArr = moveInArray(prev, idx, to);

    console.log('[ChallengeList][moveSelected]', { selectedId, dir, from: idx, to, activeCount });

    setData(nextArr);
    (async () => { try { await persistChallenges(nextArr, 'move'); } catch {} })();

    setTimeout(() => {
      const ref = itemRefs.current[safeStringId(selectedId)];
      if (ref && ref.measureInWindow) {
        ref.measureInWindow((_x, y) => {
          const nextTop = y;
          Animated.timing(floatTop, {
            toValue: nextTop,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start(() => { animLockRef.current = false; });
        });
      } else {
        animLockRef.current = false;
      }
    }, 16);
  }, [reorderActive, selectedId, activeCount, insets.top, floatTop, persistChallenges]);

  const enterReorder = useCallback((item) => {
    if (asDoneFlags(item)._isDone) {
      Alert.alert('안내', '완료된 도전은 순서를 변경할 수 없어요.');
      return;
    }
    setSelectedId(item.id);
    const ok = measureNow(item.id);
    setReorderActive(true);
    console.log('[ChallengeList][enterReorder] id=', safeStringId(item.id), 'okMeasure=', ok);
    if (!ok) rafMeasureSelected(item.id);
  }, [measureNow, rafMeasureSelected]);

  const onOverlayPress = useCallback(() => { finalizeReorder(); }, [finalizeReorder]);

  /* 렌더 */
  const keyExtractor = useCallback((it) => safeStringId(it?.id ?? it?.challengeId ?? it?.uuid ?? it?.key ?? ''), []);
  const listBottomPad = spacing.xxl + Math.max(insets.bottom, 12);

  const renderRow = useCallback(
    ({ item }) => {
      const id = safeStringId(item.id);
      const isSelected = reorderActive && id === safeStringId(selectedId);

      return (
        <ItemCard
          ref={(el) => { if (el) itemRefs.current[id] = el; }}
          item={item}
          hidden={isSelected && reorderActive}
          onLongPress={() => enterReorder(item)}
          onPressCard={(it) => {
            if (reorderActive) return;
            if (it?._upload) { navigationRef.current.navigate('Upload', { challengeId: it.id }); return; }
            goEntryList(it);
          }}
          onPressEdit={() => {}}
          onPressDuplicate={() => {}}
          onPressDelete={() => {}}
          onPressClaim={onClaimReward}
        />
      );
    },
    [reorderActive, selectedId, goEntryList, enterReorder, onClaimReward]
  );

  const selected = data.find(d => safeStringId(d.id) === safeStringId(selectedId));

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>THE - PUSH</Text>
        <TouchableOpacity
          style={[buttonStyles.compactRight, styles.headerRight, styles.hofBtn]}
          onPress={() => navigationRef.current.navigate('HallOfFameScreen')}
          activeOpacity={0.9}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          disabled={reorderActive}
        >
          <Text style={[buttonStyles.compactRightText, styles.hofBtnText]}>명예의 전당</Text>
        </TouchableOpacity>
      </View>

      {/* 리스트 */}
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderRow}
        scrollEnabled={!reorderActive}
        removeClippedSubviews={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: listBottomPad }}
        ListEmptyComponent={EmptyState}
        initialNumToRender={12}
        windowSize={15}
      />

      {/* 플로팅 버튼 */}
      <View pointerEvents="box-none" style={[styles.addFloatingWrap, { bottom: Math.max(insets.bottom, 8) + spacing.lg }]}>
        <TouchableOpacity
          style={styles.addFab}
          onPress={() => navigationRef.current.navigate('AddChallenge', { resetNonce: Date.now() })}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={reorderActive}
        >
          <Text allowFontScaling={false} style={styles.addFabPlus}>+</Text>
        </TouchableOpacity>
      </View>

      <View pointerEvents="box-none" style={[styles.settingsFloatingWrap, { bottom: Math.max(insets.bottom, 8) + spacing.lg }]}>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => navigationRef.current.navigate('Settings')}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={reorderActive}
        >
          <GearIcon width={52} height={52} fill={colors.gray600} />
        </TouchableOpacity>
      </View>

      {/* 정렬 스크림 */}
      {reorderActive && (
        <TouchableWithoutFeedback onPress={onOverlayPress}>
          <View style={styles.fullOverlay} />
        </TouchableWithoutFeedback>
      )}

      {/* 정렬 중 선택 카드 복제본 */}
      {reorderActive && selected && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.floatingCardWrap,
            { left: floatLeft, top: floatTop, width: floatWidthRef.current },
          ]}
        >
          <CardBody
            item={selected}
            showControls
            canReorder={!asDoneFlags(selected)._isDone}
            onPressCard={(it) => {
              if (it?.__move === 'up') { moveSelected('up'); return; }
              if (it?.__move === 'down') { moveSelected('down'); return; }
            }}
            onPressEdit={(it) => { finalizeReorder(); navigationRef.current.navigate('EditChallenge', { challenge: it }); }}
            onPressDuplicate={(it) => { onDuplicate(it); finalizeReorder(); }}
            onPressDelete={(it) => { onDelete(it); }}
            onPressClaim={() => {}}
            onLongPress={undefined}
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

/* ---------- 스타일 ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    position: 'relative',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.gray800, textAlign: 'center' },
  headerRight: { position: 'absolute', right: spacing.lg, top: '50%', transform: [{ translateY: -12 }] },
  hofBtn: { paddingVertical: 4, paddingHorizontal: 10, marginTop: 15 },
  hofBtnText: { fontSize: 13, fontWeight: '700' },

  /* 카드 */
  cardWrap: { marginTop: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: CARD_BORDER,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  cardContent: { },
  dimmedContent: { opacity: 0.55 },

  pctCircleWrap: { alignItems:'center', justifyContent:'center', position:'relative', width:26, height:26 },
  pctCircleLabel: { position:'absolute', fontSize:6, fontWeight:'800', color:'#111', textAlign:'center', includeFontPadding:false },

  uploadNowBtn: {
    marginTop: 10, height: 48, borderRadius: 14,
    backgroundColor: '#111', alignItems:'center', justifyContent:'center',
  },
  uploadNowText: { fontSize:16, fontWeight:'800', color:'#fff' },

  selectedCard: { borderColor: CARD_BORDER, borderWidth: 1 },
  title: { fontSize: 16, fontWeight: '800', color: colors.gray800 },
  metaWrap: { marginTop: 6 },
  meta: { fontSize: 12, color: colors.gray600, marginTop: 2 },

  controlsRow: { marginTop: spacing.sm, minHeight: CONTROLS_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  arrowsInline: { flexDirection: 'row', alignItems: 'center', height: CONTROLS_H },
  circleArrowSmall: {
    width: ARROW_SIZE, height: ARROW_SIZE, borderRadius: 20,
    backgroundColor: colors.black, borderWidth: 1, borderColor: colors.black,
    alignItems: 'center', justifyContent: 'center',
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 2 },
  },
  circleArrowTxt: { color: colors.background, fontSize: 18, fontWeight: '900', lineHeight: 18, includeFontPadding: false },

  actionsRight: { flexDirection: 'row', alignItems: 'center', columnGap: 8, height: CONTROLS_H },
  actionDarkBtn: {
    backgroundColor: colors.black, borderWidth: 1, borderColor: colors.black,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md,
  },
  actionDarkText: { color: colors.background, fontSize: 12, fontWeight: '800' },

  bigActionBtn: { marginTop: spacing.sm, alignSelf: 'stretch', paddingVertical: 14, borderRadius: radius.lg },
  bigActionText: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  disabledBig: { opacity: 0.5 },

  outlineBigBtn: {
    backgroundColor: colors.background,
    borderWidth: 2, borderColor: '#000',
    borderRadius: radius.lg, paddingVertical: 14, alignSelf: 'stretch', marginTop: spacing.sm,
  },
  outlineBigText: { color: '#000', fontSize: 16, fontWeight: '800', textAlign: 'center' },

  /* 빈 상태 */
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  emptyText: { fontSize: 14, color: colors.gray400 },

  /* 플로팅 버튼들 */
  addFloatingWrap: { position: 'absolute', right: spacing.lg },
  addFab: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: colors.black,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  addFabPlus: { color: colors.background, fontSize: 25, fontWeight: '900', lineHeight: 28, includeFontPadding: false },

  settingsFloatingWrap: { position: 'absolute', left: spacing.lg },
  settingsBtn: { backgroundColor: 'transparent', borderWidth: 0, padding: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  /* 정렬 스크림 */
  fullOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 2 },

  /* 선택 카드 복제본 */
  floatingCardWrap: { position: 'absolute', zIndex: 3, elevation: 12, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: {width:0, height:4} },
});