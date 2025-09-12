// screens/HallOfFameScreen.js
// - 보상 직후 팝업: 1회 노출, onShow 시점에 3초 자동 닫힘, 화면 아무 곳 탭해도 닫힘
// - 하이라이트: 노란 배경 제거, 카드 외곽선 1회 깜빡임
// - 성능: memoization/FlatList 파라미터 유지

import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, Animated, Pressable
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, radius, buttonStyles } from '../styles/common';

const CARD_BORDER = '#E5E7EB';

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

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.cardWrap}
      onLongPress={() => onLongPress?.(item)}
      onPress={() => (selectMode ? onToggleSelect?.(item) : onPress?.(item))}
    >
      <Animated.View style={[styles.card, animatedStyle]}>
        <View style={styles.rowBetween}>
          <Text style={styles.title} numberOfLines={1}>{item.title || '(제목 없음)'}</Text>
          {selectMode && (
            <View style={[styles.check, isSelected && styles.checkOn]}>
              <Text style={[styles.checkText, isSelected && styles.checkTextOn]}>
                {isSelected ? '✓' : ''}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.metaWrap}>
          {!!item.startDate && !!item.endDate && (
            <Text style={styles.meta}>기간 {item.startDate} ~ {item.endDate}</Text>
          )}
          <Text style={styles.meta}>완료일 {item.completedAt ? new Date(item.completedAt).toLocaleString() : '-'}</Text>
          {!!(item.rewardTitle || item.reward) && (
            <Text style={styles.meta}>보상 {item.rewardTitle ?? item.reward}</Text>
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

  const removeSelected = useCallback(async () => {
    if (!selected.size) { cancelSelectMode(); return; }
    try {
      const raw = await AsyncStorage.getItem('hallOfFame');
      const arr = raw ? JSON.parse(raw) : [];
      const next = arr.filter(it => !selected.has(String(it.id)));
      await AsyncStorage.setItem('hallOfFame', JSON.stringify(next));
      setHof(sortHOF(next));
      cancelSelectMode();
    } catch (e) { console.error(e); }
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
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>명예의 전당</Text>
        {!selectMode ? (
          <TouchableOpacity style={buttonStyles.compactRight} onPress={enterSelectMode}>
            <Text style={buttonStyles.compactRightText}>선택</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={buttonStyles.compactRight} onPress={cancelSelectMode}>
            <Text style={buttonStyles.compactRightText}>취소</Text>
          </TouchableOpacity>
        )}
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

      {/* 축하 팝업: 어디나 탭 → 닫힘, onShow에서 3초 자동 닫힘 */}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.gray800 },

  cardWrap: { marginTop: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.gray800 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  metaWrap: { marginTop: 6 },
  meta: { fontSize: 12, color: colors.gray600, marginTop: 2 },

  check: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background,
  },
  checkOn: { backgroundColor: '#111', borderColor: '#111' },
  checkText: { fontSize: 14, color: 'transparent', fontWeight: '800' },
  checkTextOn: { color: colors.background },

  empty: { textAlign: 'center', color: colors.gray400, marginTop: 60 },

  bottomBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 0,
    flexDirection: 'row',
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
  congratsTitle: { fontSize: 18, fontWeight: '800', color: colors.gray800, marginBottom: 6 },
  congratsDesc: { color: colors.gray600 },
});
