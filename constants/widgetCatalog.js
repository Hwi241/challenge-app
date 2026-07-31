import {
 WIDGET_PREVIEW_FAMILIES,
 WIDGET_PREVIEW_VARIANTS,
} from './widgetPreviewRules';

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

export const ACTUAL_DASHBOARD_GRAPH_WIDGET_IDS = [
  'overall_progress',
  'month_calendar',
  'goal_black_box',
  'weekly_bar',
  'line_count_cumulative',
  'line_minutes',
  'grass_graph',
  'health_steps_weekly',
  'health_steps_trend',
  'health_exercise_minutes_trend',
  'health_distance_trend',
  'health_steps_goal_rate',
  'health_steps_cumulative',
  'health_exercise_weekly_minutes',
  'health_distance_weekly',
  'health_distance_cumulative',
 'health_active_calories_trend',
 'health_sleep_hours_trend',
 'health_sleep_rhythm',
 'health_heart_rate_trend',
 'health_weight_trend',
 'health_body_fat_trend',
 'health_bmi_trend',
];

export const DEFAULT_OWNED_DASHBOARD_GRAPH_WIDGET_IDS = [
  'overall_progress',
  'month_calendar',
];

export const ACTUAL_PURCHASABLE_DASHBOARD_GRAPH_WIDGET_IDS = [
  'goal_black_box',
  'weekly_bar',
  'line_count_cumulative',
  'line_minutes',
  'grass_graph',
  'health_steps_weekly',
  'health_steps_trend',
  'health_exercise_minutes_trend',
  'health_distance_trend',
  'health_steps_goal_rate',
  'health_steps_cumulative',
  'health_exercise_weekly_minutes',
  'health_distance_weekly',
  'health_distance_cumulative',
 'health_active_calories_trend',
 'health_sleep_hours_trend',
 'health_sleep_rhythm',
 'health_heart_rate_trend',
 'health_weight_trend',
 'health_body_fat_trend',
 'health_bmi_trend',
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
    title: '전체 진행 카드',
    tier: 0,
    price: 0,
    shop: false,
    defaultOwned: true,
    supports: ['challenge', 'habit'],
    defaultSize: { w: 2, h: 4 },
    minSize: { w: 2, h: 2 },
    maxSize: { w: 4, h: 4 },
    kind: 'progress',
    previewFamily: 'progress',
  },
  {
    id: 'goal_black_box',
    title: '도전 목표 카드',
    tier: 1,
    price: 25,
    shop: true,
    defaultOwned: false,
    supports: ['challenge'],
    defaultSize: { w: 6, h: 2 },
    minSize: { w: 2, h: 1 },
    maxSize: { w: 6, h: 4 },
    kind: 'goal',
    previewFamily: 'goal',
  },
  {
    id: 'month_calendar',
    title: '달력 카드',
    tier: 0,
    price: 0,
    shop: false,
    defaultOwned: true,
    supports: ['challenge', 'habit'],
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 4, h: 2 },
    maxSize: { w: 6, h: 6 },
    kind: 'calendar',
    previewFamily: 'calendar',
  },

  { id: 't1_record_counter', title: '기록 카운터', tier: 1, price: 30, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 1, h: 2 }, minSize: { w: 1, h: 2 }, maxSize: { w: 2, h: 4 }, kind: 'placeholder', previewFamily: 'kpi' },
  { id: 't1_today_meter', title: '오늘 집중 미터', tier: 1, price: 30, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 1, h: 2 }, minSize: { w: 1, h: 2 }, maxSize: { w: 2, h: 4 }, kind: 'placeholder', previewFamily: 'progress' },
  { id: 't1_mini_summary', title: '미니 요약 카드', tier: 1, price: 30, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 1, h: 2 }, minSize: { w: 1, h: 2 }, maxSize: { w: 3, h: 2 }, kind: 'placeholder', previewFamily: 'board' },

  { id: 'health_steps_weekly', title: '걸음 리듬 카드', tier: 1, price: 25, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 6 }, kind: 'healthStepsWeekly', previewFamily: 'bar' },
  { id: 'health_steps_trend', title: '걸음 수 추세 카드', tier: 1, price: 25, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 6 }, kind: 'healthStepsTrend', previewFamily: 'line' },
 { id: 'health_exercise_minutes_trend', title: '운동 시간 추세 카드', tier: 1, price: 25, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 6 }, kind: 'healthExerciseMinutesTrend', previewFamily: 'line' },
 { id: 'health_distance_trend', title: '운동 거리 추세 카드', tier: 1, price: 25, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 6 }, kind: 'healthDistanceTrend', previewFamily: 'line' },

 {
 id: 'health_steps_goal_rate',
 title: '걸음 목표 달성률',
 tier: 1,
 price: 15,
 shop: true,
 placeholder: false,
 supports: ['challenge', 'habit'],
 defaultSize: { w: 3, h: 2 },
 minSize: { w: 2, h: 2 },
 maxSize: { w: 4, h: 3 },
 kind: 'healthStepsGoalRate',
 previewFamily: 'goal',
 },
 {
 id: 'health_steps_cumulative',
 title: '누적 걸음수',
 tier: 1,
 price: 25,
 shop: true,
 placeholder: false,
 supports: ['challenge', 'habit'],
 defaultSize: { w: 4, h: 2 },
 minSize: { w: 2, h: 2 },
 maxSize: { w: 6, h: 4 },
 kind: 'healthStepsCumulative',
 previewFamily: 'bar',
 },
 {
 id: 'health_exercise_weekly_minutes',
 title: '주간 운동시간',
 tier: 1,
 price: 25,
 shop: true,
 placeholder: false,
 supports: ['challenge', 'habit'],
 defaultSize: { w: 4, h: 2 },
 minSize: { w: 2, h: 2 },
 maxSize: { w: 6, h: 4 },
 kind: 'healthExerciseWeeklyMinutes',
 previewFamily: 'bar',
 },
 {
 id: 'health_distance_weekly',
 title: '주간 이동거리',
 tier: 1,
 price: 25,
 shop: true,
 placeholder: false,
 supports: ['challenge', 'habit'],
 defaultSize: { w: 4, h: 2 },
 minSize: { w: 2, h: 2 },
 maxSize: { w: 6, h: 4 },
 kind: 'healthDistanceWeekly',
 previewFamily: 'bar',
 },
 {
 id: 'health_distance_cumulative',
 title: '누적 운동거리',
 tier: 1,
 price: 25,
 shop: true,
 placeholder: false,
 supports: ['challenge', 'habit'],
 defaultSize: { w: 4, h: 2 },
 minSize: { w: 2, h: 2 },
 maxSize: { w: 6, h: 4 },
 kind: 'healthDistanceCumulative',
 previewFamily: 'bar',
 }, { id: 'health_active_calories_trend', title: '운동 칼로리 카드', tier: 1, price: 25, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 6 }, kind: 'healthActiveCaloriesTrend', previewFamily: 'line' },
 { id: 'health_sleep_hours_trend', title: '수면 시간 추세 카드', tier: 1, price: 25, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 6 }, kind: 'healthSleepHoursTrend', previewFamily: 'line' },
 { id: 'health_sleep_rhythm', title: '수면 리듬 카드', tier: 1, price: 25, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 6 }, kind: 'healthSleepRhythm', previewFamily: 'bar' },
 { id: 'health_heart_rate_trend', title: '평균 심박 추세 카드', tier: 1, price: 25, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 6 }, kind: 'healthHeartRateTrend', previewFamily: 'line' },
 { id: 'health_weight_trend', title: '체중 추세 카드', tier: 1, price: 25, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 6 }, kind: 'healthWeightTrend', previewFamily: 'line' },
 { id: 'health_body_fat_trend', title: '체지방률 추세 카드', tier: 1, price: 25, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 6 }, kind: 'healthBodyFatTrend', previewFamily: 'line' },
 { id: 'health_bmi_trend', title: 'BMI 추세 카드', tier: 1, price: 25, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 6 }, kind: 'healthBmiTrend', previewFamily: 'line' },

 { id: 'weekly_bar', title: '주간 막대 카드', tier: 2, price: 80, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 6 }, kind: 'weeklyBar', previewFamily: 'bar' },
  { id: 't2_weekly_heat', title: '주간 열감 지도', tier: 2, price: 80, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 3, h: 4 }, minSize: { w: 2, h: 4 }, maxSize: { w: 3, h: 6 }, kind: 'placeholder', previewFamily: 'heatmap' },
  { id: 't2_record_balance', title: '기록 균형 카드', tier: 2, price: 80, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 2, h: 4 }, minSize: { w: 1, h: 2 }, maxSize: { w: 3, h: 4 }, kind: 'placeholder', previewFamily: 'donut' },

  { id: 'line_count_cumulative', title: '누적 선형 카드', tier: 3, price: 200, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 6 }, kind: 'lineCount', previewFamily: 'line' },
  { id: 't3_streak_curve', title: '연속 기록 곡선', tier: 3, price: 200, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 3, h: 4 }, minSize: { w: 2, h: 4 }, maxSize: { w: 3, h: 6 }, kind: 'placeholder', previewFamily: 'line' },
  { id: 't3_goal_velocity', title: '목표 속도계', tier: 3, price: 200, shop: true, placeholder: true, supports: ['challenge'], defaultSize: { w: 2, h: 4 }, minSize: { w: 1, h: 2 }, maxSize: { w: 3, h: 4 }, kind: 'placeholder', previewFamily: 'progress' },

  { id: 'line_minutes', title: '시간 선형 카드', tier: 4, price: 500, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 6 }, kind: 'lineMinutes', previewFamily: 'line' },
  { id: 'grass_graph', title: '잔디 카드', tier: 4, price: 500, shop: true, placeholder: false, supports: ['challenge', 'habit'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 2 }, maxSize: { w: 6, h: 6 }, kind: 'grass', previewFamily: 'heatmap' },
  { id: 't4_animated_pulse', title: '애니메이션 펄스', tier: 4, price: 500, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 3, h: 4 }, minSize: { w: 2, h: 4 }, maxSize: { w: 3, h: 6 }, kind: 'placeholder', previewFamily: 'pulse' },

  { id: 't5_all_black_theme', title: '올블랙 전용 테마', tier: 5, price: 1000, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 3, h: 4 }, minSize: { w: 3, h: 2 }, maxSize: { w: 3, h: 6 }, kind: 'theme', previewFamily: 'theme' },
  { id: 't5_master_panel', title: '마스터 패널', tier: 5, price: 1000, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 3, h: 4 }, minSize: { w: 3, h: 2 }, maxSize: { w: 3, h: 6 }, kind: 'placeholder', previewFamily: 'board' },
  { id: 't5_final_record', title: '최종 기록 보드', tier: 5, price: 1000, shop: true, placeholder: true, supports: ['challenge', 'habit'], defaultSize: { w: 3, h: 4 }, minSize: { w: 3, h: 2 }, maxSize: { w: 3, h: 6 }, kind: 'placeholder', previewFamily: 'board' },

  {
 id: 'profile-image',
 title: '프로필 이미지',
 tier: 0,
 price: 0,
 shop: false,
 defaultOwned: true,
 supports: ['recordRoom'],
 defaultSize: { w: 2, h: 2 },
 minSize: { w: 2, h: 2 },
 maxSize: { w: 3, h: 3 },
 kind: 'recordRoom',
 previewFamily: 'profile',
 widgetPreview: {
 family: WIDGET_PREVIEW_FAMILIES.PROFILE,
 variant: WIDGET_PREVIEW_VARIANTS.AVATAR,
 seed: 201,
 features: ['프로필 이미지', '사진 선택'],
 },
 },
  {
 id: 'profile-info',
 title: '내 정보',
 tier: 0,
 price: 0,
 shop: false,
 defaultOwned: true,
 supports: ['recordRoom'],
 defaultSize: { w: 4, h: 2 },
 minSize: { w: 3, h: 2 },
 maxSize: { w: 6, h: 3 },
 kind: 'recordRoom',
 previewFamily: 'profile',
 widgetPreview: {
 family: WIDGET_PREVIEW_FAMILIES.PROFILE,
 variant: WIDGET_PREVIEW_VARIANTS.PROFILE_SUMMARY,
 seed: 202,
 features: ['이름', '대표 문장', '소개'],
 },
 },

  {
 id: 'total-cards',
 title: '현재 도전/기록',
 tier: 0,
 price: 0,
 shop: false,
 defaultOwned: true,
 supports: ['recordRoom'],
 defaultSize: { w: 3, h: 2 },
 minSize: { w: 2, h: 2 },
 maxSize: { w: 3, h: 3 },
 kind: 'recordRoomKpi',
 previewFamily: 'kpi',
 widgetPreview: {
 family: WIDGET_PREVIEW_FAMILIES.KPI,
 variant: WIDGET_PREVIEW_VARIANTS.DUAL_COUNT,
 seed: 211,
 features: ['도전 수', '기록 수', '전체 합계'],
 unitLabel: '개',
 },
 },
  {
 id: 'hall-count',
 title: '명예의 전당',
 tier: 0,
 price: 0,
 shop: false,
 defaultOwned: true,
 supports: ['recordRoom'],
 defaultSize: { w: 3, h: 2 },
 minSize: { w: 2, h: 2 },
 maxSize: { w: 3, h: 3 },
 kind: 'recordRoomKpi',
 previewFamily: 'kpi',
 widgetPreview: {
 family: WIDGET_PREVIEW_FAMILIES.KPI,
 variant: WIDGET_PREVIEW_VARIANTS.COUNT_WITH_NOTE,
 seed: 212,
 features: ['완료 수', '보조 설명'],
 unitLabel: '개',
 },
 },
  {
 id: 'stars',
 title: '별 갯수',
 tier: 0,
 price: 0,
 shop: false,
 defaultOwned: true,
 supports: ['recordRoom'],
 defaultSize: { w: 3, h: 2 },
 minSize: { w: 2, h: 2 },
 maxSize: { w: 3, h: 3 },
 kind: 'recordRoomKpi',
 previewFamily: 'kpi',
 widgetPreview: {
 family: WIDGET_PREVIEW_FAMILIES.KPI,
 variant: WIDGET_PREVIEW_VARIANTS.COUNT_WITH_ICON,
 seed: 213,
 features: ['별 아이콘', '보유 수치'],
 unitLabel: '개',
 },
 },
  {
 id: 'today-count',
 title: '오늘 기록',
 tier: 0,
 price: 0,
 shop: false,
 defaultOwned: true,
 supports: ['recordRoom'],
 defaultSize: { w: 3, h: 2 },
 minSize: { w: 2, h: 2 },
 maxSize: { w: 3, h: 3 },
 kind: 'recordRoomKpi',
 previewFamily: 'kpi',
 widgetPreview: {
 family: WIDGET_PREVIEW_FAMILIES.KPI,
 variant: WIDGET_PREVIEW_VARIANTS.COUNT_WITH_NOTE,
 seed: 214,
 features: ['오늘 수치', '인증 기록'],
 unitLabel: '회',
 },
 },
  {
 id: 'deleted-count',
 title: '삭제 갯수',
 tier: 0,
 price: 0,
 shop: false,
 defaultOwned: true,
 supports: ['recordRoom'],
 defaultSize: { w: 3, h: 2 },
 minSize: { w: 2, h: 2 },
 maxSize: { w: 3, h: 3 },
 kind: 'recordRoomKpi',
 previewFamily: 'kpi',
 widgetPreview: {
 family: WIDGET_PREVIEW_FAMILIES.KPI,
 variant: WIDGET_PREVIEW_VARIANTS.COUNT_WITH_NOTE,
 seed: 215,
 features: ['삭제 수치', '휴지통 기준'],
 unitLabel: '개',
 },
 },
  {
 id: 'expired-fail',
 title: '만료 실패',
 tier: 0,
 price: 0,
 shop: false,
 defaultOwned: true,
 supports: ['recordRoom'],
 defaultSize: { w: 3, h: 2 },
 minSize: { w: 2, h: 2 },
 maxSize: { w: 3, h: 3 },
 kind: 'recordRoomKpi',
 previewFamily: 'kpi',
 widgetPreview: {
 family: WIDGET_PREVIEW_FAMILIES.KPI,
 variant: WIDGET_PREVIEW_VARIANTS.COUNT_WITH_NOTE,
 seed: 216,
 features: ['실패 수치', '미완료 만료'],
 unitLabel: '개',
 },
 },

  { id: 'weekly-bars', title: '주간 막대', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 4 }, maxSize: { w: 6, h: 6 }, kind: 'recordRoomChart', previewFamily: 'bar' },
  { id: 'ratio-donut', title: '도전/기록 비율', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 3, h: 4 }, minSize: { w: 3, h: 4 }, maxSize: { w: 6, h: 5 }, kind: 'recordRoomChart', previewFamily: 'donut' },
  { id: 'token-line', title: '토큰 추이', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 3, h: 4 }, minSize: { w: 3, h: 4 }, maxSize: { w: 6, h: 5 }, kind: 'recordRoomChart', previewFamily: 'line' },
  { id: 'calendar', title: '인증 달력', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 5 }, maxSize: { w: 6, h: 7 }, kind: 'recordRoomChart', previewFamily: 'calendar' },
  { id: 'heatmap', title: '인증 시간 패턴', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 5 }, maxSize: { w: 6, h: 7 }, kind: 'recordRoomChart', previewFamily: 'heatmap' },
  { id: 'monthly-bars', title: '월간 기록', tier: 0, price: 0, shop: false, defaultOwned: true, supports: ['recordRoom'], defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 4 }, maxSize: { w: 6, h: 6 }, kind: 'recordRoomChart', previewFamily: 'bar' },

  {
 id: 'hall-battery',
 title: '명예의 전당 목표',
 tier: 0,
 price: 0,
 shop: false,
 defaultOwned: true,
 supports: ['recordRoom'],
 defaultSize: { w: 6, h: 3 },
 minSize: { w: 4, h: 3 },
 maxSize: { w: 6, h: 5 },
 kind: 'recordRoom',
 previewFamily: 'battery',
 widgetPreview: {
 family: WIDGET_PREVIEW_FAMILIES.GOAL,
 variant: WIDGET_PREVIEW_VARIANTS.BATTERY,
 seed: 221,
 features: ['현재 완료', '목표', '진행 트랙'],
 },
 },
  {
 id: 'connect-status',
 title: '커넥트 상태',
 tier: 0,
 price: 0,
 shop: false,
 defaultOwned: true,
 supports: ['recordRoom'],
 defaultSize: { w: 6, h: 3 },
 minSize: { w: 4, h: 3 },
 maxSize: { w: 6, h: 4 },
 kind: 'recordRoom',
 previewFamily: 'connect',
 widgetPreview: {
 family: WIDGET_PREVIEW_FAMILIES.STATUS,
 variant: WIDGET_PREVIEW_VARIANTS.CONNECTION_LIST,
 seed: 222,
 features: ['연동 항목', '상태 표시', '목록'],
 },
 },
  {
 id: 'memo',
 title: '메모',
 tier: 0,
 price: 0,
 shop: false,
 defaultOwned: true,
 supports: ['recordRoom'],
 defaultSize: { w: 6, h: 3 },
 minSize: { w: 4, h: 3 },
 maxSize: { w: 6, h: 5 },
 kind: 'recordRoom',
 previewFamily: 'memo',
 widgetPreview: {
 family: WIDGET_PREVIEW_FAMILIES.MEMO,
 variant: WIDGET_PREVIEW_VARIANTS.MEMO_LINES,
 seed: 223,
 features: ['첫 줄 강조', '메모 줄', '입력 내용'],
 },
 },
  {
 id: 'record-room-card-list',
 title: '내 기록실 카드목록',
 tier: 0,
 price: 0,
 shop: false,
 defaultOwned: true,
 supports: ['recordRoom'],
 defaultSize: { w: 6, h: 6 },
 minSize: { w: 6, h: 5 },
 maxSize: { w: 6, h: 10 },
 kind: 'recordRoomList',
 previewFamily: 'board',
 widgetPreview: {
 family: WIDGET_PREVIEW_FAMILIES.LIST,
 variant: WIDGET_PREVIEW_VARIANTS.TABBED_LIST,
 seed: 224,
 features: ['탭', '카드 행', '상태 표시'],
 },
 },
];

export const getWidgetById = (id) =>
  WIDGET_CATALOG.find((item) => item.id === id) || null;

export const getDefaultWidgetIds = () =>
  WIDGET_CATALOG.filter((item) => item.defaultOwned).map((item) => item.id);

export const getDefaultWidgets = (target = DASHBOARD_TARGETS.CHALLENGE) =>
  WIDGET_CATALOG.filter((item) => item.defaultOwned && item.supports.includes(target));

export const getShopWidgets = () =>
  WIDGET_CATALOG.filter((item) => item.shop && ACTUAL_PURCHASABLE_DASHBOARD_GRAPH_WIDGET_IDS.includes(item.id));

export const getDashboardEditableWidgets = (target = DASHBOARD_TARGETS.CHALLENGE) =>
  target === DASHBOARD_TARGETS.RECORD_ROOM
    ? WIDGET_CATALOG.filter((item) => supportsWidgetTarget(item, target))
    : WIDGET_CATALOG.filter((item) => ACTUAL_DASHBOARD_GRAPH_WIDGET_IDS.includes(item.id) && supportsWidgetTarget(item, target));

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
 // goal_black_box는 기본 배치에서 제거 (구매 필요)
 }

 return base.filter((item) => {
 const widget = getWidgetById(item.widgetId);
 return supportsWidgetTarget(widget, target);
 });
};
