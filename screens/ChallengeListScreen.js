// screens/ChallengeListScreen.js
import React, { useEffect, useMemo, useState, useCallback, memo, useRef } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet,
  TouchableOpacity, Alert, BackHandler, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DraggableFlatList from 'react-native-draggable-flatlist';

import { buttonStyles, colors, spacing, radius } from '../styles/common';
import { cancelAllForChallenge } from '../utils/notificationScheduler';
import GearIcon from '../assets/icons/gear.svg';

const CARD_BORDER = '#E5E7EB';

/* ---------- 안전 유틸 ---------- */
async function readJsonArray(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function safeStringId(v) { return v == null ? '' : String(v); }
function dedupeById(arr = []) {
  const map = new Map();
  for (const it of arr) { if (!it || !it.id) continue; map.set(safeStringId(it.id), it); }
  return Array.from(map.values());
}
function moveInArray(arr, from, to) {
  const copy = [...arr];
  const [picked] = copy.splice(from, 1);
  copy.splice(to, 0, picked);
  return copy;
}

/* ---------- 카드 ---------- */
const ItemCard = memo(function ItemCard({
  item, onPressCard, onPressEdit, onPressDuplicate, onPressDelete, onPressClaim,
  onLongPress, isActiveDrag,
}) {
  const isDone = !!item._isDone;
  return (
    <View style={styles.cardWrap}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onPressCard(item)}
        onLongPress={isDone ? undefined : onLongPress}
        delayLongPress={160}
        style={[styles.card, isDone && styles.dimmed, isActiveDrag && styles.draggingCard]}
      >
        <Text style={styles.title}>{item.title}</Text>

        <View style={styles.metaWrap}>
          <Text style={styles.meta}>기간 {item.startDate ?? '-'} ~ {item.endDate ?? '-'}</Text>
          <Text style={styles.meta}>점수 {item.currentScore ?? 0} / {item.goalScore ?? 0}</Text>
          {!!(item.rewardTitle || item.reward) && (
            <Text style={styles.meta}>보상 {item.rewardTitle ?? item.reward}</Text>
          )}
        </View>

        <View style={styles.actionsRight}>
          <TouchableOpacity
            disabled={isDone}
            style={[styles.outlineBtn, isDone && styles.disabledBtn]}
            onPress={() => onPressEdit(item)}
          >
            <Text style={styles.outlineText}>{isDone ? '수정불가' : '수정'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={isDone}
            style={[styles.outlineBtn, isDone && styles.disabledBtn]}
            onPress={() => onPressDuplicate(item)}
          >
            <Text style={styles.outlineText}>{isDone ? '복제불가' : '복제'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.outlineBtn} onPress={() => onPressDelete(item)}>
            <Text style={styles.outlineText}>삭제</Text>
          </TouchableOpacity>
        </View>

        {!isDone ? (
          <TouchableOpacity
            style={[buttonStyles.primary.container, styles.bigActionBtn]}
            onPress={() => onPressCard({ ...item, _upload: true })}
            activeOpacity={0.9}
          >
            <Text style={[buttonStyles.primary.label, styles.bigActionText]}>인증하기</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.outlineBigBtn}
            onPress={() => onPressClaim(item)}
            activeOpacity={1}
          >
            <Text style={styles.outlineBigText}>보상 받기</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  );
});

/* ---------- 화면 ---------- */
export default function ChallengeListScreen() {
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [list, setList] = useState([]);
  const [uiData, setUiData] = useState([]); // 드래그시 깜빡임 방지용 표시 데이터
  const uiDataRef = useRef(uiData);
  useEffect(() => { uiDataRef.current = uiData; }, [uiData]);

  // 포커스 시 최신 데이터 로드 + sortIndex 초기화
  useEffect(() => {
    if (!isFocused) return;
    (async () => {
      const arr = dedupeById(await readJsonArray('challenges'));
      const decorated = arr.map((c) => ({
        ...c,
        sortIndex: Number.isFinite(c?.sortIndex) ? c.sortIndex : undefined,
      }));
      const done = decorated.filter(c => (c?.status === 'completed'));
      const active = decorated.filter(c => !(c?.status === 'completed'));
      const needInit = active.some(c => !Number.isFinite(c.sortIndex));
      if (needInit) {
        const activeInit = active
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
          .map((c, idx) => ({ ...c, sortIndex: idx }));
        const merged = [...done, ...activeInit];
        try { await AsyncStorage.setItem('challenges', JSON.stringify(merged)); } catch {}
        setList(merged);
      } else {
        try { await AsyncStorage.setItem('challenges', JSON.stringify(decorated)); } catch {}
        setList(decorated);
      }
    })().catch(console.error);
  }, [isFocused]);

  // 안드로이드 뒤로가기 → 종료 확인
  useEffect(() => {
    if (!isFocused || Platform.OS !== 'android') return;
    const onBackPress = () => {
      Alert.alert('앱 종료', '정말 종료할까요?', [
        { text: '취소', style: 'cancel' },
        { text: '종료', style: 'destructive', onPress: () => BackHandler.exitApp() },
      ]);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [isFocused]);

  const decorate = useCallback((c) => {
    const cs = Number(c?.currentScore ?? 0);
    const gs = Number(c?.goalScore ?? NaN);
    const hasValidGoal = Number.isFinite(gs) && gs > 0;
    const doneByScore = hasValidGoal && cs >= gs;
    const done = c?.status === 'completed' || doneByScore;
    return { ...c, _isDone: !!done, _completedAt: c?.completedAt ?? 0 };
  }, []);

  // 표시 순서: 완료(완료일 내림차순) + 진행중(sortIndex 오름차순/대체 createdAt)
  const sorted = useMemo(() => {
    const arr = (list || []).map(decorate);
    const done = arr.filter((c) => c._isDone)
      .sort((a, b) => (b._completedAt || 0) - (a._completedAt || 0));
    const active = arr.filter((c) => !c._isDone)
      .sort((a, b) => {
        const ai = Number.isFinite(a.sortIndex) ? a.sortIndex : -(a.createdAt || 0);
        const bi = Number.isFinite(b.sortIndex) ? b.sortIndex : -(b.createdAt || 0);
        return ai - bi;
      });
    return [...done, ...active];
  }, [list, decorate]);

  // 정렬 계산이 바뀌면 화면 데이터 동기화
  useEffect(() => { setUiData(sorted); }, [sorted]);

  const saveChallenges = useCallback(async (arr) => {
    const clean = dedupeById(Array.isArray(arr) ? arr : []);
    setList(clean); // 상태도 갱신(루트와 동기화)
    await AsyncStorage.setItem('challenges', JSON.stringify(clean));
  }, []);

  const onDelete = useCallback((item) => {
    Alert.alert('삭제 확인', `'${item.title}' 도전을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          try { await cancelAllForChallenge(item.id).catch(() => {}); } catch {}
          const next = (list || []).filter((c) => safeStringId(c.id) !== safeStringId(item.id));
          await saveChallenges(next);
          try { await AsyncStorage.removeItem(`entries_${item.id}`); } catch {}
        },
      },
    ]);
  }, [list, saveChallenges]);

  const onDuplicate = useCallback((item) => {
    if (item._isDone) return;
    Alert.alert('복제 확인', `'${item.title}' 도전을 복제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '복제', onPress: async () => {
          const current = dedupeById(await readJsonArray('challenges'));
          const dec = current.map(decorate);
          const active = dec.filter(c => !c._isDone);
          const shifted = active.map(c => ({ ...c, sortIndex: Number.isFinite(c.sortIndex) ? (c.sortIndex + 1) : 1 }));
          const copy = {
            ...item,
            id: `ch_${Date.now()}`,
            title: `${item.title} (복제)`,
            currentScore: 0,
            status: 'active',
            createdAt: Date.now(),
            completedAt: undefined,
            sortIndex: 0,
          };
          const done = dec.filter(c => c._isDone);
          const merged = [...done, copy, ...shifted];
          await saveChallenges(merged);
        },
      },
    ]);
  }, [saveChallenges]);

  const confirmClaimReward = useCallback((item) => {
    Alert.alert('보상 받기', `'${item.title}' 도전의 보상을 받으시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      { text: '확인', style: 'default', onPress: () => onClaimReward(item) },
    ]);
  }, []);

  const onClaimReward = useCallback(async (item) => {
    try {
      const current = dedupeById(await readJsonArray('challenges'));
      const next = current.filter(c => safeStringId(c.id) !== safeStringId(item.id));
      await AsyncStorage.setItem('challenges', JSON.stringify(next));
      setList(next);

      const hof = await readJsonArray('hallOfFame');
      const marked = { ...item, status: 'completed', completedAt: Date.now() };
      hof.unshift(marked);
      await AsyncStorage.setItem('hallOfFame', JSON.stringify(hof));
      await AsyncStorage.setItem('lastClaimedId', safeStringId(marked.id));

      try { await cancelAllForChallenge(item.id); } catch {}

      navigation.navigate('HallOfFameScreen', { fromClaim: true, recentId: marked.id });
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '보상 처리 중 문제가 발생했습니다.');
    }
  }, [navigation]);

  const goEntryList = useCallback((item) => {
    if (item?._upload) {
      navigation.navigate('Upload', { challengeId: item.id });
      return;
    }
    navigation.navigate('EntryList', {
      challengeId: item.id,
      title: item.title,
      startDate: item.startDate,
      endDate: item.endDate,
      targetScore: item.goalScore,
      rewardTitle: item.rewardTitle,
      reward: item.reward,
    });
  }, [navigation]);

  // ── 드래그 시작/종료 메타 (진행중 영역 경계 유지)
  const dragMetaRef = useRef({ doneCount: 0 });
  const handleDragBegin = useCallback(({ index }) => {
    const arr = uiDataRef.current || [];
    const doneCount = arr.filter(c => c._isDone).length;
    dragMetaRef.current = { doneCount, startIndex: index };
  }, []);

  // ── 드래그 종료: 화면 먼저 업데이트(깜빡임 최소화) → 진행중 블록 sortIndex 저장
  const handleDragEnd = useCallback(({ from, to }) => {
    const arr = uiDataRef.current || [];
    const { doneCount } = dragMetaRef.current;
    const activeStart = doneCount;

    // 완료 블록으로 드롭되는 경우, 진행중 첫 위치로 클램프
    const clampedFrom = Math.max(from, activeStart);
    const clampedTo = Math.max(to, activeStart);

    const done = arr.slice(0, activeStart);
    const active = arr.slice(activeStart);

    const fromIdx = clampedFrom - activeStart;
    const toIdx = Math.min(Math.max(clampedTo - activeStart, 0), active.length - 1);

    // 동일 위치면 아무 것도 안 함
    if (fromIdx === toIdx) return;

    const activeMoved = moveInArray(active, fromIdx, toIdx);
    const merged = [...done, ...activeMoved];

    // 1) UI 즉시 반영 (깜빡임 최소화)
    setUiData(merged);

    // 2) 진행중 sortIndex 재부여하여 영구 저장
    const idxMap = new Map(activeMoved.map((c, idx) => [safeStringId(c.id), idx]));
    const next = (list || []).map(it => {
      const id = safeStringId(it.id);
      return idxMap.has(id) ? { ...it, sortIndex: idxMap.get(id) } : it;
    });
    saveChallenges(next);
  }, [list, saveChallenges]);

  const renderItem = useCallback(
    ({ item, drag, isActive }) => (
      <ItemCard
        item={item}
        onPressCard={goEntryList}
        onPressEdit={(it) => navigation.navigate('EditChallenge', { challenge: it })}
        onPressDuplicate={onDuplicate}
        onPressDelete={onDelete}
        onPressClaim={confirmClaimReward}
        onLongPress={drag}
        isActiveDrag={isActive}
      />
    ),
    [goEntryList, navigation, onDuplicate, onDelete, confirmClaimReward]
  );

  const renderPlaceholder = useCallback(() => (
    <View style={styles.cardWrap}>
      <View style={[styles.card, styles.placeholderCard]} />
    </View>
  ), []);

  const keyExtractor = useCallback((it) => String(it.id), []);

  /** 오른쪽 하단: 도전추가 버튼 — 원형 + 아이콘만 (UI 유지) */
  const BottomAddButton = useCallback(() => {
    const bottom = Math.max(insets.bottom, 8) + spacing.lg;
    return (
      <View pointerEvents="box-none" style={[styles.addFloatingWrap, { bottom }]}>
        <TouchableOpacity
          style={styles.addFab}
          onPress={() => navigation.navigate('AddChallenge', { resetNonce: Date.now() })}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text allowFontScaling={false} style={styles.addFabPlus}>+</Text>
        </TouchableOpacity>
      </View>
    );
  }, [insets.bottom, navigation]);

  /** 왼쪽 하단: 설정(아이콘만, 52px) */
  const BottomSettingsButton = useCallback(() => {
    const bottom = Math.max(insets.bottom, 8) + spacing.lg;
    return (
      <View pointerEvents="box-none" style={[styles.settingsFloatingWrap, { bottom }]}>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => navigation.navigate('Settings')}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <GearIcon width={52} height={52} fill={colors.gray600} />
        </TouchableOpacity>
      </View>
    );
  }, [insets.bottom, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      {/* ▼ 타이틀 중앙 정렬 헤더 (UI 유지) */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>THE - PUSH</Text>

        <TouchableOpacity
          style={[buttonStyles.compactRight, styles.headerRight, styles.hofBtn]}
          onPress={() => navigation.navigate('HallOfFameScreen')}
          activeOpacity={0.9}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={[buttonStyles.compactRightText, styles.hofBtnText]}>명예의 전당</Text>
        </TouchableOpacity>
      </View>

      <DraggableFlatList
        data={uiData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderPlaceholder={renderPlaceholder}    // ✅ 드롭 시 레이아웃 점프 완화
        onDragBegin={handleDragBegin}           // ✅ 진행중 경계 기록
        onDragEnd={handleDragEnd}               // ✅ 경계 클램프 + 제어형 반영
        activationDistance={10}
        dragItemOverflow                          // ✅ 드래그중 아이템 오버플로 허용(안드 깜빡임 감소)
        removeClippedSubviews={false}            // ✅ 클리핑 제거로 깜빡임 감소
        containerStyle={{ flexGrow: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl + Math.max(insets.bottom, 12),
        }}
        scrollEventThrottle={16}
      />

      <BottomAddButton />
      <BottomSettingsButton />
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.gray800,
    textAlign: 'center',
    alignSelf: 'center',
  },
  headerRight: {
    position: 'absolute',
    right: spacing.lg,
    top: '50%',
    transform: [{ translateY: -12 }],
  },
  hofBtn: { paddingVertical: 4, paddingHorizontal: 10, marginTop: 15 },
  hofBtnText: { fontSize: 13, fontWeight: '700' },

  cardWrap: { marginTop: spacing.md },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  placeholderCard: {
    opacity: 0.25,
    borderStyle: 'dashed',
  },
  dimmed: { opacity: 0.6 },

  // 드래그 중 효과(가벼운 처리로 부드럽게)
  draggingCard: { opacity: 0.98 },

  title: { fontSize: 16, fontWeight: '800', color: colors.gray800 },
  metaWrap: { marginTop: 6 },
  meta: { fontSize: 12, color: colors.gray600, marginTop: 2 },

  actionsRight: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 8,
  },
  outlineBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  outlineText: { color: colors.black, fontSize: 12, fontWeight: '700' },
  disabledBtn: { opacity: 0.5 },

  bigActionBtn: { marginTop: spacing.md, alignSelf: 'stretch', paddingVertical: 14, borderRadius: radius.lg },
  bigActionText: { fontSize: 16, fontWeight: '800', textAlign: 'center' },

  empty: { textAlign: 'center', color: colors.gray400, marginTop: 60 },

  /* 우하단 플로팅: 검은 원 + 흰색 + */
  addFloatingWrap: { position: 'absolute', right: spacing.lg },
  addFab: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.black,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  addFabPlus: { color: colors.background, fontSize: 28, fontWeight: '900', lineHeight: 28, includeFontPadding: false },

  /* 좌하단 설정 버튼 */
  settingsFloatingWrap: { position: 'absolute', left: spacing.lg },
  settingsBtn: { backgroundColor: 'transparent', borderWidth: 0, padding: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  /* 완료 도전용 큰 아웃라인 버튼 */
  outlineBigBtn: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignSelf: 'stretch',
    marginTop: spacing.md,
  },
  outlineBigText: { color: colors.black, fontSize: 16, fontWeight: '800', textAlign: 'center' },
});
