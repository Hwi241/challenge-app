// constants/graphCatalog.js
// Graph shop catalog for the graph-only shop.
// This file is intentionally separate from widgetCatalog.js.

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
  /* ===== Tier 1 ===== */
  {
    id: 'line_count_basic',
    title: '횟수 선형 그래프',
    category: GRAPH_CATEGORY_KEYS.LINE,
    tier: 1,
    price: 25,
    description: '일별 기록 횟수의 흐름을 선으로 보여줍니다.',
    inputs: [
      { key: 'count', label: '횟수', unit: '회' },
      { key: 'date', label: '날짜', unit: '일' },
    ],
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 4 },
    recommendedSize: { w: 4, h: 2 },
    supports: ['습관', '도전', '일별 기록'],
    metricTypes: [GRAPH_METRIC_TYPES.COUNT, GRAPH_METRIC_TYPES.DATE],
    preview: { family: GRAPH_PREVIEW_FAMILIES.LINE, variant: 'dotLine', metricType: GRAPH_METRIC_TYPES.COUNT, seed: 101, features: ['점 강조', '횟수 라벨', '상승 흐름'] },
  },
  {
    id: 'line_minutes_basic',
    title: '분 선형 그래프',
    category: GRAPH_CATEGORY_KEYS.LINE,
    tier: 1,
    price: 25,
    description: '운동, 공부처럼 분 단위 기록의 흐름을 보여줍니다.',
    inputs: [
      { key: 'minutes', label: '분', unit: '분' },
      { key: 'date', label: '날짜', unit: '일' },
    ],
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 4 },
    recommendedSize: { w: 4, h: 2 },
    supports: ['습관', '시간형 기록', '일별 기록'],
    metricTypes: [GRAPH_METRIC_TYPES.MINUTE, GRAPH_METRIC_TYPES.DATE],
    preview: { family: GRAPH_PREVIEW_FAMILIES.LINE, variant: 'smoothLine', metricType: GRAPH_METRIC_TYPES.MINUTE, seed: 102, features: ['완만한 선', 'min 라벨', '시간 흐름'] },
  },
  {
    id: 'bar_count_basic',
    title: '횟수 막대 그래프',
    category: GRAPH_CATEGORY_KEYS.BAR,
    tier: 1,
    price: 30,
    description: '날짜별 기록 횟수를 막대 높이로 비교합니다.',
    inputs: [
      { key: 'count', label: '횟수', unit: '회', description: '날짜별 기록 횟수' },
      { key: 'date', label: '날짜', unit: '일', description: '비교할 날짜' },
    ],
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 4 },
    recommendedSize: { w: 4, h: 3 },
    supports: ['습관', '도전', '일별 비교'],
    metricTypes: [GRAPH_METRIC_TYPES.COUNT, GRAPH_METRIC_TYPES.DATE],
    preview: { family: GRAPH_PREVIEW_FAMILIES.BAR, variant: 'solidBars', metricType: GRAPH_METRIC_TYPES.COUNT, seed: 103, features: ['굵은 막대', '횟수 비교', '일별 차이'] },
  },
  {
    id: 'pie_daily_ratio',
    title: '일일 비율 원형 그래프',
    category: GRAPH_CATEGORY_KEYS.PIE,
    tier: 1,
    price: 30,
    description: '습관과 도전의 비율을 원형으로 보여줍니다.',
    inputs: [
      { key: 'category', label: '카테고리', unit: '' },
      { key: 'count', label: '횟수', unit: '회' },
    ],
    minSize: { w: 2, h: 2 },
    maxSize: { w: 4, h: 4 },
    recommendedSize: { w: 2, h: 2 },
    supports: ['습관', '도전'],
    metricTypes: [GRAPH_METRIC_TYPES.COUNT, GRAPH_METRIC_TYPES.PERCENT],
    preview: { family: GRAPH_PREVIEW_FAMILIES.PIE, variant: 'basic', metricType: GRAPH_METRIC_TYPES.COUNT, seed: 104, features: ['색상 구분', '퍼센트 라벨'] },
  },

  /* ===== Tier 2 ===== */
  {
    id: 'line_score_trend',
    title: '점수 추세 선형 그래프',
    category: GRAPH_CATEGORY_KEYS.LINE,
    tier: 2,
    price: 80,
    description: '도전 점수의 증가 추세와 목표 대비 진행률을 보여줍니다.',
    inputs: [
      { key: 'score', label: '점수', unit: '점' },
      { key: 'goal', label: '목표', unit: '점' },
      { key: 'date', label: '날짜', unit: '일' },
    ],
    minSize: { w: 3, h: 2 },
    maxSize: { w: 6, h: 4 },
    recommendedSize: { w: 6, h: 3 },
    supports: ['도전'],
    metricTypes: [GRAPH_METRIC_TYPES.SCORE, GRAPH_METRIC_TYPES.DATE],
    preview: { family: GRAPH_PREVIEW_FAMILIES.LINE, variant: 'goalLine', metricType: GRAPH_METRIC_TYPES.SCORE, seed: 201, features: ['목표선', '진행률%', '2축'] },
  },
  {
    id: 'bar_weekly_summary',
    title: '주간 요약 막대 그래프',
    category: GRAPH_CATEGORY_KEYS.BAR,
    tier: 2,
    price: 80,
    description: '주차별 기록 현황을 종합하여 막대로 보여줍니다.',
    inputs: [
      { key: 'week', label: '주차', unit: '주' },
      { key: 'count', label: '횟수', unit: '회' },
    ],
    minSize: { w: 3, h: 2 },
    maxSize: { w: 6, h: 4 },
    recommendedSize: { w: 6, h: 3 },
    supports: ['습관', '도전'],
    metricTypes: [GRAPH_METRIC_TYPES.COUNT, GRAPH_METRIC_TYPES.DATE],
    preview: { family: GRAPH_PREVIEW_FAMILIES.BAR, variant: 'grouped', metricType: GRAPH_METRIC_TYPES.COUNT, seed: 202, features: ['그룹 막대', '주간 평균선'] },
  },
  {
    id: 'bar_minutes_stack',
    title: '분 누적 막대 그래프',
    category: GRAPH_CATEGORY_KEYS.BAR,
    tier: 2,
    price: 50,
    description: '분 단위 기록을 기간별로 누적해 비교합니다.',
    inputs: [
      { key: 'minutes', label: '분', unit: '분', description: '기간별 누적 시간' },
      { key: 'period', label: '기간', unit: '일/주', description: '비교할 기간 단위' },
    ],
    minSize: { w: 3, h: 2 },
    maxSize: { w: 6, h: 4 },
    recommendedSize: { w: 4, h: 3 },
    supports: ['시간형 기록', '주간 비교', '누적형 기록'],
    metricTypes: [GRAPH_METRIC_TYPES.MINUTE, GRAPH_METRIC_TYPES.DURATION],
    preview: {
      family: GRAPH_PREVIEW_FAMILIES.BAR,
      variant: 'stackedBars',
      metricType: GRAPH_METRIC_TYPES.MINUTE,
      seed: 202,
      features: ['누적 막대', '분 라벨', '기간 비교'],
    },
  },
  {
    id: 'pie_success_rate',
    title: '성공률 원형 그래프',
    category: GRAPH_CATEGORY_KEYS.PIE,
    tier: 2,
    price: 45,
    description: '성공과 미완료 비율을 원형으로 보여줍니다.',
    inputs: [
      { key: 'successRate', label: '성공률', unit: '%', description: '성공한 기록의 비율' },
      { key: 'failRate', label: '미완료율', unit: '%', description: '미완료 기록의 비율' },
    ],
    minSize: { w: 2, h: 2 },
    maxSize: { w: 4, h: 4 },
    recommendedSize: { w: 3, h: 3 },
    supports: ['습관', '도전', '비율형 기록'],
    metricTypes: [GRAPH_METRIC_TYPES.PERCENT],
    preview: {
      family: GRAPH_PREVIEW_FAMILIES.PIE,
      variant: 'donut',
      metricType: GRAPH_METRIC_TYPES.PERCENT,
      seed: 201,
      features: ['도넛형', '성공 비율', '퍼센트 강조'],
    },
  },
  {
    id: 'distribution_score_basic',
    title: '점수 분포도',
    category: GRAPH_CATEGORY_KEYS.DISTRIBUTION,
    tier: 2,
    price: 55,
    description: '기록 점수가 어느 구간에 몰려 있는지 보여줍니다.',
    inputs: [
      { key: 'score', label: '점수', unit: '점', description: '각 기록의 점수' },
      { key: 'count', label: '횟수', unit: '회', description: '점수 구간별 기록 수' },
    ],
    minSize: { w: 3, h: 2 },
    maxSize: { w: 6, h: 4 },
    recommendedSize: { w: 4, h: 3 },
    supports: ['점수형 기록', '분포 확인', '구간 비교'],
    metricTypes: [GRAPH_METRIC_TYPES.SCORE, GRAPH_METRIC_TYPES.COUNT],
    preview: {
      family: GRAPH_PREVIEW_FAMILIES.DISTRIBUTION,
      variant: 'dotCloud',
      metricType: GRAPH_METRIC_TYPES.SCORE,
      seed: 203,
      features: ['점 분포', '평균선', '점수 구간'],
    },
  },

  /* ===== Tier 3 ===== */
  {
    id: 'line_dual_count_minutes',
    title: '횟수·분 이중 선형 그래프',
    category: GRAPH_CATEGORY_KEYS.LINE,
    tier: 3,
    price: 80,
    description: '횟수와 분 기록을 두 개의 선으로 함께 비교합니다.',
    inputs: [
      { key: 'count', label: '횟수', unit: '회', description: '하루 기록 횟수' },
      { key: 'minutes', label: '분', unit: '분', description: '하루 기록 시간' },
      { key: 'date', label: '날짜', unit: '일', description: '기록 날짜' },
    ],
    minSize: { w: 3, h: 2 },
    maxSize: { w: 6, h: 4 },
    recommendedSize: { w: 5, h: 3 },
    supports: ['습관', '시간형 기록', '복합 비교'],
    metricTypes: [GRAPH_METRIC_TYPES.COUNT, GRAPH_METRIC_TYPES.MINUTE, GRAPH_METRIC_TYPES.DATE],
    preview: {
      family: GRAPH_PREVIEW_FAMILIES.LINE,
      variant: 'dualLine',
      metricType: 'countMinute',
      seed: 301,
      features: ['이중선', '횟수/분 비교', '복합 흐름'],
    },
  },
  {
    id: 'line_streak_tracker',
    title: '연속 기록 트래커',
    category: GRAPH_CATEGORY_KEYS.LINE,
    tier: 3,
    price: 200,
    description: '연속 성공일수의 변화와 유지 현황을 보여줍니다.',
    inputs: [
      { key: 'streak', label: '스트릭', unit: '일' },
      { key: 'date', label: '날짜', unit: '일' },
    ],
    minSize: { w: 3, h: 2 },
    maxSize: { w: 6, h: 4 },
    recommendedSize: { w: 4, h: 2 },
    supports: ['습관', '도전'],
    metricTypes: [GRAPH_METRIC_TYPES.COUNT, GRAPH_METRIC_TYPES.DATE],
    preview: { family: GRAPH_PREVIEW_FAMILIES.LINE, variant: 'step', metricType: GRAPH_METRIC_TYPES.COUNT, seed: 302, features: ['계단형', '최대 스트릭 마크'] },
  },
  {
    id: 'bar_stacked_category',
    title: '카테고리 누적 막대 그래프',
    category: GRAPH_CATEGORY_KEYS.BAR,
    tier: 3,
    price: 200,
    description: '여러 카테고리의 기여도를 누적으로 보여줍니다.',
    inputs: [
      { key: 'date', label: '날짜', unit: '일' },
      { key: 'category', label: '카테고리', unit: '' },
      { key: 'count', label: '횟수', unit: '회' },
    ],
    minSize: { w: 4, h: 3 },
    maxSize: { w: 6, h: 5 },
    recommendedSize: { w: 6, h: 4 },
    supports: ['습관', '도전'],
    metricTypes: [GRAPH_METRIC_TYPES.COUNT, GRAPH_METRIC_TYPES.DATE, GRAPH_METRIC_TYPES.PERCENT],
    preview: { family: GRAPH_PREVIEW_FAMILIES.BAR, variant: 'stacked', metricType: GRAPH_METRIC_TYPES.COUNT, seed: 303, features: ['누적 막대', '색상 구분', '범례'] },
  },
  {
    id: 'bar_monthly_heat',
    title: '월간 히트맵',
    category: GRAPH_CATEGORY_KEYS.BAR,
    tier: 3,
    price: 220,
    description: '한 달 동안의 기록 밀도를 색상으로 표현합니다.',
    inputs: [
      { key: 'day', label: '일', unit: '일' },
      { key: 'count', label: '횟수', unit: '회' },
    ],
    minSize: { w: 4, h: 3 },
    maxSize: { w: 6, h: 6 },
    recommendedSize: { w: 6, h: 4 },
    supports: ['습관', '도전'],
    metricTypes: [GRAPH_METRIC_TYPES.COUNT, GRAPH_METRIC_TYPES.DATE],
    preview: { family: GRAPH_PREVIEW_FAMILIES.BAR, variant: 'heatmap', metricType: GRAPH_METRIC_TYPES.COUNT, seed: 304, features: ['색상 밀도', '요일 구분'] },
  },
  {
    id: 'pie_category_ratio',
    title: '기록 유형 원형 그래프',
    category: GRAPH_CATEGORY_KEYS.PIE,
    tier: 3,
    price: 85,
    description: '습관, 도전, 시간형 기록의 비율을 원형으로 보여줍니다.',
    inputs: [
      { key: 'habitCount', label: '습관 수', unit: '개', description: '습관형 기록 수' },
      { key: 'challengeCount', label: '도전 수', unit: '개', description: '도전형 기록 수' },
      { key: 'minutesCount', label: '시간형 수', unit: '개', description: '분 단위 기록 수' },
    ],
    minSize: { w: 2, h: 2 },
    maxSize: { w: 5, h: 4 },
    recommendedSize: { w: 3, h: 3 },
    supports: ['습관', '도전', '기록 유형'],
    metricTypes: [GRAPH_METRIC_TYPES.COUNT, GRAPH_METRIC_TYPES.PERCENT],
    preview: {
      family: GRAPH_PREVIEW_FAMILIES.PIE,
      variant: 'segmentedPie',
      metricType: GRAPH_METRIC_TYPES.PERCENT,
      seed: 302,
      features: ['분할 조각', '유형 비율', '다중 카테고리'],
    },
  },
  {
    id: 'network_goal_relation',
    title: '목표 관계망',
    category: GRAPH_CATEGORY_KEYS.NETWORK,
    tier: 3,
    price: 90,
    description: '관련 목표와 기록 흐름을 노드와 선으로 보여줍니다.',
    inputs: [
      { key: 'goal', label: '목표', unit: '개', description: '중심 목표' },
      { key: 'relatedRecords', label: '관련 기록', unit: '개', description: '목표와 연결된 기록' },
      { key: 'relationStrength', label: '관계 강도', unit: '점', description: '기록 간 연결 강도' },
    ],
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 5 },
    recommendedSize: { w: 4, h: 4 },
    supports: ['관계형 기록', '목표 연결', '복합 분석'],
    metricTypes: [GRAPH_METRIC_TYPES.RELATION, GRAPH_METRIC_TYPES.SCORE],
    preview: {
      family: GRAPH_PREVIEW_FAMILIES.NETWORK,
      variant: 'nodeLinks',
      metricType: GRAPH_METRIC_TYPES.RELATION,
      seed: 303,
      features: ['노드', '연결선', '중심 목표'],
    },
  },

  /* ===== Tier 4 ===== */
  {
    id: 'line_streak_curve',
    title: '연속 성공 곡선',
    category: GRAPH_CATEGORY_KEYS.LINE,
    tier: 4,
    price: 150,
    description: '연속 성공일과 실패 지점을 곡선으로 보여줍니다.',
    inputs: [
      { key: 'streak', label: '연속 성공', unit: '일', description: '끊기지 않은 성공 기간' },
      { key: 'breakPoint', label: '실패 지점', unit: '일', description: '연속 기록이 끊긴 날짜' },
      { key: 'date', label: '날짜', unit: '일', description: '기록 날짜' },
    ],
    minSize: { w: 3, h: 2 },
    maxSize: { w: 6, h: 4 },
    recommendedSize: { w: 5, h: 3 },
    supports: ['습관', '연속 기록', '기간형 분석'],
    metricTypes: [GRAPH_METRIC_TYPES.DURATION, GRAPH_METRIC_TYPES.DATE],
    preview: {
      family: GRAPH_PREVIEW_FAMILIES.LINE,
      variant: 'curveWithBreak',
      metricType: GRAPH_METRIC_TYPES.DURATION,
      seed: 403,
      features: ['곡선', '끊김 표시', '연속일 강조'],
    },
  },
  {
    id: 'bar_goal_compare',
    title: '목표 대비 막대 그래프',
    category: GRAPH_CATEGORY_KEYS.BAR,
    tier: 4,
    price: 140,
    description: '목표값과 실제 기록값의 차이를 막대로 비교합니다.',
    inputs: [
      { key: 'target', label: '목표값', unit: '점/회/분', description: '설정한 목표' },
      { key: 'actual', label: '실제값', unit: '점/회/분', description: '실제 달성 기록' },
      { key: 'period', label: '기간', unit: '일/주', description: '비교 기간' },
    ],
    minSize: { w: 3, h: 2 },
    maxSize: { w: 6, h: 4 },
    recommendedSize: { w: 5, h: 3 },
    supports: ['목표 비교', '누적형 기록', '달성률 분석'],
    metricTypes: [GRAPH_METRIC_TYPES.SCORE, GRAPH_METRIC_TYPES.COUNT, GRAPH_METRIC_TYPES.MINUTE],
    preview: {
      family: GRAPH_PREVIEW_FAMILIES.BAR,
      variant: 'compareBars',
      metricType: GRAPH_METRIC_TYPES.SCORE,
      seed: 402,
      features: ['목표/실제 비교', '이중 막대', '차이 강조'],
    },
  },
  {
    id: 'pie_goal_progress',
    title: '목표 진행률 원형 그래프',
    category: GRAPH_CATEGORY_KEYS.PIE,
    tier: 4,
    price: 500,
    description: '목표 대비 현재 진행 상황을 직관적으로 보여줍니다.',
    inputs: [
      { key: 'progress', label: '진행률', unit: '%' },
      { key: 'goal', label: '목표', unit: '' },
    ],
    minSize: { w: 2, h: 2 },
    maxSize: { w: 4, h: 4 },
    recommendedSize: { w: 2, h: 2 },
    supports: ['도전'],
    metricTypes: [GRAPH_METRIC_TYPES.PERCENT, GRAPH_METRIC_TYPES.SCORE],
    preview: { family: GRAPH_PREVIEW_FAMILIES.PIE, variant: 'gauge', metricType: GRAPH_METRIC_TYPES.PERCENT, seed: 403, features: ['게이지형', '목표치 표시', '애니메이션'] },
  },
  {
    id: 'distribution_time_heat',
    title: '시간 분포 히트맵',
    category: GRAPH_CATEGORY_KEYS.DISTRIBUTION,
    tier: 4,
    price: 130,
    description: '기록이 어느 시간대와 기간에 집중되는지 보여줍니다.',
    inputs: [
      { key: 'hour', label: '시간대', unit: '시', description: '기록한 시간대' },
      { key: 'date', label: '날짜', unit: '일', description: '기록 날짜' },
      { key: 'count', label: '횟수', unit: '회', description: '시간대별 기록 수' },
    ],
    minSize: { w: 4, h: 3 },
    maxSize: { w: 6, h: 5 },
    recommendedSize: { w: 5, h: 4 },
    supports: ['시간대 분석', '기간형 기록', '습관 패턴'],
    metricTypes: [GRAPH_METRIC_TYPES.DATE, GRAPH_METRIC_TYPES.COUNT, GRAPH_METRIC_TYPES.DURATION],
    preview: {
      family: GRAPH_PREVIEW_FAMILIES.DISTRIBUTION,
      variant: 'heatGrid',
      metricType: GRAPH_METRIC_TYPES.COUNT,
      seed: 401,
      features: ['격자', '밀도 표현', '시간대 패턴'],
    },
  },
  {
    id: 'network_challenge_relation',
    title: '도전 관계망 그래프',
    category: GRAPH_CATEGORY_KEYS.NETWORK,
    tier: 4,
    price: 550,
    description: '도전/습관 간의 관계와 연결 강도를 네트워크로 시각화합니다.',
    inputs: [
      { key: 'source', label: '시작', unit: '' },
      { key: 'target', label: '연결', unit: '' },
      { key: 'strength', label: '강도', unit: '' },
    ],
    minSize: { w: 4, h: 3 },
    maxSize: { w: 6, h: 6 },
    recommendedSize: { w: 6, h: 5 },
    supports: ['습관', '도전'],
    metricTypes: [GRAPH_METRIC_TYPES.COUNT, GRAPH_METRIC_TYPES.RELATION],
    preview: { family: GRAPH_PREVIEW_FAMILIES.NETWORK, variant: 'force', metricType: GRAPH_METRIC_TYPES.RELATION, seed: 405, features: ['노드', '엣지', '연결 강도'] },
  },

  /* ===== Tier 5 ===== */
  {
    id: 'line_prediction_path',
    title: '예상 흐름 선형 그래프',
    category: GRAPH_CATEGORY_KEYS.LINE,
    tier: 5,
    price: 240,
    description: '현재 기록 흐름을 바탕으로 다음 기간의 예상 추세를 보여줍니다.',
    inputs: [
      { key: 'count', label: '횟수', unit: '회', description: '이전 기록 횟수' },
      { key: 'minutes', label: '분', unit: '분', description: '이전 기록 시간' },
      { key: 'prediction', label: '예상값', unit: '점/회/분', description: '다음 기간 예상 기록' },
    ],
    minSize: { w: 4, h: 3 },
    maxSize: { w: 6, h: 5 },
    recommendedSize: { w: 5, h: 4 },
    supports: ['추세 분석', '기간형 기록', '고급 예측'],
    metricTypes: [GRAPH_METRIC_TYPES.COUNT, GRAPH_METRIC_TYPES.MINUTE, GRAPH_METRIC_TYPES.SCORE],
    preview: {
      family: GRAPH_PREVIEW_FAMILIES.LINE,
      variant: 'forecastLine',
      metricType: 'prediction',
      seed: 503,
      features: ['실선+점선', '예상 구간', '추세 강조'],
    },
  },
  {
    id: 'bar_master_comparison',
    title: '마스터 비교 종합 막대',
    category: GRAPH_CATEGORY_KEYS.BAR,
    tier: 5,
    price: 1000,
    description: '모든 기간의 기록을 종합적으로 비교하는 마스터 막대 차트입니다.',
    inputs: [
      { key: 'period', label: '기간', unit: '' },
      { key: 'count', label: '횟수', unit: '회' },
      { key: 'score', label: '점수', unit: '점' },
    ],
    minSize: { w: 4, h: 4 },
    maxSize: { w: 6, h: 6 },
    recommendedSize: { w: 6, h: 4 },
    supports: ['습관', '도전'],
    metricTypes: [GRAPH_METRIC_TYPES.COUNT, GRAPH_METRIC_TYPES.SCORE],
    preview: { family: GRAPH_PREVIEW_FAMILIES.BAR, variant: 'master', metricType: GRAPH_METRIC_TYPES.COUNT, seed: 502, features: ['전체 비교', '통계 수치', '하이라이트'] },
  },
  {
    id: 'network_habit_cluster',
    title: '습관 군집 관계망',
    category: GRAPH_CATEGORY_KEYS.NETWORK,
    tier: 5,
    price: 210,
    description: '습관들이 어떤 패턴으로 묶이는지 관계망으로 보여줍니다.',
    inputs: [
      { key: 'habit', label: '습관', unit: '개', description: '분석할 습관' },
      { key: 'cluster', label: '군집', unit: '그룹', description: '비슷한 패턴의 묶음' },
      { key: 'relationStrength', label: '관계 강도', unit: '점', description: '습관 간 연결 강도' },
    ],
    minSize: { w: 4, h: 3 },
    maxSize: { w: 6, h: 6 },
    recommendedSize: { w: 5, h: 5 },
    supports: ['관계형 기록', '습관 분석', '복합 패턴'],
    metricTypes: [GRAPH_METRIC_TYPES.RELATION, GRAPH_METRIC_TYPES.SCORE],
    preview: {
      family: GRAPH_PREVIEW_FAMILIES.NETWORK,
      variant: 'clusterNetwork',
      metricType: GRAPH_METRIC_TYPES.RELATION,
      seed: 501,
      features: ['군집', '다중 노드', '관계 강도'],
    },
  },
  {
    id: 'distribution_goal_box',
    title: '목표 분산 박스',
    category: GRAPH_CATEGORY_KEYS.DISTRIBUTION,
    tier: 5,
    price: 220,
    description: '기록값의 중앙값, 범위, 튀는 값을 한눈에 보여줍니다.',
    inputs: [
      { key: 'score', label: '점수', unit: '점', description: '분석할 기록값' },
      { key: 'median', label: '중앙값', unit: '점', description: '기록의 중심값' },
      { key: 'outlier', label: '이상값', unit: '점', description: '튀는 기록값' },
    ],
    minSize: { w: 4, h: 3 },
    maxSize: { w: 6, h: 5 },
    recommendedSize: { w: 5, h: 4 },
    supports: ['점수형 기록', '분산 분석', '고급 통계'],
    metricTypes: [GRAPH_METRIC_TYPES.SCORE],
    preview: {
      family: GRAPH_PREVIEW_FAMILIES.DISTRIBUTION,
      variant: 'boxPlot',
      metricType: GRAPH_METRIC_TYPES.SCORE,
      seed: 502,
      features: ['박스형', '중앙값', '이상값'],
    },
  },
  {
    id: 'pie_ultimate_insight',
    title: '궁극의 인사이트 원형',
    category: GRAPH_CATEGORY_KEYS.PIE,
    tier: 5,
    price: 1500,
    description: '모든 데이터를 하나의 원형으로 종합하는 궁극의 인사이트 그래프입니다.',
    inputs: [
      { key: 'category', label: '카테고리', unit: '' },
      { key: 'value', label: '값', unit: '' },
      { key: 'percentage', label: '비율', unit: '%' },
    ],
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 6 },
    recommendedSize: { w: 4, h: 4 },
    supports: ['습관', '도전'],
    metricTypes: [GRAPH_METRIC_TYPES.COUNT, GRAPH_METRIC_TYPES.PERCENT, GRAPH_METRIC_TYPES.RELATION],
    preview: { family: GRAPH_PREVIEW_FAMILIES.PIE, variant: 'ultimate', metricType: GRAPH_METRIC_TYPES.PERCENT, seed: 505, features: ['멀티 레이어', '인터랙티브', '3D 효과'] },
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
