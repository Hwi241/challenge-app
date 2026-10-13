import React, { useEffect, useState } from 'react';
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

import TogetherMemberSyncMetaV2 from './TogetherMemberSyncMetaV2';

import {
  buildTogetherRoomOverviewV3,
} from '../utils/togetherRoomOverviewV3';

const MODE_TITLES = {
  watch: '함께 지켜보는 기록',
  same_push: '같은 목표, 서로의 실천',
  paired_push: '서로 다른 목표, 함께하는 실천',
  shared_goal: '함께 쌓아가는 목표',
};

const formatNumber = (value) =>
  Number(value).toLocaleString('ko-KR', {
    maximumFractionDigits: 2,
  });

const activityLabel = (activity) => {
  if (activity === 'done') return '오늘 완료';
  if (activity === 'not_done') {
    return '오늘 완료 기록 없음';
  }
  return '오늘 상태 미수신';
};

export default function TogetherRoomOverviewV3({
  room,
  members,
}) {
  const [visibleCount, setVisibleCount] = useState(8);

  useEffect(() => {
    setVisibleCount(8);
  }, [room?.id]);

  const overview = buildTogetherRoomOverviewV3({
    room,
    members,
  });

  const mode = overview.mode;
  const isWatch = mode === 'watch';
  const isShared = mode === 'shared_goal';

  const visibleMembers = isWatch
    ? overview.owner ? [overview.owner] : []
    : overview.members.slice(0, visibleCount);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>
        {MODE_TITLES[mode] || '함께하는 기록'}
      </Text>

      {isWatch ? (
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>
            공유자의 현재 활동
          </Text>
          <Text style={styles.summaryValue}>
            {overview.owner
              ? activityLabel(overview.owner.activity)
              : '공유자 정보 확인 중'}
          </Text>
          <Text style={styles.hint}>
            함께 지켜보는 사람 {overview.supporterCount}명
          </Text>
        </View>
      ) : isShared ? (
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>
            공동 목표 달성 현황
          </Text>
          <Text style={styles.summaryValue}>
            {overview.contributionKnownCount === 0
              ? '기여 기록 동기화 대기'
              : `${formatNumber(overview.contributionTotal)} / ${
                  overview.target === null
                    ? '목표 미설정'
                    : formatNumber(overview.target)
                } ${overview.unit}`}
          </Text>

          {overview.percentage !== null ? (
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${overview.percentage}%` },
                ]}
              />
            </View>
          ) : null}

          <Text style={styles.hint}>
            {overview.contributionKnownCount}명 기여 정보 확인
            {' · '}
            마지막 동기화 기준
          </Text>
        </View>
      ) : (
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>
            오늘의 함께 실천
          </Text>
          <Text style={styles.summaryValue}>
            {overview.knownCount === 0
              ? '활동 상태 확인 중'
              : `${overview.completedCount}명 완료`}
          </Text>
          <Text style={styles.hint}>
            확인된 멤버 {overview.knownCount}명
            {' · '}
            미수신 {overview.unknownCount}명
          </Text>
        </View>
      )}

      <Text style={styles.section}>
        {isWatch ? '공유자' : '멤버별 현황'}
      </Text>

      {visibleMembers.length === 0 ? (
        <Text style={styles.hint}>
          확인 가능한 멤버 정보가 없습니다.
        </Text>
      ) : null}

      {visibleMembers.map((member) => {
        const detail = isShared
          ? member.contribution === null
            ? '기여 정보 미수신'
            : `${formatNumber(member.contribution)} ${overview.unit}`
          : mode === 'same_push' && member.progress !== null
            ? `진행률 ${Math.round(
                Math.min(1, member.progress) * 100
              )}%`
            : member.streak !== null
              ? `${formatNumber(member.streak)}일 연속`
              : '연속 기록 미수신';

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
                {mode !== 'shared_goal' ? (
                  <Text style={styles.state}>
                    {activityLabel(member.activity)}
                  </Text>
                ) : null}
                <Text style={styles.detail}>
                  {detail}
                </Text>
              </View>
            </View>

            <TogetherMemberSyncMetaV2 member={member} />
          </View>
        );
      })}

      {!isWatch &&
        overview.members.length > visibleCount ? (
          <TouchableOpacity
            style={styles.moreButton}
            onPress={() => setVisibleCount(
              (count) => count + 20
            )}
            accessibilityRole="button"
            accessibilityLabel="멤버 더 보기"
          >
            <Text style={styles.moreText}>
              멤버 더 보기
              {' · '}
              {Math.min(
                visibleCount,
                overview.members.length
              )}/{overview.members.length}명
            </Text>
          </TouchableOpacity>
        ) : null}

      <Text style={styles.footer}>
        표시된 기록은 마지막 동기화 기준입니다.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  heading: {
    fontSize: 18,
    fontWeight: font.weight.heavy,
    color: color.textPrimary,
    marginBottom: 12,
  },
  summary: {
    backgroundColor: primitive.neutral[100],
    borderRadius: radius.md,
    padding: space.md,
    gap: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: color.textSecondary,
  },
  summaryValue: {
    fontSize: 21,
    fontWeight: font.weight.heavy,
    color: color.textPrimary,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    color: color.textSecondary,
  },
  track: {
    height: 9,
    backgroundColor: primitive.neutral[300],
    borderRadius: 5,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: primitive.black,
  },
  section: {
    marginTop: 22,
    marginBottom: 8,
    fontSize: 16,
    fontWeight: font.weight.heavy,
    color: color.textPrimary,
  },
  member: {
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    paddingVertical: 13,
  },
  memberTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  nameArea: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    fontSize: 14,
    fontWeight: font.weight.bold,
    color: color.textPrimary,
  },
  role: {
    marginTop: 4,
    fontSize: 11,
    color: color.textSecondary,
  },
  memberRight: {
    alignItems: 'flex-end',
  },
  state: {
    fontSize: 12,
    color: color.textPrimary,
  },
  detail: {
    marginTop: 4,
    fontSize: 12,
    color: color.textSecondary,
  },
  moreButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  moreText: {
    fontSize: 13,
    fontWeight: font.weight.bold,
    color: color.textPrimary,
  },
  footer: {
    marginTop: 18,
    fontSize: 11,
    color: color.textSecondary,
  },
});
