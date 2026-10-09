import React, { memo, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import {
  color, font, primitive, radius, space,
  surface as canonicalSurfaceStyles,
  text as canonicalTextStyles,
} from '../styles/common';
import TogetherAcceptedRoomDetail from '../components/TogetherAcceptedRoomDetail';
import { loadTogetherCardSnapshot } from '../utils/togetherLocalData';

const BackIcon = memo(function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Path d="M15 5L8 12L15 19" stroke={color.textPrimary} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
});

const CheckIcon = memo(function CheckIcon({ inverse = false }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Path d="M5 12.5L9.5 17L19 7.5" stroke={inverse ? primitive.white : color.textPrimary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
});

const TodayStatus = memo(function TodayStatus({ label, state = 'pending', align = 'left' }) {
  const right = align === 'right';
  const done = state === 'done';
  const stateLabel = state === 'done' ? '오늘 완료' : state === 'off' ? '오늘 없음' : '아직';
  return (
    <View style={[styles.todayPerson, right ? styles.todayPersonRight : null]}>
      <View style={[styles.todayStatusMark, done ? styles.todayStatusMarkDone : styles.todayStatusMarkPending]}>
        {done ? <CheckIcon inverse /> : null}
      </View>
      <View style={[styles.todayTextWrap, right ? styles.todayTextWrapRight : null]}>
        <Text style={[styles.todayOwner, right ? styles.textRight : null]}>{label}</Text>
        <Text style={[styles.todayState, right ? styles.textRight : null]}>{stateLabel}</Text>
      </View>
    </View>
  );
});

const RecentRecord = memo(function RecentRecord({ item, isLast }) {
  return (
    <View style={styles.recordRow}>
      <View style={styles.recordRail}>
        <View style={styles.recordDot}><CheckIcon /></View>
        {!isLast && <View style={styles.recordLine} />}
      </View>
      <View style={[styles.recordContent, isLast ? styles.recordContentLast : null]}>
        <View style={styles.recordTop}>
          <Text style={styles.recordOwner}>{item.owner}</Text>
          <Text style={styles.recordWhen}>{item.when}{item.time ? ` · ${item.time}` : ''}</Text>
        </View>
        <Text style={styles.recordDescription}>{item.description}</Text>
      </View>
    </View>
  );
});

function ExistingTogetherRoomDetailScreen({ navigation, route }) {
  const room = route?.params?.room || {};
  const [localSnapshot, setLocalSnapshot] = useState(null);
  const [localLoading, setLocalLoading] = useState(!!room?.challengeId);

  useEffect(() => {
    let alive = true;
    const challengeId = String(room?.challengeId ?? '').trim();
    if (!challengeId) {
      setLocalSnapshot(null);
      setLocalLoading(false);
      return () => {
        alive = false;
      };
    }

    setLocalLoading(true);
    loadTogetherCardSnapshot({ challengeId })
      .then((snapshot) => {
        if (!alive) return;
        setLocalSnapshot(snapshot || null);
      })
      .catch((error) => {
        console.warn('[Together] load room local snapshot failed', error);
        if (alive) setLocalSnapshot(null);
      })
      .finally(() => {
        if (alive) setLocalLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [room?.challengeId]);

  const recentRecords = useMemo(() => {
    const localRecords = Array.isArray(localSnapshot?.recentRecords) ? localSnapshot.recentRecords : [];
    const partnerPreviewRecords = Array.isArray(room?.recentRecords)
      ? room.recentRecords
        .filter((item) => item?.owner !== '나')
        .slice(0, 2)
        .map((item) => ({ ...item, owner: `${item.owner} · 예시` }))
      : [];
    return [...localRecords, ...partnerPreviewRecords];
  }, [localSnapshot?.recentRecords, room?.recentRecords]);
  const partnerName = String(room?.partnerName || '친구');
  const title = String(localSnapshot?.title || room?.title || '함께 활동');
  const streak = Math.max(0, Number(localSnapshot?.streak ?? room?.streak ?? 0));
  const mineTodayState = localSnapshot?.todayState || (room?.mineDone === true ? 'done' : 'pending');
  const partnerTodayState = room?.partnerDone === true ? 'done' : 'pending';

  return (
    <SafeAreaView style={canonicalSurfaceStyles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerSide} activeOpacity={0.72} onPress={() => navigation.goBack()}
          accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <BackIcon />
        </TouchableOpacity>
        <View pointerEvents="none" style={styles.headerTitleLayer}>
          <Text style={[canonicalTextStyles.headerTitle, styles.headerTitle]}>함께방</Text>
        </View>
        <View style={styles.headerSide} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {room?.isPreview === true && <View style={styles.previewBadge}><Text style={styles.previewBadgeText}>미리보기</Text></View>}
        <View style={styles.identity}>
          <Text style={styles.roomEyebrow}>{localSnapshot?.typeLabel ? `${localSnapshot.typeLabel} · 1:1 함께` : '1:1 함께'}</Text>
          <Text style={styles.roomTitle}>{title}</Text>
          <Text style={styles.roomPartner}>{partnerName}님과 함께</Text>
        </View>
        <View style={styles.streakBlock}>
          <Text style={styles.streakNumber}>{streak}</Text>
          <Text style={styles.streakUnit}>일째</Text>
          <Text style={styles.streakDescription}>{localSnapshot ? '내 활동 연속 기록' : '함께 이어가는 중'}</Text>
        </View>
        {localLoading && (
          <View style={styles.localLoading}>
            <Text style={styles.localLoadingText}>내 활동 기록을 불러오는 중...</Text>
          </View>
        )}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>오늘</Text>
          <View style={styles.todayCard}>
            <TodayStatus label="나" state={mineTodayState} />
            <View style={styles.todayDivider}><View style={styles.todayDividerLine} /></View>
            <TodayStatus label={partnerName} state={partnerTodayState} align="right" />
          </View>
          <Text style={styles.todayHint}>{localSnapshot ? '내 상태는 실제 기록을 기준으로 표시되고, 상대 상태는 현재 미리보기입니다.' : '상대가 완료하면 이곳에서 바로 확인할 수 있어요.'}</Text>
        </View>
        <View style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionTitle}>최근 기록</Text>
            <Text style={styles.sectionMeta}>최근 인증</Text>
          </View>
          {recentRecords.length > 0 ? (
            <View style={styles.records}>
              {recentRecords.map((item, index) => (
                <RecentRecord key={item.id || `${item.owner}_${item.when}_${index}`} item={item} isLast={index === recentRecords.length - 1} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyRecords}>
              <Text style={styles.emptyRecordsTitle}>아직 인증 기록이 없어요.</Text>
              <Text style={styles.emptyRecordsText}>둘 중 한 명이 활동을 완료하면{`\n`}여기에 최근 기록이 쌓입니다.</Text>
            </View>
          )}
        </View>
        {room?.isPreview === true && (
          <View style={styles.previewNotice}>
            <Text style={styles.previewNoticeTitle}>함께방 미리보기</Text>
            <Text style={styles.previewNoticeText}>내 활동명·오늘 완료 여부·연속 기록·최근 인증은{`\n`}실제 앱 기록을 사용합니다. 상대방 정보와 상태는{`\n`}아직 미리보기 데이터이며 실제 친구 연결은{`\n`}다음 단계에서 이어집니다.</Text>
          </View>
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
  content: { paddingHorizontal: space.md, paddingTop: 20, paddingBottom: 42 },
  previewBadge: { alignSelf: 'flex-start', minHeight: 24, paddingHorizontal: 9, borderRadius: 12, backgroundColor: primitive.black, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  previewBadgeText: { color: primitive.white, fontSize: 10, lineHeight: 13, fontWeight: font.weight.heavy },
  identity: { paddingBottom: 20 },
  roomEyebrow: { color: color.textSecondary, fontSize: 11, lineHeight: 15, fontWeight: font.weight.bold },
  roomTitle: { marginTop: 6, color: color.textPrimary, fontSize: 26, lineHeight: 33, fontWeight: font.weight.heavy },
  roomPartner: { marginTop: 6, color: color.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: font.weight.medium },
  streakBlock: { minHeight: 118, borderTopWidth: 1, borderBottomWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  streakNumber: { color: color.textPrimary, fontSize: 42, lineHeight: 48, fontWeight: font.weight.heavy, includeFontPadding: false },
  streakUnit: { marginTop: -2, color: color.textPrimary, fontSize: 13, lineHeight: 17, fontWeight: font.weight.bold },
  streakDescription: { marginTop: 6, color: color.textSecondary, fontSize: 11, lineHeight: 15, fontWeight: font.weight.medium },
  localLoading: { marginBottom: 16, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: color.border, borderRadius: radius.md },
  localLoadingText: { color: color.textSecondary, fontSize: 11, lineHeight: 16, fontWeight: font.weight.medium, textAlign: 'center' },
  section: { marginBottom: 30 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: color.textPrimary, fontSize: 17, lineHeight: 22, fontWeight: font.weight.heavy },
  sectionMeta: { color: color.textTertiary, fontSize: 10, lineHeight: 14, fontWeight: font.weight.medium },
  todayCard: { marginTop: 13, minHeight: 98, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: color.border, borderRadius: radius.md, paddingHorizontal: 15 },
  todayPerson: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  todayPersonRight: { justifyContent: 'flex-end' },
  todayStatusMark: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  todayStatusMarkDone: { backgroundColor: primitive.black },
  todayStatusMarkPending: { borderWidth: 1, borderColor: color.border, backgroundColor: color.background },
  todayTextWrap: { marginLeft: 9 },
  todayTextWrapRight: { marginLeft: 0, marginRight: 9 },
  todayOwner: { color: color.textPrimary, fontSize: 12, lineHeight: 16, fontWeight: font.weight.bold },
  todayState: { marginTop: 2, color: color.textSecondary, fontSize: 11, lineHeight: 15, fontWeight: font.weight.medium },
  textRight: { textAlign: 'right' },
  todayDivider: { width: 31, alignItems: 'center', justifyContent: 'center' },
  todayDividerLine: { width: 1, height: 34, backgroundColor: color.border },
  todayHint: { marginTop: 9, color: color.textTertiary, fontSize: 10, lineHeight: 15, fontWeight: font.weight.medium },
  records: { marginTop: 13 },
  recordRow: { flexDirection: 'row' },
  recordRail: { width: 34, alignItems: 'center' },
  recordDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: color.border, backgroundColor: color.background, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  recordLine: { flex: 1, width: 1, minHeight: 46, backgroundColor: color.border },
  recordContent: { flex: 1, minWidth: 0, paddingLeft: 9, paddingBottom: 22 },
  recordContentLast: { paddingBottom: 0 },
  recordTop: { minHeight: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recordOwner: { color: color.textPrimary, fontSize: 12, lineHeight: 16, fontWeight: font.weight.bold },
  recordWhen: { marginLeft: 12, color: color.textTertiary, fontSize: 10, lineHeight: 14, fontWeight: font.weight.medium },
  recordDescription: { marginTop: 3, color: color.textSecondary, fontSize: 12, lineHeight: 18, fontWeight: font.weight.medium },
  emptyRecords: { marginTop: 13, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, paddingVertical: 20, paddingHorizontal: 16 },
  emptyRecordsTitle: { color: color.textPrimary, fontSize: 13, lineHeight: 17, fontWeight: font.weight.bold },
  emptyRecordsText: { marginTop: 6, color: color.textSecondary, fontSize: 11, lineHeight: 17, fontWeight: font.weight.medium },
  previewNotice: { borderTopWidth: 1, borderColor: color.border, paddingTop: 20 },
  previewNoticeTitle: { color: color.textPrimary, fontSize: 12, lineHeight: 16, fontWeight: font.weight.bold },
  previewNoticeText: { marginTop: 6, color: color.textSecondary, fontSize: 11, lineHeight: 18, fontWeight: font.weight.medium },
});

export default function TogetherRoomDetailScreen(
  props
) {
  const acceptedRoomId =
    String(
      props?.route?.params
        ?.acceptedRoomId
      ?? ''
    ).trim();

  if (acceptedRoomId) {
    return (
      <TogetherAcceptedRoomDetail
        invitationId={
          acceptedRoomId
        }
      />
    );
  }

  return (
    <ExistingTogetherRoomDetailScreen
      {...props}
    />
  );
}
