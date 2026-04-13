// screens/HallOfFameScreen.js
// 요구사항 반영 + 강조(하이라이트) 원복:
// 1) 보상 직후 넘어온 카드는 첫 진입 시 맨 위 배치
// 2) 카드 외곽선은 도전 리스트와 동일(#E5E7EB, 1px)
// 3) 왼쪽 하단 '선택' 버튼 제거(길게 눌러 선택/삭제만 지원)
// 4) 카드 탭 시 인증목록(EntryList)로 이동
// 5) 축하 닫힘 직후 해당 카드 외곽선 1회 깜빡임(원복)

import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, Pressable, Alert, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView,  useSafeAreaInsets  } from 'react-native-safe-area-context';

import { colors, spacing, radius, buttonStyles } from '../styles/common';
import BackButton from '../components/BackButton';

const CARD_BORDER = '#E5E7EB';   // gray-200: 도전 리스트와 동일
const DIVIDER = '#D1D5DB';       // gray-300 (살짝 더 진하게)
const HOF_KEY = 'hof';
const LEGACY_KEYS = ['hallOfFame', 'hall_of_fame', 'HOF']; // 1회 마이그레이션 용

/* ----------------- 저장 로직 ----------------- */
async function readHof() {
  const raw = await AsyncStorage.getItem(HOF_KEY);
  const list = raw ? JSON.parse(raw) : [];
  return Array.isArray(list) ? list : [];
}
async function writeHof(list) {
  await AsyncStorage.setItem(HOF_KEY, JSON.stringify(Array.isArray(list) ? list : []));
}
async function migrateHofIfNeeded() {
  const current = await readHof();
  if (current.length > 0) return current;
  for (const k of LEGACY_KEYS) {
    try {
      const raw = await AsyncStorage.getItem(k);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr) && arr.length > 0) {
        await writeHof(arr);
        await AsyncStorage.removeItem(k); // 재등장 방지
        return arr;
      }
    } catch {}
  }
  return current;
}

/* ----------------- 유틸 ----------------- */
function sortHOF(list = []) {
  return [...list].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
}
function sortHOFWithTop(list = [], topId) {
  const s = sortHOF(list);
  if (!topId) return s;
  const idx = s.findIndex(it => String(it.id) === String(topId));
  if (idx > 0) {
    const [hit] = s.splice(idx, 1);
    s.unshift(hit);
  }
  return s;
}
function toMillis(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v > 1e12 ? v : v * 1000; // sec → ms 보정
  if (typeof v === 'string') {
    if (/^\d+$/.test(v)) { const n = Number(v); return n > 1e12 ? n : n * 1000; }
    const t = Date.parse(v); return Number.isNaN(t) ? 0 : t;   // ISO 문자열 보정
  }
  return 0;
}

function extractIncomingId(params = {}) {
  const id =
    params.highlightId ??
    params.highlightedCardId ??
    params.claimedId ??
    params.challengeId ??
    params.challenge?.id ??
    params.claimedChallenge?.id ??
    params.newHofItem?.id ??
    null;
  return id != null ? String(id) : null;
}
function shouldShowCongrats(params = {}) {
  // ChallengeList에서 모달은 제거했으므로 HOF에서만 1회 표시
  return !!params.justClaimed;
}

/* ----------------- 카드 (하이라이트 애니메이션 포함) ----------------- */
const HofItem = memo(function HofItem({
  item, isSelected, selectMode, onPress, onLongPress, onToggleSelect, highlight,
}) {
  const rewardLabel = item.rewardTitle ?? item.reward ?? '';
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
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.cardWrap}
      onLongPress={() => onLongPress?.(item)}
      onPress={() => (selectMode ? onToggleSelect?.(item) : onPress?.(item))}
    >
      <Animated.View style={[
        styles.card,
        highlight && styles.cardHighlight, // 깜빡임 동안 검은 테두리
        animatedStyle
      ]}>
        {/* 타이틀 중앙 정렬 + 선택 체크는 오버레이 */}
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
          {(() => {
            const doneTs = toMillis(item.completedAt ?? item.rewardClaimedAt ?? item.endDate);
            return (
              <Text style={styles.meta}>
                완료일 {doneTs ? new Date(doneTs).toLocaleString() : '-'}
              </Text>
            );
          })()}

          {!!rewardLabel && (
            <>
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

/* ----------------- 화면 ----------------- */
export default function HallOfFameScreen() {
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);

  const [hof, setHof] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  // 축하 팝업 (HOF에서만 1회)
  const [showCongrats, setShowCongrats] = useState(false);
  const [recentId, setRecentId] = useState(null);

  // 🔸 강조(하이라이트) 원복용
  const [highlightId, setHighlightId] = useState(null);
  const congratsTimer = useRef(null);
  const flashTimer = useRef(null);
  const handledSigRef = useRef(null);

  const recentItem = useMemo(() => {
    if (!recentId) return null;
    const rid = String(recentId);
    return hof.find(it => String(it.id) === rid) || null;
  }, [hof, recentId]);

  const triggerHighlight = useCallback((id) => {
    if (!id) return;
    setHighlightId(String(id));
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setHighlightId(null), 1200);
  }, []);

  // 로드 + 보상 직후 진입 처리
  useEffect(() => {
    if (!isFocused) return;

    // 1) 파라미터 해석(동기)
    const p = route.params ?? {};
    const incomingId = extractIncomingId(p);
    const congrats = shouldShowCongrats(p);
    const sig = incomingId ? `${incomingId}|${congrats ? '1' : '0'}` : 'none';
    if (handledSigRef.current === sig) return;
    handledSigRef.current = sig;

    // 2) 데이터 로드 후 정렬(필요 시 incomingId를 맨 위로)
    (async () => {
      const arr = await migrateHofIfNeeded();
      const normalized = arr.map(it => {
        const fixed = toMillis(it.completedAt ?? it.rewardClaimedAt ?? it.endDate);
        return fixed ? { ...it, completedAt: fixed } : it;
      });
      if (JSON.stringify(arr) !== JSON.stringify(normalized)) {
        await writeHof(normalized);   // ✅ 1회 정정 저장
      }
      const arranged = sortHOFWithTop(normalized, incomingId);
      setHof(arranged);

      if (incomingId) {
        try { listRef.current?.scrollToOffset?.({ offset: 0, animated: true }); } catch {}
      }

      // 3) 축하 모달(HOF에서만 1회)
      if (incomingId && congrats) {
        setRecentId(incomingId);
        setShowCongrats(true);
      } else if (incomingId && !congrats) {
        // 모달 없이 넘어온 경우라도 바로 하이라이트 1회
        triggerHighlight(incomingId);
      }
    })().catch(console.error);

    return () => {
      if (congratsTimer.current) { clearTimeout(congratsTimer.current); congratsTimer.current = null; }
      if (flashTimer.current) { clearTimeout(flashTimer.current); flashTimer.current = null; }
    };
  }, [isFocused, route.params, triggerHighlight]);

  const closeCongrats = useCallback(() => {
    if (congratsTimer.current) { clearTimeout(congratsTimer.current); congratsTimer.current = null; }
    setShowCongrats(false);
    // ✅ 모달 닫힘 직후 강조 원복
    if (recentId) triggerHighlight(recentId);
    setRecentId(null);
  }, [recentId, triggerHighlight]);

  const onModalShow = useCallback(() => {
    if (congratsTimer.current) { clearTimeout(congratsTimer.current); }
    congratsTimer.current = setTimeout(() => { closeCongrats(); }, 3000);
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

  // 카드 탭 → 인증 목록 이동
  const onPressItem = useCallback((item) => {
    if (selectMode) return;
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
  }, [navigation, selectMode]);

  const onLongPressItem = useCallback((item) => {
    if (!selectMode) {
      setSelectMode(true);
      setSelected(new Set([String(item.id)]));
    }
  }, [selectMode]);

  // 삭제
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
              const arr = await readHof();
              const next = arr.filter(it => !selected.has(String(it.id)));
              await writeHof(next);
              setHof(sortHOF(next));
              cancelSelectMode();
            } catch (e) { console.error(e); }
          }
        }
      ]
    );
  }, [cancelSelectMode, selected]);

  const keyExtractor = useCallback((it) => String(it.id), []);
  const renderItem = useCallback(({ item }) => {
    const isSelected = selected.has(String(item.id));
    const isHighlight = highlightId === String(item.id);
    return (
      <HofItem
        item={item}
        isSelected={isSelected}
        selectMode={selectMode}
        onPress={onPressItem}
        onLongPress={onLongPressItem}
        onToggleSelect={toggleSelect}
        highlight={isHighlight}  // ✅ 강조 전달
      />
    );
  }, [onLongPressItem, onPressItem, selectMode, selected, toggleSelect, highlightId]);

  return (
    <SafeAreaView style={styles.container}>
      <BackButton title="명예의 전당" />


      <FlatList
        ref={listRef}
        data={hof}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl + Math.max(insets.bottom, 8) + 50 }}
        ListEmptyComponent={<Text style={styles.empty}>아직 완료된 도전이 없습니다.</Text>}
        removeClippedSubviews
        windowSize={7}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
      />

      {/* 선택 모드 하단바 (선택 버튼은 제거) */}
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

      {/* 축하 팝업 (HOF에서만 1회) */}
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

/* ----------------- 스타일 ----------------- */
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
    borderColor: CARD_BORDER,     // ✅ 도전 리스트와 동일한 얇은 회색 라인
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  // 강조 시 테두리만 잠깐 검정 3px로
  cardHighlight: { borderColor: '#111' },

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
  checkOn: { borderColor: '#111', backgroundColor: '#FFF' },
  checkText: { fontSize: 14, color: 'transparent', fontWeight: '900' },
  checkTextOn: { color: '#111' },

  metaWrap: { marginTop: 2, alignItems: 'center' },
  meta: { fontSize: 12, color: colors.gray600, marginTop: 2, textAlign: 'center' },

  innerDivider: {
    height: 1,
    backgroundColor: DIVIDER,     // ✅ 기존보다 살짝 진한 회색
    alignSelf: 'stretch',
    marginTop: 10,
    marginBottom: 8,
    marginHorizontal: 4,
  },

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
