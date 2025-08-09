// components/MonthlyNotificationPreview.js
// 월간 알림 설정 내용을 "읽기 전용" 달력 그리드로 보여주는 프리뷰
// 기대 데이터 형식:
// {
//   "2025-08-01": ["08:00", "22:10"],
//   "2025-08-10": ["07:30"],
//   ...
// }
// 사용 예:
// <MonthlyNotificationPreview year={2025} month={8} data={monthlyPayload} />

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../styles/common';

// 한국 사용자 UX에 맞춰 월~일 순서(월요일 시작)를 기본값으로 제공
const DOW_HEADER = ['월', '화', '수', '목', '금', '토', '일'];

function pad2(n) {
  return n < 10 ? `0${n}` : String(n);
}

function formatKoreanTime(hhmm) {
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

function buildMonthMatrix(year, month /* 1-12 */) {
  // 월요일 시작 그리드(6주 칸) 생성
  // JS Date: month는 0-11
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const daysInMonth = last.getDate();

  // JS: 0=일,1=월,... → 월요일 시작 인덱스로 보정
  const firstDowJS = first.getDay(); // 0-6 (일~토)
  const firstDowMonStart = (firstDowJS + 6) % 7; // 0-6 (월~일)

  const totalCells = 42; // 6주 * 7일
  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - firstDowMonStart + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push(null); // 지난달/다음달 칸은 비움
    } else {
      const dateStr = `${year}-${pad2(month)}-${pad2(dayNum)}`;
      cells.push({ year, month, day: dayNum, dateStr });
    }
  }
  return { daysInMonth, cells };
}

export default function MonthlyNotificationPreview({
  year,
  month, // 1-12
  data = {},
  maxItemsPerDay = 3,
  style,
  emptyText = '시간 없음',
}) {
  const matrix = useMemo(() => buildMonthMatrix(year, month), [year, month]);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerRow}>
        {DOW_HEADER.map((d) => (
          <View key={`h-${d}`} style={styles.headerCell}>
            <Text style={styles.headerText}>{d}</Text>
          </View>
        ))}
      </View>

      {/* 6줄 x 7칸 */}
      <View style={styles.grid}>
        {matrix.cells.map((cell, idx) => {
          if (!cell) {
            return <View key={`c-${idx}`} style={[styles.cell, styles.cellEmpty]} />;
          }
          const times = Array.isArray(data[cell.dateStr]) ? [...data[cell.dateStr]] : [];
          times.sort();
          const sliced = times.slice(0, maxItemsPerDay);
          const more = Math.max(times.length - sliced.length, 0);

          return (
            <View key={`c-${cell.dateStr}`} style={styles.cell}>
              <Text style={styles.dayText}>{cell.day}</Text>
              <View style={styles.timeList}>
                {sliced.length === 0 ? (
                  <Text style={styles.empty}>{emptyText}</Text>
                ) : (
                  sliced.map((t, i) => (
                    <View key={`${cell.dateStr}-${t}-${i}`} style={styles.timeChip}>
                      <Text style={styles.timeText}>{formatKoreanTime(t)}</Text>
                    </View>
                  ))
                )}
                {more > 0 && (
                  <Text style={styles.moreText}>+{more}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const CELL_SIZE = 44;

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
    width: CELL_SIZE,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 12,
    color: colors.gray600,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: CELL_SIZE,
    minHeight: CELL_SIZE + 28,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.sm,
    padding: 4,
    marginRight: 4,
    marginBottom: 4,
    backgroundColor: colors.gray50,
  },
  cellEmpty: {
    backgroundColor: colors.white,
    borderColor: colors.gray100,
  },
  dayText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gray800,
    marginBottom: 2,
  },
  timeList: {
    flexShrink: 1,
  },
  timeChip: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginBottom: 3,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  timeText: {
    fontSize: 11,
    color: colors.gray800,
  },
  empty: {
    fontSize: 11,
    color: colors.gray400,
  },
  moreText: {
    fontSize: 10,
    color: colors.gray600,
    marginTop: 2,
  },
});
