// components/WeeklyNotificationPreview.js
// 주간 알림 설정 내용을 "읽기 전용"으로 간단히 보여주는 프리뷰 컴포넌트
// 기대 데이터 형식:
// {
//   "월": ["07:30", "10:00"],
//   "화": [],
//   "수": ["15:30"],
//   "목": [],
//   "금": ["08:00", "20:15"],
//   "토": [],
//   "일": []
// }
//
// 사용 예:
// <WeeklyNotificationPreview data={weeklyPayload} />

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../styles/common';

const DEFAULT_DAY_ORDER = ['월', '화', '수', '목', '금', '토', '일'];

function formatKoreanTime(hhmm) {
  // 'HH:mm' -> '오전/오후 H시 mm분'
  if (!hhmm || typeof hhmm !== 'string') return '';
  const [hStr, mStr = '00'] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h)) return '';

  const isAM = h < 12;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const period = isAM ? '오전' : '오후';
  if (!Number.isFinite(m) || m === 0) {
    return `${period} ${hour12}시`;
  }
  return `${period} ${hour12}시 ${m}분`;
}

export default function WeeklyNotificationPreview({
  data = {},
  dayOrder = DEFAULT_DAY_ORDER,
  maxItemsPerDay = 3, // 너무 길면 프리뷰가 길어지므로 기본 3개까지만 표기
  style,
  emptyText = '시간 없음',
}) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerRow}>
        {dayOrder.map((d) => (
          <View key={`h-${d}`} style={styles.headerCell}>
            <Text style={styles.headerText}>{d}</Text>
          </View>
        ))}
      </View>

      <View style={styles.bodyRow}>
        {dayOrder.map((d) => {
          const times = Array.isArray(data[d]) ? [...data[d]] : [];
          times.sort(); // 'HH:mm' 문자열 정렬로 시간 순서 보장
          const sliced = times.slice(0, maxItemsPerDay);
          const more = Math.max(times.length - sliced.length, 0);

          return (
            <View key={`c-${d}`} style={styles.bodyCell}>
              {sliced.length === 0 ? (
                <Text style={styles.empty}>{emptyText}</Text>
              ) : (
                sliced.map((t, idx) => (
                  <View key={`${d}-${t}-${idx}`} style={styles.timeChip}>
                    <Text style={styles.timeText}>{formatKoreanTime(t)}</Text>
                  </View>
                ))
              )}
              {more > 0 && (
                <Text style={styles.moreText}>+{more}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const CELL_MIN_HEIGHT = 64;

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.white,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 12,
    color: colors.gray600,
    fontWeight: '600',
  },
  bodyRow: {
    flexDirection: 'row',
  },
  bodyCell: {
    flex: 1,
    minHeight: CELL_MIN_HEIGHT,
    borderRightWidth: 1,
    borderRightColor: colors.gray200,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  timeChip: {
    backgroundColor: colors.gray100,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 12,
    color: colors.gray800,
  },
  empty: {
    fontSize: 12,
    color: colors.gray400,
  },
  moreText: {
    fontSize: 11,
    color: colors.gray600,
    marginTop: 2,
  },
});
