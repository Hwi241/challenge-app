import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import TogetherQrCode from '../components/TogetherQrCode';
import { color, font, primitive, radius, space, surface as surfaceStyles } from '../styles/common';
import { ensureTogetherAnonymousSession } from '../utils/togetherRemoteAuth';
import { loadTogetherRoomDraftByIdV2, updateTogetherRoomDraftRemoteV2, cancelTogetherRoomDraftV2 } from '../utils/togetherRoomDrafts';
import { loadTogetherDisplayName } from '../utils/togetherProfile';
import { loadTogetherEligibleCards, loadTogetherProgressMetrics } from '../utils/togetherLocalData';
import { buildTogetherPushTemplate } from '../utils/togetherPushTemplate';
import { createTogetherRoomV2, initializeTogetherSharedActivityV4 } from '../utils/togetherRemoteV2';
import { upsertTogetherBinding } from '../utils/togetherBindings';
import { buildTogetherInviteLink, getTogetherModeDescription, getTogetherModeLabel } from '../utils/togetherV2';
import useTogetherInvitePresenceV2 from '../hooks/useTogetherInvitePresenceV2';

export default function TogetherInviteDraftScreen({ navigation, route }) {
  const routeDraft = route?.params?.draft || null;
  const draftId = String(routeDraft?.id || route?.params?.draftId || '');
  const [draft, setDraft] = useState(routeDraft);
  const [preparing, setPreparing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState('');
  const inviteRoomId = String(createdRoomId || draft?.roomId || '').trim();
  const invitePresence = useTogetherInvitePresenceV2(inviteRoomId);
  useEffect(() => {
    if (!routeDraft && draftId) {
      loadTogetherRoomDraftByIdV2({ draftId }).then((loadedDraft) => {
        setDraft(loadedDraft);
        setCreatedRoomId(String(loadedDraft?.roomId ?? '').trim());
      });
    }
  }, [draftId, routeDraft]);
  const link = buildTogetherInviteLink(draft?.inviteCode);
  const prepareInvitation = useCallback(async () => {
    if (!draft || preparing) return;
    setPreparing(true);
    try {
      const auth = await ensureTogetherAnonymousSession();
      if (!auth?.ok) throw new Error(auth?.reason || 'TOGETHER_AUTH_FAILED');
      const newShared = draft.mode === 'shared_goal' && draft.sharedGoal?.source === 'room_contributions_v1';
      const displayName = await loadTogetherDisplayName();
      const cards = newShared ? [] : await loadTogetherEligibleCards();
      const card = newShared ? null : cards.find((item) => String(item.id) === draft.challengeId);
      if (!newShared && !card) throw new Error('TOGETHER_LOCAL_PUSH_NOT_FOUND');
      const pushTemplate = !newShared && ['watch', 'same_push'].includes(draft.mode) ? buildTogetherPushTemplate(card) : null;
      let timezone = 'Asia/Seoul'; try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || timezone; } catch {}
      const remote = await createTogetherRoomV2({ mode: draft.mode, title: draft.title, timezone, pushTemplate, sharedGoal: draft.sharedGoal, requestId: draft.requestId, displayName });
      if (newShared) await initializeTogetherSharedActivityV4({ roomId: remote.roomId });
      else {
        const metrics = draft.mode === 'shared_goal' ? await loadTogetherProgressMetrics({ challengeId: draft.challengeId }) : null;
        await upsertTogetherBinding({ binding: { roomId: remote.roomId, mode: draft.mode, localChallengeId: draft.challengeId, baselineContribution: metrics?.contributionMetric || 0, source: 'owner' } });
      }
      setDraft(await updateTogetherRoomDraftRemoteV2({ draftId: draft.id, ...remote }));
      setCreatedRoomId(String(remote.roomId).trim());
    } catch (error) {
      console.warn('[Together] create v2 room failed', error?.message || 'unknown');
      Alert.alert('초대 오류', '초대 링크를 만들지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally { setPreparing(false); }
  }, [draft, preparing]);
  const copy = async () => { if (link) { await Clipboard.setStringAsync(link); setCopied(true); } };
  const share = async () => { if (link) await Share.share({ title: 'THE PUSH 함께하기', message: `${draft.title}\n${link}` }); };
  const cancel = () => Alert.alert('초대 준비 취소', '이 초대 준비를 삭제할까요?', [{ text: '계속 준비', style: 'cancel' }, { text: '삭제', style: 'destructive', onPress: async () => { await cancelTogetherRoomDraftV2({ draftId }); navigation.navigate('Together'); } }]);
  return <SafeAreaView style={surfaceStyles.screen}><View style={styles.header}><TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹</Text></TouchableOpacity><Text style={styles.headerTitle}>친구 초대</Text><View style={styles.side} /></View><ScrollView contentContainerStyle={styles.content}>
    {!draft ? <Text style={styles.center}>초대 준비 정보를 찾을 수 없어요.</Text> : <><Text style={styles.mode}>{getTogetherModeLabel(draft.mode)}</Text><Text style={styles.title}>{draft.title}</Text><Text style={styles.description}>{getTogetherModeDescription(draft.mode)}</Text><View style={styles.notice}><Text style={styles.noticeTitle}>개인 기록은 공유하지 않아요.</Text><Text style={styles.noticeText}>완료 상태와 진행 정보만 공유하며 인증 글, 사진, 메모는 보내지 않습니다.</Text></View>
      {!link ? <TouchableOpacity style={styles.primary} onPress={prepareInvitation} disabled={preparing}><Text style={styles.primaryText}>{preparing ? '만드는 중...' : '초대 링크 만들기'}</Text></TouchableOpacity> : <><Text style={styles.section}>초대 QR</Text><View style={styles.qr}><TogetherQrCode value={link} size={210} color={primitive.black} backgroundColor={primitive.white} /></View><Text style={styles.label}>초대 코드</Text><Text style={styles.code} selectable>{draft.inviteCode}</Text><Text style={styles.label}>초대 링크</Text><Text style={styles.link} selectable>{link}</Text><View style={styles.row}><TouchableOpacity style={styles.secondary} onPress={copy}><Text>{copied ? '복사됨' : '링크 복사'}</Text></TouchableOpacity><TouchableOpacity style={styles.primarySmall} onPress={share}><Text style={styles.primaryText}>공유하기</Text></TouchableOpacity></View>{inviteRoomId ? <View style={styles.invitePresenceCard}>{invitePresence.status === 'joined' ? <><Text style={styles.invitePresenceTitle}>친구가 참여했어요!</Text><Text style={styles.invitePresenceDescription}>{invitePresence.joinedCount}명이 함께 방에 참여했습니다.</Text><TouchableOpacity style={styles.invitePresenceButton} activeOpacity={0.84} onPress={() => navigation.navigate('TogetherRoomDetail', { roomId: inviteRoomId })}><Text style={styles.invitePresenceButtonText}>함께 PUSH로 이동</Text></TouchableOpacity></> : invitePresence.status === 'unavailable' ? <><Text style={styles.invitePresenceTitle}>방 상태를 확인해주세요.</Text><Text style={styles.invitePresenceDescription}>현재 계정에서 이 방의 초대 상태를 확인할 수 없어요.</Text></> : <><Text style={styles.invitePresenceTitle}>초대 대기 중</Text><Text style={styles.invitePresenceDescription}>친구가 초대를 수락하면 이 화면에 자동으로 표시됩니다.</Text></>}{invitePresence.error ? <Text style={styles.invitePresenceError}>{invitePresence.error}</Text> : null}<TouchableOpacity style={styles.invitePresenceExit} activeOpacity={0.8} onPress={() => navigation.navigate('Together')}><Text style={styles.invitePresenceExitText}>함께 화면으로 돌아가기</Text></TouchableOpacity></View> : null}</>}
      <TouchableOpacity style={styles.cancel} onPress={cancel}><Text style={styles.cancelText}>초대 준비 취소</Text></TouchableOpacity></>}
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, borderBottomWidth: 1, borderColor: color.border }, back: { fontSize: 34 }, headerTitle: { fontSize: 16, fontWeight: font.weight.heavy }, side: { width: 24 }, content: { padding: space.lg, paddingBottom: 80 }, center: { textAlign: 'center', marginTop: 80 }, mode: { color: color.textSecondary, fontWeight: font.weight.bold }, title: { marginTop: 8, fontSize: 27, color: color.textPrimary, fontWeight: font.weight.heavy }, description: { marginTop: 8, color: color.textSecondary }, notice: { marginTop: 24, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, padding: 15 }, noticeTitle: { fontWeight: font.weight.bold }, noticeText: { marginTop: 5, color: color.textSecondary, lineHeight: 18 }, primary: { marginTop: 28, minHeight: 50, backgroundColor: primitive.black, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: primitive.white, fontWeight: font.weight.bold }, section: { marginTop: 28, fontSize: 16, fontWeight: font.weight.heavy }, qr: { alignSelf: 'center', marginTop: 14, padding: 16, borderWidth: 1, borderColor: color.border, borderRadius: radius.md }, label: { marginTop: 18, color: color.textSecondary, fontSize: 11 }, code: { marginTop: 6, fontSize: 24, letterSpacing: 2, fontWeight: font.weight.heavy }, link: { marginTop: 6, color: color.textPrimary }, row: { flexDirection: 'row', gap: 10, marginTop: 18 }, secondary: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, primarySmall: { flex: 1, minHeight: 46, backgroundColor: primitive.black, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, invitePresenceCard: { marginTop: space.lg, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, padding: space.lg, alignItems: 'center' }, invitePresenceTitle: { color: color.textPrimary, fontSize: 16, lineHeight: 22, fontWeight: font.weight.heavy, textAlign: 'center' }, invitePresenceDescription: { marginTop: 8, color: color.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center' }, invitePresenceError: { marginTop: 10, color: color.textSecondary, fontSize: 12, textAlign: 'center' }, invitePresenceButton: { width: '100%', minHeight: 48, marginTop: 18, backgroundColor: primitive.black, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, invitePresenceButtonText: { color: primitive.white, fontSize: 14, fontWeight: font.weight.bold }, invitePresenceExit: { minHeight: 44, marginTop: 8, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }, invitePresenceExitText: { color: color.textSecondary, fontSize: 13, fontWeight: font.weight.medium }, cancel: { minHeight: 44, marginTop: 24, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: color.textSecondary, textDecorationLine: 'underline' },
});
