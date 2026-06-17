// OFFICIAL_GRAPH_PREVIEW_RULE: docs/GRAPH_PREVIEW_RULE.md
// DashboardWidgetPreview is a temporary/legacy bridge.
// Final direction: wrap GraphPreviewIcon and use graphCatalog.preview metadata.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import GraphPreviewIcon from '../GraphPreviewIcon';
import { GRAPH_PREVIEW_FAMILIES, GRAPH_METRIC_TYPES } from '../../constants/graphCatalog';

/**
 * Dashboard widget preview — pure graph visual
 *
 * previewFamily 규칙:
 * - kpi: 숫자/요약   - progress: 진행률 링   - goal: 목표 박스
 * - calendar: 달력   - bar: 막대            - line: 선형
 * - heatmap: 잔디    - donut: 비율          - profile: 프로필
 * - battery: 목표    - connect: 연결 상태    - memo: 메모
 * - board: 복합 보드  - theme: 테마          - pulse: 리듬/펄스
 * - placeholder: 준비중
 *
 * bar / line / donut / heatmap:
 *   → GraphPreviewIcon에 위임 (공식 기준)
 *
 * 그 외 family:
 *   → 기존 DashboardWidgetPreview 자체 렌더링 유지
 */

export const PREVIEW_FAMILY_RULES = {
  kpi: { label: '숫자', maxWidth: 132, maxHeight: 78 },
  progress: { label: '진행', maxWidth: 118, maxHeight: 92 },
  goal: { label: '목표', maxWidth: 214, maxHeight: 92 },
  calendar: { label: '달력', maxWidth: 212, maxHeight: 124 },
  bar: { label: '막대', maxWidth: 216, maxHeight: 112 },
  line: { label: '선형', maxWidth: 224, maxHeight: 108 },
  heatmap: { label: '격자', maxWidth: 218, maxHeight: 124 },
  donut: { label: '비율', maxWidth: 126, maxHeight: 94 },
  profile: { label: '프로필', maxWidth: 152, maxHeight: 92 },
  battery: { label: '목표', maxWidth: 214, maxHeight: 82 },
  connect: { label: '상태', maxWidth: 200, maxHeight: 92 },
  memo: { label: '메모', maxWidth: 200, maxHeight: 90 },
  board: { label: '보드', maxWidth: 212, maxHeight: 112 },
  theme: { label: '테마', maxWidth: 172, maxHeight: 92 },
  pulse: { label: '리듬', maxWidth: 200, maxHeight: 92 },
  placeholder: { label: '예정', maxWidth: 150, maxHeight: 74 },
};

const KIND_TO_FAMILY = {
  progress: 'progress',
  goal: 'goal',
  calendar: 'calendar',
  weeklyBar: 'bar',
  lineCount: 'line',
  lineMinutes: 'line',
  grass: 'heatmap',
  recordRoomChart: 'board',
  recordRoomKpi: 'kpi',
  recordRoom: 'board',
  recordRoomList: 'board',
  placeholder: 'placeholder',
  theme: 'theme',
};

/**
 * Dashboard preview family → GraphPreviewIcon graph family 매핑.
 */
const GRAPH_PREVIEW_FAMILY_TO_ICON = {
  line: GRAPH_PREVIEW_FAMILIES.LINE,
  bar: GRAPH_PREVIEW_FAMILIES.BAR,
  donut: GRAPH_PREVIEW_FAMILIES.PIE,
  heatmap: GRAPH_PREVIEW_FAMILIES.DISTRIBUTION,
};

const LEGACY_FAMILIES = new Set([
  'kpi', 'progress', 'goal', 'calendar',
  'profile', 'battery', 'connect', 'memo',
  'board', 'theme', 'pulse', 'placeholder',
]);

/**
 * previewFamily + widgetId/kind/title로 GraphPreviewIcon용 preview 객체를 만든다.
 */
const inferGraphMetricType = ({ widgetId, title, family }) => {
  const id = String(widgetId || '').toLowerCase();
  const t = String(title || '').toLowerCase();

  if (family === 'donut') return GRAPH_METRIC_TYPES.PERCENT;
  if (family === 'heatmap') return GRAPH_METRIC_TYPES.COUNT;
  if (id.includes('minute') || t.includes('시간') || t.includes('분')) return GRAPH_METRIC_TYPES.MINUTE;
  if (id.includes('score') || t.includes('점수')) return GRAPH_METRIC_TYPES.SCORE;
  if (id.includes('duration') || t.includes('기간')) return GRAPH_METRIC_TYPES.DURATION;
  if (id.includes('ratio') || t.includes('비율') || t.includes('퍼센트')) return GRAPH_METRIC_TYPES.PERCENT;
  return GRAPH_METRIC_TYPES.COUNT;
};

const inferGraphVariant = ({ widgetId, family }) => {
  const id = String(widgetId || '').toLowerCase();

  if (family === 'bar') return id.includes('monthly') ? 'solidBars' : 'solidBars';
  if (family === 'line') return id.includes('cumulative') ? 'smoothLine' : 'dotLine';
  if (family === 'donut') return 'donut';
  if (family === 'heatmap') return 'heatmap';
  return 'basic';
};

const makeGraphPreviewSeed = ({ widgetId, kind, previewFamily, title }) => {
  const raw = `${widgetId || ''}:${kind || ''}:${previewFamily || ''}:${title || ''}` || 'dashboard-preview';
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) % 9973;
  }
  return hash || 1;
};

const buildGraphPreviewFromDashboardPreview = ({ family, widgetId, kind, title, previewFamily }) => {
  const graphFamily = GRAPH_PREVIEW_FAMILY_TO_ICON[family];
  if (!graphFamily) return null;

  return {
    family: graphFamily,
    variant: inferGraphVariant({ widgetId, family }),
    metricType: inferGraphMetricType({ widgetId, title, family }),
    seed: makeGraphPreviewSeed({ widgetId, kind, previewFamily, title }),
  };
};

const BLACK = '#111111';
const GREY_1 = '#F3F4F6';
const GREY_2 = '#E5E7EB';
const GREY_3 = '#D1D5DB';
const GREY_4 = '#9CA3AF';

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || min));

export const resolveWidgetPreviewFamily = ({ previewFamily, widgetId, kind, title, placeholder }) => {
  if (previewFamily && PREVIEW_FAMILY_RULES[previewFamily]) return previewFamily;

  if (KIND_TO_FAMILY[kind]) return KIND_TO_FAMILY[kind];

  const id = String(widgetId || '').toLowerCase();
  const k = String(kind || '').toLowerCase();
  const t = String(title || '').toLowerCase();

  if (KIND_TO_FAMILY[k]) return KIND_TO_FAMILY[k];

  if (id.includes('weekly') || id.includes('monthly') || t.includes('막대') || t.includes('월간')) return 'bar';
  if (id.includes('line') || t.includes('선형') || t.includes('곡선') || t.includes('추이')) return 'line';
  if (id.includes('grass') || id.includes('heat') || t.includes('잔디') || t.includes('열감') || t.includes('패턴')) return 'heatmap';
  if (id.includes('calendar') || t.includes('달력')) return 'calendar';
  if (id.includes('donut') || id.includes('balance') || t.includes('비율') || t.includes('균형')) return 'donut';
  if (id.includes('goal') || t.includes('목표')) return 'goal';
  if (id.includes('meter') || id.includes('velocity') || id.includes('progress') || t.includes('미터') || t.includes('속도')) return 'progress';
  if (id.includes('counter') || id.includes('count') || id.includes('stars') || t.includes('카운터')) return 'kpi';
  if (id.includes('profile')) return 'profile';
  if (id.includes('battery')) return 'battery';
  if (id.includes('connect')) return 'connect';
  if (id.includes('memo')) return 'memo';
  if (id.includes('theme')) return 'theme';
  if (id.includes('pulse')) return 'pulse';
  if (id.includes('summary') || id.includes('panel') || id.includes('board') || id.includes('list')) return 'board';

  return placeholder ? 'placeholder' : 'board';
};

const isMonthlyBar = (widgetId) => String(widgetId || '').toLowerCase().includes('monthly');

const BarVisual = ({ compact, monthly }) => {
  const values = monthly
    ? [0.38, 0.58, 0.46, 0.78, 0.52, 0.68]
    : [0.32, 0.72, 0.48, 0.88, 0.58, 0.76, 0.42];

  return (
    <View style={[styles.barWrap, compact && styles.barWrapCompact]}>
      {values.map((value, index) => (
        <View key={`bar-${index}`} style={styles.barItem}>
          <View style={[styles.barTrack, compact && styles.barTrackCompact]}>
            <View style={[styles.barFill, { height: `${Math.max(14, value * 100)}%` }]} />
          </View>
          {!compact && <View style={styles.barDot} />}
        </View>
      ))}
    </View>
  );
};

const LineVisual = ({ compact }) => {
  const width = compact ? 124 : 198;
  const height = compact ? 52 : 88;
  const pathD = compact
    ? 'M7 41 L28 32 L50 36 L74 20 L96 26 L117 12'
    : 'M8 70 L42 54 L76 60 L111 31 L150 41 L190 15';
  const dots = compact
    ? [[7, 41], [28, 32], [50, 36], [74, 20], [96, 26], [117, 12]]
    : [[8, 70], [42, 54], [76, 60], [111, 31], [150, 41], [190, 15]];

  return (
    <View style={styles.svgWrap}>
      <Svg width="100%" height={compact ? 58 : 96} viewBox={`0 0 ${width} ${height}`}>
        <Path d={`${pathD} L${width - 7} ${height - 9} L7 ${height - 9} Z`} fill={GREY_1} />
        <Path d={pathD} fill="none" stroke={BLACK} strokeWidth={compact ? 2 : 2.4} strokeLinecap="round" strokeLinejoin="round" />
        {dots.map(([cx, cy], index) => (
          <Circle key={`line-dot-${index}`} cx={cx} cy={cy} r={compact ? 2.2 : 2.8} fill={BLACK} />
        ))}
        <Path d={`M7 ${height - 8.5} L${width - 7} ${height - 8.5}`} stroke={GREY_3} strokeWidth={1} />
      </Svg>
    </View>
  );
};

const CalendarVisual = ({ compact }) => {
  const cells = compact ? 21 : 35;
  const active = new Set([2, 4, 8, 11, 12, 16, 20, 23, 25, 28, 31]);

  return (
    <View style={[styles.calendarWrap, compact && styles.calendarWrapCompact]}>
      {Array.from({ length: cells }).map((_, index) => (
        <View
          key={`cal-${index}`}
          style={[
            styles.calendarCell,
            compact && styles.calendarCellCompact,
            active.has(index) && styles.calendarCellActive,
            index === 17 && styles.calendarCellToday,
          ]}
        />
      ))}
    </View>
  );
};

const HeatmapVisual = ({ compact }) => {
  const rows = [
    [0.16, 0.28, 0.54, 0.18, 0.76, 0.38, 0.22],
    [0.34, 0.86, 0.24, 0.48, 0.30, 0.66, 0.42],
    [0.18, 0.44, 0.78, 0.34, 0.56, 0.24, 0.64],
    [0.26, 0.16, 0.46, 0.70, 0.32, 0.54, 0.28],
  ];
  const visibleRows = compact ? rows.slice(0, 3) : rows;

  return (
    <View style={styles.heatmapWrap}>
      {visibleRows.map((row, rowIndex) => (
        <View key={`hm-row-${rowIndex}`} style={styles.heatmapRow}>
          {row.map((opacity, colIndex) => (
            <View
              key={`hm-${rowIndex}-${colIndex}`}
              style={[
                styles.heatmapCell,
                compact && styles.heatmapCellCompact,
                { backgroundColor: `rgba(17,17,17,${opacity})` },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

const DonutVisual = ({ compact }) => {
  const size = compact ? 48 : 72;
  const stroke = compact ? 8 : 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * 0.64;

  return (
    <View style={styles.center}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={GREY_2} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={BLACK}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
        <Circle cx={size / 2} cy={size / 2} r={Math.max(3, r - stroke * 1.06)} fill={BLACK} />
      </Svg>
      {!compact && <Text style={styles.donutText}>64%</Text>}
    </View>
  );
};

const ProgressVisual = ({ compact }) => {
  const size = compact ? 48 : 72;
  const stroke = compact ? 8 : 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * 0.72;

  return (
    <View style={styles.center}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={GREY_2} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={BLACK}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.progressLayer}>
        <Text style={[styles.progressText, compact && styles.progressTextCompact]}>72</Text>
      </View>
    </View>
  );
};

const GoalVisual = ({ compact }) => (
  <View style={[styles.goalBox, compact && styles.goalBoxCompact]}>
    <View style={styles.goalLineMain} />
    {!compact && <View style={styles.goalLineSub} />}
    <View style={styles.goalTrack}>
      <View style={styles.goalFill} />
    </View>
  </View>
);

const KpiVisual = ({ compact }) => (
  <View style={styles.kpiWrap}>
    <Text style={[styles.kpiNumber, compact && styles.kpiNumberCompact]}>24</Text>
    <View style={styles.kpiLine} />
  </View>
);

const ProfileVisual = ({ compact }) => (
  <View style={styles.profileWrap}>
    <View style={[styles.avatar, compact && styles.avatarCompact]}>
      <View style={styles.avatarHead} />
      <View style={styles.avatarBody} />
    </View>
    {!compact && (
      <View style={styles.profileTextWrap}>
        <View style={styles.profileLineStrong} />
        <View style={styles.profileLine} />
      </View>
    )}
  </View>
);

const BatteryVisual = ({ compact }) => (
  <View style={styles.batteryWrap}>
    <View style={[styles.batteryTrack, compact && styles.batteryTrackCompact]}>
      <View style={styles.batteryFill} />
    </View>
    {!compact && <View style={styles.batteryTextLine} />}
  </View>
);

const ConnectVisual = ({ compact }) => (
  <View style={[styles.connectWrap, compact && styles.connectWrapCompact]}>
    {[0, 1, 2].map((item) => (
      <View key={`connect-${item}`} style={styles.connectRow}>
        <View style={styles.connectDot} />
        <View style={styles.connectLine} />
      </View>
    ))}
  </View>
);

const MemoVisual = ({ compact }) => (
  <View style={[styles.memoWrap, compact && styles.memoWrapCompact]}>
    <View style={styles.memoLineStrong} />
    <View style={styles.memoLine} />
    {!compact && <View style={styles.memoLineShort} />}
  </View>
);

const BoardVisual = ({ compact }) => (
  <View style={[styles.boardWrap, compact && styles.boardWrapCompact]}>
    <View style={styles.boardTopRow}>
      <View style={styles.boardBlockDark} />
      <View style={styles.boardBlockLight} />
    </View>
    <View style={styles.boardLine} />
    <View style={styles.boardLineShort} />
  </View>
);

const ThemeVisual = ({ compact }) => (
  <View style={[styles.themeWrap, compact && styles.themeWrapCompact]}>
    <View style={styles.themeDark} />
    <View style={styles.themeMid} />
    <View style={styles.themeLight} />
  </View>
);

const PulseVisual = ({ compact }) => {
  const width = compact ? 124 : 184;
  const height = compact ? 48 : 74;
  const mid = height / 2;

  return (
    <View style={styles.svgWrap}>
      <Svg width="100%" height={compact ? 52 : 82} viewBox={`0 0 ${width} ${height}`}>
        <Path
          d={`M7 ${mid} L28 ${mid} L38 ${mid - 18} L50 ${mid + 16} L64 ${mid - 8} L80 ${mid} L${width - 7} ${mid}`}
          stroke={BLACK}
          strokeWidth={compact ? 2 : 2.4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path d={`M7 ${mid + 18} L${width - 7} ${mid + 18}`} stroke={GREY_3} strokeWidth={1} />
      </Svg>
    </View>
  );
};

const PlaceholderVisual = ({ compact }) => (
  <View style={styles.placeholderWrap}>
    <View style={[styles.placeholderBox, compact && styles.placeholderBoxCompact]}>
      <Text style={styles.placeholderPlus}>+</Text>
    </View>
    {!compact && <View style={styles.placeholderLine} />}
  </View>
);

/**
 * 렌더링 분기:
 * - bar / line / donut / heatmap → default export에서 GraphPreviewIcon으로 위임
 * - 그 외 (kpi / progress / goal / calendar / profile / battery / connect / memo / board / theme / pulse / placeholder) → 기존 전용 컴포넌트
 */
const renderVisual = ({ family, compact, widgetId }) => {
  if (family === 'kpi') return <KpiVisual compact={compact} />;
  if (family === 'progress') return <ProgressVisual compact={compact} />;
  if (family === 'goal') return <GoalVisual compact={compact} />;
  if (family === 'calendar') return <CalendarVisual compact={compact} />;
  if (family === 'profile') return <ProfileVisual compact={compact} />;
  if (family === 'battery') return <BatteryVisual compact={compact} />;
  if (family === 'connect') return <ConnectVisual compact={compact} />;
  if (family === 'memo') return <MemoVisual compact={compact} />;
  if (family === 'board') return <BoardVisual compact={compact} />;
  if (family === 'theme') return <ThemeVisual compact={compact} />;
  if (family === 'pulse') return <PulseVisual compact={compact} />;
  return <PlaceholderVisual compact={compact} />;
};

export default function DashboardWidgetPreview({
  widgetId,
  kind,
  title,
  previewFamily,
  placeholder = false,
  w = 1,
  h = 1,
  isResizeActive = false,
}) {
  const safeW = clamp(w, 1, 6);
  const safeH = clamp(h, 1, 12);
  const family = resolveWidgetPreviewFamily({ previewFamily, widgetId, kind, title, placeholder });
  const rule = PREVIEW_FAMILY_RULES[family] || PREVIEW_FAMILY_RULES.placeholder;
  const compact = safeW <= 2 || safeH <= 2;
  const tiny = safeH <= 1;
  const graphPreview = buildGraphPreviewFromDashboardPreview({
    family,
    widgetId,
    kind,
    title,
    previewFamily,
  });
  const graphPreviewSize = tiny ? 24 : compact ? 42 : Math.min(88, Math.max(68, rule.maxHeight || 82));
  const isDelegated = !!graphPreview;
  const visual = graphPreview ? (
    <GraphPreviewIcon
      preview={graphPreview}
      size={graphPreviewSize}
      muted={isResizeActive}
    />
  ) : (
    renderVisual({ family, compact, widgetId })
  );

  return (
    <View
      pointerEvents="none"
      style={[
        styles.root,
        compact && styles.rootCompact,
        tiny && styles.rootTiny,
        isResizeActive && styles.rootResizeActive,
      ]}
    >
      <View
        style={[
          styles.cap,
          isDelegated && styles.delegatedCap,
          isDelegated && tiny && styles.delegatedCapTiny,
          !isDelegated && {
            maxWidth: rule.maxWidth,
            maxHeight: tiny ? Math.min(rule.maxHeight, 30) : compact ? Math.min(rule.maxHeight, 58) : rule.maxHeight,
          },
        ]}
      >
        {visual}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    zIndex: 2,
    elevation: 1,
    flex: 1,
    width: '100%',
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  rootCompact: {
    paddingTop: 2,
    paddingHorizontal: 2,
  },
  rootTiny: {
    paddingTop: 0,
    paddingHorizontal: 0,
    transform: [{ scale: 0.86 }],
  },
  rootResizeActive: {
    opacity: 0.62,
  },
  cap: {
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  delegatedCap: {
    maxWidth: '100%',
    maxHeight: '100%',
    overflow: 'hidden',
  },
  delegatedCapTiny: {
    width: 30,
    height: 28,
    maxWidth: 30,
    maxHeight: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  barWrap: {
    width: '100%',
    height: 88,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    columnGap: 8,
    paddingHorizontal: 4,
  },
  barWrapCompact: {
    height: 34,
    columnGap: 4,
    paddingHorizontal: 0,
  },
  barItem: {
    flex: 1,
    maxWidth: 18,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barTrack: {
    width: 11,
    height: 68,
    borderRadius: 6,
    backgroundColor: GREY_2,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barTrackCompact: {
    width: 6,
    height: 28,
    borderRadius: 3,
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
    backgroundColor: BLACK,
  },
  barDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: GREY_3,
    marginTop: 6,
  },

  calendarWrap: {
    width: '100%',
    maxWidth: 190,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 5,
    alignSelf: 'center',
  },
  calendarWrapCompact: {
    maxWidth: 64,
    gap: 2,
  },
  calendarCell: {
    width: 20,
    height: 15,
    borderRadius: 4,
    backgroundColor: GREY_2,
  },
  calendarCellCompact: {
    width: 6,
    height: 5,
    borderRadius: 2,
  },
  calendarCellActive: {
    backgroundColor: BLACK,
  },
  calendarCellToday: {
    borderWidth: 1,
    borderColor: BLACK,
    backgroundColor: '#FFFFFF',
  },

  heatmapWrap: {
    width: '100%',
    maxWidth: 190,
    rowGap: 5,
    alignSelf: 'center',
  },
  heatmapRow: {
    flexDirection: 'row',
    columnGap: 5,
    justifyContent: 'center',
  },
  heatmapCell: {
    width: 18,
    height: 14,
    borderRadius: 4,
  },
  heatmapCellCompact: {
    width: 6,
    height: 5,
    borderRadius: 2,
  },

  donutText: {
    position: 'absolute',
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    includeFontPadding: false,
  },
  progressLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    color: BLACK,
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '900',
    includeFontPadding: false,
  },
  progressTextCompact: {
    fontSize: 8,
    lineHeight: 9,
  },

  goalBox: {
    width: '100%',
    maxWidth: 190,
    borderRadius: 14,
    backgroundColor: BLACK,
    padding: 14,
    alignSelf: 'center',
  },
  goalBoxCompact: {
    maxWidth: 68,
    borderRadius: 8,
    padding: 7,
  },
  goalLineMain: {
    width: '74%',
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  goalLineSub: {
    width: '48%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    opacity: 0.42,
    marginTop: 8,
  },
  goalTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginTop: 11,
    overflow: 'hidden',
  },
  goalFill: {
    width: '64%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },

  kpiWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiNumber: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '900',
    color: BLACK,
    includeFontPadding: false,
  },
  kpiNumberCompact: {
    fontSize: 18,
    lineHeight: 20,
  },
  kpiLine: {
    width: 50,
    height: 6,
    borderRadius: 3,
    backgroundColor: GREY_2,
    marginTop: 6,
  },

  profileWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: GREY_1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCompact: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  avatarHead: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: BLACK,
  },
  avatarBody: {
    width: 28,
    height: 12,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: BLACK,
    marginTop: 4,
  },
  profileTextWrap: {
    marginTop: 9,
    alignItems: 'center',
    rowGap: 5,
  },
  profileLineStrong: {
    width: 58,
    height: 6,
    borderRadius: 3,
    backgroundColor: BLACK,
  },
  profileLine: {
    width: 78,
    height: 5,
    borderRadius: 3,
    backgroundColor: GREY_2,
  },

  batteryWrap: {
    width: '100%',
    maxWidth: 190,
    alignSelf: 'center',
    alignItems: 'center',
  },
  batteryTrack: {
    width: '100%',
    height: 16,
    borderRadius: 8,
    backgroundColor: GREY_2,
    overflow: 'hidden',
  },
  batteryTrackCompact: {
    height: 8,
    borderRadius: 4,
  },
  batteryFill: {
    width: '72%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: BLACK,
  },
  batteryTextLine: {
    width: '42%',
    height: 6,
    borderRadius: 3,
    backgroundColor: GREY_2,
    marginTop: 9,
  },

  connectWrap: {
    width: '100%',
    maxWidth: 180,
    alignSelf: 'center',
    rowGap: 8,
  },
  connectWrapCompact: {
    rowGap: 3,
  },
  connectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  connectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BLACK,
  },
  connectLine: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: GREY_2,
  },

  memoWrap: {
    width: '100%',
    maxWidth: 180,
    alignSelf: 'center',
    rowGap: 8,
  },
  memoWrapCompact: {
    rowGap: 3,
  },
  memoLineStrong: {
    width: '82%',
    height: 7,
    borderRadius: 4,
    backgroundColor: BLACK,
  },
  memoLine: {
    width: '100%',
    height: 7,
    borderRadius: 4,
    backgroundColor: GREY_2,
  },
  memoLineShort: {
    width: '58%',
    height: 7,
    borderRadius: 4,
    backgroundColor: GREY_1,
  },

  boardWrap: {
    width: '100%',
    maxWidth: 190,
    alignSelf: 'center',
  },
  boardWrapCompact: {
    maxWidth: 70,
  },
  boardTopRow: {
    flexDirection: 'row',
    columnGap: 8,
    marginBottom: 9,
  },
  boardBlockDark: {
    flex: 1,
    height: 32,
    borderRadius: 9,
    backgroundColor: BLACK,
  },
  boardBlockLight: {
    flex: 1,
    height: 32,
    borderRadius: 9,
    backgroundColor: GREY_2,
  },
  boardLine: {
    width: '100%',
    height: 7,
    borderRadius: 4,
    backgroundColor: GREY_2,
    marginBottom: 7,
  },
  boardLineShort: {
    width: '68%',
    height: 7,
    borderRadius: 4,
    backgroundColor: GREY_1,
  },

  themeWrap: {
    width: 110,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeWrapCompact: {
    width: 62,
    height: 34,
  },
  themeDark: {
    position: 'absolute',
    left: 8,
    top: 8,
    width: 54,
    height: 42,
    borderRadius: 10,
    backgroundColor: BLACK,
  },
  themeMid: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 54,
    height: 42,
    borderRadius: 10,
    backgroundColor: GREY_2,
  },
  themeLight: {
    width: 54,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BLACK,
    backgroundColor: '#FFFFFF',
    zIndex: 2,
  },

  placeholderWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: GREY_3,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GREY_1,
  },
  placeholderBoxCompact: {
    width: 30,
    height: 30,
    borderRadius: 10,
  },
  placeholderPlus: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '800',
    color: GREY_4,
    includeFontPadding: false,
  },
  placeholderLine: {
    width: 58,
    height: 6,
    borderRadius: 3,
    backgroundColor: GREY_2,
    marginTop: 8,
  },
});
