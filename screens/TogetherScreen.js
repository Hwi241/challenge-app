import React, { memo, useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  color, font, primitive, radius, space,
  surface as canonicalSurfaceStyles,
  text as canonicalTextStyles,
} from '../styles/common';
import TogetherAcceptedRoomCard from '../components/TogetherAcceptedRoomCard';
import TogetherPushPickerModal from '../components/TogetherPushPickerModal';
import {
  loadTogetherCardSnapshot,
} from '../utils/togetherLocalData';
import {
  loadTogetherReservedChallengeIds,
  reconcileTogetherAcceptedRooms,
} from '../utils/togetherLocalLifecycle';
import {
  loadTogetherAcceptableChallenges,
  parseTogetherInvitationUrl,
} from '../utils/togetherIncomingInvitations';
import { createOrReuseTogetherRoomDraft, loadTogetherRoomDrafts } from '../utils/togetherRoomDrafts';

const TOGETHER_PREVIEW_ROOMS = [];

const PeopleIcon = memo(function PeopleIcon({ size = 28, colorValue = primitive.black }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Circle cx="8" cy="8" r="3" stroke={colorValue} strokeWidth={1.8} />
      <Circle cx="16.2" cy="9" r="2.5" stroke={colorValue} strokeWidth={1.8} />
      <Path d="M2.8 20C3.15 15.8 5.2 13.6 8.25 13.6C11.3 13.6 13.35 15.8 13.7 20" stroke={colorValue} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M13.2 15.4C14.05 14.75 15.1 14.45 16.35 14.45C18.8 14.45 20.3 16.25 20.6 20" stroke={colorValue} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
});

const PlusIcon = memo(function PlusIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Path d="M12 5V19M5 12H19" stroke={primitive.black} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
});

const ArrowIcon = memo(function ArrowIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Path d="M9 5L16 12L9 19" stroke={color.textSecondary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
});

const CheckIcon = memo(function CheckIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Path d="M5 12.5L9.5 17L19 7.5" stroke={primitive.white} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
});

const TogetherRoomCard = memo(function TogetherRoomCard({ room, onPress }) {
  const mineDone = room?.mineDone === true;
  const partnerDone = room?.partnerDone === true;
  return (
    <TouchableOpacity
      style={styles.roomCard}
      activeOpacity={0.82}
      onPress={() => onPress?.(room)}
      accessibilityRole="button"
      accessibilityLabel={`${room?.title || '함께 활동'} 방 열기`}
    >
      <View style={styles.roomCardTop}>
        <View style={styles.roomIdentity}>
          <View style={styles.partnerAvatar}>
            <Text style={styles.partnerAvatarText}>{String(room?.partnerName || '?').slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.roomIdentityText}>
            <Text style={styles.partnerName} numberOfLines={1}>{room?.partnerName || '친구'}</Text>
            <Text style={styles.roomTitle} numberOfLines={1}>{room?.title || '함께 활동'}</Text>
          </View>
        </View>
        <ArrowIcon />
      </View>
      <View style={styles.roomDivider} />
      <View style={styles.statusRow}>
        <View style={styles.personStatus}>
          <View style={[styles.statusMark, mineDone ? styles.statusMarkDone : styles.statusMarkPending]}>{mineDone ? <CheckIcon /> : null}</View>
          <View>
            <Text style={styles.statusOwner}>나</Text>
            <Text style={styles.statusText}>{mineDone ? '오늘 완료' : '아직'}</Text>
          </View>
        </View>
        <View style={styles.statusCenter}>
          <Text style={styles.streakValue}>{Number(room?.streak || 0)}일</Text>
          <Text style={styles.streakLabel}>함께 이어가는 중</Text>
        </View>
        <View style={[styles.personStatus, styles.personStatusRight]}>
          <View>
            <Text style={[styles.statusOwner, styles.statusOwnerRight]}>{room?.partnerName || '친구'}</Text>
            <Text style={[styles.statusText, styles.statusTextRight]}>{partnerDone ? '오늘 완료' : '아직'}</Text>
          </View>
          <View style={[styles.statusMark, partnerDone ? styles.statusMarkDone : styles.statusMarkPending]}>{partnerDone ? <CheckIcon /> : null}</View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const TogetherDraftCard = memo(function TogetherDraftCard({ draft, onPress }) {
  return (
    <TouchableOpacity style={styles.draftCard} activeOpacity={0.82} onPress={() => onPress?.(draft)} accessibilityRole="button" accessibilityLabel={`${draft?.title || '함께 활동'} 초대 준비 열기`}>
      <View style={styles.draftText}>
        <View style={styles.draftMetaRow}>
          <Text style={styles.draftType}>{draft?.typeLabel || '도전'}</Text>
          <View style={styles.draftBadge}><Text style={styles.draftBadgeText}>초대 준비 중</Text></View>
        </View>
        <Text style={styles.draftTitle} numberOfLines={1}>{draft?.title || '함께 활동'}</Text>
      </View>
      <ArrowIcon />
    </TouchableOpacity>
  );
});

function TogetherConfirmSheet({ visible, card, creating, onClose, onConfirm }) {
  const insets = useSafeAreaInsets();
  if (!card) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={creating ? undefined : onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={creating ? undefined : onClose} accessibilityRole="button" accessibilityLabel="닫기" />
        <View
          style={[
            styles.confirmSheet,
            {
              paddingBottom:
                Math.max(
                  space.lg,
                  Math.min(
                    insets.bottom,
                    space.xl
                  )
                ),
            },
          ]}
        >
          <Text style={styles.confirmEyebrow}>{card.togetherTypeLabel || '도전'}</Text>
          <Text style={styles.confirmTitle}>{card.title || '함께 활동'}</Text>
          <Text style={styles.confirmQuestion}>이 활동을 친구와 함께 이어갈까요?</Text>
          <View style={styles.confirmPrivacy}>
            <Text style={styles.confirmPrivacyTitle}>공유 범위</Text>
            <Text style={styles.confirmPrivacyText}>오늘 완료 여부와 연속 기록 등{`\n`}활동 상태만 공유합니다.{`\n`}인증 글과 사진은 공유하지 않아요.</Text>
          </View>
          <TouchableOpacity style={[styles.confirmPrimaryButton, creating ? styles.confirmPrimaryButtonDisabled : null]} activeOpacity={0.84} disabled={creating} onPress={onConfirm} accessibilityRole="button" accessibilityLabel="이 활동으로 시작">
            <Text style={styles.confirmPrimaryButtonText}>{creating ? '준비하는 중...' : '이 활동으로 시작'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmCancelButton} activeOpacity={0.76} disabled={creating} onPress={onClose} accessibilityRole="button" accessibilityLabel="다른 활동 선택">
            <Text style={styles.confirmCancelText}>다른 활동 선택</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function TogetherScreen({ navigation }) {
  const [pushPickerVisible, setPushPickerVisible] = useState(false);
  const [pushPickerLoading, setPushPickerLoading] = useState(false);
  const [pushPickerItems, setPushPickerItems] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [acceptedRoomRows, setAcceptedRoomRows] = useState([]);
  const rooms = useMemo(() => TOGETHER_PREVIEW_ROOMS, []);
  const hasRooms = rooms.length > 0;
  const hasDrafts = drafts.length > 0;
  const hasContent = hasRooms || hasDrafts || acceptedRoomRows.length > 0;

  useFocusEffect(useCallback(() => {
    let alive = true;
    loadTogetherRoomDrafts()
      .then((nextDrafts) => {
        if (alive) setDrafts(Array.isArray(nextDrafts) ? nextDrafts : []);
      })
      .catch((error) => {
        console.warn('[Together] load room drafts failed', error);
        if (alive) setDrafts([]);
      });
    return () => { alive = false; };
  }, []));

  useFocusEffect(
    useCallback(
      () => {
        let active = true;

        const loadAcceptedRooms =
          async () => {
            try {
              const rooms =
                await reconcileTogetherAcceptedRooms();

              const rows =
                await Promise.all(
                  rooms.map(
                    async (
                      room
                    ) => {
                      let snapshot =
                        null;

                      try {
                        if (
                          room?.challengeId
                        ) {
                          snapshot =
                            await loadTogetherCardSnapshot({
                              challengeId:
                                room.challengeId,
                            });
                        }
                      } catch {
                        snapshot =
                          null;
                      }

                      return {
                        room,
                        snapshot,
                        sourceAvailable:
                          !!snapshot,
                      };
                    }
                  )
                );

              if (active) {
                setAcceptedRoomRows(
                  rows
                );
              }
            } catch {
              if (active) {
                setAcceptedRoomRows(
                  []
                );
              }
            }
          };

        loadAcceptedRooms();

        return () => {
          active = false;
        };
      },
      []
    )
  );

  const openRoom = useCallback((room) => {
    if (!room) return;
    navigation.navigate('TogetherRoomDetail', { room });
  }, [navigation]);

  const openCopiedInvitation =
    useCallback(
      async () => {
        try {
          const raw =
            await Clipboard.getStringAsync();

          const invitation =
            parseTogetherInvitationUrl(
              raw
            );

          if (!invitation) {
            Alert.alert(
              '초대 링크 확인',
              '복사한 THE PUSH 초대 링크를 찾지 못했어요.'
            );

            return;
          }

          navigation.navigate(
            'TogetherInviteAccept',
            {
              data:
                JSON.stringify(
                  invitation
                ),
            }
          );
        } catch (
          error
        ) {
          console.warn(
            '[Together] read invitation clipboard failed',
            error?.message
            || 'unknown'
          );

          Alert.alert(
            '초대 링크 확인',
            '복사한 초대 링크를 불러오지 못했어요.'
          );
        }
      },
      [
        navigation,
      ]
    );

  const loadPushPickerItems =
    useCallback(
      async () => {
        setPushPickerLoading(true);

        try {
          const [
            activities,
            reservedIds,
          ] = await Promise.all([
            loadTogetherAcceptableChallenges(),
            loadTogetherReservedChallengeIds(),
          ]);

          const next =
            activities.filter(
              (item) => (
                !reservedIds.has(
                  String(
                    item?.id
                    ?? ''
                  )
                )
              )
            );

          setPushPickerItems(next);
        } catch {
          setPushPickerItems([]);
        } finally {
          setPushPickerLoading(false);
        }
      },
      []
    );

  const openPushPicker =
    useCallback(
      () => {
        setSelectedCard(null);
        setConfirmVisible(false);
        setPushPickerVisible(true);
        loadPushPickerItems();
      },
      [loadPushPickerItems]
    );

  const closePushPicker =
    useCallback(
      () => {
        setPushPickerVisible(false);
      },
      []
    );

  const selectActivity = useCallback((card) => {
    if (!card?.id) return;
    setSelectedCard(card);
    setConfirmVisible(true);
  }, []);

  const handlePushPickerSelect =
    useCallback(
      (item) => {
        setPushPickerVisible(false);
        selectActivity(item);
      },
      [selectActivity]
    );

  const closeConfirm = useCallback(() => {
    if (creatingDraft) return;
    setConfirmVisible(false);
    setSelectedCard(null);
    setPushPickerVisible(true);
  }, [creatingDraft]);

  const confirmActivity = useCallback(async () => {
    if (creatingDraft || !selectedCard?.id) return;
    setCreatingDraft(true);
    try {
      const draft = await createOrReuseTogetherRoomDraft({ card: selectedCard });
      setConfirmVisible(false);
      setSelectedCard(null);
      setDrafts((previous) => [draft, ...(Array.isArray(previous) ? previous : []).filter((item) => item.id !== draft.id)]);
      navigation.navigate('TogetherInviteDraft', { draft, draftId: draft.id });
    } catch (error) {
      console.warn('[Together] create room draft failed', error);
    } finally {
      setCreatingDraft(false);
    }
  }, [creatingDraft, navigation, selectedCard]);

  const openDraft = useCallback((draft) => {
    if (!draft?.id) return;
    navigation.navigate('TogetherInviteDraft', { draft, draftId: draft.id });
  }, [navigation]);

  return (
    <SafeAreaView style={canonicalSurfaceStyles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View pointerEvents="none" style={styles.headerTitleLayer}>
          <Text style={[canonicalTextStyles.headerTitle, styles.headerTitle]}>함께</Text>
        </View>
        <View style={styles.headerLeftSpacer} />
        <TouchableOpacity style={styles.headerAction} activeOpacity={0.78} onPress={openPushPicker}
          accessibilityRole="button" accessibilityLabel="함께 시작하기"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <PlusIcon />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, !hasContent ? styles.scrollContentEmpty : null]} showsVerticalScrollIndicator={false}>
        {hasContent ? (
          <>
            {acceptedRoomRows.length > 0 && (
              <View
                style={
                  styles.acceptedSection
                }
              >
                <Text
                  style={
                    styles.acceptedSectionTitle
                  }
                >
                  함께하는 활동
                </Text>

                <View
                  style={
                    styles.acceptedRoomList
                  }
                >
                  {acceptedRoomRows.map(
                    ({
                      room,
                      snapshot,
                      sourceAvailable,
                    }) => (
                      <TogetherAcceptedRoomCard
                        key={
                          room.id
                          || room.invitationId
                        }
                        room={
                          room
                        }
                        snapshot={
                          snapshot
                        }
                        sourceAvailable={
                          sourceAvailable
                        }
                        onPress={
                          () =>
                            navigation.navigate(
                              'TogetherRoomDetail',
                              {
                                acceptedRoomId:
                                  room.invitationId,
                              }
                            )
                        }
                      />
                    )
                  )}
                </View>
              </View>
            )}
            {hasDrafts && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>초대 준비 중</Text><Text style={styles.sectionCount}>{drafts.length}</Text></View>
                <View style={styles.roomList}>{drafts.map((draft) => <TogetherDraftCard key={draft.id} draft={draft} onPress={openDraft} />)}</View>
              </View>
            )}
            {hasRooms && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>함께하는 활동</Text><Text style={styles.sectionCount}>{rooms.length}</Text></View>
                <View style={styles.roomList}>{rooms.map((room) => <TogetherRoomCard key={room.id} room={room} onPress={openRoom} />)}</View>
              </View>
            )}
            <TouchableOpacity style={styles.contentStartButton} activeOpacity={0.82} onPress={openPushPicker} accessibilityRole="button" accessibilityLabel="함께 시작하기">
              <PlusIcon /><Text style={styles.contentStartText}>함께 시작하기</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.inviteLinkButton} activeOpacity={0.78} onPress={openCopiedInvitation} accessibilityRole="button" accessibilityLabel="복사한 초대 링크로 참여하기">
              <Text style={styles.inviteLinkButtonText}>복사한 초대 링크로 참여하기</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}><PeopleIcon size={38} /></View>
            <Text style={styles.emptyTitle}>혼자 하던 일을{`\n`}함께 이어가보세요.</Text>
            <Text style={styles.emptyDescription}>친구 한 명과 같은 활동을 이어가며{`\n`}오늘 했는지 서로 확인할 수 있어요.</Text>
            <TouchableOpacity style={styles.primaryButton} activeOpacity={0.84} onPress={openPushPicker} accessibilityRole="button" accessibilityLabel="함께 시작하기">
              <Text style={styles.primaryButtonText}>함께 시작하기</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.inviteLinkButton} activeOpacity={0.78} onPress={openCopiedInvitation} accessibilityRole="button" accessibilityLabel="복사한 초대 링크로 참여하기">
              <Text style={styles.inviteLinkButtonText}>복사한 초대 링크로 참여하기</Text>
            </TouchableOpacity>
            <View style={styles.guideRow}>
              <View style={styles.guideItem}><View style={styles.guideNumber}><Text style={styles.guideNumberText}>1</Text></View><Text style={styles.guideLabel}>활동 선택</Text></View>
              <View style={styles.guideDivider} />
              <View style={styles.guideItem}><View style={styles.guideNumber}><Text style={styles.guideNumberText}>2</Text></View><Text style={styles.guideLabel}>친구 초대</Text></View>
              <View style={styles.guideDivider} />
              <View style={styles.guideItem}><View style={styles.guideNumber}><Text style={styles.guideNumberText}>3</Text></View><Text style={styles.guideLabel}>함께 기록</Text></View>
            </View>
            <Text style={styles.emptyFootnote}>공개 피드나 순위 없이,{`\n`}초대한 사람과만 함께합니다.</Text>
          </View>
        )}
      </ScrollView>
      <TogetherPushPickerModal
        visible={pushPickerVisible}
        items={pushPickerItems}
        loading={pushPickerLoading}
        onClose={closePushPicker}
        onSelect={handlePushPickerSelect}
        onCreatePush={() => {
          setPushPickerVisible(false);
          navigation.navigate('CreateChallengeType');
        }}
      />
      <TogetherConfirmSheet visible={confirmVisible} card={selectedCard} creating={creatingDraft} onClose={closeConfirm} onConfirm={confirmActivity} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, borderBottomWidth: 1, borderBottomColor: color.border, position: 'relative' },
  headerTitleLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { textAlign: 'center' },
  headerLeftSpacer: { width: 38, height: 38 },
  headerAction: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: space.md, paddingTop: space.lg, paddingBottom: 36 },
  scrollContentEmpty: { justifyContent: 'center', paddingTop: 20, paddingBottom: 42 },
  acceptedSection: { marginTop: space.xl },
  acceptedSectionTitle: { color: color.textPrimary, fontSize: font.size.bodyLarge, fontWeight: font.weight.bold, marginBottom: space.sm },
  acceptedRoomList: { gap: space.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
  sectionTitle: { color: color.textPrimary, fontSize: 17, lineHeight: 22, fontWeight: font.weight.heavy },
  sectionCount: { marginLeft: 7, color: color.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: font.weight.bold },
  sectionBlock: { marginBottom: 28 },
  roomList: { gap: 12 },
  draftCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: color.border, borderRadius: radius.md, paddingHorizontal: 15, paddingVertical: 12 },
  draftText: { flex: 1, minWidth: 0, paddingRight: 12 },
  draftMetaRow: { flexDirection: 'row', alignItems: 'center' },
  draftType: { color: color.textSecondary, fontSize: 10, lineHeight: 13, fontWeight: font.weight.bold },
  draftBadge: { minHeight: 20, marginLeft: 8, paddingHorizontal: 7, borderRadius: 10, borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center' },
  draftBadgeText: { color: color.textSecondary, fontSize: 9, lineHeight: 12, fontWeight: font.weight.bold },
  draftTitle: { marginTop: 5, color: color.textPrimary, fontSize: 14, lineHeight: 19, fontWeight: font.weight.heavy },
  contentStartButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.border, borderRadius: radius.md, marginTop: 2 },
  contentStartText: { marginLeft: 8, color: color.textPrimary, fontSize: 13, lineHeight: 17, fontWeight: font.weight.heavy },
  inviteLinkButton: { minHeight: 42, marginTop: 8, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  inviteLinkButtonText: { color: color.textSecondary, fontSize: 12, lineHeight: 16, fontWeight: font.weight.bold, textAlign: 'center', textDecorationLine: 'underline' },
  roomCard: { backgroundColor: color.background, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, paddingHorizontal: 16, paddingTop: 15, paddingBottom: 14 },
  roomCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roomIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  partnerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: primitive.black, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  partnerAvatarText: { color: primitive.white, fontSize: 14, lineHeight: 18, fontWeight: font.weight.heavy },
  roomIdentityText: { flex: 1, minWidth: 0 },
  partnerName: { color: color.textPrimary, fontSize: 14, lineHeight: 18, fontWeight: font.weight.bold },
  roomTitle: { marginTop: 2, color: color.textSecondary, fontSize: 12, lineHeight: 16, fontWeight: font.weight.medium },
  roomDivider: { height: 1, backgroundColor: color.border, marginVertical: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  personStatus: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  personStatusRight: { justifyContent: 'flex-end' },
  statusMark: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  statusMarkDone: { backgroundColor: primitive.black },
  statusMarkPending: { borderWidth: 1, borderColor: color.border, backgroundColor: color.background },
  statusOwner: { marginLeft: 7, color: color.textPrimary, fontSize: 11, lineHeight: 14, fontWeight: font.weight.bold },
  statusOwnerRight: { marginLeft: 0, marginRight: 7, textAlign: 'right' },
  statusText: { marginLeft: 7, marginTop: 1, color: color.textSecondary, fontSize: 10, lineHeight: 13, fontWeight: font.weight.medium },
  statusTextRight: { marginLeft: 0, marginRight: 7, textAlign: 'right' },
  statusCenter: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  streakValue: { color: color.textPrimary, fontSize: 13, lineHeight: 17, fontWeight: font.weight.heavy },
  streakLabel: { marginTop: 1, color: color.textSecondary, fontSize: 9, lineHeight: 12, fontWeight: font.weight.medium },
  emptyState: { alignItems: 'center', paddingHorizontal: 18 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.border, backgroundColor: color.background, marginBottom: 22 },
  emptyTitle: { color: color.textPrimary, fontSize: 24, lineHeight: 31, fontWeight: font.weight.heavy, textAlign: 'center' },
  emptyDescription: { marginTop: 12, maxWidth: 310, color: color.textSecondary, fontSize: 14, lineHeight: 21, fontWeight: font.weight.medium, textAlign: 'center' },
  primaryButton: { minWidth: 184, minHeight: 48, marginTop: 25, paddingHorizontal: 24, borderRadius: radius.md, backgroundColor: primitive.black, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: primitive.white, fontSize: 14, lineHeight: 18, fontWeight: font.weight.heavy },
  guideRow: { width: '100%', maxWidth: 320, marginTop: 34, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' },
  guideItem: { width: 76, alignItems: 'center' },
  guideNumber: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.border, backgroundColor: color.background },
  guideNumberText: { color: color.textPrimary, fontSize: 11, lineHeight: 14, fontWeight: font.weight.heavy },
  guideLabel: { marginTop: 7, color: color.textSecondary, fontSize: 11, lineHeight: 15, fontWeight: font.weight.medium, textAlign: 'center' },
  guideDivider: { flex: 1, maxWidth: 38, height: 1, marginTop: 13, backgroundColor: color.border },
  emptyFootnote: { marginTop: 28, color: color.textTertiary, fontSize: 11, lineHeight: 17, fontWeight: font.weight.medium, textAlign: 'center' },
  modalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:
      'rgba(0, 0, 0, 0.36)',
  },
  confirmSheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '70%',
    backgroundColor:
      color.background,
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingTop: 22,
    alignItems: 'stretch',

    shadowColor:
      primitive.black,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.18,
    shadowRadius: 20,

    elevation: 12,
  },
  confirmEyebrow: { marginTop: 4, color: color.textSecondary, fontSize: 11, lineHeight: 15, fontWeight: font.weight.bold, textAlign: 'center' },
  confirmTitle: { marginTop: 6, color: color.textPrimary, fontSize: 22, lineHeight: 28, fontWeight: font.weight.heavy, textAlign: 'center' },
  confirmQuestion: { marginTop: 9, color: color.textSecondary, fontSize: 13, lineHeight: 19, fontWeight: font.weight.medium, textAlign: 'center' },
  confirmPrivacy: { marginTop: 22, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 14 },
  confirmPrivacyTitle: { color: color.textPrimary, fontSize: 11, lineHeight: 15, fontWeight: font.weight.bold },
  confirmPrivacyText: { marginTop: 5, color: color.textSecondary, fontSize: 11, lineHeight: 18, fontWeight: font.weight.medium },
  confirmPrimaryButton: { width: '100%', minHeight: 48, marginTop: 15, borderRadius: radius.md, backgroundColor: primitive.black, alignItems: 'center', justifyContent: 'center' },
  confirmPrimaryButtonDisabled: { opacity: 0.55 },
  confirmPrimaryButtonText: { color: primitive.white, fontSize: 14, lineHeight: 18, fontWeight: font.weight.heavy },
  confirmCancelButton: { width: '100%', minHeight: 42, marginTop: 4, alignItems: 'center', justifyContent: 'center' },
  confirmCancelText: { color: color.textSecondary, fontSize: 12, lineHeight: 16, fontWeight: font.weight.bold },
});
