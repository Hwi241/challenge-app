// screens/HallOfFameScreen.js
// - 보상 직후 팝업: 1회 노출, onShow 시점에 3초 자동 닫힘, 화면 아무 곳 탭해도 닫힘
// - 하이라이트: 카드 외곽선 1회 깜빡임
// - 선택 삭제: 선택 모드 + 하단바에서 "선택 삭제" (삭제 전 경고창)
// - 카드 텍스트 전부 중앙 정렬
// - 보상 섹션 위 수평선: 기존보다 살짝 더 진한 회색
// - 선택 버튼: 화면 왼쪽 하단 고정
// - 선택 아이콘: 체크 마크를 '검은색'으로 표시

import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, Animated, Pressable, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, radius, buttonStyles } from '../styles/common';

const CARD_BORDER = '#E5E7EB';   // gray-200
const DIVIDER = '#D1D5DB';       // gray-300 (살짝 더 진하게)

function sortHOF(list = []) {
  return [...list].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
}

/** 개별 카드 — 외곽선 플래시 */
const HofItem = memo(function HofItem({
  item, isSelected, selectMode, onPress, onLongPress, onToggleSelect, highlight,
}) {
  const outlineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (highlight) {
      outlineAnim.setValue(0);
      Animated.sequence([
        Animated.timing(outlineAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
        Animated.timing(outlineAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
      ]).start();
    }
  }, [highlight, outlineAnim]);

  const animatedStyle = {
    borderWidth: outlineAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 3] }),
    borderColor: '#111',
  };

  const rewardLabel = item.rewardTitle ?? item.reward ?? '';

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.cardWrap}
      onLongPress={() => onLongPress?.(item)}
      onPress={() => (selectMode ? onToggleSelect?.(item) : onPress?.(item))}
    >
      <Animated.View style={[styles.card, animatedStyle]}>
        {/* 타이틀 중앙 정렬, 우상단 체크표시는 오버레이 */}
        <View style={styles.titleCenterWrap}>
          <Text style={styles.titleCentered} numberOfLines={2}>
            {item.title || '(제목 없음)'}
          </Text>
          {selectMode && (
            <View style={styles.checkOverlay}>
              <View style={[styles.check, isSelected && styles.checkOn]}>
                <Text style={[styles.checkText, isSelected && styles.checkTextOn]}>
                  {isSelected ? '✓' : ''}
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.metaWrap}>
          {!!item.startDate && !!item.endDate && (
            <Text style={styles.meta}>기간 {item.startDate} ~ {item.endDate}</Text>
          )}
          <Text style={styles.meta}>
            완료일 {item.completedAt ? new Date(item.completedAt).toLocaleString() : '-'}
          </Text>

          {!!rewardLabel && (
            <>
              {/* 보상 섹션 상단 구분선 (카드 외곽 라인과 닿지 않도록 좌우 여백) */}
              <View style={styles.innerDivider} />

              <View style={styles.rewardBox}>
                <Text style={styles.rewardBoxLabel}>보상</Text>
                <Text style={styles.rewardBoxTitle} numberOfLines={1}>{rewardLabel}</Text>
              </View>
            </>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

export default function HallOfFameScreen() {
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);

  const [hof, setHof] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  // 축하 팝업/하이라이트
  const [showCongrats, setShowCongrats] = useState(false);
  const [recentId, setRecentId] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const congratsTimer = useRef(null);
  const flashTimer = useRef(null);
  const lastShownIdRef = useRef(null); // 동일 ID 재노출 방지

  // 방금 완료한 도전 데이터
  const recentItem = useMemo(() => {
    if (!recentId) return null;
    const rid = String(recentId);
    return hof.find(it => String(it.id) === rid) || null;
  }, [hof, recentId]);

  // 데이터 로드 + 보상 직후 진입 처리
  useEffect(() => {
    if (!isFocused) return;
    (async () => {
      const raw = await AsyncStorage.getItem('hallOfFame');
      const arr = raw ? JSON.parse(raw) : [];
      setHof(sortHOF(arr));

      let rid = route.params?.recentId || null;
      if (!rid) {
        const last = await AsyncStorage.getItem('lastClaimedId').catch(() => null);
        if (last) rid = last;
      }

      const ridStr = rid ? String(rid) : null;

      if (ridStr && lastShownIdRef.current !== ridStr) {
        lastShownIdRef.current = ridStr; // 1회 처리
        setRecentId(ridStr);
        setShowCongrats(true);
        await AsyncStorage.removeItem('lastClaimedId').catch(() => {});
        navigation.setParams?.({ recentId: undefined });
      }
    })().catch(console.error);

    return () => {
      if (congratsTimer.current) { clearTimeout(congratsTimer.current); congratsTimer.current = null; }
      if (flashTimer.current) { clearTimeout(flashTimer.current); flashTimer.current = null; }
    };
  }, [isFocused, navigation, route.params]);

  const handleAfterCongrats = useCallback(() => {
    try {
      listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
    } catch {}
    if (recentId) {
      setHighlightId(String(recentId));
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setHighlightId(null), 1200);
    }
    setRecentId(null);
  }, [recentId]);

  const closeCongrats = useCallback(() => {
    if (congratsTimer.current) { clearTimeout(congratsTimer.current); congratsTimer.current = null; }
    setShowCongrats(false);
    handleAfterCongrats();
  }, [handleAfterCongrats]);

  // Modal이 실제로 화면에 나타난 시점에서 3초 타이머 시작
  const onModalShow = useCallback(() => {
    if (congratsTimer.current) { clearTimeout(congratsTimer.current); }
    congratsTimer.current = setTimeout(() => {
      closeCongrats();
    }, 3000);
  }, [closeCongrats]);

  // 선택 모드
  const enterSelectMode = useCallback(() => { setSelectMode(true); setSelected(new Set()); }, []);
  const cancelSelectMode = useCallback(() => { setSelectMode(false); setSelected(new Set()); }, []);
  const toggleSelect = useCallback((item) => {
    setSelected(prev => {
      const next = new Set(prev);
      const key = String(item.id);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const onPressItem = useCallback((item) => {
    navigation.navigate('EntryList', {
      challengeId: item.id,
      title: item.title,
      startDate: item.startDate,
      endDate: item.endDate,
      targetScore: item.goalScore,
      rewardTitle: item.rewardTitle,
      reward: item.reward,
      readOnly: true,
    });
  }, [navigation]);

  const onLongPressItem = useCallback((item) => {
    if (!selectMode) {
      setSelectMode(true);
      setSelected(new Set([String(item.id)]));
    }
  }, [selectMode]);

  // 삭제 전 경고창
  const removeSelected = useCallback(() => {
    if (!selected.size) { cancelSelectMode(); return; }
    Alert.alert(
      '삭제 확인',
      '선택한 완료 카드를 삭제할까요? 이 작업은 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              const raw = await AsyncStorage.getItem('hallOfFame');
              const arr = raw ? JSON.parse(raw) : [];
              const next = arr.filter(it => !selected.has(String(it.id)));
              await AsyncStorage.setItem('hallOfFame', JSON.stringify(next));
              setHof(sortHOF(next));
              cancelSelectMode();
            } catch (e) { console.error(e); }
          }
        }
      ]
    );
  }, [cancelSelectMode, selected]);

  const data = useMemo(() => sortHOF(hof), [hof]);
  const keyExtractor = useCallback((it) => String(it.id), []);
  const renderItem = useCallback(({ item }) => {
    const isSelected = selected.has(String(item.id));
    return (
      <HofItem
        item={item}
        isSelected={isSelected}
        selectMode={selectMode}
        onPress={onPressItem}
        onLongPress={onLongPressItem}
        onToggleSelect={toggleSelect}
        highlight={highlightId === String(item.id)}
      />
    );
  }, [highlightId, onLongPressItem, onPressItem, selectMode, selected, toggleSelect]);

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 — 중앙 정렬 타이틀 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>명예의 전당</Text>
      </View>

      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl + Math.max(insets.bottom, 8) }}
        ListEmptyComponent={<Text style={styles.empty}>아직 완료된 도전이 없습니다.</Text>}
        removeClippedSubviews
        windowSize={7}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
      />

      {/* 선택 모드 하단바 */}
      {selectMode && (
        <View pointerEvents="box-none" style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TouchableOpacity style={[buttonStyles.outlineSoft.container, { flex: 1, marginRight: spacing.sm }]} onPress={cancelSelectMode}>
            <Text style={buttonStyles.outlineSoft.label}>취소</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[buttonStyles.outlineStrong.container, { flex: 1, marginLeft: spacing.sm }]} onPress={removeSelected}>
            <Text style={buttonStyles.outlineStrong.label}>선택 삭제</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 선택 버튼: 화면 왼쪽 하단 고정 (selectMode 아닐 때만 표시) */}
      {!selectMode && (
        <View style={[styles.fabLeftWrap, { bottom: Math.max(insets.bottom, 8) + 12 }]}>
          <TouchableOpacity style={styles.fabLeftBtn} onPress={enterSelectMode} activeOpacity={0.9}>
            <Text style={styles.fabLeftText}>선택</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 축하 팝업 */}
      <Modal
        visible={showCongrats}
        transparent
        animationType="fade"
        onRequestClose={closeCongrats}
        onShow={onModalShow}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeCongrats}>
          <View style={styles.modalCard}>
            <Text style={styles.congratsTitle}>축하합니다! 🎉</Text>
            <Text style={styles.congratsDesc}>도전을 완료하셨습니다.</Text>
            {!!(recentItem?.rewardTitle || recentItem?.reward) && (
              <>
                <View style={styles.congratsDivider} />
                <Text style={styles.congratsRewardLabel}>이번 보상</Text>
                <Text style={styles.congratsRewardName} numberOfLines={2}>
                  {recentItem?.rewardTitle ?? recentItem?.reward}
                </Text>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.gray800, textAlign: 'center' },

  cardWrap: { marginTop: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },

  // 타이틀 중앙 정렬 + 선택 체크는 오버레이
  titleCenterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
    paddingBottom: 6,
  },
  titleCentered: { fontSize: 16, fontWeight: '800', color: colors.gray800, textAlign: 'center' },

  checkOverlay: { position: 'absolute', right: 0, top: 0 },
  check: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1, borderColor: '#111',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  // 선택 아이콘은 검은색 체크 마크
  checkOn: { borderColor: '#111', backgroundColor: '#FFF' },
  checkText: { fontSize: 14, color: 'transparent', fontWeight: '900' },
  checkTextOn: { color: '#111' },

  metaWrap: { marginTop: 2, alignItems: 'center' },
  meta: { fontSize: 12, color: colors.gray600, marginTop: 2, textAlign: 'center' },

  // 보상 섹션 상단 구분선(카드 테두리와 닿지 않게 좌우 마진) — 더 진한 회색
  innerDivider: {
    height: 1,
    backgroundColor: DIVIDER,
    alignSelf: 'stretch',
    marginTop: 10,
    marginBottom: 8,
    marginHorizontal: 4,
  },

  // 보상 강조 박스
  rewardBox: {
    marginTop: 2,
    backgroundColor: colors.gray100,
    borderRadius: radius.lg,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  rewardBoxLabel: { fontSize: 11, color: colors.gray500, marginBottom: 2, textAlign: 'center' },
  rewardBoxTitle: { fontSize: 15, fontWeight: '800', color: colors.gray800, textAlign: 'center' },

  empty: { textAlign: 'center', color: colors.gray400, marginTop: 60 },

  bottomBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 0,
    flexDirection: 'row',
  },

  // 왼쪽 하단 고정 선택 버튼
  fabLeftWrap: {
    position: 'absolute',
    left: spacing.lg,
  },
  fabLeftBtn: {
  backgroundColor: '#111',   // 검은 배경
  borderWidth: 1,
  borderColor: '#111',       // 테두리도 검은색
  borderRadius: radius.lg,
  paddingHorizontal: 14,
  paddingVertical: 10,
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 6,
  elevation: 3,
},
fabLeftText: {
  fontSize: 14,
  fontWeight: '700',
  color: '#FFF',             // 흰 글씨
},

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    alignItems: 'center',
  },
  congratsTitle: { fontSize: 18, fontWeight: '800', color: colors.gray800, marginBottom: 4, textAlign: 'center' },
  congratsDesc: { color: colors.gray600, textAlign: 'center' },
  congratsDivider: { height: 1, backgroundColor: CARD_BORDER, alignSelf: 'stretch', marginTop: 10, marginBottom: 10, marginHorizontal: 4 },
  congratsRewardLabel: { fontSize: 12, color: colors.gray500, marginBottom: 4, textAlign: 'center' },
  congratsRewardName: { fontSize: 20, fontWeight: '900', color: colors.gray800, textAlign: 'center' },
});
