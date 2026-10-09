import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import Svg, { Path } from 'react-native-svg';
import TogetherQrCode from '../components/TogetherQrCode';
import {
  color, font, primitive, radius, space,
  surface as canonicalSurfaceStyles,
  text as canonicalTextStyles,
} from '../styles/common';
import { loadTogetherRoomDraftById } from '../utils/togetherRoomDrafts';
import { createOrReuseTogetherInvitation, loadTogetherInvitationByDraftId } from '../utils/togetherInvitations';
import { cancelTogetherRoomDraft } from '../utils/togetherLocalLifecycle';

const BackIcon = memo(function BackIcon() {
  return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" pointerEvents="none"><Path d="M15 5L8 12L15 19" stroke={color.textPrimary} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
});

const CheckIcon = memo(function CheckIcon() {
  return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" pointerEvents="none"><Path d="M5 12.5L9.5 17L19 7.5" stroke={primitive.white} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
});

const PrivacyRow = memo(function PrivacyRow({ children }) {
  return <View style={styles.privacyRow}><View style={styles.checkCircle}><CheckIcon /></View><Text style={styles.privacyRowText}>{children}</Text></View>;
});

export default function TogetherInviteDraftScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const routeDraft = route?.params?.draft || null;
  const draftId = String(routeDraft?.id || route?.params?.draftId || '');
  const [draft, setDraft] = useState(routeDraft);
  const [loading, setLoading] = useState(!routeDraft && !!draftId);
  const [invitation, setInvitation] = useState(null);
  const [invitationLoading, setInvitationLoading] = useState(!!draftId);
  const [preparing, setPreparing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cancellingDraft, setCancellingDraft] = useState(false);
  const copyTimerRef = useRef(null);

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  useEffect(() => {
    let alive = true;
    if (routeDraft || !draftId) {
      setLoading(false);
      return () => { alive = false; };
    }
    setLoading(true);
    loadTogetherRoomDraftById({ draftId })
      .then((nextDraft) => {
        if (alive) setDraft(nextDraft || null);
      })
      .catch((error) => {
        console.warn('[Together] load invite draft failed', error);
        if (alive) setDraft(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [draftId, routeDraft]);

  useEffect(() => {
    let alive = true;
    if (!draftId) {
      setInvitation(null);
      setInvitationLoading(false);
      return () => { alive = false; };
    }
    setInvitationLoading(true);
    loadTogetherInvitationByDraftId({ draftId })
      .then((nextInvitation) => {
        if (alive) setInvitation(nextInvitation || null);
      })
      .catch((error) => {
        console.warn('[Together] load invitation failed', error);
        if (alive) setInvitation(null);
      })
      .finally(() => {
        if (alive) setInvitationLoading(false);
      });
    return () => { alive = false; };
  }, [draftId]);

  const prepareInvitation = useCallback(async () => {
    if (!draft || preparing) return;
    setPreparing(true);
    try {
      setInvitation(await createOrReuseTogetherInvitation({ draft }));
    } catch (error) {
      console.warn('[Together] create invitation failed', error);
    } finally {
      setPreparing(false);
    }
  }, [draft, preparing]);

  const copyLink = useCallback(async () => {
    if (!invitation?.link) return;
    try {
      await Clipboard.setStringAsync(invitation.link);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, 1600);
    } catch (error) {
      console.warn('[Together] copy invitation failed', error);
    }
  }, [invitation?.link]);

  const shareInvitation = useCallback(async () => {
    if (!invitation?.link || sharing) return;
    setSharing(true);
    try {
      await Share.share({
        title: 'THE PUSH 함께하기',
        message: `THE PUSH에서 "${invitation.title}" 함께하기\n${invitation.link}`,
        url: invitation.link,
      });
    } catch (error) {
      console.warn('[Together] share invitation failed', error);
    } finally {
      setSharing(false);
    }
  }, [invitation, sharing]);

  const handleCancelDraft =
    useCallback(
      () => {
        const safeDraftId =
          String(
            draftId
            ?? ''
          ).trim();

        if (
          !safeDraftId
          || cancellingDraft
        ) {
          return;
        }

        Alert.alert(
          '초대 준비 취소',
          '이 초대 준비를 삭제할까요?',
          [
            {
              text: '계속 준비',
              style: 'cancel',
            },

            {
              text: '삭제',
              style: 'destructive',

              onPress: async () => {
                setCancellingDraft(
                  true
                );

                try {
                  await cancelTogetherRoomDraft(
                    safeDraftId
                  );

                  navigation.navigate(
                    'Together'
                  );
                } finally {
                  setCancellingDraft(
                    false
                  );
                }
              },
            },
          ]
        );
      },
      [
        cancellingDraft,
        draftId,
        navigation,
      ]
    );

  const ready = !!invitation?.link;

  return (
    <SafeAreaView style={canonicalSurfaceStyles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerSide} activeOpacity={0.72} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><BackIcon /></TouchableOpacity>
        <View pointerEvents="none" style={styles.headerTitleLayer}><Text style={[canonicalTextStyles.headerTitle, styles.headerTitle]}>친구 초대</Text></View>
        <View style={styles.headerSide} />
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom:
              Math.max(
                insets.bottom + 72,
                96
              ),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.stateBlock}><Text style={styles.stateTitle}>초대 준비를 불러오는 중...</Text></View>
        ) : !draft ? (
          <View style={styles.stateBlock}><Text style={styles.stateTitle}>초대 준비 정보를 찾을 수 없어요.</Text><Text style={styles.stateDescription}>함께 화면으로 돌아가 다시 시작해 주세요.</Text></View>
        ) : (
          <>
            <View style={[styles.statusBadge, ready ? styles.statusBadgeReady : null]}><Text style={[styles.statusBadgeText, ready ? styles.statusBadgeTextReady : null]}>{ready ? '초대 준비 완료' : '초대 준비 중'}</Text></View>
            <Text style={styles.eyebrow}>{draft.typeLabel}</Text>
            <Text style={styles.title}>{draft.title}</Text>
            <Text style={styles.description}>이 활동을 친구 한 명과 함께 이어갑니다.</Text>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>함께 보게 되는 정보</Text>
            <View style={styles.privacyCard}><PrivacyRow>오늘 완료 여부</PrivacyRow><PrivacyRow>내 활동 연속 기록</PrivacyRow><PrivacyRow>최근 완료 기록</PrivacyRow></View>
            <View style={styles.privateNotice}><Text style={styles.privateNoticeTitle}>개인 기록은 공유하지 않아요.</Text><Text style={styles.privateNoticeText}>인증 글과 사진 같은 기록 내용은{`\n`}친구에게 보내지 않고 완료 사실만 공유합니다.</Text></View>
            <View style={styles.divider} />
            {invitationLoading ? (
              <View style={styles.invitationLoading}><Text style={styles.invitationLoadingText}>기존 초대를 확인하는 중...</Text></View>
            ) : !ready ? (
              <>
                <Text style={styles.sectionTitle}>친구에게 보내기</Text>
                <Text style={styles.nextDescription}>초대 링크를 만들면 QR이나 시스템 공유로{`\n`}친구에게 전달할 수 있어요.</Text>
                <TouchableOpacity style={[styles.primaryButton, preparing ? styles.primaryButtonBusy : null]} activeOpacity={0.84} disabled={preparing} onPress={prepareInvitation} accessibilityRole="button" accessibilityLabel="초대 링크 만들기"><Text style={styles.primaryButtonText}>{preparing ? '만드는 중...' : '초대 링크 만들기'}</Text></TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>초대 QR</Text>
                <Text style={styles.nextDescription}>친구가 이 QR을 스캔하거나{`\n`}아래 링크를 열면 초대를 받을 수 있어요.</Text>
                <View style={styles.qrCard}><TogetherQrCode value={invitation.link} size={210} color={primitive.black} backgroundColor={primitive.white} errorCorrectionLevel="M" /></View>
                <Text style={styles.linkLabel}>초대 링크</Text>
                <View style={styles.linkBox}><Text style={styles.linkText} selectable>{invitation.link}</Text></View>
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.8} onPress={copyLink} accessibilityRole="button" accessibilityLabel="초대 링크 복사"><Text style={styles.secondaryButtonText}>{copied ? '복사됨' : '링크 복사'}</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.shareButton} activeOpacity={0.84} disabled={sharing} onPress={shareInvitation} accessibilityRole="button" accessibilityLabel="초대 공유하기"><Text style={styles.shareButtonText}>{sharing ? '공유 중...' : '공유하기'}</Text></TouchableOpacity>
                </View>
                <View style={styles.receiveNotice}><Text style={styles.receiveNoticeTitle}>수락 연결은 다음 단계에서 적용됩니다.</Text><Text style={styles.receiveNoticeText}>지금은 초대 링크와 QR을 안전하게 만들고{`\n`}전달하는 단계입니다. 링크를 받은 친구의{`\n`}수락 화면은 다음 작업에서 연결합니다.</Text></View>
              </>
            )}
            <TouchableOpacity
              style={
                styles.cancelDraftButton
              }
              onPress={
                handleCancelDraft
              }
              disabled={
                cancellingDraft
              }
              activeOpacity={0.84}
            >
              <Text
                style={
                  styles.cancelDraftButtonText
                }
              >
                {cancellingDraft
                  ? '삭제 중...'
                  : '초대 준비 취소'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, borderBottomWidth: 1, borderBottomColor: color.border, position: 'relative' },
  headerSide: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  headerTitleLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { textAlign: 'center' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: space.md, paddingTop: 24, paddingBottom: 42 },
  stateBlock: { minHeight: 220, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  stateTitle: { color: color.textPrimary, fontSize: 15, lineHeight: 21, fontWeight: font.weight.bold, textAlign: 'center' },
  stateDescription: { marginTop: 8, color: color.textSecondary, fontSize: 12, lineHeight: 18, fontWeight: font.weight.medium, textAlign: 'center' },
  statusBadge: { alignSelf: 'flex-start', minHeight: 25, paddingHorizontal: 10, borderRadius: 13, borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center' },
  statusBadgeReady: { backgroundColor: primitive.black, borderColor: primitive.black },
  statusBadgeText: { color: color.textPrimary, fontSize: 10, lineHeight: 13, fontWeight: font.weight.heavy },
  statusBadgeTextReady: { color: primitive.white },
  eyebrow: { marginTop: 22, color: color.textSecondary, fontSize: 11, lineHeight: 15, fontWeight: font.weight.bold },
  title: { marginTop: 5, color: color.textPrimary, fontSize: 26, lineHeight: 33, fontWeight: font.weight.heavy },
  description: { marginTop: 8, color: color.textSecondary, fontSize: 13, lineHeight: 20, fontWeight: font.weight.medium },
  divider: { height: 1, backgroundColor: color.border, marginVertical: 26 },
  sectionTitle: { color: color.textPrimary, fontSize: 16, lineHeight: 21, fontWeight: font.weight.heavy },
  privacyCard: { marginTop: 13, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, paddingVertical: 4, paddingHorizontal: 15 },
  privacyRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center' },
  checkCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: primitive.black, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  privacyRowText: { flex: 1, color: color.textPrimary, fontSize: 12, lineHeight: 17, fontWeight: font.weight.bold },
  privateNotice: { marginTop: 14, paddingVertical: 14, paddingHorizontal: 15, borderWidth: 1, borderColor: color.border, borderRadius: radius.md },
  privateNoticeTitle: { color: color.textPrimary, fontSize: 12, lineHeight: 16, fontWeight: font.weight.bold },
  privateNoticeText: { marginTop: 5, color: color.textSecondary, fontSize: 11, lineHeight: 17, fontWeight: font.weight.medium },
  nextDescription: { marginTop: 8, color: color.textSecondary, fontSize: 12, lineHeight: 19, fontWeight: font.weight.medium },
  invitationLoading: { minHeight: 90, alignItems: 'center', justifyContent: 'center' },
  invitationLoadingText: { color: color.textSecondary, fontSize: 11, lineHeight: 17, fontWeight: font.weight.medium },
  primaryButton: { minHeight: 48, marginTop: 18, borderRadius: radius.md, backgroundColor: primitive.black, alignItems: 'center', justifyContent: 'center' },
  primaryButtonBusy: { opacity: 0.55 },
  primaryButtonText: { color: primitive.white, fontSize: 14, lineHeight: 18, fontWeight: font.weight.heavy },
  qrCard: { alignSelf: 'center', marginTop: 22, padding: 16, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, backgroundColor: primitive.white },
  linkLabel: { marginTop: 24, color: color.textPrimary, fontSize: 11, lineHeight: 15, fontWeight: font.weight.bold },
  linkBox: { marginTop: 8, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, paddingVertical: 11, paddingHorizontal: 12 },
  linkText: { color: color.textSecondary, fontSize: 10, lineHeight: 16, fontWeight: font.weight.medium },
  actionRow: { flexDirection: 'row', marginTop: 12, gap: 10 },
  secondaryButton: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: color.textPrimary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: color.textPrimary, fontSize: 13, lineHeight: 17, fontWeight: font.weight.heavy },
  shareButton: { flex: 1, minHeight: 46, borderRadius: radius.md, backgroundColor: primitive.black, alignItems: 'center', justifyContent: 'center' },
  shareButtonText: { color: primitive.white, fontSize: 13, lineHeight: 17, fontWeight: font.weight.heavy },
  receiveNotice: { marginTop: 22, borderTopWidth: 1, borderTopColor: color.border, paddingTop: 18 },
  receiveNoticeTitle: { color: color.textPrimary, fontSize: 11, lineHeight: 15, fontWeight: font.weight.bold },
  receiveNoticeText: { marginTop: 5, color: color.textSecondary, fontSize: 10, lineHeight: 16, fontWeight: font.weight.medium },
  cancelDraftButton: { minHeight: 46, marginTop: space.xl, borderWidth: 1, borderColor: color.border, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  cancelDraftButtonText: { color: color.textSecondary, fontSize: font.size.body, fontWeight: font.weight.bold },
});
