import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BackButton from './BackButton';
import { color, font, primitive, radius, space, surface } from '../styles/common';
import { loadTogetherAcceptedRoomByInvitationId } from '../utils/togetherIncomingInvitations';
import { loadTogetherCardSnapshot } from '../utils/togetherLocalData';
import { disconnectTogetherAcceptedRoom } from '../utils/togetherLocalLifecycle';

const getTodayLabel = (snapshot) => {
  if (snapshot?.todayState === 'done') return '완료';
  if (snapshot?.todayState === 'off') return '오늘 없음';
  return '아직';
};

export default function TogetherAcceptedRoomDetail({ invitationId }) {
  const navigation = useNavigation();
  const [room, setRoom] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const load = async () => {
        setLoading(true);

        try {
          const nextRoom = await loadTogetherAcceptedRoomByInvitationId(invitationId);
          if (!active) return;

          setRoom(nextRoom || null);

          if (!nextRoom?.challengeId) {
            setSnapshot(null);
            return;
          }

          const nextSnapshot = await loadTogetherCardSnapshot({
            challengeId: nextRoom.challengeId,
          });

          if (!active) return;
          setSnapshot(nextSnapshot || null);
        } catch {
          if (active) {
            setRoom(null);
            setSnapshot(null);
          }
        } finally {
          if (active) setLoading(false);
        }
      };

      load();

      return () => {
        active = false;
      };
    }, [invitationId])
  );

  const handleDisconnect =
    useCallback(
      () => {
        if (
          disconnecting
          || !room?.invitationId
        ) {
          return;
        }

        Alert.alert(
          '함께 활동 연결 해제',
          '이 기기에 저장된 함께 활동 연결을 해제할까요?',
          [
            {
              text: '취소',
              style: 'cancel',
            },

            {
              text: '연결 해제',
              style: 'destructive',

              onPress: async () => {
                setDisconnecting(
                  true
                );

                try {
                  await disconnectTogetherAcceptedRoom(
                    room.invitationId
                  );

                  navigation.navigate(
                    'Together'
                  );
                } finally {
                  setDisconnecting(
                    false
                  );
                }
              },
            },
          ]
        );
      },
      [
        disconnecting,
        navigation,
        room?.invitationId,
      ]
    );

  if (loading) {
    return (
      <SafeAreaView style={surface.screen}>
        <BackButton title="함께" />
        <View style={styles.loading}>
          <ActivityIndicator color={primitive.black} />
        </View>
      </SafeAreaView>
    );
  }

  if (!room) {
    return (
      <SafeAreaView style={surface.screen}>
        <BackButton title="함께" />
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>함께 정보를 찾을 수 없어요.</Text>
          <Text style={styles.emptyDescription}>저장된 초대 정보를 다시 확인해주세요.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sourceAvailable = !!snapshot;
  const streak = Math.max(0, Number(snapshot?.streak) || 0);
  const recentRecords = Array.isArray(snapshot?.recentRecords)
    ? snapshot.recentRecords
    : [];

  return (
    <SafeAreaView style={surface.screen}>
      <BackButton title="함께" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.type}>{room.invitationTypeLabel || snapshot?.typeLabel || '함께'}</Text>
          <View style={styles.waitBadge}>
            <Text style={styles.waitBadgeText}>연결 대기</Text>
          </View>
        </View>

        <Text style={styles.title}>{room.invitationTitle || snapshot?.title || room.challengeTitle}</Text>
        <Text style={styles.linkedText}>내 활동 · {snapshot?.title || room.challengeTitle}</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>오늘</Text>
            <Text style={styles.summaryValue}>{snapshot ? getTodayLabel(snapshot) : '-'}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>연속</Text>
            <Text style={styles.summaryValue}>{streak > 0 ? `${streak}일` : '-'}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>공유</Text>
            <Text style={styles.summaryValue}>완료 여부</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>나</Text>
        <View style={styles.memberCard}>
          <View>
            <Text style={styles.memberName}>내 기록</Text>
            <Text style={styles.memberDescription}>{snapshot?.title || room.challengeTitle}</Text>
          </View>
          <Text style={styles.memberState}>{snapshot ? getTodayLabel(snapshot) : '활동 확인 필요'}</Text>
        </View>

        {!sourceAvailable && (
          <View
            style={
              styles.sourceWarning
            }
          >
            <Text
              style={
                styles.sourceWarningTitle
              }
            >
              연결한 내 활동을 확인해주세요.
            </Text>

            <Text
              style={
                styles.sourceWarningDescription
              }
            >
              활동이 삭제되었거나
              완료·만료되어 현재 함께 기록에
              사용할 수 없어요.
            </Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, styles.partnerTitle]}>상대</Text>
        <View style={styles.partnerCard}>
          <Text style={styles.partnerCardTitle}>상대 기록 연결 대기</Text>
          <Text style={styles.partnerCardDescription}>현재는 이 기기의 수락 상태와{`\n`}내 기록만 연결되어 있어요.{`\n`}상대방 기록은 서버 연결 이후 표시됩니다.</Text>
        </View>

        <Text style={[styles.sectionTitle, styles.recordsTitle]}>최근 내 기록</Text>
        {recentRecords.length ? (
          <View style={styles.recordsCard}>
            {recentRecords.map((record, index) => (
              <View
                key={record?.id || `${record?.timestamp || 'record'}-${index}`}
                style={[styles.recordRow, index < recentRecords.length - 1 && styles.recordRowBorder]}
              >
                <View style={styles.recordTextWrap}>
                  <Text style={styles.recordWhen}>{record?.when || ''}{!!record?.time && ` · ${record.time}`}</Text>
                  <Text style={styles.recordDescription}>{record?.description || '활동을 완료했어요.'}</Text>
                </View>
                <Text style={styles.recordOwner}>나</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.noRecordsCard}>
            <Text style={styles.noRecordsText}>아직 표시할 완료 기록이 없어요.</Text>
          </View>
        )}

        <Text style={styles.footerNotice}>기록 내용이나 사진은 공유하지 않습니다.</Text>

        <TouchableOpacity
          style={
            styles.disconnectButton
          }
          onPress={
            handleDisconnect
          }
          disabled={
            disconnecting
          }
          activeOpacity={0.84}
        >
          <Text
            style={
              styles.disconnectButtonText
            }
          >
            {disconnecting
              ? '연결 해제 중...'
              : '함께 활동 연결 해제'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: 48 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  emptyTitle: { color: color.textPrimary, fontSize: font.size.bodyLarge, fontWeight: font.weight.bold },
  emptyDescription: { marginTop: space.sm, color: color.textSecondary, textAlign: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  type: { color: color.textSecondary, fontSize: font.size.caption, fontWeight: font.weight.bold },
  waitBadge: { borderRadius: 999, borderWidth: 1, borderColor: primitive.neutral[300], paddingHorizontal: space.sm, paddingVertical: 5 },
  waitBadgeText: { color: color.textSecondary, fontSize: font.size.caption, fontWeight: font.weight.bold },
  title: { marginTop: space.sm, color: color.textPrimary, fontSize: font.size.screenTitle, fontWeight: font.weight.heavy, lineHeight: 32 },
  linkedText: { marginTop: space.xs, color: color.textSecondary },
  summaryCard: { marginTop: space.xl, borderWidth: 1, borderColor: color.border, borderRadius: radius.card, paddingVertical: space.lg, flexDirection: 'row', alignItems: 'stretch' },
  summaryItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xs },
  summaryLabel: { color: color.textSecondary, fontSize: font.size.caption },
  summaryValue: { marginTop: 5, color: color.textPrimary, fontSize: font.size.body, fontWeight: font.weight.bold, textAlign: 'center' },
  summaryDivider: { width: 1, backgroundColor: color.border },
  sectionTitle: { marginTop: space.xl, color: color.textPrimary, fontSize: font.size.bodyLarge, fontWeight: font.weight.bold },
  partnerTitle: { marginTop: space.xl },
  recordsTitle: { marginTop: space.xl },
  memberCard: { marginTop: space.sm, borderRadius: radius.card, backgroundColor: primitive.black, padding: space.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  memberName: { color: primitive.white, fontSize: font.size.body, fontWeight: font.weight.bold },
  memberDescription: { marginTop: 4, color: primitive.neutral[400], fontSize: font.size.caption },
  memberState: { color: primitive.white, fontSize: font.size.body, fontWeight: font.weight.bold },
  partnerCard: { marginTop: space.sm, borderWidth: 1, borderColor: color.border, borderRadius: radius.card, padding: space.lg },
  partnerCardTitle: { color: color.textPrimary, fontSize: font.size.body, fontWeight: font.weight.bold },
  partnerCardDescription: { marginTop: space.sm, color: color.textSecondary, lineHeight: 20 },
  recordsCard: { marginTop: space.sm, borderWidth: 1, borderColor: color.border, borderRadius: radius.card, overflow: 'hidden' },
  recordRow: { minHeight: 68, padding: space.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  recordRowBorder: { borderBottomWidth: 1, borderBottomColor: color.border },
  recordTextWrap: { flex: 1, minWidth: 0 },
  recordWhen: { color: color.textSecondary, fontSize: font.size.caption },
  recordDescription: { marginTop: 4, color: color.textPrimary, fontSize: font.size.body, fontWeight: font.weight.bold },
  recordOwner: { color: color.textSecondary, fontSize: font.size.caption, fontWeight: font.weight.bold },
  noRecordsCard: { marginTop: space.sm, borderWidth: 1, borderColor: color.border, borderRadius: radius.card, padding: space.lg },
  noRecordsText: { color: color.textSecondary, fontSize: font.size.body },
  footerNotice: { marginTop: space.xl, color: color.textSecondary, fontSize: font.size.caption, textAlign: 'center' },
  sourceWarning: { marginTop: space.md, borderWidth: 1, borderColor: color.border, borderRadius: radius.card, padding: space.lg },
  sourceWarningTitle: { color: color.textPrimary, fontSize: font.size.body, fontWeight: font.weight.bold },
  sourceWarningDescription: { marginTop: space.xs, color: color.textSecondary, fontSize: font.size.caption, lineHeight: 19 },
  disconnectButton: { minHeight: 48, marginTop: space.xl, borderWidth: 1, borderColor: color.border, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  disconnectButtonText: { color: color.textSecondary, fontSize: font.size.body, fontWeight: font.weight.bold },
});
