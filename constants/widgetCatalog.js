export const DASHBOARD_TARGETS = {
  CHALLENGE: 'challenge',
  HABIT: 'habit',
};

export const GRID_COLUMNS = 6;

export const DEFAULT_WIDGET_IDS = [
  'overall_progress',
  'goal_black_box',
  'month_calendar',
];

export const WIDGET_CATALOG = [
  {
    id: 'overall_progress',
    title: '전체 진행 그래프',
    tier: 0,
    price: 0,
    shop: false,
    defaultOwned: true,
    supports: ['challenge', 'habit'],
    defaultSize: { w: 2, h: 2 },
    minSize: { w: 1, h: 1 },
    maxSize: { w: 6, h: 2 },
    kind: 'progress',
  },
  {
    id: 'goal_black_box',
    title: '도전 목표 박스',
    tier: 0,
    price: 0,
    shop: false,
    defaultOwned: true,
    supports: ['challenge'],
    defaultSize: { w: 6, h: 1 },
    minSize: { w: 2, h: 1 },
    maxSize: { w: 6, h: 2 },
    kind: 'goal',
  },
  {
    id: 'month_calendar',
    title: '달력',
    tier: 0,
    price: 0,
    shop: false,
    defaultOwned: true,
    supports: ['challenge', 'habit'],
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 3 },
    kind: 'calendar',
  },

  { id: 't1_record_counter', title: '기록 카운터', tier: 1, price: 30, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 1, h: 1 }, minSize: { w: 1, h: 1 }, maxSize: { w: 2, h: 2 }, kind: 'placeholder' },
  { id: 't1_today_meter', title: '오늘 집중 미터', tier: 1, price: 30, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 1, h: 1 }, minSize: { w: 1, h: 1 }, maxSize: { w: 2, h: 2 }, kind: 'placeholder' },
  { id: 't1_mini_summary', title: '미니 요약 카드', tier: 1, price: 30, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 1, h: 1 }, minSize: { w: 1, h: 1 }, maxSize: { w: 3, h: 1 }, kind: 'placeholder' },

  { id: 'weekly_bar', title: '주간 막대 그래프', tier: 2, price: 80, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 6, h: 3 }, kind: 'weeklyBar' },
  { id: 't2_weekly_heat', title: '주간 열감 지도', tier: 2, price: 80, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 3, h: 3 }, kind: 'placeholder' },
  { id: 't2_record_balance', title: '기록 균형 카드', tier: 2, price: 80, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 2, h: 2 }, minSize: { w: 1, h: 1 }, maxSize: { w: 3, h: 2 }, kind: 'placeholder' },

  { id: 'line_count_cumulative', title: '선형 그래프(누적)', tier: 3, price: 200, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 6, h: 3 }, kind: 'lineCount' },
  { id: 't3_streak_curve', title: '연속 기록 곡선', tier: 3, price: 200, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 3, h: 3 }, kind: 'placeholder' },
  { id: 't3_goal_velocity', title: '목표 속도계', tier: 3, price: 200, shop: true, placeholder: true, supports: ['challenge'], defaultSize: { w: 2, h: 2 }, minSize: { w: 1, h: 1 }, maxSize: { w: 3, h: 2 }, kind: 'placeholder' },

  { id: 'line_minutes', title: '선형 그래프(분)', tier: 4, price: 500, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 6, h: 3 }, kind: 'lineMinutes' },
  { id: 'grass_graph', title: '잔디 그래프', tier: 4, price: 500, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 2 }, minSize: { w: 3, h: 2 }, maxSize: { w: 6, h: 3 }, kind: 'grass' },
  { id: 't4_animated_pulse', title: '애니메이션 펄스', tier: 4, price: 500, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 3, h: 3 }, kind: 'placeholder' },

  { id: 't5_all_black_theme', title: '올블랙 전용 테마', tier: 5, price: 1000, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 3, h: 2 }, minSize: { w: 3, h: 1 }, maxSize: { w: 3, h: 3 }, kind: 'theme' },
  { id: 't5_master_panel', title: '마스터 패널', tier: 5, price: 1000, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 3, h: 2 }, minSize: { w: 3, h: 1 }, maxSize: { w: 3, h: 3 }, kind: 'placeholder' },
  { id: 't5_final_record', title: '최종 기록 보드', tier: 5, price: 1000, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 3, h: 2 }, minSize: { w: 3, h: 1 }, maxSize: { w: 3, h: 3 }, kind: 'placeholder' },
];

export const getWidgetById = (id) =>
  WIDGET_CATALOG.find((item) => item.id === id) || null;

export const getDefaultWidgetIds = () =>
  WIDGET_CATALOG.filter((item) => item.defaultOwned).map((item) => item.id);

export const getDefaultWidgets = (target = DASHBOARD_TARGETS.CHALLENGE) =>
  WIDGET_CATALOG.filter((item) => item.defaultOwned && item.supports.includes(target));

export const getShopWidgets = () =>
  WIDGET_CATALOG.filter((item) => item.shop);

export const getWidgetsByTier = (tier) =>
  getShopWidgets().filter((item) => item.tier === tier);

export const supportsWidgetTarget = (widget, target) =>
  !!widget && Array.isArray(widget.supports) && widget.supports.includes(target);

export const getDefaultDashboardLayout = (target = DASHBOARD_TARGETS.CHALLENGE) => {
 const base = [
 { widgetId: 'overall_progress', x: 0, y: 0, w: 2, h: 2 },
 { widgetId: 'month_calendar', x: 2, y: 0, w: 4, h: 2 },
 ];

 if (target === DASHBOARD_TARGETS.CHALLENGE) {
 base.push({ widgetId: 'goal_black_box', x: 0, y: 2, w: 6, h: 1 });
 }

 return base.filter((item) => {
 const widget = getWidgetById(item.widgetId);
 return supportsWidgetTarget(widget, target);
 });
};
