import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  AppState,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  useIsFocused,
} from '@react-navigation/native';

import {
  color,
  font,
  primitive,
  radius,
  space,
} from '../styles/common';

import {
  loadTogetherWeekV3,
} from '../utils/togetherRemoteV2';

import {
  requestTogetherImmediateSyncV2,
} from '../utils/togetherImmediateSyncV2';

import {
  getTogetherRoomDateKeyV3,
} from '../utils/togetherRoomOverviewV3';

import {
  getTogetherWeeklyDateRelationV4,
  getTogetherWeeklyDayPresentationV4,
} from '../utils/togetherWeeklyDayV4';

import {
  buildTogetherWeeklyViewV3,
} from '../utils/togetherWeeklyViewV3';

const WIDE_WIDTH = 600;

const DAY_LABELS = [
  '일', '월', '화', '수', '목', '금', '토',
];

const STATUS_INFO = {
  done: {
    symbol: '✓',
    label: '완료',
  },
  pending: {
    symbol: '✕',
    label: '미완료',
  },
  todayPending: {
    symbol: '·',
    label: '오늘 미기록',
  },
  off: {
    symbol: '–',
    label: '활동 제외',
  },
  unknown: {
    symbol: '?',
    label: '기록 확인 실패',
  },
};

const MODE_HELP = {
  watch:
    '공유자의 활동만 표시합니다.',
  same_push:
    '같은 PUSH의 날짜별 실천 여부를 비교합니다.',
  paired_push:
    '서로 다른 목표의 실천 여부만 비교합니다.',
  shared_goal:
    '날짜별 실천 여부입니다. 기여량은 위 요약에서 확인하세요.',
};

const dateLabel = (key) => {
  const date = new Date(`${key}T00:00:00Z`);

  if (!Number.isFinite(date.getTime())) {
    return key;
  }

  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
};

const weekdayLabel = (key) => {
  const date = new Date(`${key}T00:00:00Z`);

  if (!Number.isFinite(date.getTime())) {
    return '';
  }

  return DAY_LABELS[date.getUTCDay()];
};

const dateToneStyle = (localDate, todayKey) => {
  const relation = getTogetherWeeklyDateRelationV4(
    localDate,
    todayKey
  );

  if (relation === 'today') {
    return styles.dateToday;
  }

  if (relation === 'future') {
    return styles.dateFuture;
  }

  return styles.datePast;
};

const StatusCell = ({
  status,
  memberName,
  localDate,
  todayKey,
}) => {
  const info = getTogetherWeeklyDayPresentationV4({
    status,
    localDate,
    todayKey,
  });

  const statusStyle =
    info.symbol === '✓'
      ? styles.done
      : info.symbol === '✕'
        || info.symbol === '·'
        ? styles.pending
        : info.symbol === '–'
          ? styles.off
          : styles.unknown;

  return (
    <View
      accessible
      accessibilityLabel={
        `${memberName}, ${localDate}, ${info.label}`
      }
      style={[
        styles.cell,
        statusStyle,
      ]}
    >
      <Text
        style={[
          styles.cellText,
          info.symbol === '✓'
            && styles.doneText,
        ]}
      >
        {info.symbol}
      </Text>
    </View>
  );
};

const CompactRow = ({
  row,
  todayKey,
}) => (
  <View style={styles.memberCard}>
    <View style={styles.memberHeader}>
      <Text
        style={styles.memberName}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {row.name}
      </Text>

      <Text style={styles.memberCount}>
        완료 {row.completedCount}일
      </Text>
    </View>

    <View style={styles.compactDays}>
      {row.days.map((day) => (
        <View
          key={day.localDate}
          style={styles.compactDay}
        >
          <Text style={[
            styles.dayLabel,
            dateToneStyle(day.localDate, todayKey),
          ]}>
            {weekdayLabel(day.localDate)}
          </Text>

          <Text style={[
            styles.dateLabel,
            dateToneStyle(day.localDate, todayKey),
          ]}>
            {dateLabel(day.localDate)}
          </Text>

          <StatusCell
            status={day.status}
            memberName={row.name}
            localDate={day.localDate}
            todayKey={todayKey}
          />
        </View>
      ))}
    </View>

    {row.unknownCount > 0 ? (
      <Text style={styles.missingLabel}>
        미수신·비공개 {row.unknownCount}일
      </Text>
    ) : null}
  </View>
);

const WideMatrix = ({
  view,
  todayKey,
}) => (
  <View style={styles.matrix}>
    <View style={styles.matrixRow}>
      <View style={styles.matrixNameColumn}>
        <Text style={styles.matrixHeading}>
          멤버
        </Text>
      </View>

      {view.dates.map((day) => (
        <View
          key={day}
          style={styles.matrixDayColumn}
        >
          <Text style={[
            styles.dayLabel,
            dateToneStyle(day, todayKey),
          ]}>
            {weekdayLabel(day)}
          </Text>

          <Text style={[
            styles.dateLabel,
            dateToneStyle(day, todayKey),
          ]}>
            {dateLabel(day)}
          </Text>
        </View>
      ))}
    </View>

    {view.rows.map((row) => (
      <View
        key={row.userId}
        style={styles.matrixRow}
      >
        <View style={styles.matrixNameColumn}>
          <Text
            style={styles.matrixName}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {row.name}
          </Text>

          <Text style={styles.matrixSubtext}>
            완료 {row.completedCount}일
          </Text>
        </View>

        {row.days.map((day) => (
          <View
            key={day.localDate}
            style={styles.matrixDayColumn}
          >
            <StatusCell
              status={day.status}
              memberName={row.name}
              localDate={day.localDate}
              todayKey={todayKey}
            />
          </View>
        ))}
      </View>
    ))}
  </View>
);

export default function TogetherRoomWeeklyV3({
  room,
  members = [],
}) {
  const roomId = String(room?.id ?? '').trim();
  const isFocused = useIsFocused();

  const [width, setWidth] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [nowTick, setNowTick] = useState(
    () => Date.now()
  );

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sequenceRef = useRef(0);

  const todayKey = useMemo(
    () => getTogetherRoomDateKeyV3(
      nowTick,
      room?.timezone || 'Asia/Seoul'
    ),
    [nowTick, room?.timezone]
  );

  useEffect(() => {
    if (!isFocused) {
      return undefined;
    }

    const updateClock = () => {
      setNowTick(Date.now());
    };

    updateClock();

    const interval = setInterval(
      updateClock,
      60000
    );

    const subscription = AppState.addEventListener(
      'change',
      (nextState) => {
        if (nextState === 'active') {
          updateClock();
        }
      }
    );

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [isFocused]);

  const onLayout = useCallback((event) => {
    const next = Math.round(
      Number(
        event?.nativeEvent?.layout?.width
      ) || 0
    );

    if (next <= 0) return;

    setWidth((previous) =>
      previous === next ? previous : next
    );
  }, []);

  const reload = useCallback(() => {
    void requestTogetherImmediateSyncV2()
      .catch((failure) => {
        console.warn(
          '[TogetherWeekly] local sync failed',
          String(failure?.message || 'unknown')
        );
      })
      .finally(() => {
        setReloadKey((previous) => previous + 1);
      });
  }, []);

  useEffect(() => {
    if (!isFocused || !roomId) {
      return undefined;
    }

    let active = true;
    const sequence = ++sequenceRef.current;

    setLoading(true);
    setError('');

    Promise.resolve()
      .then(() =>
        loadTogetherWeekV3({ roomId })
      )
      .then((value) => {
        if (
          !active
          || sequence !== sequenceRef.current
        ) {
          return;
        }

        if (
          !value
          || typeof value !== 'object'
          || !Array.isArray(value.members)
          || typeof value.startDate !== 'string'
          || typeof value.endDate !== 'string'
        ) {
          throw new Error(
            'TOGETHER_WEEK_RESPONSE_INVALID'
          );
        }

        setData({
          roomId,
          todayKey,
          value,
        });
      })
      .catch((failure) => {
        if (
          !active
          || sequence !== sequenceRef.current
        ) {
          return;
        }

        console.warn(
          '[TogetherWeekly] load failed',
          String(
            failure?.message || 'unknown'
          )
        );

        setError(
          '주간 기록을 불러오지 못했어요.'
        );
      })
      .finally(() => {
        if (
          active
          && sequence === sequenceRef.current
        ) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    roomId,
    isFocused,
    members,
    reloadKey,
    todayKey,
  ]);

  const week =
    data?.roomId === roomId
      && data?.todayKey === todayKey
      ? data.value
      : null;

  const view = useMemo(
    () =>
      buildTogetherWeeklyViewV3({
        room,
        members,
        week,
      }),
    [room, members, week]
  );

  const wide = width >= WIDE_WIDTH;

  return (
    <View
      style={styles.container}
      onLayout={onLayout}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>
            최근 활동
          </Text>

          <Text style={styles.help}>
            {MODE_HELP[room?.mode]
              || '날짜별 활동을 확인합니다.'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={reload}
          disabled={loading}
          style={styles.refreshButton}
          accessibilityRole="button"
          accessibilityLabel="주간 기록 새로고침"
        >
          <Text style={styles.refreshText}>
            새로고침
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !view ? (
        <View style={styles.message}>
          <ActivityIndicator
            color={primitive.black}
          />
          <Text style={styles.messageText}>
            주간 기록을 불러오는 중...
          </Text>
        </View>
      ) : null}

      {error ? (
        <Text style={styles.error}>
          {error}
          {view ? ' 이전 조회 결과를 표시합니다.' : ''}
        </Text>
      ) : null}

      {view ? (
        <>
          <Text style={styles.period}>
            {dateLabel(view.startDate)}
            {' ~ '}
            {dateLabel(view.endDate)}
            {' · 참여 이후 공개 기록'}
          </Text>

          {view.rows.length ? (
            wide ? (
              <WideMatrix
                view={view}
                todayKey={todayKey}
              />
            ) : (
              <View style={styles.compactList}>
                {view.rows.map((row) => (
                  <CompactRow
                    key={row.userId}
                    row={row}
                    todayKey={todayKey}
                  />
                ))}
              </View>
            )
          ) : (
            <Text style={styles.messageText}>
              표시할 주간 멤버 기록이 없어요.
            </Text>
          )}

          {view.limited ? (
            <Text style={styles.limitNotice}>
              전체 {view.memberCount}명 중
              최대 8명까지 표시합니다.
              나머지 멤버 조회는 후속 단계에서 지원합니다.
            </Text>
          ) : null}

          <View style={styles.legend}>
            {Object.entries(STATUS_INFO).map(
              ([status, info]) => (
                <View
                  key={status}
                  style={styles.legendItem}
                >
                  <Text style={styles.legendSymbol}>
                    {info.symbol}
                  </Text>

                  <Text style={styles.legendText}>
                    {info.label}
                  </Text>
                </View>
              )
            )}
          </View>

          <Text style={styles.notice}>
            서버에 확인된 주간 활동입니다.
            ✕는 해당 날짜의 완료 기록이 없음을 의미합니다.
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: space.xl,
    padding: space.md,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.card,
    backgroundColor: color.surface,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.sm,
  },

  headerText: {
    flex: 1,
    minWidth: 0,
  },

  title: {
    color: color.textPrimary,
    fontSize: font.size.title,
    fontWeight: font.weight.heavy,
  },

  help: {
    marginTop: space.xxs,
    color: color.textSecondary,
    fontSize: font.size.meta,
    lineHeight: 18,
  },

  refreshButton: {
    minWidth: 68,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xs,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
  },

  refreshText: {
    color: color.textPrimary,
    fontSize: font.size.meta,
    fontWeight: font.weight.bold,
  },

  period: {
    marginTop: space.md,
    color: color.textSecondary,
    fontSize: font.size.meta,
  },

  message: {
    marginTop: space.lg,
    alignItems: 'center',
    gap: space.xs,
  },

  messageText: {
    marginTop: space.md,
    color: color.textSecondary,
    fontSize: font.size.bodySmall,
  },

  error: {
    marginTop: space.md,
    color: primitive.black,
    fontSize: font.size.bodySmall,
  },

  compactList: {
    marginTop: space.md,
    gap: space.sm,
  },

  memberCard: {
    padding: space.sm,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.backgroundMuted,
  },

  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },

  memberName: {
    flex: 1,
    minWidth: 0,
    color: color.textPrimary,
    fontSize: font.size.body,
    fontWeight: font.weight.bold,
  },

  memberCount: {
    color: color.textSecondary,
    fontSize: font.size.meta,
  },

  compactDays: {
    flexDirection: 'row',
    marginTop: space.sm,
    gap: 3,
  },

  compactDay: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 4,
  },

  dayLabel: {
    color: color.textSecondary,
    fontSize: 11,
    textAlign: 'center',
  },

  dateLabel: {
    color: color.textTertiary,
    fontSize: 10,
    textAlign: 'center',
  },

  datePast: {
    color: '#777777',
    fontWeight: font.weight.regular,
  },

  dateToday: {
    color: '#111111',
    fontWeight: font.weight.heavy,
  },

  dateFuture: {
    color: '#C4C4C4',
    fontWeight: font.weight.regular,
  },

  cell: {
    width: '100%',
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.sm,
  },

  cellText: {
    color: color.textSecondary,
    fontSize: 15,
    fontWeight: font.weight.bold,
  },

  done: {
    backgroundColor: primitive.neutral[100],
    borderColor: primitive.neutral[300],
  },

  doneText: {
    color: primitive.black,
  },

  pending: {
    backgroundColor: primitive.neutral[100],
    borderColor: primitive.neutral[300],
  },

  off: {
    backgroundColor: primitive.neutral[50],
    borderColor: primitive.neutral[200],
  },

  unknown: {
    backgroundColor: primitive.white,
    borderColor: primitive.neutral[300],
    borderStyle: 'dashed',
  },

  missingLabel: {
    marginTop: space.xs,
    color: color.textTertiary,
    fontSize: 11,
  },

  matrix: {
    marginTop: space.md,
    gap: 6,
  },

  matrixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  matrixNameColumn: {
    width: 132,
    minWidth: 0,
    paddingRight: space.xs,
  },

  matrixHeading: {
    color: color.textSecondary,
    fontSize: 11,
    fontWeight: font.weight.bold,
  },

  matrixName: {
    color: color.textPrimary,
    fontSize: font.size.bodySmall,
    fontWeight: font.weight.bold,
  },

  matrixSubtext: {
    color: color.textTertiary,
    fontSize: 11,
    marginTop: 3,
  },

  matrixDayColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 3,
  },

  legend: {
    marginTop: space.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  legendSymbol: {
    color: color.textSecondary,
    fontSize: 12,
    fontWeight: font.weight.bold,
  },

  legendText: {
    color: color.textSecondary,
    fontSize: 11,
  },

  limitNotice: {
    marginTop: space.sm,
    color: color.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },

  notice: {
    marginTop: space.sm,
    color: color.textTertiary,
    fontSize: 11,
    lineHeight: 16,
  },
});
