import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

const WEEK_DAYS_KO = ['월', '화', '수', '목', '금', '토', '일'];

const sortTimesAsc = (arr = []) => [...arr].sort((a, b) => String(a).localeCompare(String(b)));
const pad2 = (n) => String(n).padStart(2, '0');

const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export function SettingSectionCard({
  title,
  actionLabel,
  onActionPress,
  onClear,
  clearAccessibilityLabel,
  children,
  style,
}) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitleInline}>{title}</Text>
        <View style={styles.headerActionRow}>
          {!!onClear && (
            <TouchableOpacity
              style={styles.clearCircleBtn}
              onPress={onClear}
              activeOpacity={0.85}
              accessibilityLabel={clearAccessibilityLabel}
            >
              <Text style={styles.clearCircleText}>×</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerSmallBtn}
            onPress={onActionPress}
            activeOpacity={0.9}
          >
            <Text style={styles.headerSmallBtnText}>{actionLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.previewBox}>
        {children}
      </View>
    </View>
  );
}

export function GoalCyclePreview({ cycle }) {
  if (!cycle) {
    return <Text style={styles.previewText}>주기 없음</Text>;
  }

  if (cycle.type === 'weekly') {
    const selected = Array.isArray(cycle.days) ? cycle.days : [];
    return (
      <View>
        <View style={styles.daysRow}>
          {WEEK_DAYS_KO.map((d) => {
            const on = selected.includes(d);
            return (
              <View key={d} style={[styles.dayCircle, on ? styles.dayCircleOn : styles.dayCircleOff]}>
                <Text style={[styles.dayCircleText, on && styles.dayCircleTextOn]}>{d}</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.previewText}>
          {selected.length ? `${selected.join(', ')} 반복` : '요일 미선택'}
        </Text>
      </View>
    );
  }

  if (cycle.type === 'monthly') {
    const dates = (Array.isArray(cycle.dates) ? cycle.dates : [])
      .map(Number)
      .filter((n) => n >= 1 && n <= 31)
      .sort((a, b) => a - b);

    if (!dates.length) {
      return <Text style={styles.previewText}>날짜 미선택</Text>;
    }

    return (
      <View style={styles.dateChipWrap}>
        {dates.map((d) => (
          <View key={d} style={styles.dateChip}>
            <Text style={styles.dateChipText}>{d}일</Text>
          </View>
        ))}
      </View>
    );
  }

  return <Text style={styles.previewText}>주기 없음</Text>;
}

const SimpleNotificationPreview = ({ days = [], times = [], time }) => {
  const toShow = Array.isArray(times) && times.length ? sortTimesAsc(times) : (time ? [time] : []);
  return (
    <View>
      <View style={styles.daysRow}>
        {WEEK_DAYS_KO.map((d) => {
          const on = days.includes(d);
          return (
            <View key={d} style={[styles.dayCircle, on ? styles.dayCircleOn : styles.dayCircleOff]}>
              <Text style={[styles.dayCircleText, on && styles.dayCircleTextOn]}>{d}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.previewText}>{toShow.length ? toShow.join(' ') : '시간 미설정'}</Text>
    </View>
  );
};

const WeeklyNotificationPreview = ({ byWeekDays = [] }) => {
  const map = useMemo(() => {
    const m = new Map();
    for (const { day, times = [] } of byWeekDays) m.set(day, sortTimesAsc(times));
    return m;
  }, [byWeekDays]);

  return (
    <View style={styles.weekGrid}>
      {WEEK_DAYS_KO.map((d, i) => (
        <View key={d} style={[styles.weekCol, i < 6 && styles.weekColDivider]}>
          <Text style={styles.weekDayLabel}>{d}</Text>
          {(map.get(d) || []).map((t, idx) => (
            <Text key={`${d}-${t}-${idx}`} style={styles.weekTimeText}>{t}</Text>
          ))}
        </View>
      ))}
    </View>
  );
};

const MonthlyNotificationPreview = ({ byDates = [] }) => {
  const map = useMemo(() => {
    const m = new Map();
    for (const { date, times = [] } of byDates) {
      const n = Number(date);
      if (n >= 1 && n <= 31) m.set(n, sortTimesAsc([...(m.get(n) || []), ...times]));
    }
    return m;
  }, [byDates]);

  const cells = [];
  for (let d = 1; d <= 31; d += 1) cells.push(d);
  while (cells.length < 35) cells.push(null);

  return (
    <View style={styles.monthOuter}>
      {Array.from({ length: 5 }).map((_, r) => (
        <View key={`r${r}`} style={[styles.monthRow, r < 4 && styles.monthRowDivider]}>
          {cells.slice(r * 7, r * 7 + 7).map((d, c) => (
            <View key={`c${r}-${c}`} style={[styles.monthCell, c < 6 && styles.monthCellDivider]}>
              {!!d && (
                <>
                  <Text style={styles.monthDateText}>{d}</Text>
                  {(map.get(d) || []).map((t, idx) => (
                    <Text key={`${d}-${t}-${idx}`} style={styles.monthTimeText}>{t}</Text>
                  ))}
                </>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

const FullRangeNotificationPreview = ({ payload = {}, startDate, endDate }) => {
  const start = normalizeDate(startDate);
  const endDateObj = normalizeDate(endDate);

  if (!start || !endDateObj) {
    return <Text style={styles.previewText}>기간이 설정되지 않았습니다.</Text>;
  }
  const byDate = payload.byDate || {};
  const months = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(endDateObj.getFullYear(), endDateObj.getMonth(), 1);

  while (cur <= endMonth) {
    months.push({ y: cur.getFullYear(), mi: cur.getMonth() });
    cur.setMonth(cur.getMonth() + 1, 1);
  }

  const inRange = (y, mi, d) => {
    const dt = new Date(y, mi, d);
    return dt >= new Date(start.getFullYear(), start.getMonth(), start.getDate())
      && dt <= new Date(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate());
  };

  return (
    <View style={{ maxHeight: 260 }}>
      <ScrollView nestedScrollEnabled>
        {months.map(({ y, mi }) => {
          const firstDow = new Date(y, mi, 1).getDay();
          const dim = new Date(y, mi + 1, 0).getDate();
          const cells = [];
          for (let i = 0; i < firstDow; i += 1) cells.push(null);
          for (let d = 1; d <= dim; d += 1) cells.push(d);
          while (cells.length % 7 !== 0) cells.push(null);

          return (
            <View key={`${y}-${mi}`} style={{ marginBottom: 8 }}>
              <Text style={styles.fullRangeMonthTitle}>{y}.{pad2(mi + 1)}</Text>
              <View style={styles.fullRangeWeekRow}>
                {['일', '월', '화', '수', '목', '금', '토'].map((w, i) => (
                  <View key={w} style={[styles.fullRangeWeekCell, i < 6 && styles.monthCellDivider]}>
                    <Text style={styles.weekDayLabel}>{w}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.monthOuter}>
                {Array.from({ length: Math.ceil(cells.length / 7) }).map((_, r) => (
                  <View key={`fr-r${r}`} style={styles.monthRow}>
                    {cells.slice(r * 7, r * 7 + 7).map((d, c) => {
                      const show = d && inRange(y, mi, d);
                      const key = d ? `${y}-${pad2(mi + 1)}-${pad2(d)}` : '';
                      const t = show ? (Array.isArray(byDate[key]) ? sortTimesAsc(byDate[key]) : []) : [];

                      return (
                        <View key={`fr-c${r}-${c}`} style={[styles.monthCell, c < 6 && styles.monthCellDivider]}>
                          {!!d && (
                            <>
                              <Text style={[styles.monthDateText, !show && { opacity: 0.3 }]}>{d}</Text>
                              {show && t.map((x, idx) => (
                                <Text key={`${d}-${x}-${idx}`} style={styles.monthTimeText}>{x}</Text>
                              ))}
                            </>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

export function NotificationPreview({ notification, startDate, endDate }) {
  if (!notification?.mode) {
    return <Text style={styles.previewText}>알림 없음</Text>;
  }

  const { mode, payload = {} } = notification;

  if (mode === 'simple') {
    return <SimpleNotificationPreview days={payload.days || []} times={payload.times || []} time={payload.time} />;
  }
  if (mode === 'weekly' && Array.isArray(payload.byWeekDays)) {
    return <WeeklyNotificationPreview byWeekDays={payload.byWeekDays} />;
  }
  if (mode === 'monthly' && Array.isArray(payload.byDates)) {
    return <MonthlyNotificationPreview byDates={payload.byDates} />;
  }
  if (mode === 'fullrange') {
    return <FullRangeNotificationPreview payload={payload} startDate={startDate} endDate={endDate} />;
  }

  return <Text style={styles.previewText}>알림 없음</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitleInline: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  clearCircleBtn: {
    width: 22.4,
    height: 22.4,
    borderRadius: 11.2,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearCircleText: {
    color: '#374151',
    fontSize: 14.4,
    fontWeight: '800',
    lineHeight: 14.4,
    includeFontPadding: false,
  },
  headerSmallBtn: {
    minWidth: 52,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSmallBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  previewBox: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  previewText: {
    fontSize: 12,
    color: '#333333',
    textAlign: 'center',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dayCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dayCircleOff: {
    borderColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
  },
  dayCircleOn: {
    borderColor: '#111111',
    backgroundColor: '#111111',
  },
  dayCircleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#333333',
  },
  dayCircleTextOn: {
    color: '#FFFFFF',
  },
  dateChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  dateChip: {
    minWidth: 28,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
    paddingHorizontal: 8,
    marginRight: 6,
    marginBottom: 6,
  },
  dateChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  weekGrid: {
    flexDirection: 'row',
  },
  weekCol: {
    flex: 1,
    paddingHorizontal: 4,
  },
  weekColDivider: {
    borderRightWidth: 1,
    borderRightColor: '#EEEEEE',
  },
  weekDayLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#555555',
    textAlign: 'center',
    marginBottom: 2,
  },
  weekTimeText: {
    fontSize: 11,
    textAlign: 'center',
    color: '#333333',
  },
  monthOuter: {
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  monthRow: {
    flexDirection: 'row',
  },
  monthRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  monthCell: {
    flex: 1,
    padding: 4,
  },
  monthCellDivider: {
    borderRightWidth: 1,
    borderRightColor: '#EEEEEE',
  },
  monthDateText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#555555',
    textAlign: 'right',
  },
  monthTimeText: {
    fontSize: 11,
    color: '#333333',
  },
  fullRangeMonthTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#555555',
    textAlign: 'center',
  },
  fullRangeWeekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  fullRangeWeekCell: {
    flex: 1,
    alignItems: 'center',
  },
});
