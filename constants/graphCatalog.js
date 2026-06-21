// constants/graphCatalog.js
// Graph shop catalog for the graph-only shop.
// This file is intentionally separate from widgetCatalog.js.
// Actual dashboard graph catalog. Includes certification graphs and sample health graphs.

export const GRAPH_CATEGORY_KEYS = {
  ALL: 'all',
  PIE: 'pie',
  LINE: 'line',
  BAR: 'bar',
  DISTRIBUTION: 'distribution',
  NETWORK: 'network',
};

export const GRAPH_CATEGORIES = [
  { key: GRAPH_CATEGORY_KEYS.ALL, label: '전체' },
  { key: GRAPH_CATEGORY_KEYS.PIE, label: '원형' },
  { key: GRAPH_CATEGORY_KEYS.LINE, label: '선형' },
  { key: GRAPH_CATEGORY_KEYS.BAR, label: '막대' },
  { key: GRAPH_CATEGORY_KEYS.DISTRIBUTION, label: '분포도' },
  { key: GRAPH_CATEGORY_KEYS.NETWORK, label: '관계망' },
];

export const GRAPH_FILTER_OPTIONS = [
  { key: 'all', label: '전체' },
  { key: 'available', label: '구매 가능' },
  { key: 'owned', label: '보유중' },
  { key: 'insufficient', label: '별 부족' },
  { key: 'tier1', label: 'Tier 1' },
  { key: 'tier2', label: 'Tier 2' },
  { key: 'tier3', label: 'Tier 3' },
  { key: 'tier4', label: 'Tier 4' },
  { key: 'tier5', label: 'Tier 5' },
];

export const GRAPH_SORT_OPTIONS = [
  { key: 'default', label: '기본순' },
  { key: 'priceAsc', label: '낮은 가격순' },
  { key: 'priceDesc', label: '높은 가격순' },
  { key: 'tierAsc', label: 'Tier 낮은순' },
  { key: 'tierDesc', label: 'Tier 높은순' },
];

export const GRAPH_METRIC_TYPES = {
  COUNT: 'count',
  MINUTE: 'minute',
  DURATION: 'duration',
  DATE: 'date',
  SCORE: 'score',
  PERCENT: 'percent',
  RELATION: 'relation',
  STEPS: 'steps',
  DISTANCE: 'distance',
  EXERCISE: 'exercise',
};

export const GRAPH_PREVIEW_FAMILIES = {
  PIE: 'pie',
  LINE: 'line',
  BAR: 'bar',
  DISTRIBUTION: 'distribution',
  NETWORK: 'network',
};

export const GRAPH_TIER_UNLOCK_REQUIREMENT = 3;

export const GRAPH_CATALOG = [
 {
 id: 'overall_progress',
 title: '전체 진행률',
 category: GRAPH_CATEGORY_KEYS.PIE,
 tier: 0,
 price: 0,
 defaultOwned: true,
 shop: false,
 description: '전체 진행률을 원형 진행 그래프로 보여줍니다.',
 inputs: [
 { key: 'progress', label: '진행률', unit: '%' },
 { key: 'goal', label: '목표', unit: '%' },
 ],
 minSize: { w: 2, h: 2 },
 maxSize: { w: 4, h: 4 },
 recommendedSize: { w: 2, h: 4 },
 supports: ['습관', '도전'],
 metricTypes: [GRAPH_METRIC_TYPES.PERCENT],
 preview: {
 family: GRAPH_PREVIEW_FAMILIES.PIE,
 variant: 'donut',
 metricType: GRAPH_METRIC_TYPES.PERCENT,
 seed: 101,
 features: ['기본 제공', '진행률', '목표 대비'],
 },
 },
 {
 id: 'month_calendar',
 title: '달력',
 category: GRAPH_CATEGORY_KEYS.DISTRIBUTION,
 tier: 0,
 price: 0,
 defaultOwned: true,
 shop: false,
 description: '월간 인증일을 달력형 그래프로 보여줍니다.',
 inputs: [
 { key: 'date', label: '날짜', unit: '일' },
 { key: 'count', label: '인증', unit: '회' },
 ],
 minSize: { w: 4, h: 2 },
 maxSize: { w: 6, h: 6 },
 recommendedSize: { w: 4, h: 4 },
 supports: ['습관', '도전'],
 metricTypes: [GRAPH_METRIC_TYPES.COUNT, GRAPH_METRIC_TYPES.DATE],
 preview: {
 family: GRAPH_PREVIEW_FAMILIES.DISTRIBUTION,
 variant: 'heatmap',
 metricType: GRAPH_METRIC_TYPES.COUNT,
 seed: 102,
 features: ['기본 제공', '달력', '월간'],
 },
 },
 {
 id: 'goal_black_box',
 title: '도전 목표',
 category: GRAPH_CATEGORY_KEYS.PIE,
 tier: 1,
 price: 25,
 defaultOwned: false,
 shop: true,
 description: '도전 목표를 블랙박스 위젯으로 보여줍니다.',
 inputs: [
 { key: 'goal', label: '목표', unit: '점' },
 { key: 'reward', label: '보상', unit: '' },
 ],
 minSize: { w: 2, h: 1 },
 maxSize: { w: 6, h: 4 },
 recommendedSize: { w: 6, h: 2 },
 supports: ['도전'],
 metricTypes: [GRAPH_METRIC_TYPES.SCORE],
 preview: {
 family: GRAPH_PREVIEW_FAMILIES.PIE,
 variant: 'donut',
 metricType: GRAPH_METRIC_TYPES.SCORE,
 seed: 103,
 features: ['도전 전용', '목표', '25별'],
 },
 },
 {
 id: 'health_steps_weekly',
 title: '걸음 리듬',
 category: GRAPH_CATEGORY_KEYS.BAR,
 tier: 1,
 price: 25,
 defaultOwned: false,
 shop: true,
 description: '최근 7일 걸음 수를 목표선과 함께 보여줍니다. Health Connect 연동 전에는 샘플 데이터로 표시됩니다.',
 inputs: [
 { key: 'steps', label: '걸음 수', unit: '보' },
 { key: 'goal', label: '목표', unit: '보' },
 ],
 minSize: { w: 4, h: 2 },
 maxSize: { w: 6, h: 6 },
 recommendedSize: { w: 6, h: 4 },
 supports: ['습관', '도전'],
 metricTypes: [GRAPH_METRIC_TYPES.COUNT, GRAPH_METRIC_TYPES.DATE],
 preview: {
 family: GRAPH_PREVIEW_FAMILIES.BAR,
 variant: 'solidBars',
 metricType: GRAPH_METRIC_TYPES.COUNT,
 seed: 501,
 features: ['샘플 데이터', '걸음 수', '8,000보 목표'],
 },
 },
 {
 id: 'health_steps_trend',
 title: '걸음 수 추세',
 category: GRAPH_CATEGORY_KEYS.LINE,
 tier: 1,
 price: 25,
 defaultOwned: false,
 shop: true,
 description: 'Health Connect로 인증한 걸음 수의 날짜별 흐름을 선형 그래프로 보여줍니다.',
 inputs: [
 { key: 'date', label: '날짜', unit: '일' },
 { key: 'steps', label: '걸음 수', unit: '보' },
 ],
 minSize: { w: 4, h: 2 },
 maxSize: { w: 6, h: 6 },
 recommendedSize: { w: 6, h: 4 },
 supports: ['습관', '도전'],
 metricTypes: [GRAPH_METRIC_TYPES.STEPS, GRAPH_METRIC_TYPES.DATE],
 preview: {
 family: GRAPH_PREVIEW_FAMILIES.LINE,
 variant: 'smoothLine',
 metricType: GRAPH_METRIC_TYPES.STEPS,
 seed: 502,
 features: ['Health Connect', '걸음 수', '날짜별 추세'],
 },
 },
 {
 id: 'health_exercise_minutes_trend',
 title: '운동 시간 추세',
 category: GRAPH_CATEGORY_KEYS.LINE,
 tier: 1,
 price: 25,
 defaultOwned: false,
 shop: true,
 description: 'Health Connect로 인증한 운동 시간의 날짜별 흐름을 선형 그래프로 보여줍니다.',
 inputs: [
 { key: 'date', label: '날짜', unit: '일' },
 { key: 'minutes', label: '운동 시간', unit: '분' },
 ],
 minSize: { w: 4, h: 2 },
 maxSize: { w: 6, h: 6 },
 recommendedSize: { w: 6, h: 4 },
 supports: ['습관', '도전'],
 metricTypes: [GRAPH_METRIC_TYPES.EXERCISE, GRAPH_METRIC_TYPES.DATE],
 preview: {
 family: GRAPH_PREVIEW_FAMILIES.LINE,
 variant: 'smoothLine',
 metricType: GRAPH_METRIC_TYPES.EXERCISE,
 seed: 503,
 features: ['Health Connect', '운동 시간', '분 단위'],
 },
 },
 {
 id: 'health_distance_trend',
 title: '운동 거리 추세',
 category: GRAPH_CATEGORY_KEYS.LINE,
 tier: 1,
 price: 25,
 defaultOwned: false,
 shop: true,
 description: 'Health Connect로 인증한 운동 거리의 날짜별 흐름을 선형 그래프로 보여줍니다.',
 inputs: [
 { key: 'date', label: '날짜', unit: '일' },
 { key: 'distance', label: '운동 거리', unit: 'km' },
 ],
 minSize: { w: 4, h: 2 },
 maxSize: { w: 6, h: 6 },
 recommendedSize: { w: 6, h: 4 },
 supports: ['습관', '도전'],
 metricTypes: [GRAPH_METRIC_TYPES.DISTANCE, GRAPH_METRIC_TYPES.DATE],
 preview: {
 family: GRAPH_PREVIEW_FAMILIES.LINE,
 variant: 'smoothLine',
 metricType: GRAPH_METRIC_TYPES.DISTANCE,
 seed: 504,
 features: ['Health Connect', '운동 거리', 'km 추세'],
 },
 },
 {
 id: 'weekly_bar',
 title: '주간 막대',
 category: GRAPH_CATEGORY_KEYS.BAR,
 tier: 1,
 price: 80,
 defaultOwned: false,
 shop: true,
 description: '주간 인증 기록을 막대 그래프로 보여줍니다.',
 inputs: [
 { key: 'week', label: '주차', unit: '주' },
 { key: 'count', label: '인증', unit: '회' },
 ],
 minSize: { w: 4, h: 2 },
 maxSize: { w: 6, h: 6 },
 recommendedSize: { w: 6, h: 4 },
 supports: ['습관', '도전'],
 metricTypes: [GRAPH_METRIC_TYPES.COUNT, GRAPH_METRIC_TYPES.DATE],
 preview: {
 family: GRAPH_PREVIEW_FAMILIES.BAR,
 variant: 'solidBars',
 metricType: GRAPH_METRIC_TYPES.COUNT,
 seed: 201,
 features: ['주간', '막대', '인증 비교'],
 },
 },
 {
 id: 'line_count_cumulative',
 title: '누적 선형',
 category: GRAPH_CATEGORY_KEYS.LINE,
 tier: 1,
 price: 200,
 defaultOwned: false,
 shop: true,
 description: '인증 횟수의 누적 흐름을 선형 그래프로 보여줍니다.',
 inputs: [
 { key: 'date', label: '날짜', unit: '일' },
 { key: 'count', label: '누적 인증', unit: '회' },
 ],
 minSize: { w: 4, h: 2 },
 maxSize: { w: 6, h: 6 },
 recommendedSize: { w: 6, h: 4 },
 supports: ['습관', '도전'],
 metricTypes: [GRAPH_METRIC_TYPES.COUNT, GRAPH_METRIC_TYPES.DATE],
 preview: {
 family: GRAPH_PREVIEW_FAMILIES.LINE,
 variant: 'smoothLine',
 metricType: GRAPH_METRIC_TYPES.COUNT,
 seed: 301,
 features: ['누적', '선형', '흐름'],
 },
 },
 {
 id: 'line_minutes',
 title: '시간 선형',
 category: GRAPH_CATEGORY_KEYS.LINE,
 tier: 1,
 price: 500,
 defaultOwned: false,
 shop: true,
 description: '분 단위 기록의 흐름을 선형 그래프로 보여줍니다.',
 inputs: [
 { key: 'date', label: '날짜', unit: '일' },
 { key: 'minutes', label: '시간', unit: '분' },
 ],
 minSize: { w: 4, h: 2 },
 maxSize: { w: 6, h: 6 },
 recommendedSize: { w: 6, h: 4 },
 supports: ['습관', '도전'],
 metricTypes: [GRAPH_METRIC_TYPES.MINUTE, GRAPH_METRIC_TYPES.DATE],
 preview: {
 family: GRAPH_PREVIEW_FAMILIES.LINE,
 variant: 'smoothLine',
 metricType: GRAPH_METRIC_TYPES.MINUTE,
 seed: 401,
 features: ['시간', '분', '선형'],
 },
 },
 {
 id: 'grass_graph',
 title: '잔디',
 category: GRAPH_CATEGORY_KEYS.DISTRIBUTION,
 tier: 1,
 price: 500,
 defaultOwned: false,
 shop: true,
 description: '기간별 인증 밀도를 잔디 그래프로 보여줍니다.',
 inputs: [
 { key: 'date', label: '날짜', unit: '일' },
 { key: 'count', label: '인증', unit: '회' },
 ],
 minSize: { w: 4, h: 2 },
 maxSize: { w: 6, h: 6 },
 recommendedSize: { w: 6, h: 4 },
 supports: ['습관', '도전'],
 metricTypes: [GRAPH_METRIC_TYPES.COUNT, GRAPH_METRIC_TYPES.DATE],
 preview: {
 family: GRAPH_PREVIEW_FAMILIES.DISTRIBUTION,
 variant: 'heatmap',
 metricType: GRAPH_METRIC_TYPES.COUNT,
 seed: 402,
 features: ['잔디', '밀도', '연속 기록'],
 },
 },
];

export function getGraphById(id) {
  return GRAPH_CATALOG.find((graph) => graph.id === id) || null;
}

export function getGraphsByCategory(categoryKey) {
  if (!categoryKey || categoryKey === GRAPH_CATEGORY_KEYS.ALL) {
    return GRAPH_CATALOG;
  }
  return GRAPH_CATALOG.filter((graph) => graph.category === categoryKey);
}

export function getGraphsByTier(tier) {
  return GRAPH_CATALOG.filter((graph) => Number(graph.tier) === Number(tier));
}

export function getGraphTierLabel(tier) {
  return `Tier ${Number(tier) || 1}`;
}

export function getGraphInputSummary(graph) {
  return (graph?.inputs || [])
    .map((input) => `${input.label}${input.unit ? `(${input.unit})` : ''}`)
    .join(', ');
}

export function getGraphSizeSummary(graph) {
  if (!graph) return '';
  const min = graph.minSize ? `최소 ${graph.minSize.w}x${graph.minSize.h}` : '';
  const max = graph.maxSize ? `최대 ${graph.maxSize.w}x${graph.maxSize.h}` : '';
  const recommended = graph.recommendedSize ? `추천 ${graph.recommendedSize.w}x${graph.recommendedSize.h}` : '';
  return [min, max, recommended].filter(Boolean).join(' / ');
}

export function getGraphSearchText(graph) {
  if (!graph) return '';
  const inputText = (graph.inputs || [])
    .flatMap((input) => [input.key, input.label, input.unit, input.description])
    .filter(Boolean)
    .join(' ');
  const previewText = [
    graph.preview?.family,
    graph.preview?.variant,
    graph.preview?.metricType,
    ...(graph.preview?.features || []),
  ].filter(Boolean).join(' ');
  return [
    graph.id, graph.title, graph.description, graph.category,
    getGraphTierLabel(graph.tier), String(graph.price),
    inputText, getGraphSizeSummary(graph),
    (graph.supports || []).join(' '),
    (graph.metricTypes || []).join(' '),
    previewText,
  ].filter(Boolean).join(' ').toLowerCase();
}

export function searchGraphs(graphs, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return graphs;
  return (graphs || []).filter((graph) => getGraphSearchText(graph).includes(q));
}

export function sortGraphs(graphs, sortKey = 'default') {
  const list = [...(graphs || [])];
  switch (sortKey) {
    case 'priceAsc':
      return list.sort((a, b) => a.price - b.price || a.tier - b.tier);
    case 'priceDesc':
      return list.sort((a, b) => b.price - a.price || a.tier - b.tier);
    case 'tierAsc':
      return list.sort((a, b) => a.tier - b.tier || a.price - b.price);
    case 'tierDesc':
      return list.sort((a, b) => b.tier - a.tier || a.price - b.price);
    default:
      return list;
  }
}
