// constants/graphPreviewRules.js
// Executable visual rules for GraphPreviewIcon.
// docs/GRAPH_PREVIEW_RULE.md explains the policy;
// this file is the code-level rule source that GraphPreviewIcon will import in later steps.

// ---- Base dimensions ----
export const GRAPH_PREVIEW_VIEW_BOX = 120;
export const GRAPH_PREVIEW_DEFAULT_SIZE = 150;

// ---- Color palette ----
export const GRAPH_PREVIEW_COLORS = Object.freeze({
  primary: '#0A0A0A',
  secondary: '#525252',
  tertiary: '#737373',
  axis: '#D4D4D4',
  border: '#E5E5E5',
  backgroundStart: '#FAFAFA',
  backgroundEnd: '#F5F5F5',
  surface: '#FFFFFF',
  white: '#FFFFFF',
});

// ---- Metric type labels ----
export const GRAPH_PREVIEW_METRIC_LABELS = Object.freeze({
  count: '횟수',
  minute: '분',
  duration: 'D',
  date: 'D',
  score: '점',
  percent: '%',
  relation: '관계',
  steps: '보',
  distance: 'km',
  exercise: '운동',
  calories: 'kcal',
  sleep: '수면',
  heartRate: 'bpm',
  weight: 'kg',
  bodyFat: '%',
  bmi: 'BMI',
  countMinute: '횟수/분',
  targetActual: '목표',
  prediction: '예상',
});

// ---- Frame (background card) ----
export const GRAPH_PREVIEW_FRAME = Object.freeze({
  viewBox: GRAPH_PREVIEW_VIEW_BOX,
  radius: 16,
  inset: 1,
  width: 118,
  height: 118,
  borderWidth: 1.5,
  gradientStartColor: '#FAFAFA',
  gradientEndColor: '#F5F5F5',
  borderColor: '#E5E5E5',
});

// ---- Metric tag (label badge) ----
export const GRAPH_PREVIEW_METRIC_TAG = Object.freeze({
  enabled: true,
  defaultX: 78,
  defaultY: 92,
  width: 34,
  height: 18,
  radius: 9,
  xOffset: -8,
  yOffset: -13,
  textOffsetX: 9,
  fontSize: 7,
  fontWeight: '800',
  fillColor: '#0A0A0A',
  opacity: 0.92,
  textColor: '#FFFFFF',
});

// ---- LINE family ----
export const GRAPH_PREVIEW_LINE = Object.freeze({
  pointCount: 6,
  minValue: 20,
  maxValue: 85,
  startX: 18,
  stepX: 17,
  axisStartX: 16,
  axisEndX: 104,
  axisTopY: 24,
  baselineY: 92,
  yScale: 0.72,
  axisStrokeWidth: 2,
  strokeWidth: 4,
  secondaryStrokeWidth: 3,
  dotRadius: 3.2,
  countDotRadius: 4.5,
  secondLineEvenOffset: 12,
  secondLineOddOffset: -8,
  dualDasharray: '5 4',
  forecastDasharray: '4 4',
});

// ---- BAR family ----
export const GRAPH_PREVIEW_BAR = Object.freeze({
  barCount: 5,
  minValue: 28,
  maxValue: 84,
  startX: 20,
  stepX: 17,
  axisStartX: 16,
  axisEndX: 104,
  baselineY: 92,
  yScale: 0.62,
  axisStrokeWidth: 2,
  barWidth: 11,
  barXOffset: -5,
  compareBarWidth: 6,
  comparePrimaryXOffset: -3,
  compareSecondaryXOffset: 5,
  compareRadius: 3,
  compareSecondMinHeight: 10,
  compareSecondBaseDelta: -13,
  compareSecondOddOffset: 10,
  stackedXOffset: -5,
  stackedTopRatio: 0.38,
  radius: 5,
});

// ---- PIE family ----
export const GRAPH_PREVIEW_PIE = Object.freeze({
  centerX: 60,
  centerY: 58,
  radius: 34,
  donutHoleRadius: 16,
  startAngleOffset: -90,
  sliceStrokeWidth: 2,
  sliceStrokeColorKey: 'surface',
  defaultSlices: Object.freeze([
    Object.freeze({ start: 0, end: 246, colorKey: 'primary' }),
    Object.freeze({ start: 246, end: 360, colorKey: 'axis' }),
  ]),
  segmentedSlices: Object.freeze([
    Object.freeze({ start: 0, end: 118, colorKey: 'primary' }),
    Object.freeze({ start: 118, end: 220, colorKey: 'secondary' }),
    Object.freeze({ start: 220, end: 360, colorKey: 'axis' }),
  ]),
  labelText: '%',
  labelFontSize: 12,
  labelFontWeight: '900',
  labelY: 64,
  donutLabelY: 62,
  metricTagX: 75,
  metricTagY: 99,
});

// ---- DISTRIBUTION family ----
export const GRAPH_PREVIEW_DISTRIBUTION = Object.freeze({
  dotCount: 13,
  minValue: 18,
  maxValue: 86,

  baselineX1: 18,
  baselineX2: 104,
  baselineY: 92,
  baselineStrokeWidth: 2,

  averageLineY: 62,
  averageStrokeWidth: 2,
  averageDasharray: '4 4',

  dotStartX: 20,
  dotColumns: 7,
  dotStepX: 13,
  dotBaseY: 94,
  dotYScale: 0.7,
  dotRowOffset: 7,
  dotRadius: 3.5,
  dotOpacityBase: 0.55,
  dotOpacityStep: 0.15,
  dotOpacityCycle: 3,

  heatCellCount: 20,
  heatCols: 5,
  heatStartX: 24,
  heatStartY: 28,
  heatStepX: 14,
  heatStepY: 14,
  heatCellSize: 10,
  heatRadius: 3,
  heatOpacityBase: 0.25,
  heatOpacityStep: 17,
  heatOpacityMod: 60,
  heatOpacityDivisor: 100,

  boxCenterLine: Object.freeze({ x1: 20, y1: 62, x2: 100, y2: 62 }),
  boxWhiskers: Object.freeze([
    Object.freeze({ x: 28, y1: 54, y2: 70 }),
    Object.freeze({ x: 94, y1: 54, y2: 70 }),
  ]),
  boxRect: Object.freeze({ x: 42, y: 44, width: 38, height: 36, radius: 8 }),
  boxMedianLine: Object.freeze({ x: 61, y1: 44, y2: 80 }),
  boxOutliers: Object.freeze([
    Object.freeze({ cx: 96, cy: 36, r: 4 }),
    Object.freeze({ cx: 25, cy: 83, r: 3.5 }),
  ]),
  boxLineStrokeWidth: 2,
  boxWhiskerStrokeWidth: 3,
  boxMedianStrokeWidth: 2,
});

// ---- NETWORK family ----
export const GRAPH_PREVIEW_NETWORK = Object.freeze({
  linkWidth: 2.2,
  clusterLinkWidth: 2.8,
  nodeStrokeWidth: 3,
  linkColorKey: 'tertiary',
  nodeStrokeColorKey: 'primary',
  primaryNodeFillColorKey: 'primary',
  secondaryNodeFillColorKey: 'surface',
  primaryNodeIndex: 1,
  metricTagX: 72,
  metricTagY: 101,
  defaultNodes: Object.freeze([
    Object.freeze({ x: 36, y: 38, r: 8 }),
    Object.freeze({ x: 68, y: 31, r: 9 }),
    Object.freeze({ x: 86, y: 62, r: 7 }),
    Object.freeze({ x: 47, y: 78, r: 8 }),
    Object.freeze({ x: 74, y: 85, r: 6 }),
  ]),
  clusterNodes: Object.freeze([
    Object.freeze({ x: 33, y: 35, r: 7 }),
    Object.freeze({ x: 58, y: 31, r: 9 }),
    Object.freeze({ x: 82, y: 42, r: 7 }),
    Object.freeze({ x: 40, y: 72, r: 8 }),
    Object.freeze({ x: 67, y: 76, r: 7 }),
    Object.freeze({ x: 91, y: 71, r: 6 }),
  ]),
  defaultLinks: Object.freeze([
    Object.freeze([0, 1]),
    Object.freeze([1, 2]),
    Object.freeze([1, 3]),
    Object.freeze([3, 4]),
    Object.freeze([2, 4]),
  ]),
  clusterLinks: Object.freeze([
    Object.freeze([0, 1]),
    Object.freeze([1, 2]),
    Object.freeze([1, 3]),
    Object.freeze([3, 4]),
    Object.freeze([4, 5]),
    Object.freeze([2, 5]),
    Object.freeze([0, 3]),
  ]),
});

// ---- CALENDAR official visual ----
export const GRAPH_PREVIEW_CALENDAR = Object.freeze({
 columns: 7,
 rows: 5,
 startX: 18,
 startY: 27,
 stepX: 12,
 stepY: 13,
 cellSize: 8,
 radius: 4,
 weekdayY: 19,
 weekdayFontSize: 5.5,
 weekdayFontWeight: '700',
 weekdays: Object.freeze(['S', 'M', 'T', 'W', 'T', 'F', 'S']),
 activeIndices: Object.freeze([2, 4, 8, 11, 12, 16, 20, 23, 25, 28, 31]),
 todayIndex: 17,
 todayStrokeWidth: 2,
 metricTagX: 76,
 metricTagY: 105,
});

// ---- INFO CARD official visual ----
export const GRAPH_PREVIEW_INFO_CARD = Object.freeze({
 x: 14,
 y: 22,
 width: 92,
 height: 72,
 radius: 11,
 borderWidth: 2,
 titleLine: Object.freeze({
 x: 24,
 y: 34,
 width: 34,
 height: 5,
 radius: 2.5,
 }),
 subtitleLine: Object.freeze({
 x: 24,
 y: 44,
 width: 50,
 height: 3,
 radius: 1.5,
 }),
 divider: Object.freeze({
 x1: 24,
 y1: 54,
 x2: 96,
 y2: 54,
 strokeWidth: 1.5,
 }),
 valueBox: Object.freeze({
 x: 24,
 y: 63,
 width: 43,
 height: 20,
 radius: 6,
 }),
 valueText: 'GOAL',
 valueTextX: 45.5,
 valueTextY: 76.5,
 valueFontSize: 7,
 valueFontWeight: '900',
 rewardLine: Object.freeze({
 x: 76,
 y: 68,
 width: 20,
 height: 4,
 radius: 2,
 }),
 rewardLineShort: Object.freeze({
 x: 76,
 y: 77,
 width: 13,
 height: 3,
 radius: 1.5,
 }),
 metricTagX: 76,
 metricTagY: 105,
});

// ---- HORIZONTAL PROGRESS official visual ----
export const GRAPH_PREVIEW_HORIZONTAL_PROGRESS = Object.freeze({
 trackX: 17,
 trackY: 52,
 trackWidth: 86,
 trackHeight: 17,
 radius: 8.5,
 fillRatio: 0.72,
 labelText: '72%',
 labelX: 60,
 labelY: 42,
 labelFontSize: 13,
 labelFontWeight: '900',
 captionY: 82,
 captionLineX: 30,
 captionLineWidth: 60,
 captionLineHeight: 4,
 captionLineRadius: 2,
 metricTagX: 76,
 metricTagY: 105,
});

// ---- STACKED SEGMENT official visual ----
export const GRAPH_PREVIEW_STACKED_SEGMENT = Object.freeze({
 x: 16,
 y: 48,
 width: 88,
 height: 19,
 radius: 9.5,
 segments: Object.freeze([
 Object.freeze({ ratio: 0.24, colorKey: 'primary' }),
 Object.freeze({ ratio: 0.34, colorKey: 'secondary' }),
 Object.freeze({ ratio: 0.25, colorKey: 'tertiary' }),
 Object.freeze({ ratio: 0.17, colorKey: 'axis' }),
 ]),
 legendY: 83,
 legendStartX: 26,
 legendStepX: 23,
 legendDotRadius: 3,
 metricTagX: 76,
 metricTagY: 105,
});

// ---- WEEKLY GOAL official visual ----
export const GRAPH_PREVIEW_WEEKLY_GOAL = Object.freeze({
 goalLineY: 43,
 goalLineStrokeWidth: 2,
 goalLineDasharray: '5 4',
 goalLabel: 'GOAL',
 goalLabelX: 101,
 goalLabelY: 39,
 goalLabelFontSize: 5.5,
 goalLabelFontWeight: '800',
});

// ---- CUMULATIVE BAR official visual ----
export const GRAPH_PREVIEW_CUMULATIVE_BAR = Object.freeze({
 values: Object.freeze([25, 39, 54, 70, 86]),
 opacityStart: 0.42,
 opacityStep: 0.13,
 latestStrokeWidth: 1.5,
});

// ---- GRASS GRID official visual ----
export const GRAPH_PREVIEW_GRASS = Object.freeze({
 columns: 7,
 rows: 5,
 startX: 19,
 startY: 25,
 stepX: 12,
 stepY: 13,
 cellSize: 9,
 radius: 3,
 levelColorKeys: Object.freeze([
 'border',
 'axis',
 'tertiary',
 'secondary',
 'primary',
 ]),
 todayIndex: 31,
 todayStrokeWidth: 2,
 metricTagX: 76,
 metricTagY: 105,
});

// ---- Fallback preview (for unknown families) ----
export const GRAPH_PREVIEW_FALLBACK = Object.freeze({
  polygonPoints: '28,88 48,44 68,70 92,28 102,88',
  polygonFill: 'none',
  strokeColorKey: 'primary',
  strokeWidth: 5,
  strokeLinejoin: 'round',
});

// ---- Size presets ----
export const GRAPH_PREVIEW_SIZE = Object.freeze({
  default: GRAPH_PREVIEW_DEFAULT_SIZE,
  dashboardTiny: 24,
  dashboardCompact: 42,
  dashboardDefaultMin: 68,
  dashboardDefaultMax: 88,
});

// ---- Family labels (for display) ----
export const GRAPH_PREVIEW_FAMILY_LABELS = Object.freeze({
  line: '선형',
  bar: '막대',
  pie: '원형',
  distribution: '분포',
  network: '관계망',
  calendar: '달력',
  infoCard: '정보 카드',
  progress: '진행률',
  grass: '잔디',
});

export function getGraphPreviewMetricLabel(metricType) {
 const key = String(metricType ?? '');
 return GRAPH_PREVIEW_METRIC_LABELS[key] ?? (key.slice(0, 5) || '값');
}
