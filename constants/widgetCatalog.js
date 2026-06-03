export const DASHBOARD_TARGETS = {
  CHALLENGE: 'challenge',
  HABIT: 'habit',
  RECORD_ROOM: 'recordRoom',
};

export const GRID_COLUMNS = 6;

export const DEFAULT_WIDGET_IDS = [
  'overall_progress',
  'goal_black_box',
  'month_calendar',
];

export const RECORD_ROOM_WIDGET_IDS = [
  'profile-image',
  'profile-info',
  'total-cards',
  'hall-count',
  'stars',
  'today-count',
  'deleted-count',
  'expired-fail',
  'weekly-bars',
  'ratio-donut',
  'token-line',
  'calendar',
  'heatmap',
  'monthly-bars',
  'hall-battery',
  'connect-status',
  'memo',
  'record-room-card-list',
];

export const WIDGET_CATALOG = [
  {
    id: 'overall_progress',
    title: '전체 진행 위젯',
    tier: 0,
    price: 0,
    shop: false,
    defaultOwned: true,
    supports: ['challenge', 'habit'],
    defaultSize: { w: 2, h: 4 },
    minSize: { w: 2, h: 2 },
    maxSize: { w: 4, h: 4 },
    kind: 'progress',
  },
  {
    id: 'goal_black_box',
    title: '도전 목표 위젯',
    tier: 0,
    price: 0,
    shop: false,
    defaultOwned: true,
    supports: ['challenge'],
    defaultSize: { w: 6, h: 2 },
    minSize: { w: 2, h: 1 },
    maxSize: { w: 6, h: 4 },
    kind: 'goal',
  },
  {
    id: 'month_calendar',
    title: '달력 위젯',
    tier: 0,
    price: 0,
    shop: false,
    defaultOwned: true,
    supports: ['challenge', 'habit'],
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 4, h: 2 },
    maxSize: { w: 6, h: 6 },
    kind: 'calendar',
  },

  { id: 't1_record_counter', title: '기록 카운터', tier: 1, price: 30, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 1, h: 2 }, minSize: { w: 1, h: 2 }, maxSize: { w: 2, h: 4 }, kind: 'placeholder' },
  { id: 't1_today_meter', title: '오늘 집중 미터', tier: 1, price: 30, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 1, h: 2 }, minSize: { w: 1, h: 2 }, maxSize: { w: 2, h: 4 }, kind: 'placeholder' },
  { id: 't1_mini_summary', title: '미니 요약 카드', tier: 1, price: 30, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 1, h: 2 }, minSize: { w: 1, h: 2 }, maxSize: { w: 3, h: 2 }, kind: 'placeholder' },

  { id: 'weekly_bar', title: '주간 막대 위젯', tier: 2, price: 80, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 6 }, kind: 'weeklyBar' },
  { id: 't2_weekly_heat', title: '주간 열감 지도', tier: 2, price: 80, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 3, h: 4 }, minSize: { w: 2, h: 4 }, maxSize: { w: 3, h: 6 }, kind: 'placeholder' },
  { id: 't2_record_balance', title: '기록 균형 카드', tier: 2, price: 80, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 2, h: 4 }, minSize: { w: 1, h: 2 }, maxSize: { w: 3, h: 4 }, kind: 'placeholder' },

  { id: 'line_count_cumulative', title: '누적 선형 위젯', tier: 3, price: 200, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 6 }, kind: 'lineCount' },
  { id: 't3_streak_curve', title: '연속 기록 곡선', tier: 3, price: 200, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 3, h: 4 }, minSize: { w: 2, h: 4 }, maxSize: { w: 3, h: 6 }, kind: 'placeholder' },
  { id: 't3_goal_velocity', title: '목표 속도계', tier: 3, price: 200, shop: true, placeholder: true, supports: ['challenge'], defaultSize: { w: 2, h: 4 }, minSize: { w: 1, h: 2 }, maxSize: { w: 3, h: 4 }, kind: 'placeholder' },

  { id: 'line_minutes', title: '시간 선형 위젯', tier: 4, price: 500, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 6 }, kind: 'lineMinutes' },
  { id: 'grass_graph', title: '잔디 위젯', tier: 4, price: 500, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 6 }, kind: 'grass' },
  { id: 't4_animated_pulse', title: '애니메이션 펄스', tier: 4, price: 500, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 3, h: 4 }, minSize: { w: 2, h: 4 }, maxSize: { w: 3, h: 6 }, kind: 'placeholder' },

  { id: 't5_all_black_theme', title: '올블랙 전용 테마', tier: 5, price: 1000, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 3, h: 4 }, minSize: { w: 3, h: 2 }, maxSize: { w: 3, h: 6 }, kind: 'theme' },
  { id: 't5_master_panel', title: '마스터 패널', tier: 5, price: 1000, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 3, h: 4 }, minSize: { w: 3, h: 2 }, maxSize: { w: 3, h: 6 }, kind: 'placeholder' },
  { id: 't5_final_record', title: '최종 기록 보드', tier: 5, price: 1000, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 3, h: 4 }, minSize: { w: 3, h: 2 }, maxSize: { w: 3, h: 6 }, kind: 'placeholder' },

  { id: 'profile-image', title: '프로필 이미지', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 3, h: 3 }, kind: 'recordRoom' },
  { id: 'profile-info', title: '내 정보', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 4, h: 2 }, minSize: { w: 3, h: 2 }, maxSize: { w: 6, h: 3 }, kind: 'recordRoom' },

  { id: 'total-cards', title: '현재 도전/기록', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 3, h: 1 }, minSize: { w: 2, h: 1 }, maxSize: { w: 3, h: 2 }, kind: 'recordRoomKpi' },
  { id: 'hall-count', title: '명예의 전당', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 3, h: 1 }, minSize: { w: 2, h: 1 }, maxSize: { w: 3, h: 2 }, kind: 'recordRoomKpi' },
  { id: 'stars', title: '별 갯수', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 3, h: 1 }, minSize: { w: 2, h: 1 }, maxSize: { w: 3, h: 2 }, kind: 'recordRoomKpi' },
  { id: 'today-count', title: '오늘 기록', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 3, h: 1 }, minSize: { w: 2, h: 1 }, maxSize: { w: 3, h: 2 }, kind: 'recordRoomKpi' },
  { id: 'deleted-count', title: '삭제 갯수', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 3, h: 1 }, minSize: { w: 2, h: 1 }, maxSize: { w: 3, h: 2 }, kind: 'recordRoomKpi' },
  { id: 'expired-fail', title: '만료 실패', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 3, h: 1 }, minSize: { w: 2, h: 1 }, maxSize: { w: 3, h: 2 }, kind: 'recordRoomKpi' },

  { id: 'weekly-bars', title: '주간 막대', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 6, h: 3 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 5 }, kind: 'recordRoomChart' },
  { id: 'ratio-donut', title: '도전/기록 비율', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 3, h: 3 }, minSize: { w: 3, h: 2 }, maxSize: { w: 6, h: 4 }, kind: 'recordRoomChart' },
  { id: 'token-line', title: '토큰 추이', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 3, h: 3 }, minSize: { w: 3, h: 2 }, maxSize: { w: 6, h: 4 }, kind: 'recordRoomChart' },
  { id: 'calendar', title: '인증 달력', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 }, maxSize: { w: 6, h: 6 }, kind: 'recordRoomChart' },
  { id: 'heatmap', title: '인증 시간 패턴', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 }, maxSize: { w: 6, h: 6 }, kind: 'recordRoomChart' },
  { id: 'monthly-bars', title: '월간 기록', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 6, h: 3 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 5 }, kind: 'recordRoomChart' },

  { id: 'hall-battery', title: '명예의 전당 목표', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 6, h: 2 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 4 }, kind: 'recordRoom' },
  { id: 'connect-status', title: '커넥트 상태', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 6, h: 2 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 4 }, kind: 'recordRoom' },
  { id: 'memo', title: '메모', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 6, h: 2 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 4 }, kind: 'recordRoom' },
  { id: 'record-room-card-list', title: '내 기록실 카드목록', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 6, h: 4 }, minSize: { w: 6, h: 2 }, maxSize: { w: 6, h: 8 }, kind: 'recordRoomList' },
];

export const getWidgetById = (id) =>
  WIDGET_CATALOG.find((item) => item.id === id) || null;

export const getDefaultWidgetIds = () =>
  WIDGET_CATALOG.filter((item) => item.defaultOwned).map((item) => item.id);

export const getDefaultWidgets = (target = DASHBOARD_TARGETS.CHALLENGE) =>
  WIDGET_CATALOG.filter((item) => item.defaultOwned && item.supports.includes(target));

export const getShopWidgets = () =>
  WIDGET_CATALOG.filter((item) => item.shop);

export const getDashboardEditableWidgets = (target = DASHBOARD_TARGETS.CHALLENGE) =>
  target === DASHBOARD_TARGETS.RECORD_ROOM
    ? WIDGET_CATALOG.filter((item) => supportsWidgetTarget(item, target))
    : getShopWidgets().filter((item) => supportsWidgetTarget(item, target));

export const getWidgetsByTier = (tier) =>
  getShopWidgets().filter((item) => item.tier === tier);

export const supportsWidgetTarget = (widget, target) =>
  !!widget && Array.isArray(widget.supports) && widget.supports.includes(target);

export const getDefaultDashboardLayout = (target = DASHBOARD_TARGETS.CHALLENGE) => {
 if (target === DASHBOARD_TARGETS.RECORD_ROOM) {
 return [
 { widgetId: 'profile-image', x: 0, y: 0, w: 2, h: 2 },
 { widgetId: 'profile-info', x: 2, y: 0, w: 4, h: 2 },
 { widgetId: 'total-cards', x: 0, y: 2, w: 3, h: 1 },
 { widgetId: 'hall-count', x: 3, y: 2, w: 3, h: 1 },
 { widgetId: 'stars', x: 0, y: 3, w: 3, h: 1 },
 { widgetId: 'today-count', x: 3, y: 3, w: 3, h: 1 },
 { widgetId: 'deleted-count', x: 0, y: 4, w: 3, h: 1 },
 { widgetId: 'expired-fail', x: 3, y: 4, w: 3, h: 1 },
 { widgetId: 'weekly-bars', x: 0, y: 5, w: 6, h: 3 },
 { widgetId: 'ratio-donut', x: 0, y: 8, w: 3, h: 3 },
 { widgetId: 'token-line', x: 3, y: 8, w: 3, h: 3 },
 { widgetId: 'calendar', x: 0, y: 11, w: 6, h: 4 },
 { widgetId: 'heatmap', x: 0, y: 15, w: 6, h: 4 },
 { widgetId: 'monthly-bars', x: 0, y: 19, w: 6, h: 3 },
 { widgetId: 'hall-battery', x: 0, y: 22, w: 6, h: 2 },
 { widgetId: 'connect-status', x: 0, y: 24, w: 6, h: 2 },
 { widgetId: 'memo', x: 0, y: 26, w: 6, h: 2 },
 { widgetId: 'record-room-card-list', x: 0, y: 28, w: 6, h: 4 },
 ].filter((item) => {
 const widget = getWidgetById(item.widgetId);
 return supportsWidgetTarget(widget, target);
 });
 }

 const base = [
 { widgetId: 'overall_progress', x: 0, y: 0, w: 2, h: 4 },
 { widgetId: 'month_calendar', x: 2, y: 0, w: 4, h: 4 },
 ];

 if (target === DASHBOARD_TARGETS.CHALLENGE) {
 base.push({ widgetId: 'goal_black_box', x: 0, y: 4, w: 6, h: 2 });
 }

 return base.filter((item) => {
 const widget = getWidgetById(item.widgetId);
 return supportsWidgetTarget(widget, target);
 });
};
