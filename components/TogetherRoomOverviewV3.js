import React, {
  useEffect,
  useState,
} from 'react';

import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  color,
  font,
  primitive,
  radius,
  space,
} from '../styles/common';

import TogetherMemberSyncMetaV2
  from './TogetherMemberSyncMetaV2';

import {
  buildTogetherRoomOverviewV3,
} from '../utils/togetherRoomOverviewV3';

const MODE_TITLES = {
  watch: '공유자의 PUSH',
  same_push: '같은 목표, 함께 실천',
  paired_push: '각자의 PUSH, 함께 실천',
  shared_goal: '하나의 목표를 함께 채우기',
};

const formatNumber = (value) =>
  Number(value).toLocaleString('ko-KR', {
    maximumFractionDigits: 2,
  });

const activityLabel = (activity) => {
  if (activity === 'done') {
    return '오늘 완료';
  }

  if (activity === 'not_done') {
    return '오늘 완료 기록 없음';
  }

  return '오늘 상태 미수신';
};

const percentWidth = (count, total) => {
  if (!total) return '0%';

  return `${Math.max(
    0,
    Math.min(100, count / total * 100)
  )}%`;
};

const Metric = ({
  label,
  value,
}) => (
  <View style={styles.metric}>
    <Text style={styles.metricValue}>
      {value}
    </Text>
    <Text style={styles.metricLabel}>
      {label}
    </Text>
  </View>
);

const memberDetail = (
  member,
  mode,
  unit
) => {
  if (mode === 'shared_goal') {
    return member.contribution === null
      ? '기여 정보 미수신'
      : `${formatNumber(member.contribution)} ${unit}`;
  }

  if (
    mode === 'same_push'
    && member.progress !== null
  ) {
    return `진행률 ${Math.round(
      Math.min(1, member.progress) * 100
    )}%`;
  }

  return member.streak !== null
    ? `${formatNumber(member.streak)}일 연속`
    : '연속 기록 미수신';
};

export default function TogetherRoomOverviewV3({
  room,
  members,
  sharedSummary = null,
}) {
  const [visibleCount, setVisibleCount] =
    useState(8);

  useEffect(() => {
    setVisibleCount(8);
  }, [room?.id]);

  const overview = buildTogetherRoomOverviewV3({
    room,
    members,
  });

  const mode = overview.mode;

  const isWatch = mode === 'watch';
  const isSame = mode === 'same_push';
  const isPaired = mode === 'paired_push';
  const isShared = mode === 'shared_goal';
  const isNewShared = isShared && room?.sharedGoal?.source === 'room_contributions_v1';
  const sharedTarget = Number(room?.sharedGoal?.target) > 0 ? Number(room.sharedGoal.target) : null;
  const sharedTotal = isNewShared && sharedSummary && Number.isFinite(Number(sharedSummary.total)) ? Number(sharedSummary.total) : null;
  const sharedPercentage = sharedTotal !== null && sharedTarget !== null ? Math.min(100, Math.max(0, sharedTotal / sharedTarget * 100)) : null;
  const sharedAmounts = new Map((Array.isArray(sharedSummary?.members) ? sharedSummary.members : []).map((item) => [String(item?.userId ?? ''), Number(item?.amount)]));

  const visibleMembers = isWatch
    ? overview.owner
      ? [overview.owner]
      : []
    : overview.members.slice(0, visibleCount);

  const notDoneCount = Math.max(
    0,
    overview.knownCount - overview.completedCount
  );

  const totalMembers = overview.members.length;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>
        {MODE_TITLES[mode] || '함께하는 PUSH'}
      </Text>

      {isWatch ? (
        <View style={[
          styles.dashboard,
          styles.darkDashboard,
        ]}>
          <Text style={styles.darkLabel}>
            공유자의 오늘 활동
          </Text>

          <Text style={styles.darkHero}>
            {overview.owner
              ? activityLabel(overview.owner.activity)
              : '공유자 정보 확인 중'}
          </Text>

          <Text style={styles.darkHint}>
            한 사람의 실천을 함께 지켜봅니다.
          </Text>

          <View style={styles.darkDivider} />

          <View style={styles.watchSupport}>
            <Text style={styles.darkSecondary}>
              함께 지켜보는 사람
            </Text>

            <Text style={styles.watchSupportValue}>
              {overview.supporterCount}명
            </Text>
          </View>
        </View>
      ) : null}

      {isSame ? (
        <View style={[
          styles.dashboard,
          styles.lightDashboard,
        ]}>
          <Text style={styles.lightLabel}>
            같은 PUSH · 오늘의 실천
          </Text>

          <Text style={styles.lightHero}>
            {overview.knownCount === 0
              ? '활동 상태 확인 중'
              : `${overview.completedCount}명 완료`}
          </Text>

          <Text style={styles.lightHint}>
            전체 {totalMembers}명 중
            {' '}
            {overview.knownCount}명의 오늘 상태 확인
          </Text>

          <View style={styles.statusTrack}>
            <View
              style={[
                styles.statusDone,
                {
                  width: percentWidth(
                    overview.completedCount,
                    totalMembers
                  ),
                },
              ]}
            />

            <View
              style={[
                styles.statusNotDone,
                {
                  width: percentWidth(
                    notDoneCount,
                    totalMembers
                  ),
                },
              ]}
            />
          </View>

          <View style={styles.metrics}>
            <Metric
              label="완료"
              value={`${overview.completedCount}명`}
            />

            <Metric
              label="완료 기록 없음"
              value={`${notDoneCount}명`}
            />

            <Metric
              label="미수신"
              value={`${overview.unknownCount}명`}
            />
          </View>
        </View>
      ) : null}

      {isPaired ? (
        <View style={[
          styles.dashboard,
          styles.pairedDashboard,
        ]}>
          <Text style={styles.lightLabel}>
            서로 다른 PUSH · 오늘의 실천
          </Text>

          <Text style={styles.lightHero}>
            {overview.knownCount === 0
              ? '실천 상태 확인 중'
              : `${overview.completedCount}명 실천 확인`}
          </Text>

          <Text style={styles.lightHint}>
            각자의 목표 수치 대신
            꾸준한 실천 여부를 확인합니다.
          </Text>

          <View style={styles.metrics}>
            <Metric
              label="오늘 상태 확인"
              value={`${overview.knownCount}명`}
            />

            <Metric
              label="미수신"
              value={`${overview.unknownCount}명`}
            />
          </View>
        </View>
      ) : null}

      {isShared ? (
        <View style={[
          styles.dashboard,
          styles.darkDashboard,
        ]}>
          <Text style={styles.darkLabel}>
            공동 목표 달성률
          </Text>

          <Text style={styles.darkHero}>
            {(isNewShared ? sharedPercentage : overview.percentage) === null
              ? '확인 중'
              : `${formatNumber(isNewShared ? sharedPercentage : overview.percentage)}%`}
          </Text>

          <Text style={styles.darkSecondary}>
            {isNewShared
              ? sharedTotal === null ? '기여 기록 확인 중' : `${formatNumber(sharedTotal)} ${overview.unit}`
              : overview.contributionKnownCount === 0 ? '기여 정보 동기화 대기' : `${formatNumber(overview.contributionTotal)} ${overview.unit}`}
            {' / '}
            {(isNewShared ? sharedTarget : overview.target) === null
              ? '목표 미설정'
              : `${formatNumber(isNewShared ? sharedTarget : overview.target)} ${overview.unit}`}
          </Text>

          {(isNewShared ? sharedPercentage : overview.percentage) !== null ? (
            <View style={styles.sharedTrack}>
              <View
                style={[
                  styles.sharedFill,
                  {
                    width: `${isNewShared ? sharedPercentage : overview.percentage}%`,
                  },
                ]}
              />
            </View>
          ) : null}

          <Text style={styles.darkHint}>
            {isNewShared ? (Array.isArray(sharedSummary?.members) ? sharedSummary.members.length : 0) : overview.contributionKnownCount}명
            {' '}
            기여 정보 확인 · 마지막 동기화 기준
          </Text>
        </View>
      ) : null}

      {!isWatch && !isSame && !isPaired && !isShared ? (
        <View style={[
          styles.dashboard,
          styles.lightDashboard,
        ]}>
          <Text style={styles.lightHint}>
            함께 PUSH 정보를 확인하고 있습니다.
          </Text>
        </View>
      ) : null}

      <Text style={styles.section}>
        {isWatch
          ? '공유자'
          : isShared
            ? '멤버별 기여'
            : isSame
              ? '함께 실천하는 멤버'
              : '각자의 실천'}
      </Text>

      {visibleMembers.length === 0 ? (
        <Text style={styles.emptyHint}>
          확인 가능한 멤버 정보가 없습니다.
        </Text>
      ) : null}

      {visibleMembers.map((member) => {
        const sharedAmount = sharedAmounts.has(String(member.userId)) ? sharedAmounts.get(String(member.userId)) : null;
        const displayMember = isNewShared ? { ...member, contribution: Number.isFinite(sharedAmount) ? sharedAmount : null } : member;
        const detail = memberDetail(
          displayMember,
          mode,
          overview.unit
        );

        const contributionWidth =
          isShared
          && overview.target !== null
          && displayMember.contribution !== null
            ? percentWidth(
                displayMember.contribution,
                isNewShared ? sharedTarget : overview.target
              )
            : null;

        return (
          <View
            key={String(member.userId)}
            style={styles.member}
          >
            <View style={styles.memberTop}>
              <View style={styles.nameArea}>
                <Text
                  style={styles.memberName}
                  numberOfLines={1}
                >
                  {member.name}
                </Text>

                <Text style={styles.role}>
                  {member.role === 'owner'
                    ? '방장'
                    : member.role === 'admin'
                      ? '관리자'
                      : '멤버'}
                </Text>
              </View>

              <View style={styles.memberRight}>
                <Text style={styles.detail}>
                  {detail}
                </Text>
              </View>
            </View>

            {contributionWidth !== null ? (
              <View style={styles.memberTrack}>
                <View
                  style={[
                    styles.memberFill,
                    { width: contributionWidth },
                  ]}
                />
              </View>
            ) : null}

            <TogetherMemberSyncMetaV2
              member={member}
            />
          </View>
        );
      })}

      {!isWatch
        && overview.members.length > visibleCount ? (
          <TouchableOpacity
            style={styles.moreButton}
            onPress={() =>
              setVisibleCount((count) => count + 20)
            }
            accessibilityRole="button"
            accessibilityLabel="멤버 더 보기"
          >
            <Text style={styles.moreText}>
              멤버 더 보기
              {' · '}
              {Math.min(
                visibleCount,
                overview.members.length
              )}
              /{overview.members.length}명
            </Text>
          </TouchableOpacity>
        ) : null}

      <Text style={styles.footer}>
        현재 현황은 마지막 동기화 기준입니다.
        날짜별 기록은 아래 최근 활동에서 확인할 수 있습니다.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: space.xl,
  },

  heading: {
    color: color.textPrimary,
    fontSize: 18,
    fontWeight: font.weight.heavy,
    marginBottom: space.sm,
  },

  dashboard: {
    padding: space.md,
    borderRadius: radius.card,
    gap: space.xs,
    overflow: 'hidden',
  },

  darkDashboard: {
    backgroundColor: primitive.black,
  },

  lightDashboard: {
    backgroundColor: primitive.neutral[100],
  },

  pairedDashboard: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },

  darkLabel: {
    color: primitive.neutral[300],
    fontSize: 12,
    fontWeight: font.weight.medium,
  },

  darkHero: {
    color: primitive.white,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: font.weight.heavy,
  },

  darkHint: {
    color: primitive.neutral[400],
    fontSize: 12,
    lineHeight: 18,
  },

  darkSecondary: {
    color: primitive.neutral[300],
    fontSize: 13,
    lineHeight: 19,
  },

  darkDivider: {
    height: 1,
    backgroundColor: primitive.neutral[700],
    marginVertical: space.xs,
  },

  watchSupport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  watchSupportValue: {
    color: primitive.white,
    fontSize: 19,
    fontWeight: font.weight.bold,
  },

  lightLabel: {
    color: color.textSecondary,
    fontSize: 12,
    fontWeight: font.weight.medium,
  },

  lightHero: {
    color: color.textPrimary,
    fontSize: 25,
    lineHeight: 33,
    fontWeight: font.weight.heavy,
  },

  lightHint: {
    color: color.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },

  statusTrack: {
    height: 9,
    flexDirection: 'row',
    marginTop: space.sm,
    overflow: 'hidden',
    backgroundColor: primitive.neutral[300],
    borderRadius: radius.pill,
  },

  statusDone: {
    height: '100%',
    backgroundColor: primitive.black,
  },

  statusNotDone: {
    height: '100%',
    backgroundColor: primitive.neutral[500],
  },

  metrics: {
    flexDirection: 'row',
    marginTop: space.sm,
    gap: space.xs,
  },

  metric: {
    flex: 1,
    minWidth: 0,
    paddingVertical: space.xs,
    paddingHorizontal: space.xxs,
    backgroundColor: color.surface,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },

  metricValue: {
    color: color.textPrimary,
    fontSize: 18,
    fontWeight: font.weight.bold,
  },

  metricLabel: {
    color: color.textSecondary,
    fontSize: 10,
    textAlign: 'center',
  },

  sharedTrack: {
    height: 9,
    marginTop: space.sm,
    backgroundColor: primitive.neutral[700],
    borderRadius: radius.pill,
    overflow: 'hidden',
  },

  sharedFill: {
    height: '100%',
    backgroundColor: primitive.white,
  },

  section: {
    marginTop: space.lg,
    marginBottom: space.xs,
    fontSize: 15,
    fontWeight: font.weight.heavy,
    color: color.textPrimary,
  },

  member: {
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },

  memberTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },

  nameArea: {
    flex: 1,
    minWidth: 0,
  },

  memberName: {
    color: color.textPrimary,
    fontSize: 14,
    fontWeight: font.weight.bold,
  },

  role: {
    marginTop: 3,
    color: color.textSecondary,
    fontSize: 11,
  },

  memberRight: {
    alignItems: 'flex-end',
    maxWidth: '48%',
  },

  detail: {
    color: color.textPrimary,
    fontSize: 13,
    fontWeight: font.weight.semibold,
    textAlign: 'right',
  },

  memberTrack: {
    height: 5,
    marginTop: space.xs,
    borderRadius: radius.pill,
    backgroundColor: primitive.neutral[200],
    overflow: 'hidden',
  },

  memberFill: {
    height: '100%',
    backgroundColor: primitive.black,
  },

  emptyHint: {
    color: color.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },

  moreButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: space.xs,
  },

  moreText: {
    color: color.textPrimary,
    fontSize: 13,
    fontWeight: font.weight.bold,
  },

  footer: {
    marginTop: space.md,
    color: color.textTertiary,
    fontSize: 11,
    lineHeight: 17,
  },
});
