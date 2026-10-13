import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import TogetherModePickerModal from '../components/TogetherModePickerModal';
import TogetherPushPickerModal from '../components/TogetherPushPickerModal';
import TogetherEntryMenuModal from '../components/TogetherEntryMenuModal';
import TogetherRoomFoldCardV2 from '../components/TogetherRoomFoldCardV2';
import { color, font, primitive, radius, space, surface as surfaceStyles } from '../styles/common';
import { getExistingTogetherSession } from '../utils/togetherRemoteAuth';
import { loadMyTogetherRoomsV2 } from '../utils/togetherRemoteV2';
import { loadTogetherEligibleCards } from '../utils/togetherLocalData';
import { createTogetherRoomDraftV2, loadTogetherRoomDraftsV2 } from '../utils/togetherRoomDrafts';
import { loadTogetherInvitations } from '../utils/togetherInvitations';
import { resolveTogetherRoomPresentation } from '../utils/togetherRoomViewIntegrity';
import { loadTogetherCollapsedRoomsV2, saveTogetherCollapsedRoomsV2 } from '../utils/togetherRoomCardCollapseV2';
import { subscribeTogetherHomeChangesV2 } from '../utils/togetherHomeRealtimeV2';

const TOGETHER_CARD_GRID_GAP = 16;
const TOGETHER_CARD_GRID_WIDE_WIDTH = 600;

export default function TogetherScreen({ navigation, route }) {
  const [rooms, setRooms] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [localInvitationRows, setLocalInvitationRows] = useState([]);
  const [modeVisible, setModeVisible] = useState(false);
  const [selectedMode, setSelectedMode] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [entryMenuVisible, setEntryMenuVisible] = useState(false);
  const [collapsedTogetherRooms, setCollapsedTogetherRooms] = useState({});
  const [togetherCollapseLoaded, setTogetherCollapseLoaded] = useState(false);
  const reloadSequenceRef = useRef(0);
  const homeActiveRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [homeLoadError, setHomeLoadError] = useState('');
  const [homeInitialLoaded, setHomeInitialLoaded] = useState(false);
  const [cardListWidth, setCardListWidth] = useState(0);
  const openEntryMenu = useCallback(() => { setEntryMenuVisible(true); }, []);
  const closeEntryMenu = useCallback(() => { setEntryMenuVisible(false); }, []);
  const openTogetherStart = useCallback(() => { setModeVisible(true); }, []);
  const openJoinEntry = useCallback(() => { navigation.navigate('TogetherJoinEntry'); }, [navigation]);
  const onCardListLayout = useCallback((event) => {
    const nextWidth = Math.round(
      Number(event?.nativeEvent?.layout?.width) || 0
    );

    if (nextWidth <= 0) return;

    setCardListWidth((previous) =>
      previous === nextWidth ? previous : nextWidth
    );
  }, []);
  const isTwoColumnCardLayout =
    cardListWidth >= TOGETHER_CARD_GRID_WIDE_WIDTH;
  const cardCellWidth = isTwoColumnCardLayout
    ? (cardListWidth - TOGETHER_CARD_GRID_GAP) / 2
    : '100%';
  useFocusEffect(useCallback(() => {
    let active = true;
    loadTogetherCollapsedRoomsV2().then((value) => {
      if (!active) return;
      setCollapsedTogetherRooms(value);
      setTogetherCollapseLoaded(true);
    }).catch((error) => {
      if (!active) return;
      console.warn('[Together] load collapse state failed', String(error?.message || 'unknown'));
      setTogetherCollapseLoaded(false);
    });
    return () => { active = false; };
  }, []));
  useEffect(() => {
    if (!togetherCollapseLoaded) return;
    saveTogetherCollapsedRoomsV2({ collapsedMap: collapsedTogetherRooms }).catch((error) => {
      console.warn('[Together] save collapse state failed', String(error?.message || 'unknown'));
    });
  }, [collapsedTogetherRooms, togetherCollapseLoaded]);
  const toggleTogetherCollapsed = useCallback((id) => {
    const key = String(id ?? '').trim();
    if (!key || !togetherCollapseLoaded) return;
    setCollapsedTogetherRooms((previous) => ({ ...previous, [key]: !previous[key] }));
  }, [togetherCollapseLoaded]);
  const reload = useCallback(async ({ manual = false } = {}) => {
    if (!homeActiveRef.current) {
      return;
    }

    const sequence = ++reloadSequenceRef.current;
    const isCurrent = () =>
      homeActiveRef.current &&
      sequence === reloadSequenceRef.current;

    if (manual) {
      setRefreshing(true);
    }

    let failed = false;

    try {
      const [draftResult, sessionResult] = await Promise.allSettled([
        loadTogetherRoomDraftsV2(),
        getExistingTogetherSession(),
      ]);

      if (!isCurrent()) return;

      if (
        draftResult.status === 'fulfilled' &&
        Array.isArray(draftResult.value)
      ) {
        setDrafts(draftResult.value);
      } else {
        failed = true;
        console.warn(
          '[Together] drafts reload failed',
          draftResult.status === 'rejected'
            ? String(draftResult.reason?.message || 'unknown')
            : 'invalid response'
        );
      }

      if (sessionResult.status === 'rejected') {
        failed = true;
        console.warn(
          '[Together] session reload failed',
          String(sessionResult.reason?.message || 'unknown')
        );
      } else if (!sessionResult.value) {
        setRooms([]);
      } else {
        try {
          const nextRooms = await loadMyTogetherRoomsV2();

          if (!Array.isArray(nextRooms)) {
            throw new Error('TOGETHER_ROOMS_RESPONSE_INVALID');
          }

          if (!isCurrent()) return;
          setRooms(nextRooms);
        } catch (error) {
          if (!isCurrent()) return;
          failed = true;
          console.warn(
            '[Together] rooms reload failed',
            String(error?.message || 'unknown')
          );
        }
      }

      if (isCurrent()) {
        setHomeLoadError(
          failed
            ? '함께 목록을 완전히 불러오지 못했어요.'
            : ''
        );
      }
    } finally {
      if (isCurrent()) {
        setRefreshing(false);
        setHomeInitialLoaded(true);
      }
    }
  }, []);
  useFocusEffect(useCallback(() => {
    homeActiveRef.current = true;
    setRefreshing(false);

    let focused = true;
    let refreshTimer = null;
    let unsubscribe = () => {};

    const scheduleRealtimeReload = () => {
      if (!focused || !homeActiveRef.current) {
        return;
      }

      if (refreshTimer !== null) {
        clearTimeout(refreshTimer);
      }

      refreshTimer = setTimeout(() => {
        refreshTimer = null;

        if (focused && homeActiveRef.current) {
          void reload();
        }
      }, 300);
    };

    void reload();

    void getExistingTogetherSession()
      .then((session) => {
        if (!focused || !session) {
          return;
        }

        try {
          unsubscribe = subscribeTogetherHomeChangesV2({
            onChange: scheduleRealtimeReload,
          });
        } catch (error) {
          console.warn(
            '[TogetherHome] realtime subscribe failed',
            String(error?.message || 'unknown')
          );
        }
      })
      .catch((error) => {
        if (!focused) return;

        console.warn(
          '[TogetherHome] realtime session check failed',
          String(error?.message || 'unknown')
        );
      });

    return () => {
      focused = false;
      homeActiveRef.current = false;
      reloadSequenceRef.current += 1;

      if (refreshTimer !== null) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }

      unsubscribe();
    };
  }, [reload]));
  useFocusEffect(useCallback(() => {
    let active = true;
    loadTogetherInvitations()
      .then((rows) => {
        if (active) setLocalInvitationRows(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (active) setLocalInvitationRows([]);
      });
    return () => { active = false; };
  }, []));
  const chooseMode = async (mode) => { setSelectedMode(mode); setModeVisible(false); setLoadingCards(true); setPickerVisible(true); try { setCards(await loadTogetherEligibleCards()); } finally { setLoadingCards(false); } };
  const selectActivity = useCallback(async (card) => {
    setPickerVisible(false);
    if (selectedMode === 'shared_goal') { navigation.navigate('TogetherSharedGoalCreate', { selectedCard: card }); return; }
    const draft = await createTogetherRoomDraftV2({ mode: selectedMode, card });
    navigation.navigate('TogetherInviteDraft', { draft, draftId: draft.id });
  }, [navigation, selectedMode]);
  useFocusEffect(
    useCallback(() => {
      const createdId = String(route?.params?.togetherCreatedPushId ?? '').trim();
      if (!createdId) return undefined;

      let active = true;
      const resumeTogetherCreation = async () => {
        try {
          const available = await loadTogetherEligibleCards();
          if (!active) return;

          const createdPush = available.find((item) => String(item?.id ?? '') === createdId);
          navigation.setParams({ togetherCreatedPushId: undefined });

          if (!createdPush) {
            Alert.alert('PUSH 확인', '새 PUSH를 저장했지만 함께할 목록에서 찾지 못했어요. 함께 화면에서 다시 선택해주세요.');
            return;
          }

          setPickerVisible(false);
          selectActivity(createdPush);
        } catch (error) {
          if (!active) return;
          console.warn('[Together] resume created PUSH failed', String(error?.message || 'unknown'));
          navigation.setParams({ togetherCreatedPushId: undefined });
          Alert.alert('함께 만들기', 'PUSH는 저장됐지만 함께 만들기를 이어가지 못했어요. 함께 화면에서 다시 선택해주세요.');
        }
      };

      void resumeTogetherCreation();
      return () => { active = false; };
    }, [navigation, route?.params?.togetherCreatedPushId, selectActivity])
  );
  const visibleTogetherRows = useMemo(
    () => resolveTogetherRoomPresentation({
      remoteRows: rooms,
      drafts,
      invitations: localInvitationRows,
    }),
    [rooms, drafts, localInvitationRows]
  );
  const visibleRemoteRooms = visibleTogetherRows.remoteRows.filter(
    (room) => room?.room_status === 'active'
  );
  const visibleRooms = visibleRemoteRooms;
  const visibleDrafts = visibleTogetherRows.drafts;
  const hasContent = visibleRooms.length > 0 || visibleDrafts.length > 0;
  const hasTogetherRoom = visibleRemoteRooms.length > 0 || visibleTogetherRows.drafts.some((draft) => Boolean(String(draft?.roomId ?? '').trim()));
  const showEmptyActions = homeInitialLoaded && !homeLoadError && !hasTogetherRoom;
  return <SafeAreaView style={surfaceStyles.screen} edges={['top', 'left', 'right']}>
    <View style={styles.header}><TouchableOpacity style={styles.settingsHeaderButton} activeOpacity={0.8} onPress={() => navigation.navigate('Settings')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="설정"><Text style={styles.settingsHeaderIcon}>☰</Text></TouchableOpacity><Text style={styles.headerTitle} pointerEvents="none">함께 PUSH</Text>{hasTogetherRoom ? <TouchableOpacity style={styles.addTogetherButton} onPress={openEntryMenu} activeOpacity={0.84} accessibilityRole="button" accessibilityLabel="함께 추가"><Text style={styles.addTogetherButtonText}>함께 추가</Text></TouchableOpacity> : <View style={styles.side} />}</View>
    <ScrollView contentContainerStyle={[styles.content, !hasContent && styles.emptyContent]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void reload({ manual: true }); }} colors={[color.primary]} tintColor={color.primary} />}>
      {!homeInitialLoaded ? <View style={styles.homeLoading}><Text style={styles.homeLoadingText}>함께 목록을 불러오는 중...</Text></View> : null}
      {homeLoadError ? <View style={styles.homeRefreshError}><Text style={styles.homeRefreshErrorText}>{homeLoadError}</Text><TouchableOpacity style={styles.homeRefreshRetry} onPress={() => { void reload({ manual: true }); }} activeOpacity={0.84} accessibilityRole="button" accessibilityLabel="함께 목록 다시 시도"><Text style={styles.homeRefreshRetryText}>다시 시도</Text></TouchableOpacity></View> : null}
      {visibleRooms.length > 0 ? (
        <View>
          <View
            style={[
              styles.cardList,
              isTwoColumnCardLayout && styles.cardListWide,
            ]}
            onLayout={onCardListLayout}
          >
            {visibleRooms.map((room) => {
              const id = String(
                room.room_id ?? room.roomId ?? room.id ?? ''
              );

              return (
                <View key={id} style={{ width: cardCellWidth }}>
                  <TogetherRoomFoldCardV2
                    room={room}
                    variant="room"
                    collapsed={!!collapsedTogetherRooms[id]}
                    onToggleCollapsed={() =>
                      toggleTogetherCollapsed(id)
                    }
                    onOpen={() =>
                      navigation.navigate(
                        'TogetherRoomDetail',
                        { roomId: id }
                      )
                    }
                  />
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
      {visibleDrafts.length > 0 ? (
        <View>
          <Text style={styles.section}>초대 준비 중</Text>

          <View
            style={[
              styles.cardList,
              isTwoColumnCardLayout && styles.cardListWide,
            ]}
            onLayout={onCardListLayout}
          >
            {visibleDrafts.map((draft) => {
              const id = String(draft?.id ?? '');

              return (
                <View key={id} style={{ width: cardCellWidth }}>
                  <TogetherRoomFoldCardV2
                    room={draft}
                    variant="draft"
                    collapsed={!!collapsedTogetherRooms[id]}
                    onToggleCollapsed={() =>
                      toggleTogetherCollapsed(id)
                    }
                    onOpen={() =>
                      navigation.navigate(
                        'TogetherInviteDraft',
                        { draft, draftId: draft.id }
                      )
                    }
                  />
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
      {homeInitialLoaded && !homeLoadError && !hasContent ? <View style={styles.empty}><Text style={styles.emptyTitle}>혼자 하던 일을{`\n`}함께 이어가보세요.</Text><Text style={styles.guide}>1 방식 선택   2 PUSH 선택   3 초대</Text></View> : null}
      {showEmptyActions ? <><TouchableOpacity style={styles.emptyStartButton} onPress={openTogetherStart}><Text style={styles.emptyStartText}>함께 시작하기</Text></TouchableOpacity><TouchableOpacity style={styles.emptyJoinButton} onPress={openJoinEntry}><Text style={styles.emptyJoinText}>초대 참여하기</Text></TouchableOpacity></> : null}
    </ScrollView>
    <TogetherModePickerModal visible={modeVisible} onClose={() => setModeVisible(false)} onSelect={chooseMode} />
    <TogetherPushPickerModal visible={pickerVisible} items={cards} loading={loadingCards} onClose={() => setPickerVisible(false)} onSelect={selectActivity} onCreatePush={() => { setPickerVisible(false); navigation.navigate('CreateChallengeType', { fromTogether: true }); }} />
    <TogetherEntryMenuModal visible={entryMenuVisible} onClose={closeEntryMenu} onStart={openTogetherStart} onJoin={openJoinEntry} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, borderBottomWidth: 1, borderColor: color.border }, settingsHeaderButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', zIndex: 2 }, settingsHeaderIcon: { color: color.textPrimary, fontSize: 22, fontWeight: '400' }, side: { width: 40, alignItems: 'center' }, headerTitle: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 17, fontWeight: font.weight.heavy }, addTogetherButton: { minWidth: 78, height: 34, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: primitive.black, borderRadius: radius.md, zIndex: 2 }, addTogetherButtonText: { color: primitive.white, fontSize: 12, fontWeight: font.weight.bold }, content: { padding: space.md, paddingBottom: 60 }, emptyContent: { flexGrow: 1, justifyContent: 'center' }, homeLoading: { alignItems: 'center', paddingVertical: space.lg }, homeLoadingText: { color: color.textSecondary, fontSize: font.size.bodySmall }, homeRefreshError: { marginBottom: space.md, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, padding: space.md, backgroundColor: color.background }, homeRefreshErrorText: { color: color.textPrimary, fontSize: font.size.bodySmall, lineHeight: 19 }, homeRefreshRetry: { minHeight: 40, alignSelf: 'flex-start', justifyContent: 'center', marginTop: space.xs, paddingHorizontal: space.sm, borderWidth: 1, borderColor: primitive.black, borderRadius: radius.sm }, homeRefreshRetryText: { color: primitive.black, fontSize: font.size.bodySmall, fontWeight: font.weight.bold }, section: { marginTop: 16, marginBottom: 10, fontSize: 16, fontWeight: font.weight.heavy }, cardList: { width: '100%', gap: 16 }, cardListWide: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' }, empty: { alignItems: 'center', marginBottom: 24 }, emptyTitle: { textAlign: 'center', fontSize: 24, lineHeight: 32, fontWeight: font.weight.heavy }, guide: { marginTop: 14, color: color.textSecondary }, emptyStartButton: { width: '100%', minHeight: 50, backgroundColor: primitive.black, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, emptyStartText: { color: primitive.white, fontSize: 14, fontWeight: font.weight.bold }, emptyJoinButton: { width: '100%', minHeight: 50, marginTop: 10, backgroundColor: primitive.white, borderWidth: 1, borderColor: primitive.black, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, emptyJoinText: { color: primitive.black, fontSize: 14, fontWeight: font.weight.bold }, primary: { minHeight: 50, backgroundColor: primitive.black, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: primitive.white, fontWeight: font.weight.bold }, linkButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center' }, linkText: { color: color.textSecondary, fontSize: 12, fontWeight: font.weight.bold, textDecorationLine: 'underline' },
});
