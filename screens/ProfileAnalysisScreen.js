import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';

import {
  color,
  font,
  primitive,
  space,
  surface as canonicalSurfaceStyles,
  text as canonicalTextStyles,
} from '../styles/common';

const ANALYSIS_PAGES = [
  { key: 'consistency', title: '꾸준함', eyebrow: 'CONSISTENCY' },
  { key: 'growth', title: '성장', eyebrow: 'GROWTH' },
  { key: 'rhythm', title: '리듬', eyebrow: 'RHYTHM' },
  { key: 'balance', title: '균형', eyebrow: 'BALANCE' },
  { key: 'achievement', title: '성취', eyebrow: 'ACHIEVEMENT' },
];

const clampPageIndex = (value) => Math.max(
  0,
  Math.min(ANALYSIS_PAGES.length - 1, Math.floor(Number(value) || 0))
);

const ReadyState = ({ pageNumber, eyebrow, title = '분석 준비 중', summary, detail }) => (
  <View style={styles.readyWrap}>
    <Text style={styles.pageNumber}>{pageNumber}</Text>
    <Text style={styles.eyebrow}>{eyebrow}</Text>
    <Text style={styles.readyTitle}>{title}</Text>
    <View style={styles.rule} />
    <Text style={styles.readyDescription}>{summary}</Text>
    {detail ? <Text style={styles.readyDetail}>{detail}</Text> : null}
  </View>
);

const MetricLine = ({ label, value, score }) => (
  <View style={styles.metricLine}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
    {score ? <Text style={styles.metricScore}>{score}</Text> : null}
  </View>
);

const ConsistencyPage = ({ analysis }) => {
  if (!analysis || analysis.score == null) {
    return (
      <ReadyState
        pageNumber="01"
        eyebrow="CONSISTENCY"
        summary={analysis?.summary || '조금 더 기록이 쌓이면 꾸준함을 분석할 수 있어요.'}
        detail={analysis ? `현재 ${analysis.metrics.trackedDays}일 기록` : null}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.analysisContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>CONSISTENCY</Text>
      <View style={styles.scoreHero}>
        <Text style={styles.scoreValue}>{analysis.score}</Text>
        <View style={styles.scoreCopy}>
          <Text style={styles.scoreLabel}>꾸준함 점수</Text>
          <Text style={styles.scoreStatus}>{analysis.status}</Text>
        </View>
      </View>
      <Text style={styles.comparisonText}>{analysis.comparison?.text}</Text>

      <View style={styles.activityGrid}>
        {analysis.activity.map((day) => (
          <View
            key={day.key}
            style={[
              styles.activityDay,
              day.count > 0 && styles.activityDayActive,
              day.isToday && styles.activityDayToday,
            ]}
          />
        ))}
      </View>
      <View style={styles.legendRow}>
        <Text style={styles.legendText}>30일 전</Text>
        <Text style={styles.legendText}>오늘</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>점수 근거</Text>
        <MetricLine label="활동일" value={`${analysis.metrics.activityDays} / 30일`} score={`${analysis.components.activityDays} / 60`} />
        <MetricLine label="연속성" value={`현재 ${analysis.metrics.currentStreak}일`} score={`${analysis.components.streak} / 25`} />
        <MetricLine label="공백 관리" value={`최장 ${analysis.metrics.longestGap}일`} score={`${analysis.components.gap} / 15`} />
      </View>
    </ScrollView>
  );
};

const formatGrowthChange = (metric) => {
  if (metric?.isNew) return '새로운 활동';
  if (!Number.isFinite(metric?.rate)) return '비교 데이터 없음';
  const value = Math.round(metric.rate);
  return `${value > 0 ? '+' : ''}${value}%`;
};

const createLinePath = (values, width, height, maxValue) => values.map((value, index) => {
  const x = values.length > 1 ? (index / (values.length - 1)) * width : 0;
  const y = height - (value / maxValue) * (height - 8) - 4;
  return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
}).join(' ');

const GrowthChart = ({ flow }) => {
  const chartWidth = 320;
  const chartHeight = 120;
  const maxValue = Math.max(1, ...flow.current, ...flow.previous);
  return (
    <View style={styles.chartWrap}>
      <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
        <Path d={`M0 ${chartHeight - 4} L${chartWidth} ${chartHeight - 4}`} stroke={color.divider} strokeWidth="1" />
        <Path d={createLinePath(flow.previous, chartWidth, chartHeight, maxValue)} fill="none" stroke={primitive.neutral[400]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d={createLinePath(flow.current, chartWidth, chartHeight, maxValue)} fill="none" stroke={color.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <View style={styles.chartLegend}>
        <View style={styles.chartLegendItem}><View style={styles.legendCurrent} /><Text style={styles.legendText}>최근 30일</Text></View>
        <View style={styles.chartLegendItem}><View style={styles.legendPrevious} /><Text style={styles.legendText}>이전 30일</Text></View>
      </View>
    </View>
  );
};

const GrowthPage = ({ analysis }) => {
  if (!analysis || analysis.score == null) {
    return (
      <ReadyState
        pageNumber="02"
        eyebrow="GROWTH"
        summary={analysis?.summary || '이전 30일과 비교하려면 조금 더 기록이 필요해요.'}
        detail={analysis ? `현재 ${analysis.metrics.trackedDays}일 기록` : null}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.analysisContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>GROWTH</Text>
      <View style={styles.scoreHero}>
        <Text style={styles.scoreValue}>{analysis.score}</Text>
        <View style={styles.scoreCopy}>
          <Text style={styles.scoreLabel}>성장 점수</Text>
          <Text style={styles.scoreStatus}>{analysis.status}</Text>
        </View>
      </View>
      <Text style={styles.comparisonText}>{analysis.summary}</Text>

      <GrowthChart flow={analysis.flow} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>이전 30일 대비</Text>
        <MetricLine label="활동일" value={`${analysis.metrics.previousActivityDays}일 → ${analysis.metrics.currentActivityDays}일`} score={formatGrowthChange(analysis.comparison.activityDays)} />
        <MetricLine label="기록량" value={`${analysis.metrics.previousCount}회 → ${analysis.metrics.currentCount}회`} score={formatGrowthChange(analysis.comparison.activityCount)} />
      </View>
      <View style={styles.sectionCompact}>
        <MetricLine label="활동일 변화" value="항목 점수" score={`${analysis.components.activityDays} / 100`} />
        <MetricLine label="기록량 변화" value="항목 점수" score={`${analysis.components.activityCount} / 100`} />
      </View>
    </ScrollView>
  );
};

const getHeatColor = (value, maxValue) => {
  if (value <= 0 || maxValue <= 0) return primitive.white;
  const ratio = value / maxValue;
  if (ratio <= 0.25) return primitive.neutral[100];
  if (ratio <= 0.5) return primitive.neutral[300];
  if (ratio <= 0.75) return primitive.neutral[600];
  return primitive.neutral[950];
};

const RhythmHeatmap = ({ rows }) => {
  const maxValue = Math.max(0, ...rows.flatMap((row) => row.values));
  return (
    <View style={styles.heatmap}>
      <View style={styles.heatmapHeader}>
        <View style={styles.heatmapLabelSpace} />
        {['월', '화', '수', '목', '금', '토', '일'].map((label) => (
          <Text key={label} style={styles.heatmapDayLabel}>{label}</Text>
        ))}
      </View>
      {rows.map((row) => (
        <View key={row.key} style={styles.heatmapRow}>
          <Text style={styles.heatmapTimeLabel}>{row.label}</Text>
          {row.values.map((value, index) => (
            <View
              key={`${row.key}-${index}`}
              style={[styles.heatmapCell, { backgroundColor: getHeatColor(value, maxValue) }]}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

const RhythmPage = ({ analysis }) => {
  if (!analysis || !analysis.rhythmType) {
    return (
      <ReadyState
        pageNumber="03"
        eyebrow="RHYTHM"
        summary={analysis?.summaryLines?.[0] || '조금 더 기록이 쌓이면 활동 시간과 요일 패턴을 보여드릴게요.'}
        detail={analysis ? `최근 30일 · 기록 ${analysis.totalRecords}건 · 활동 ${analysis.activeDays}일` : null}
      />
    );
  }

  const leading = [...analysis.timeShares].sort((a, b) => b.share - a.share)[0];
  const topWeekdayLabel = analysis.topWeekdays.length > 0
    ? analysis.topWeekdays.map((item) => item.label).join(' · ')
    : '특정 요일 없음';
  return (
    <ScrollView contentContainerStyle={styles.analysisContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>RHYTHM</Text>
      <Text style={styles.typeHero}>{analysis.rhythmType}</Text>
      <Text style={styles.typeSubtitle}>{analysis.patternStrength}</Text>
      {analysis.rhythmKind !== 'mixed' ? (
        <View style={styles.primaryFact}>
          <Text style={styles.primaryRange}>{leading.range}</Text>
          <Text style={styles.primaryShare}>활동의 {Math.round(leading.share * 100)}%</Text>
        </View>
      ) : null}

      <RhythmHeatmap rows={analysis.heatmap} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>활동 패턴</Text>
        <MetricLine label="활발한 시간" value={leading.shortRange} score={`${Math.round(leading.share * 100)}%`} />
        <MetricLine label="요일 패턴" value={analysis.weekdayPattern} />
        <MetricLine label="활동 요일" value={topWeekdayLabel} />
      </View>

      <View style={styles.interpretation}>
        {analysis.summaryLines.map((line) => <Text key={line} style={styles.interpretationText}>{line}</Text>)}
      </View>
    </ScrollView>
  );
};

const BalancePage = ({ analysis }) => {
  if (!analysis || !analysis.balanceType) {
    const isEmpty = analysis?.total === 0;
    return (
      <ReadyState
        pageNumber="04"
        eyebrow="BALANCE"
        title={isEmpty ? '기록 없음' : '분석 준비 중'}
        summary={isEmpty ? '최근 30일에 집계 가능한 활동이 없어요.' : '조금 더 기록이 쌓이면 활동 구성을 보여드릴게요.'}
        detail={analysis ? `최근 30일 · 집계 가능한 활동 ${analysis.total}회` : null}
      />
    );
  }

  const leading = [...analysis.shares].sort((a, b) => b.share - a.share)[0];
  const meaningfulDeltas = analysis.previousTotal >= 10
    ? [...analysis.deltas].filter((item) => Math.abs(item.deltaPp) >= 5)
      .sort((a, b) => Math.abs(b.deltaPp) - Math.abs(a.deltaPp)).slice(0, 2)
    : [];
  return (
    <ScrollView contentContainerStyle={styles.analysisContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>BALANCE</Text>
      <Text style={styles.typeHero}>{analysis.balanceType}</Text>
      <Text style={styles.typeSubtitle}>
        {analysis.balanceKind === 'singleOnly'
          ? analysis.summaryLines[0]
          : `최근 활동의 ${leading.displayPercent}%`}
      </Text>

      <View style={styles.proportionBars}>
        {analysis.shares.map((item, index) => (
          <View key={item.key} style={styles.proportionItem}>
            <View style={styles.proportionHeading}>
              <Text style={styles.proportionLabel}>{item.label}</Text>
              <Text style={styles.proportionPercent}>{item.displayPercent}%</Text>
            </View>
            <View style={styles.proportionTrack}>
              <View
                style={[
                  styles.proportionFill,
                  index !== analysis.shares.indexOf(leading) && styles.proportionFillMuted,
                  { width: `${item.displayPercent}%` },
                ]}
              />
            </View>
          </View>
        ))}
      </View>

      {meaningfulDeltas.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>이전 30일 대비</Text>
          {meaningfulDeltas.map((item) => (
            <MetricLine
              key={item.key}
              label={item.label}
              value="비중 변화"
              score={`${item.deltaPp > 0 ? '+' : ''}${Math.round(item.deltaPp)}%p`}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.interpretation}>
        {analysis.summaryLines.map((line) => <Text key={line} style={styles.interpretationText}>{line}</Text>)}
      </View>
    </ScrollView>
  );
};

const AchievementPage = ({ analysis }) => {
  if (!analysis) {
    return (
      <ReadyState
        pageNumber="05"
        eyebrow="ACHIEVEMENT"
        summary="기록을 불러오면 지금까지의 성취를 보여드려요."
      />
    );
  }

  const { metrics } = analysis;
  return (
    <ScrollView contentContainerStyle={styles.analysisContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>ACHIEVEMENT</Text>
      <View style={styles.achievementHero}>
        <Text style={styles.achievementValue}>{metrics.totalCount.toLocaleString('ko-KR')}</Text>
        <Text style={styles.achievementLabel}>총 기록</Text>
        <Text style={styles.achievementCaption}>{analysis.status}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>누적 성취</Text>
        <MetricLine label="명예의 전당" value="완료 기록" score={String(metrics.hallOfFameCount)} />
        <MetricLine label="총 활동일" value="중복 날짜 제외" score={`${metrics.totalActivityDays}일`} />
        <MetricLine label="최장 연속" value="전체 활동 기간" score={`${metrics.longestStreak}일`} />
      </View>

      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>최근 30일</Text>
        <Text style={styles.recentValue}>기록 {metrics.recentCount}회 · 활동 {metrics.recentActivityDays}일</Text>
        {analysis.comparison.recentCountDelta > 0 ? (
          <Text style={styles.recentDelta}>이전 30일보다 {analysis.comparison.recentCountDelta}회 늘었어요.</Text>
        ) : null}
      </View>
    </ScrollView>
  );
};

export default function ProfileAnalysisScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const listRef = useRef(null);
  const { width } = useWindowDimensions();
  const initialIndex = useMemo(
    () => clampPageIndex(route.params?.initialIndex),
    [route.params?.initialIndex]
  );
  const [pageIndex, setPageIndex] = useState(initialIndex);
  const analysisData = route.params?.analysisData;

  const renderPage = useCallback(({ item, index }) => {
    const content = item.key === 'consistency' ? (
      <ConsistencyPage analysis={analysisData?.consistency} />
    ) : item.key === 'growth' ? (
      <GrowthPage analysis={analysisData?.growth} />
    ) : item.key === 'rhythm' ? (
      <RhythmPage analysis={analysisData?.rhythm} />
    ) : item.key === 'balance' ? (
      <BalancePage analysis={analysisData?.balance} />
    ) : item.key === 'achievement' ? (
      <AchievementPage analysis={analysisData?.achievement} />
    ) : (
      <ReadyState
        pageNumber={String(index + 1).padStart(2, '0')}
        eyebrow={item.eyebrow}
        summary="기록이 쌓인 흐름을 더 깊이 살펴볼 수 있도록 준비하고 있어요."
      />
    );

    return (
      <View style={[styles.page, { width }]}>
        <View style={styles.pageInner}>{content}</View>
      </View>
    );
  }, [analysisData, width]);

  return (
    <SafeAreaView style={canonicalSurfaceStyles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerSide}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="내 기록실로 돌아가기"
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={[canonicalTextStyles.headerTitle, styles.headerTitle]}>
          {ANALYSIS_PAGES[pageIndex].title}
        </Text>
        <View style={styles.headerSide} />
      </View>

      <FlatList
        ref={listRef}
        data={ANALYSIS_PAGES}
        keyExtractor={(item) => item.key}
        renderItem={renderPage}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onMomentumScrollEnd={(event) => {
          setPageIndex(clampPageIndex(Math.round(event.nativeEvent.contentOffset.x / width)));
        }}
      />

      <View style={styles.dots}>
        {ANALYSIS_PAGES.map((page, index) => (
          <View
            key={page.key}
            style={[styles.dot, index === pageIndex && styles.dotActive]}
          />
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 54,
    paddingHorizontal: space.md,
    paddingTop: space.xs,
    paddingBottom: space.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSide: {
    width: 48,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backText: {
    fontSize: 34,
    lineHeight: 34,
    fontWeight: '300',
    color: color.textPrimary,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: font.weight.heavy,
  },
  page: {
    flex: 1,
    alignItems: 'center',
  },
  pageInner: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    paddingHorizontal: space.lg,
  },
  readyWrap: {
    flex: 1,
    paddingTop: 64,
  },
  analysisContent: {
    paddingTop: space.lg,
    paddingBottom: space.xxl,
  },
  scoreHero: {
    marginTop: space.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    columnGap: space.md,
  },
  scoreValue: {
    color: color.textPrimary,
    fontSize: 76,
    lineHeight: 78,
    fontWeight: font.weight.heavy,
    letterSpacing: -4,
  },
  scoreCopy: {
    paddingBottom: 8,
  },
  scoreLabel: {
    color: color.textTertiary,
    fontSize: 11,
    fontWeight: font.weight.bold,
  },
  scoreStatus: {
    marginTop: 4,
    color: color.textPrimary,
    fontSize: 18,
    fontWeight: font.weight.heavy,
  },
  comparisonText: {
    marginTop: space.md,
    color: color.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: font.weight.medium,
  },
  activityGrid: {
    marginTop: space.xl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  activityDay: {
    width: '14%',
    aspectRatio: 1.35,
    borderWidth: 1,
    borderColor: primitive.neutral[200],
    backgroundColor: primitive.neutral[100],
  },
  activityDayActive: {
    borderColor: color.primary,
    backgroundColor: color.primary,
  },
  activityDayToday: {
    borderWidth: 2,
    borderColor: primitive.neutral[500],
  },
  legendRow: {
    marginTop: space.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendText: {
    color: color.textTertiary,
    fontSize: 10,
    fontWeight: font.weight.medium,
  },
  section: {
    marginTop: space.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.divider,
  },
  sectionTitle: {
    paddingVertical: space.md,
    color: color.textPrimary,
    fontSize: 14,
    fontWeight: font.weight.heavy,
  },
  metricLine: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.divider,
  },
  metricLabel: {
    width: 76,
    color: color.textPrimary,
    fontSize: 13,
    fontWeight: font.weight.bold,
  },
  metricValue: {
    flex: 1,
    color: color.textSecondary,
    fontSize: 12,
    fontWeight: font.weight.medium,
  },
  metricScore: {
    color: color.textPrimary,
    fontSize: 13,
    fontWeight: font.weight.heavy,
  },
  readyDetail: {
    marginTop: space.md,
    color: color.textPrimary,
    fontSize: 12,
    fontWeight: font.weight.bold,
  },
  chartWrap: {
    marginTop: space.xl,
  },
  chartLegend: {
    marginTop: space.xs,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    columnGap: space.md,
  },
  chartLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 5,
  },
  legendCurrent: {
    width: 14,
    height: 2,
    backgroundColor: color.primary,
  },
  legendPrevious: {
    width: 14,
    height: 2,
    backgroundColor: primitive.neutral[400],
  },
  sectionCompact: {
    marginTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.divider,
  },
  achievementHero: {
    marginTop: space.lg,
    minHeight: 210,
    padding: space.xl,
    borderRadius: 16,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementValue: {
    color: color.textInverse,
    fontSize: 58,
    lineHeight: 64,
    fontWeight: font.weight.heavy,
    letterSpacing: -3,
  },
  achievementLabel: {
    marginTop: 4,
    color: color.textInverse,
    fontSize: 13,
    fontWeight: font.weight.bold,
  },
  achievementCaption: {
    marginTop: space.lg,
    color: primitive.neutral[400],
    fontSize: 12,
    fontWeight: font.weight.medium,
  },
  recentSection: {
    marginTop: space.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.divider,
  },
  recentValue: {
    color: color.textPrimary,
    fontSize: 18,
    fontWeight: font.weight.heavy,
  },
  recentDelta: {
    marginTop: space.xs,
    color: color.textSecondary,
    fontSize: 12,
    fontWeight: font.weight.medium,
  },
  typeHero: {
    marginTop: space.lg,
    color: color.textPrimary,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: font.weight.heavy,
    letterSpacing: -1.6,
  },
  typeSubtitle: {
    marginTop: space.xs,
    color: color.textSecondary,
    fontSize: 14,
    fontWeight: font.weight.bold,
  },
  primaryFact: {
    marginTop: space.lg,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  primaryRange: {
    color: color.textPrimary,
    fontSize: 18,
    fontWeight: font.weight.heavy,
  },
  primaryShare: {
    color: color.textSecondary,
    fontSize: 12,
    fontWeight: font.weight.bold,
  },
  heatmap: {
    marginTop: space.xl,
    rowGap: 6,
  },
  heatmapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
  },
  heatmapLabelSpace: {
    width: 38,
  },
  heatmapDayLabel: {
    flex: 1,
    textAlign: 'center',
    color: color.textTertiary,
    fontSize: 10,
    fontWeight: font.weight.bold,
  },
  heatmapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
  },
  heatmapTimeLabel: {
    width: 38,
    color: color.textSecondary,
    fontSize: 10,
    fontWeight: font.weight.bold,
  },
  heatmapCell: {
    flex: 1,
    aspectRatio: 1.2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.divider,
  },
  interpretation: {
    marginTop: space.xl,
    rowGap: space.xs,
  },
  interpretationText: {
    color: color.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: font.weight.medium,
  },
  proportionBars: {
    marginTop: space.xl,
    rowGap: space.lg,
  },
  proportionItem: {
    rowGap: 7,
  },
  proportionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  proportionLabel: {
    color: color.textPrimary,
    fontSize: 13,
    fontWeight: font.weight.bold,
  },
  proportionPercent: {
    color: color.textPrimary,
    fontSize: 15,
    fontWeight: font.weight.heavy,
  },
  proportionTrack: {
    height: 7,
    backgroundColor: primitive.neutral[100],
  },
  proportionFill: {
    height: '100%',
    backgroundColor: primitive.neutral[950],
  },
  proportionFillMuted: {
    backgroundColor: primitive.neutral[500],
  },
  pageNumber: {
    color: primitive.neutral[200],
    fontSize: 72,
    lineHeight: 76,
    fontWeight: font.weight.heavy,
    letterSpacing: -3,
  },
  eyebrow: {
    marginTop: space.lg,
    color: color.textTertiary,
    fontSize: 11,
    fontWeight: font.weight.bold,
    letterSpacing: 1.8,
  },
  readyTitle: {
    marginTop: 10,
    color: color.textPrimary,
    fontSize: 28,
    fontWeight: font.weight.heavy,
  },
  rule: {
    width: 36,
    height: 2,
    marginTop: space.lg,
    backgroundColor: color.primary,
  },
  readyDescription: {
    maxWidth: 320,
    marginTop: space.md,
    color: color.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: font.weight.medium,
  },
  dots: {
    minHeight: 48,
    paddingBottom: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: primitive.neutral[300],
  },
  dotActive: {
    width: 9,
    height: 7,
    borderRadius: 4,
    backgroundColor: color.primary,
  },
});
