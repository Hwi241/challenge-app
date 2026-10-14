import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TogetherPushPickerModal from '../components/TogetherPushPickerModal';
import { color, font, primitive, radius, space, surface as surfaceStyles } from '../styles/common';
import { normalizeTogetherInviteCode, getTogetherModeDescription, getTogetherModeLabel } from '../utils/togetherV2';
import { getTogetherInvitePreviewV2, acceptTogetherInviteV2, loadTogetherRoomSnapshotV2, initializeTogetherSharedActivityV4 } from '../utils/togetherRemoteV2';
import { ensureTogetherAnonymousSession, getExistingTogetherSession } from '../utils/togetherRemoteAuth';
import { loadTogetherDisplayName } from '../utils/togetherProfile';
import { createLocalPushFromTogetherTemplate } from '../utils/togetherPushTemplate';
import { loadTogetherEligibleCards, loadTogetherProgressMetrics } from '../utils/togetherLocalData';
import { upsertTogetherBinding } from '../utils/togetherBindings';
import { loadTogetherRoomDraftsV2 } from '../utils/togetherRoomDrafts';
import { findLocalOwnerInviteV2, isVerifiedOwnerInviteV2, resolveTogetherAcceptOutcomeV2 } from '../utils/togetherInviteAcceptanceGuardV2';
import { resolveTogetherCreatedPushResumeV2 } from '../utils/togetherInviteCreatedPushResumeV2';

export default function TogetherInviteAcceptScreen({ navigation, route }) {
  const code = normalizeTogetherInviteCode(route?.params?.code);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [result, setResult] = useState(null);
  const [picker, setPicker] = useState(false);
  const [cards, setCards] = useState([]);
  const [ownedRoomId, setOwnedRoomId] = useState('');
  const [checkingOwnInvite, setCheckingOwnInvite] = useState(false);
  const [ownInviteError, setOwnInviteError] = useState('');
  const [completedRoomId, setCompletedRoomId] = useState('');
  const [resumeBindingError, setResumeBindingError] = useState('');
  const [ownerCheckNonce, setOwnerCheckNonce] = useState(0);
  const ownerCheckSequence = useRef(0);
  const createdPushResumeConsumedRef = useRef('');
  const checkOwnInvitation = useCallback(async (inviteCode, sequence) => {
    const isCurrent = () => ownerCheckSequence.current === sequence;
    if (isCurrent()) {
      setCheckingOwnInvite(true);
      setOwnInviteError('');
      setOwnedRoomId('');
    }
    try {
      const drafts = await loadTogetherRoomDraftsV2();
      const candidate = findLocalOwnerInviteV2({ code: inviteCode, drafts });
      if (!candidate) return { isOwner: false, roomId: '' };
      const [session, snapshot] = await Promise.all([
        getExistingTogetherSession(),
        loadTogetherRoomSnapshotV2({ roomId: candidate.roomId }),
      ]);
      const verified = isVerifiedOwnerInviteV2({ snapshot, sessionUserId: session?.user?.id, expectedRoomId: candidate.roomId });
      if (verified && isCurrent()) setOwnedRoomId(candidate.roomId);
      return { isOwner: verified, roomId: verified ? candidate.roomId : '' };
    } catch (error) {
      console.warn('[TogetherInviteAccept] owner check failed', String(error?.message || 'unknown'));
      if (isCurrent()) setOwnInviteError('초대 소유자를 확인하지 못했어요. 다시 시도해주세요.');
      return { isOwner: false, roomId: '', error: true };
    } finally {
      if (isCurrent()) setCheckingOwnInvite(false);
    }
  }, []);
  useEffect(() => {
    const sequence = ++ownerCheckSequence.current;
    let active = true;
    setPreview(null);
    setError('');
    setResult(null);
    setCompletedRoomId('');
    if (!code) {
      setCheckingOwnInvite(false);
      setError('초대 코드를 확인해주세요.');
      return () => { active = false; ownerCheckSequence.current += 1; };
    }
    Promise.all([
      getTogetherInvitePreviewV2({ code }),
      checkOwnInvitation(code, sequence),
    ]).then(([value]) => {
      if (active && ownerCheckSequence.current === sequence) setPreview(value);
    }).catch(() => {
      if (active && ownerCheckSequence.current === sequence) setError('사용할 수 없는 초대예요.');
    });
    return () => {
      active = false;
      if (ownerCheckSequence.current === sequence) ownerCheckSequence.current += 1;
    };
  }, [checkOwnInvitation, code, ownerCheckNonce]);
  const completeAccepted = (accepted) => {
    const outcome = resolveTogetherAcceptOutcomeV2({ joinStatus: accepted?.joinStatus, roomId: accepted?.roomId, bindingComplete: true });
    if (outcome.state === 'complete') {
      setCompletedRoomId(outcome.roomId);
      setResult({ ...accepted, complete: true });
      return true;
    }
    setCompletedRoomId('');
    setResult(accepted);
    return false;
  };
  const bindCard = async (card) => {
    try {
      const metrics = result.mode === 'shared_goal' ? await loadTogetherProgressMetrics({ challengeId: card.id }) : null;
      await upsertTogetherBinding({ binding: { roomId: result.roomId, mode: result.mode, localChallengeId: String(card.id), baselineContribution: metrics?.contributionMetric || 0, source: 'selected' } });
      setPicker(false);
      completeAccepted(result);
    } catch {
      setCompletedRoomId('');
      setError('PUSH를 연결하지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  };
  const createdPushResumeContextRef = useRef(null);
  createdPushResumeContextRef.current = { result, bindCard };
  const returnedCreatedPushId = String(route?.params?.togetherCreatedPushId ?? '').trim();
  useFocusEffect(
    useCallback(() => {
      if (!returnedCreatedPushId || createdPushResumeConsumedRef.current === returnedCreatedPushId) return undefined;
      createdPushResumeConsumedRef.current = returnedCreatedPushId;
      let active = true;
      const resume = async () => {
        setResumeBindingError('');
        try {
          const nextCards = await loadTogetherEligibleCards();
          if (!active) return;
          const context = createdPushResumeContextRef.current;
          const resolved = resolveTogetherCreatedPushResumeV2({
            result: context?.result,
            createdPushId: returnedCreatedPushId,
            cards: nextCards,
          });
          if (resolved.status === 'invalid-acceptance') {
            setResumeBindingError('이전 초대 수락 상태를 확인할 수 없어요. 자동 연결을 진행하지 않았어요.');
            return;
          }
          setCards(nextCards);
          setPicker(true);
          if (resolved.status !== 'ready') {
            setResumeBindingError('새로 만든 PUSH를 연결 목록에서 찾지 못했어요. 목록에서 직접 선택해주세요.');
            return;
          }
          await context.bindCard(resolved.card);
        } catch (error) {
          if (!active) return;
          console.warn('[TogetherInviteAccept] created PUSH resume failed', String(error?.message || 'unknown'));
          setResumeBindingError('새 PUSH 자동 연결에 실패했어요. 기존 목록에서 다시 선택해주세요.');
        } finally {
          if (active) navigation.setParams({ togetherCreatedPushId: undefined });
        }
      };
      void resume();
      return () => { active = false; };
    }, [navigation, returnedCreatedPushId])
  );
  const continueAfterAccept = async (accepted) => {
    if (accepted.joinStatus === 'pending') { setCompletedRoomId(''); setResult(accepted); return; }
    if (accepted.mode === 'watch') { completeAccepted(accepted); return; }
    if (accepted.mode === 'shared_goal' && accepted.sharedGoal?.source === 'room_contributions_v1') {
      try { await initializeTogetherSharedActivityV4({ roomId: accepted.roomId }); completeAccepted(accepted); }
      catch (error) {
        console.warn('[TogetherInviteAccept] shared init failed', String(error?.message || 'unknown'));
        setCompletedRoomId(''); setResult({ ...accepted, sharedInitFailed: true, complete: true });
      }
      return;
    }
    if (accepted.mode === 'same_push') {
      try { const push = await createLocalPushFromTogetherTemplate({ template: accepted.pushTemplate, roomId: accepted.roomId }); await upsertTogetherBinding({ binding: { roomId: accepted.roomId, mode: accepted.mode, localChallengeId: push.id, baselineContribution: 0, source: 'clone' } }); completeAccepted(accepted); }
      catch { setCompletedRoomId(''); setResult({ ...accepted, cloneFailed: true }); }
      return;
    }
    setCompletedRoomId(''); setResult(accepted); setCards(await loadTogetherEligibleCards()); setPicker(true);
  };
  const accept = async () => {
    if (accepting || checkingOwnInvite || ownInviteError || ownedRoomId || !preview) return; setAccepting(true); setError('');
    try { const auth = await ensureTogetherAnonymousSession(); if (!auth?.ok) throw new Error('AUTH'); const displayName = await loadTogetherDisplayName(); await continueAfterAccept(await acceptTogetherInviteV2({ code, displayName })); }
    catch { setError('초대를 수락하지 못했어요. 잠시 후 다시 시도해주세요.'); }
    finally { setAccepting(false); }
  };
  const retryClone = () => continueAfterAccept(result);
  return <SafeAreaView style={surfaceStyles.screen}><View style={styles.header}><TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹</Text></TouchableOpacity><Text style={styles.headerTitle}>받은 초대</Text><View style={styles.side} /></View><ScrollView contentContainerStyle={styles.content}>
    {ownedRoomId ? <View style={styles.result}><Text style={styles.resultTitle}>이미 내가 만든 함께 방이에요.</Text><Text>이 초대는 직접 만든 방의 초대입니다. 초대를 다시 수락할 필요가 없어요.</Text><TouchableOpacity style={styles.primary} onPress={() => navigation.navigate('TogetherRoomDetail', { roomId: ownedRoomId })}><Text style={styles.primaryText}>내 함께 방으로 이동</Text></TouchableOpacity><TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.navigate('Together')}><Text>함께 화면으로 돌아가기</Text></TouchableOpacity></View> : ownInviteError ? <View style={styles.result}><Text style={styles.resultTitle}>초대 소유자를 확인하지 못했어요.</Text><Text>{ownInviteError}</Text><TouchableOpacity style={styles.primary} onPress={() => setOwnerCheckNonce((value) => value + 1)}><Text style={styles.primaryText}>다시 시도</Text></TouchableOpacity></View> : error ? <Text style={styles.error}>{error}</Text> : !preview || checkingOwnInvite ? <Text style={styles.center}>초대를 확인하는 중...</Text> : <><Text style={styles.mode}>{getTogetherModeLabel(preview.mode)}</Text><Text style={styles.title}>{preview.title}</Text><Text style={styles.description}>{getTogetherModeDescription(preview.mode)}</Text><Text style={styles.meta}>{preview.ownerDisplayName || '멤버'} · {preview.memberCount}/{preview.memberLimit}명</Text>{preview.sharedGoal ? <Text style={styles.goal}>목표 {preview.sharedGoal.target} {preview.sharedGoal.unit}</Text> : null}<View style={styles.notice}><Text>개인 기록 내용과 사진은 공유되지 않아요.</Text></View>
      {result?.sharedInitFailed ? <View style={styles.result}><Text style={styles.resultTitle}>초대는 이미 수락됐어요.</Text><Text>공동 PUSH 참여 준비를 완료하지 못했어요.</Text><TouchableOpacity style={styles.primary} onPress={retryClone}><Text style={styles.primaryText}>참여 준비 다시 시도</Text></TouchableOpacity></View> : null}
      {!result ? <TouchableOpacity style={styles.primary} onPress={accept} disabled={accepting || checkingOwnInvite}><Text style={styles.primaryText}>{accepting ? '수락하는 중...' : '초대 수락하기'}</Text></TouchableOpacity> : result.joinStatus === 'pending' ? <View style={styles.result}><Text style={styles.resultTitle}>참가 승인 요청을 보냈어요.</Text><Text>방장 또는 관리자가 승인하면 함께 방에 참여할 수 있어요.</Text><TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.navigate('Together')}><Text>함께 화면으로 돌아가기</Text></TouchableOpacity></View> : result.sharedInitFailed ? null : result.cloneFailed ? <View style={styles.result}><Text style={styles.resultTitle}>초대는 수락되었습니다.</Text><Text>PUSH를 만드는 중 문제가 생겼어요.</Text><TouchableOpacity style={styles.primary} onPress={retryClone}><Text style={styles.primaryText}>PUSH 만들기 다시 시도</Text></TouchableOpacity></View> : result.complete ? <View style={styles.result}><Text style={styles.resultTitle}>함께 방에 참여했어요!</Text><Text>함께 방에 연결되었습니다.</Text>{completedRoomId ? <TouchableOpacity style={styles.primary} onPress={() => navigation.navigate('TogetherRoomDetail', { roomId: completedRoomId })}><Text style={styles.primaryText}>함께 방으로 이동</Text></TouchableOpacity> : null}<TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.navigate('Together')}><Text>함께 화면으로 돌아가기</Text></TouchableOpacity></View> : <View style={styles.result}><Text style={styles.resultTitle}>이제 함께 기록할 내 PUSH를 연결하세요.</Text>{resumeBindingError ? <Text style={styles.error}>{resumeBindingError}</Text> : null}{cards.length === 0 ? <><Text>초대는 이미 수락되었습니다. 함께 기록할 PUSH를 만든 뒤 연결할 수 있어요.</Text><TouchableOpacity style={styles.primary} onPress={() => navigation.navigate('CreateChallengeType', { fromTogether: true, returnToTogetherInviteAccept: true })}><Text style={styles.primaryText}>PUSH 만들기</Text></TouchableOpacity></> : <TouchableOpacity style={styles.primary} onPress={() => setPicker(true)}><Text style={styles.primaryText}>내 PUSH 연결</Text></TouchableOpacity>}</View>}
    </>}
  </ScrollView><TogetherPushPickerModal visible={picker} items={cards} loading={false} onClose={() => setPicker(false)} onSelect={bindCard} onCreatePush={() => { setPicker(false); navigation.navigate('CreateChallengeType', { fromTogether: true, returnToTogetherInviteAccept: true }); }} /></SafeAreaView>;
}
const styles = StyleSheet.create({ header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, borderBottomWidth: 1, borderColor: color.border }, back: { fontSize: 34 }, headerTitle: { fontSize: 16, fontWeight: font.weight.heavy }, side: { width: 24 }, content: { padding: space.lg }, center: { textAlign: 'center', marginTop: 80 }, error: { marginTop: 80, color: color.textSecondary, textAlign: 'center' }, mode: { color: color.textSecondary, fontWeight: font.weight.bold }, title: { marginTop: 8, fontSize: 27, fontWeight: font.weight.heavy }, description: { marginTop: 7, color: color.textSecondary }, meta: { marginTop: 15, fontWeight: font.weight.bold }, goal: { marginTop: 8 }, notice: { marginTop: 22, padding: 14, borderWidth: 1, borderColor: color.border, borderRadius: radius.md }, primary: { marginTop: 24, minHeight: 50, borderRadius: radius.md, backgroundColor: primitive.black, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: primitive.white, fontWeight: font.weight.bold }, secondaryAction: { minHeight: 44, marginTop: 8, alignItems: 'center', justifyContent: 'center' }, result: { marginTop: 28, padding: 18, borderWidth: 1, borderColor: color.border, borderRadius: radius.md }, resultTitle: { marginBottom: 7, fontSize: 17, fontWeight: font.weight.heavy } });
