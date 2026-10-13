import React, { useCallback, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import TogetherPushPickerModal from '../components/TogetherPushPickerModal';
import TogetherRoomInvitePanelV2 from '../components/TogetherRoomInvitePanelV2';
import TogetherRoomOverviewV3 from '../components/TogetherRoomOverviewV3';
import TogetherRoomWeeklyV3 from '../components/TogetherRoomWeeklyV3';
import { color, font, primitive, radius, space, surface as surfaceStyles } from '../styles/common';
import { loadTogetherRoomSnapshotV2, subscribeTogetherRoomV2 } from '../utils/togetherRemoteV2';
import { getTogetherModeLabel } from '../utils/togetherV2';
import { loadTogetherBindingByRoomId, upsertTogetherBinding } from '../utils/togetherBindings';
import { loadTogetherEligibleCards, loadTogetherProgressMetrics } from '../utils/togetherLocalData';
import { createLocalPushFromTogetherTemplate } from '../utils/togetherPushTemplate';
import { syncTogetherMemberDisplayNameV2 } from '../utils/togetherMemberDisplayNameSyncV2';

export default function TogetherRoomDetailScreen({ navigation, route }) {
  const roomId = String(route?.params?.roomId || '');
  const [snapshot, setSnapshot] = useState(null);
  const [binding, setBinding] = useState(null);
  const [picker, setPicker] = useState(false);
  const [cards, setCards] = useState([]);
  const requestSequenceRef = useRef(0);
  const screenActiveRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const load = useCallback(async ({ manual = false } = {}) => {
    const targetRoomId = String(roomId ?? '').trim();
    const sequence = ++requestSequenceRef.current;

    if (manual && screenActiveRef.current) {
      setRefreshing(true);
    }

    try {
      if (!targetRoomId) {
        throw new Error('TOGETHER_ROOM_REQUIRED');
      }

      let nextSnapshot = await loadTogetherRoomSnapshotV2({ roomId: targetRoomId });

      if (
        !nextSnapshot ||
        typeof nextSnapshot !== 'object' ||
        !nextSnapshot.room ||
        typeof nextSnapshot.room !== 'object' ||
        !String(nextSnapshot.room.id ?? '').trim()
      ) {
        throw new Error('TOGETHER_ROOM_SNAPSHOT_INVALID');
      }

      if (!screenActiveRef.current || sequence !== requestSequenceRef.current) {
        return null;
      }

      try {
        const displayNameChanged =
          await syncTogetherMemberDisplayNameV2({
            roomId: targetRoomId,
          });

        if (
          displayNameChanged &&
          screenActiveRef.current &&
          sequence === requestSequenceRef.current
        ) {
          const refreshedSnapshot =
            await loadTogetherRoomSnapshotV2({
              roomId: targetRoomId,
            });

          if (
            refreshedSnapshot?.room &&
            String(
              refreshedSnapshot.room.id ?? ''
            ).trim()
          ) {
            nextSnapshot = refreshedSnapshot;
          }
        }
      } catch (error) {
        if (
          screenActiveRef.current &&
          sequence === requestSequenceRef.current
        ) {
          console.warn(
            '[TogetherRoomDetail] display name sync failed',
            String(error?.message || 'unknown')
          );
        }
      }

      if (!screenActiveRef.current || sequence !== requestSequenceRef.current) {
        return null;
      }

      setSnapshot(nextSnapshot);
      setLoadError('');

      try {
        const nextBinding = await loadTogetherBindingByRoomId({ roomId: targetRoomId });
        const metrics = nextBinding?.localChallengeId
          ? await loadTogetherProgressMetrics({ challengeId: nextBinding.localChallengeId })
          : null;

        if (screenActiveRef.current && sequence === requestSequenceRef.current) {
          setBinding(metrics ? nextBinding : null);
        }
      } catch (error) {
        if (screenActiveRef.current && sequence === requestSequenceRef.current) {
          console.warn(
            '[TogetherRoomDetail] local binding load failed',
            String(error?.message || 'unknown')
          );
        }
      }

      return nextSnapshot;
    } catch (error) {
      if (!screenActiveRef.current || sequence !== requestSequenceRef.current) {
        return null;
      }

      console.warn(
        '[TogetherRoomDetail] snapshot load failed',
        String(error?.message || 'unknown')
      );
      setLoadError('함께 방 정보를 불러오지 못했어요.');

      if (manual) {
        Alert.alert(
          '새로고침 실패',
          '최신 방 정보를 불러오지 못했어요. 다시 시도해주세요.'
        );
      }

      return null;
    } finally {
      if (screenActiveRef.current && sequence === requestSequenceRef.current) {
        setRefreshing(false);
      }
    }
  }, [roomId]);
  useFocusEffect(
    useCallback(() => {
      screenActiveRef.current = true;
      let unsubscribe = () => {};

      void load();

      if (roomId) {
        try {
          unsubscribe = subscribeTogetherRoomV2({
            roomId,
            onChange: () => {
              if (screenActiveRef.current) {
                void load();
              }
            },
          });
        } catch (error) {
          console.warn(
            '[TogetherRoomDetail] realtime subscribe failed',
            String(error?.message || 'unknown')
          );
        }
      }

      return () => {
        screenActiveRef.current = false;
        requestSequenceRef.current += 1;

        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    }, [load, roomId])
  );
  const room = snapshot?.room;
  const members = snapshot?.members || [];
  const connect = async () => { if (room.mode === 'same_push') { const push = await createLocalPushFromTogetherTemplate({ template: room.pushTemplate, roomId }); await upsertTogetherBinding({ binding: { roomId, mode: room.mode, localChallengeId: push.id, baselineContribution: 0, source: 'clone' } }); await load(); return; } setCards(await loadTogetherEligibleCards()); setPicker(true); };
  const choose = async (card) => { const metrics = room.mode === 'shared_goal' ? await loadTogetherProgressMetrics({ challengeId: card.id }) : null; await upsertTogetherBinding({ binding: { roomId, mode: room.mode, localChallengeId: card.id, baselineContribution: metrics?.contributionMetric || 0, source: 'selected' } }); setPicker(false); await load(); };
  if (!room) return <SafeAreaView style={surfaceStyles.screen}><Text style={styles.loading}>{loadError ? '함께 방 정보를 불러오지 못했어요.' : '함께 방을 불러오는 중...'}</Text>{loadError ? <TouchableOpacity style={styles.retryButton} onPress={() => { setLoadError(''); void load({ manual: true }); }} activeOpacity={0.84} accessibilityRole="button" accessibilityLabel="다시 시도"><Text style={styles.retryButtonText}>다시 시도</Text></TouchableOpacity> : null}</SafeAreaView>;
  return <SafeAreaView style={surfaceStyles.screen}><View style={styles.header}><TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹</Text></TouchableOpacity><Text style={styles.headerTitle}>함께 PUSH</Text>{['owner', 'admin', 'member'].includes(room.myRole) ? <TouchableOpacity style={styles.manageButton} onPress={() => navigation.navigate('TogetherRoomManage', { roomId })} activeOpacity={0.84} accessibilityRole="button" accessibilityLabel="함께 PUSH 관리"><Text style={styles.manageButtonText}>관리</Text></TouchableOpacity> : <View style={styles.side} />}</View><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load({ manual: true }); }} colors={[color.primary]} tintColor={color.primary} />}>
    <Text style={styles.mode}>{getTogetherModeLabel(room.mode)}</Text><Text style={styles.title}>{room.title}</Text><Text style={styles.meta}>{members.length}/{room.memberLimit}명</Text>{['owner', 'admin'].includes(room.myRole) ? <TogetherRoomInvitePanelV2 activeInvite={snapshot?.activeInvite} memberCount={members.length} onManage={() => navigation.navigate('TogetherRoomManage', { roomId })} /> : null}
    {!binding && room.mode !== 'watch' ? <TouchableOpacity style={styles.primary} onPress={connect}><Text style={styles.primaryText}>{room.mode === 'same_push' ? '내 PUSH 만들기' : '내 PUSH 연결'}</Text></TouchableOpacity> : null}
    <TogetherRoomOverviewV3 room={room} members={members} />
    <TogetherRoomWeeklyV3 room={room} members={members} />
  </ScrollView><TogetherPushPickerModal visible={picker} items={cards} loading={false} onClose={() => setPicker(false)} onSelect={choose} onCreatePush={() => { setPicker(false); navigation.navigate('CreateChallengeType'); }} /></SafeAreaView>;
}
const styles = StyleSheet.create({ header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, borderBottomWidth: 1, borderColor: color.border }, back: { fontSize: 34 }, headerTitle: { fontSize: 16, fontWeight: font.weight.heavy }, manageButton: { minWidth: 58, height: 34, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: primitive.white, borderWidth: 1, borderColor: primitive.black, borderRadius: radius.md }, manageButtonText: { color: primitive.black, fontSize: 13, fontWeight: font.weight.bold }, side: { width: 30 }, loading: { marginTop: 100, textAlign: 'center' }, retryButton: { minHeight: 44, minWidth: 140, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 16, paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: primitive.black }, retryButtonText: { color: primitive.white, fontSize: 14, fontWeight: font.weight.bold }, content: { padding: space.lg }, mode: { color: color.textSecondary, fontWeight: font.weight.bold }, title: { marginTop: 7, fontSize: 27, fontWeight: font.weight.heavy }, meta: { marginTop: 8, color: color.textSecondary }, goal: { marginTop: 24 }, goalValue: { fontSize: 21, fontWeight: font.weight.heavy }, track: { marginTop: 10, height: 8, backgroundColor: color.border, borderRadius: 4, overflow: 'hidden' }, fill: { height: 8, backgroundColor: primitive.black }, primary: { marginTop: 22, minHeight: 48, backgroundColor: primitive.black, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: primitive.white, fontWeight: font.weight.bold }, section: { marginTop: 30, marginBottom: 10, fontSize: 17, fontWeight: font.weight.heavy }, member: { minHeight: 72, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: color.border }, memberName: { fontWeight: font.weight.bold }, role: { marginTop: 3, color: color.textSecondary, fontSize: 11 }, state: { textAlign: 'right', color: color.textSecondary, fontSize: 11 } });
