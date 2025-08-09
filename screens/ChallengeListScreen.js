// screens/ChallengeListScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet,
  TouchableOpacity, Alert, FlatList
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 공통 팔레트/여백
import { buttonStyles, colors, spacing, radius } from '../styles/common';

export default function ChallengeListScreen() {
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [list, setList] = useState([]);

  useEffect(() => {
    if (!isFocused) return;
    (async () => {
      const raw = await AsyncStorage.getItem('challenges');
      const arr = raw ? JSON.parse(raw) : [];
      setList(arr);
    })().catch(console.error);
  }, [isFocused]);

  // 완료 판정(안전): status === 'completed' || (goalScore>0 && currentScore>=goalScore)
  const decorate = (c) => {
    const cs = Number(c?.currentScore ?? 0);
    const gs = Number(c?.goalScore ?? NaN);
    const hasValidGoal = Number.isFinite(gs) && gs > 0;
    const doneByScore = hasValidGoal && cs >= gs;
    const done = c?.status === 'completed' || doneByScore;
    return { ...c, _isDone: !!done, _completedAt: c?.completedAt ?? 0 };
  };

  // 정렬: 완료(완료일 최신) → 진행중(생성 최신)
  const sorted = useMemo(() => {
    const arr = (list || []).map(decorate);
    const done = arr.filter((c) => c._isDone)
      .sort((a, b) => (b._completedAt || 0) - (a._completedAt || 0));
    const active = arr.filter((c) => !c._isDone)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return [...done, ...active];
  }, [list]);

  const saveChallenges = async (arr) => {
    setList(arr);
    await AsyncStorage.setItem('challenges', JSON.stringify(arr));
  };

  const onDelete = (item) => {
    Alert.alert('삭제 확인', `'${item.title}' 도전을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          const next = (list || []).filter((c) => c.id !== item.id);
          await saveChallenges(next);
          await AsyncStorage.removeItem(`entries_${item.id}`).catch(() => {});
        },
      },
    ]);
  };

  const onDuplicate = (item) => {
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
  };

  const onClaimReward = async (item) => {
    const marked = { ...item, status: 'completed', completedAt: Date.now() };
    const nextChallenges = (list || []).filter((c) => c.id !== item.id);
    await saveChallenges(nextChallenges);
    const raw = await AsyncStorage.getItem('hallOfFame');
    const hof = raw ? JSON.parse(raw) : [];
    hof.unshift(marked);
    await AsyncStorage.setItem('hallOfFame', JSON.stringify(hof));
    navigation.navigate('HallOfFameScreen');
  };

  const goEntryList = (item) => {
    navigation.navigate('EntryList', {
      challengeId: item.id,
      title: item.title,
      startDate: item.startDate,
      endDate: item.endDate,
      targetScore: item.goalScore,
      rewardTitle: item.rewardTitle,
      reward: item.reward,
    });
  };

  const renderItem = ({ item }) => {
    const isDone = !!item._isDone;

    return (
      <View style={styles.cardWrap}>
        {/* 카드 영역 전체 탭 → 인증 목록 */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => goEntryList(item)}
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

          {/* (요청) 카드 테두리 안, 오른쪽 정렬: 흰 배경 + 카드 라인색 테두리 */}
          <View style={styles.actionsRight}>
            <TouchableOpacity
              disabled={isDone}
              style={[styles.outlineBtn, isDone && styles.disabledBtn]}
              onPress={() => navigation.navigate('EditChallenge', { challenge: item })}
            >
              <Text style={styles.outlineText}>{isDone ? '수정불가' : '수정'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={isDone}
              style={[styles.outlineBtn, isDone && styles.disabledBtn]}
              onPress={() => onDuplicate(item)}
            >
              <Text style={styles.outlineText}>{isDone ? '복제불가' : '복제'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={() => onDelete(item)}
            >
              <Text style={styles.outlineText}>삭제</Text>
            </TouchableOpacity>
          </View>

          {/* (요청) 카드 테두리 안, 큰 버튼: 진행중=인증하기 / 완료=보상 받기 */}
          {!isDone ? (
            <TouchableOpacity
              style={[buttonStyles.primary, styles.bigActionBtn]}
              onPress={() => navigation.navigate('Upload', { challengeId: item.id })}
              activeOpacity={0.9}
            >
              <Text style={[buttonStyles.primaryText, styles.bigActionText]}>인증하기</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[buttonStyles.primary, styles.bigActionBtn]}
              onPress={() => onClaimReward(item)}
              activeOpacity={0.9}
            >
              <Text style={[buttonStyles.primaryText, styles.bigActionText]}>보상 받기</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // 화면 맨밑 고정 “도전 추가” 버튼 (인증하기와 동일한 모양)
  const BottomAddButton = () => (
    <View
      pointerEvents="box-none"
      style={[
        styles.bottomBar,
        { paddingBottom: Math.max(insets.bottom, 8) }
      ]}
    >
      <TouchableOpacity
        style={[buttonStyles.primary, styles.bigActionBtn]}
        onPress={() => navigation.navigate('AddChallenge')}
        activeOpacity={0.9}
      >
        <Text style={[buttonStyles.primaryText, styles.bigActionText]}>도전 추가</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더: 명예의 전당 이동만 유지 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>도전 목록</Text>
        <TouchableOpacity
          style={buttonStyles.compactRight}
          onPress={() => navigation.navigate('HallOfFameScreen')}
        >
          <Text style={buttonStyles.compactRightText}>명예의 전당</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl + Math.max(insets.bottom, 8), // 하단 고정 버튼과 겹치지 않게
        }}
        ListEmptyComponent={<Text style={styles.empty}>등록된 도전이 없습니다.</Text>}
      />

      <BottomAddButton />
    </SafeAreaView>
  );
}

// 카드 테두리/아웃라인 공통 색(카드 외곽선과 동일하게 맞춤)
const CARD_BORDER = '#E5E7EB'; // colors.gray300 과 유사톤 (styles/common 팔레트와 톤 맞춤)

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.gray800 },

  cardWrap: { marginTop: spacing.md },

  // 카드(테두리/라운드/안쪽 패딩 포함)
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  // 완료 도전: 본문만 살짝 흐림(버튼 가독성은 유지됨)
  dimmed: { opacity: 0.6 },

  title: { fontSize: 16, fontWeight: '800', color: colors.gray800 },
  metaWrap: { marginTop: 6 },
  meta: { fontSize: 12, color: colors.gray600, marginTop: 2 },

  // 카드 내부: 우측 정렬 아웃라인 버튼들
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
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: CARD_BORDER, // (요청) 카드 테두리와 동일 톤
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  outlineText: { color: colors.black, fontSize: 12, fontWeight: '700' },

  // 카드 내부: 큰 버튼(인증하기/보상)
  bigActionBtn: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: radius.lg,
  },
  bigActionText: { fontSize: 16, fontWeight: '800' },

  empty: { textAlign: 'center', color: colors.gray400, marginTop: 60 },

  // 하단 고정 Add 버튼 컨테이너
  bottomBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 0,
    backgroundColor: 'transparent',
  },
});
