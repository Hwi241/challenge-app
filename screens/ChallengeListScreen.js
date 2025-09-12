// screens/ChallengeListScreen.js
import React, { useEffect, useMemo, useState, useCallback, memo } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet,
  TouchableOpacity, Alert, FlatList
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

function safeStringId(v) {
  return v == null ? '' : String(v);
}

function dedupeById(arr = []) {
  const map = new Map();
  for (const it of arr) {
    if (!it || !it.id) continue;
    map.set(safeStringId(it.id), it);
  }
  return Array.from(map.values());
}

/* ---------- 카드 ---------- */
const ItemCard = memo(function ItemCard({
  item,
  onPressCard,
  onPressEdit,
  onPressDuplicate,
  onPressDelete,
  onPressClaim,
}) {
  const isDone = !!item._isDone;

  return (
    <View style={styles.cardWrap}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onPressCard(item)}
        style={[styles.card, isDone && styles.dimmed]}
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

  // 포커스 시 최신 데이터 로드
  useEffect(() => {
    if (!isFocused) return;
    (async () => {
      const arr = dedupeById(await readJsonArray('challenges'));
      try { await AsyncStorage.setItem('challenges', JSON.stringify(arr)); } catch {}
      setList(arr);
    })().catch(console.error);
  }, [isFocused]);

  const decorate = useCallback((c) => {
    const cs = Number(c?.currentScore ?? 0);
    const gs = Number(c?.goalScore ?? NaN);
    const hasValidGoal = Number.isFinite(gs) && gs > 0;
    const doneByScore = hasValidGoal && cs >= gs;
    const done = c?.status === 'completed' || doneByScore;
    return { ...c, _isDone: !!done, _completedAt: c?.completedAt ?? 0 };
  }, []);

  const sorted = useMemo(() => {
    const arr = (list || []).map(decorate);
    const done = arr.filter((c) => c._isDone)
      .sort((a, b) => (b._completedAt || 0) - (a._completedAt || 0));
    const active = arr.filter((c) => !c._isDone)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return [...done, ...active];
  }, [list, decorate]);

  const saveChallenges = useCallback(async (arr) => {
    const clean = dedupeById(Array.isArray(arr) ? arr : []);
    setList(clean);
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
          const copy = {
            ...item,
            id: `ch_${Date.now()}`,
            title: `${item.title} (복제)`,
            currentScore: 0,
            status: 'active',
            createdAt: Date.now(),
            completedAt: undefined,
          };
          const next = [copy, ...list];
          await saveChallenges(next);
        },
      },
    ]);
  }, [list, saveChallenges]);

  const confirmClaimReward = useCallback((item) => {
    Alert.alert(
      '보상 받기',
      `'${item.title}' 도전의 보상을 받으시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        { text: '확인', style: 'default', onPress: () => onClaimReward(item) },
      ]
    );
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

  const renderItem = useCallback(
    ({ item }) => (
      <ItemCard
        item={item}
        onPressCard={goEntryList}
        onPressEdit={(it) => navigation.navigate('EditChallenge', { challenge: it })}
        onPressDuplicate={onDuplicate}
        onPressDelete={onDelete}
        onPressClaim={confirmClaimReward}
      />
    ),
    [goEntryList, navigation, onDuplicate, onDelete, confirmClaimReward]
  );

  const keyExtractor = useCallback((it) => String(it.id), []);

  /** 오른쪽 하단: 도전추가 버튼 — 원형 + 아이콘만 (UI 유지) */
  const BottomAddButton = useCallback(() => {
    const bottom = Math.max(insets.bottom, 8) + spacing.lg;
    return (
      <View pointerEvents="box-none" style={[styles.addFloatingWrap, { bottom }]}>
        <TouchableOpacity
          style={styles.addFab}
          // ✅ 알림 미리보기 초기화를 위해 resetNonce 전달 (UI 변화 없음)
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

      <FlatList
        data={sorted}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl + Math.max(insets.bottom, 12),
        }}
        ListEmptyComponent={<Text style={styles.empty}>새로운 도전을 응원합니다!</Text>}
        removeClippedSubviews
        windowSize={7}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={50}
      />

      <BottomAddButton />
      <BottomSettingsButton />
    </SafeAreaView>
  );
}

/* ---------- 스타일 ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // ▼ 중앙 타이틀 헤더 (UI 유지)
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
  hofBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 15,
  },
  hofBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  cardWrap: { marginTop: spacing.md },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  dimmed: { opacity: 0.6 },

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

  bigActionBtn: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: radius.lg,
  },
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
  addFabPlus: {
    color: colors.background,
    fontSize: 28, fontWeight: '900', lineHeight: 28, includeFontPadding: false,
  },

  /* 좌하단 설정 버튼 */
  settingsFloatingWrap: { position: 'absolute', left: spacing.lg },
  settingsBtn: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
  outlineBigText: {
    color: colors.black,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
});
