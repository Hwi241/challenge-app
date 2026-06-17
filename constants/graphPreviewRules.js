// constants/graphPreviewRules.js
// Executable visual rules for GraphPreviewIcon.
// docs/GRAPH_PREVIEW_RULE.md explains the policy;
// this file is the code-level rule source that GraphPreviewIcon will import in later steps.

// ---- Base dimensions ----
export const GRAPH_PREVIEW_VIEW_BOX = 120;
export const GRAPH_PREVIEW_DEFAULT_SIZE = 150;

// ---- Color palette ----
export const GRAPH_PREVIEW_COLORS = Object.freeze({
  primary: '#111827',
  secondary: '#6B7280',
  tertiary: '#9CA3AF',
  axis: '#D1D5DB',
  border: '#E5E7EB',
  backgroundStart: '#F9FAFB',
  backgroundEnd: '#EEF2F7',
  surface: '#F9FAFB',
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
  countMinute: '횟수/분',
  targetActual: '목표',
  prediction: '예상',
});

// ---- Frame (background card) ----
export const GRAPH_PREVIEW_FRAME = Object.freeze({
  viewBox: GRAPH_PREVIEW_VIEW_BOX,
  radius: 22,
  inset: 1,
  width: 118,
  height: 118,
  borderWidth: 1.5,
  gradientStartColor: '#F9FAFB',
  gradientEndColor: '#EEF2F7',
  borderColor: '#E5E7EB',
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
  fillColor: '#111827',
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
  baselineY: 92,
  yScale: 0.72,
  strokeWidth: 4,
  secondaryStrokeWidth: 3,
  dotRadius: 3.2,
  countDotRadius: 4.5,
});

// ---- BAR family ----
export const GRAPH_PREVIEW_BAR = Object.freeze({
  barCount: 5,
  minValue: 28,
  maxValue: 84,
  startX: 20,
  stepX: 17,
  baselineY: 92,
  yScale: 0.62,
  barWidth: 11,
  compareBarWidth: 6,
  radius: 5,
});

// ---- PIE family ----
export const GRAPH_PREVIEW_PIE = Object.freeze({
  centerX: 60,
  centerY: 58,
  radius: 34,
  donutHoleRadius: 16,
  labelFontSize: 12,
});

// ---- DISTRIBUTION family ----
export const GRAPH_PREVIEW_DISTRIBUTION = Object.freeze({
  dotCount: 13,
  heatCellCount: 20,
  heatCols: 5,
  dotRadius: 3.5,
  averageLineY: 62,
  baselineY: 92,
});

// ---- NETWORK family ----
export const GRAPH_PREVIEW_NETWORK = Object.freeze({
  linkWidth: 2.2,
  clusterLinkWidth: 2.8,
  nodeStrokeWidth: 3,
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
});

export function getGraphPreviewMetricLabel(metricType) {
 const key = String(metricType ?? '');
 return GRAPH_PREVIEW_METRIC_LABELS[key] ?? (key.slice(0, 5) || '값');
}
