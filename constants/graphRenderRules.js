// OFFICIAL_GRAPH_RENDER_RULE: docs/GRAPH_RENDER_RULE.md
// Actual dashboard graph render rules.
// This file defines default roles, editable color slots, and shape rules.
// It is intentionally independent from graph preview rules and app common tokens.

export const GRAPH_RENDER_RULE_VERSION = 1;

export const GRAPH_RENDER_GRAPH_IDS = Object.freeze({
  OVERALL_PROGRESS: 'overall_progress',
  GOAL_BLACK_BOX: 'goal_black_box',
  MONTH_CALENDAR: 'month_calendar',
  WEEKLY_BAR: 'weekly_bar',
  LINE_COUNT_CUMULATIVE: 'line_count_cumulative',
  LINE_MINUTES: 'line_minutes',
  GRASS_GRAPH: 'grass_graph',
  HEALTH_STEPS_WEEKLY: 'health_steps_weekly',
  HEALTH_STEPS_TREND: 'health_steps_trend',
  HEALTH_EXERCISE_MINUTES_TREND: 'health_exercise_minutes_trend',
  HEALTH_DISTANCE_TREND: 'health_distance_trend',
  HEALTH_STEPS_GOAL_RATE: 'health_steps_goal_rate',
  HEALTH_STEPS_CUMULATIVE: 'health_steps_cumulative',
  HEALTH_EXERCISE_WEEKLY_MINUTES: 'health_exercise_weekly_minutes',
  HEALTH_DISTANCE_WEEKLY: 'health_distance_weekly',
  HEALTH_DISTANCE_CUMULATIVE: 'health_distance_cumulative',
  HEALTH_ACTIVE_CALORIES_TREND: 'health_active_calories_trend',
  HEALTH_SLEEP_HOURS_TREND: 'health_sleep_hours_trend',
  HEALTH_SLEEP_RHYTHM: 'health_sleep_rhythm',
  HEALTH_HEART_RATE_TREND: 'health_heart_rate_trend',
  HEALTH_WEIGHT_TREND: 'health_weight_trend',
  HEALTH_BODY_FAT_TREND: 'health_body_fat_trend',
  HEALTH_BMI_TREND: 'health_bmi_trend',
});

export const GRAPH_RENDER_FAMILIES = Object.freeze({
  OVERALL_PROGRESS: 'overallProgress',
  CALENDAR: 'calendar',
  WEEKLY_BAR: 'weeklyBar',
  LINE: 'line',
  GRASS: 'grass',
  PROGRESS_BAR: 'progressBar',
  METRIC_BAR: 'metricBar',
  STACKED_SEGMENT: 'stackedSegment',
  INFO_CARD: 'infoCard',
});

export const GRAPH_RENDER_GRAPH_FAMILY_BY_ID = Object.freeze({
  [GRAPH_RENDER_GRAPH_IDS.OVERALL_PROGRESS]: GRAPH_RENDER_FAMILIES.OVERALL_PROGRESS,
  [GRAPH_RENDER_GRAPH_IDS.GOAL_BLACK_BOX]: GRAPH_RENDER_FAMILIES.INFO_CARD,
  [GRAPH_RENDER_GRAPH_IDS.MONTH_CALENDAR]: GRAPH_RENDER_FAMILIES.CALENDAR,
  [GRAPH_RENDER_GRAPH_IDS.WEEKLY_BAR]: GRAPH_RENDER_FAMILIES.WEEKLY_BAR,
  [GRAPH_RENDER_GRAPH_IDS.LINE_COUNT_CUMULATIVE]: GRAPH_RENDER_FAMILIES.LINE,
  [GRAPH_RENDER_GRAPH_IDS.LINE_MINUTES]: GRAPH_RENDER_FAMILIES.LINE,
  [GRAPH_RENDER_GRAPH_IDS.GRASS_GRAPH]: GRAPH_RENDER_FAMILIES.GRASS,
  [GRAPH_RENDER_GRAPH_IDS.HEALTH_STEPS_WEEKLY]: GRAPH_RENDER_FAMILIES.WEEKLY_BAR,
  [GRAPH_RENDER_GRAPH_IDS.HEALTH_STEPS_TREND]: GRAPH_RENDER_FAMILIES.LINE,
  [GRAPH_RENDER_GRAPH_IDS.HEALTH_EXERCISE_MINUTES_TREND]: GRAPH_RENDER_FAMILIES.LINE,
  [GRAPH_RENDER_GRAPH_IDS.HEALTH_DISTANCE_TREND]: GRAPH_RENDER_FAMILIES.LINE,
  [GRAPH_RENDER_GRAPH_IDS.HEALTH_ACTIVE_CALORIES_TREND]: GRAPH_RENDER_FAMILIES.LINE,
  [GRAPH_RENDER_GRAPH_IDS.HEALTH_SLEEP_HOURS_TREND]: GRAPH_RENDER_FAMILIES.LINE,
  [GRAPH_RENDER_GRAPH_IDS.HEALTH_HEART_RATE_TREND]: GRAPH_RENDER_FAMILIES.LINE,
  [GRAPH_RENDER_GRAPH_IDS.HEALTH_WEIGHT_TREND]: GRAPH_RENDER_FAMILIES.LINE,
  [GRAPH_RENDER_GRAPH_IDS.HEALTH_BODY_FAT_TREND]: GRAPH_RENDER_FAMILIES.LINE,
  [GRAPH_RENDER_GRAPH_IDS.HEALTH_BMI_TREND]: GRAPH_RENDER_FAMILIES.LINE,
  [GRAPH_RENDER_GRAPH_IDS.HEALTH_STEPS_GOAL_RATE]: GRAPH_RENDER_FAMILIES.PROGRESS_BAR,
  [GRAPH_RENDER_GRAPH_IDS.HEALTH_STEPS_CUMULATIVE]: GRAPH_RENDER_FAMILIES.METRIC_BAR,
  [GRAPH_RENDER_GRAPH_IDS.HEALTH_EXERCISE_WEEKLY_MINUTES]: GRAPH_RENDER_FAMILIES.METRIC_BAR,
  [GRAPH_RENDER_GRAPH_IDS.HEALTH_DISTANCE_WEEKLY]: GRAPH_RENDER_FAMILIES.METRIC_BAR,
  [GRAPH_RENDER_GRAPH_IDS.HEALTH_DISTANCE_CUMULATIVE]: GRAPH_RENDER_FAMILIES.METRIC_BAR,
  [GRAPH_RENDER_GRAPH_IDS.HEALTH_SLEEP_RHYTHM]: GRAPH_RENDER_FAMILIES.STACKED_SEGMENT,
});

export const GRAPH_RENDER_DEFAULT_FAMILY = GRAPH_RENDER_FAMILIES.LINE;

export const GRAPH_RENDER_UNKNOWN_GRAPH_ID_BEHAVIOR = Object.freeze({
  fallbackFamily: GRAPH_RENDER_DEFAULT_FAMILY,
  shouldWarnInDevelopment: true,
  reason: 'Unknown graphId falls back to the line family until it is explicitly mapped or a new family is created.',
});

export const GRAPH_RENDER_FAMILY_EXTENSION_REQUIREMENTS = Object.freeze([
  'GRAPH_RENDER_FAMILIES',
  'GRAPH_RENDER_GRAPH_FAMILY_BY_ID',
  'GRAPH_RENDER_EDITABLE_COLOR_SLOTS',
  'GRAPH_RENDER_LAYOUT_RULES',
  'GRAPH_RENDER_INTERNAL_COLOR_MAP',
]);

export const GRAPH_RENDER_NEW_GRAPH_DECISION_RULES = Object.freeze({
  reuseExistingFamily: 'If the new graph shares geometry, interaction, data shape, and editable color slots with an existing family, only add graphId mapping.',
  createNewFamily: 'If the new graph needs different geometry, different interaction, different data shape, or different editable color slots, create a new family.',
});

export const GRAPH_RENDER_COLOR_ROLES = Object.freeze({
  primary: '#0A0A0A',
  secondary: '#525252',
  tertiary: '#737373',
  axis: '#D4D4D4',
  track: '#E5E5E5',
  surface: '#FFFFFF',
  surfaceMuted: '#F5F5F5',
  empty: '#FAFAFA',
  inverse: '#FFFFFF',
  highlight: '#0A0A0A',
  grassLevel0: '#F3F4F6',
  grassLevel1: '#E5E7EB',
  grassLevel2: '#A0A0A0',
  grassLevel3: '#555555',
  grassLevel4: '#111111',
  grassMonthLabel: '#6B7280',
  grassArrow: '#111111',
  calendarCertified: '#111111',
  calendarCertifiedText: '#FFFFFF',
  calendarActiveDateText: '#111111',
  calendarFutureDateText: '#777777',
  calendarEmptyDateText: '#D1D5DB',
  calendarTodayUncertifiedFill: '#D1D5DB',
  calendarTodayUncertifiedText: '#000000',
  calendarHighlight: '#FFD700',

  overallProgressFill: '#111111',
  overallProgressTrack: '#D1D5DB',
  overallProgressCenterFill: '#111111',
  overallProgressLabelText: '#FFFFFF',

  progressBarFill: '#3B82F6',
  progressBarTrack: '#E5E7EB',
  progressBarSuccess: '#111111',
  progressBarValueText: '#111111',
  progressBarCaptionText: '#6B7280',
  progressBarEmptyText: '#9CA3AF',

  metricBarFill: '#D1D5DB',
  metricBarLatestFill: '#111111',
  metricBarGoalLine: '#D1D5DB',
  metricBarValueText: '#111111',
  metricBarCaptionText: '#9CA3AF',
  metricBarEmptyText: '#9CA3AF',

  stackedSegmentTrack: '#E5E7EB',
  stackedSegmentPrimary: '#111111',
  stackedSegmentSecondary: '#525252',
  stackedSegmentTertiary: '#9CA3AF',
  stackedSegmentMuted: '#D1D5DB',
  stackedSegmentValueText: '#111111',
  stackedSegmentCaptionText: '#6B7280',
  stackedSegmentEmptyText: '#9CA3AF',

  infoCardTitleText: '#111111',
  infoCardBodyText: '#525252',
  infoCardCaptionText: '#9CA3AF',
  infoCardAccentText: '#111111',
  infoCardSurfaceFill: '#FFFFFF',
  infoCardDivider: '#E5E7EB',
  infoCardEmptyText: '#9CA3AF',
});

export const GRAPH_RENDER_EDITABLE_COLOR_SLOTS = Object.freeze({
  [GRAPH_RENDER_FAMILIES.OVERALL_PROGRESS]: Object.freeze({
    progress: Object.freeze({
      label: '진행률',
      defaultRole: 'overallProgressFill',
      description: '전체 진행률 원형 그래프의 채워진 영역입니다.',
    }),
    track: Object.freeze({
      label: '남은 영역',
      defaultRole: 'overallProgressTrack',
      description: '아직 채워지지 않은 진행률 배경입니다.',
    }),
    centerFill: Object.freeze({
      label: '중앙 원',
      defaultRole: 'overallProgressCenterFill',
      description: '진행률 숫자 뒤의 중앙 원 배경입니다.',
    }),
    label: Object.freeze({
      label: '숫자',
      defaultRole: 'overallProgressLabelText',
      description: '진행률 숫자 텍스트입니다.',
    }),
  }),

  [GRAPH_RENDER_FAMILIES.CALENDAR]: Object.freeze({
    certifiedDay: Object.freeze({
      label: '인증일 배경',
      defaultRole: 'calendarCertified',
      description: '인증이 완료된 날짜의 배경입니다.',
    }),
    certifiedText: Object.freeze({
      label: '인증일 글씨',
      defaultRole: 'calendarCertifiedText',
      description: '인증이 완료된 날짜의 글씨입니다.',
    }),
    activeDateText: Object.freeze({
      label: '활성 날짜 글씨',
      defaultRole: 'calendarActiveDateText',
      description: '기간 안의 일반 날짜 글씨입니다.',
    }),
    futureDateText: Object.freeze({
      label: '미래 날짜 글씨',
      defaultRole: 'calendarFutureDateText',
      description: '기간 안이지만 아직 미래인 날짜 글씨입니다.',
    }),
    emptyDateText: Object.freeze({
      label: '빈 날짜 글씨',
      defaultRole: 'calendarEmptyDateText',
      description: '기간 밖 또는 비활성 날짜 글씨입니다.',
    }),
    today: Object.freeze({
      label: '오늘 배경',
      defaultRole: 'calendarTodayUncertifiedFill',
      description: '오늘 날짜가 아직 인증되지 않았을 때의 배경입니다.',
    }),
    todayText: Object.freeze({
      label: '오늘 글씨',
      defaultRole: 'calendarTodayUncertifiedText',
      description: '오늘 날짜가 아직 인증되지 않았을 때의 글씨입니다.',
    }),
    highlight: Object.freeze({
      label: '선택 강조',
      defaultRole: 'calendarHighlight',
      description: '선택된 날짜 또는 외부에서 강조된 날짜의 테두리입니다.',
    }),
  }),

  [GRAPH_RENDER_FAMILIES.WEEKLY_BAR]: Object.freeze({
    durationBar: Object.freeze({
      label: '시간 막대',
      defaultRole: 'primary',
      description: '시간 기록이 있는 날의 주 막대 색입니다.',
    }),
    countBar: Object.freeze({
      label: '횟수 막대',
      defaultRole: 'axis',
      description: '시간 없이 횟수만 있는 날의 보조 막대 색입니다.',
    }),
    text: Object.freeze({
      label: '글씨',
      defaultRole: 'secondary',
      description: '요일, 날짜, 횟수, 시간 텍스트 색입니다.',
    }),
    accent: Object.freeze({
      label: '오늘/강조',
      defaultRole: 'primary',
      description: '오늘 표시와 현재 주 강조에 쓰는 색입니다.',
    }),
  }),

  [GRAPH_RENDER_FAMILIES.LINE]: Object.freeze({
    line: Object.freeze({
      label: '선',
      defaultRole: 'primary',
      description: '선형그래프의 주 선 색입니다.',
    }),
    marker: Object.freeze({
      label: '점',
      defaultRole: 'primary',
      description: '끝점과 선택 점의 테두리 색입니다.',
    }),
    text: Object.freeze({
      label: '글씨',
      defaultRole: 'secondary',
      description: '축 라벨과 보조 텍스트 색입니다.',
    }),
    tooltip: Object.freeze({
      label: '선택 라벨',
      defaultRole: 'primary',
      description: '선택된 값 라벨의 배경 색입니다.',
    }),
  }),

  [GRAPH_RENDER_FAMILIES.GRASS]: Object.freeze({
    level0: Object.freeze({
      label: '빈 칸',
      defaultRole: 'grassLevel0',
      description: '잔디그래프의 범위 밖 또는 가장 약한 빈 칸 색입니다.',
    }),
    level1: Object.freeze({
      label: '약한 칸',
      defaultRole: 'grassLevel1',
      description: '잔디그래프에서 기록이 없거나 미래 날짜에 쓰는 약한 칸 색입니다.',
    }),
    level2: Object.freeze({
      label: '기록 1단계',
      defaultRole: 'grassLevel2',
      description: '잔디그래프의 첫 번째 기록 단계 색입니다.',
    }),
    level3: Object.freeze({
      label: '기록 2단계',
      defaultRole: 'grassLevel3',
      description: '잔디그래프의 두 번째 기록 단계 색입니다.',
    }),
    level4: Object.freeze({
      label: '기록 3단계',
      defaultRole: 'grassLevel4',
      description: '잔디그래프의 가장 강한 기록 단계 색입니다.',
    }),
    monthLabel: Object.freeze({
      label: '월 글씨',
      defaultRole: 'grassMonthLabel',
      description: '잔디그래프 상단 월 라벨 색입니다.',
    }),
    arrow: Object.freeze({
      label: '화살표',
      defaultRole: 'grassArrow',
      description: '잔디그래프 좌우 이동 화살표 색입니다.',
    }),
  }),

  [GRAPH_RENDER_FAMILIES.PROGRESS_BAR]: Object.freeze({
    progressFill: Object.freeze({
      label: '진행 바',
      defaultRole: 'progressBarFill',
      description: '목표 달성률 가로 바의 채워진 영역입니다.',
    }),
    trackFill: Object.freeze({
      label: '남은 바',
      defaultRole: 'progressBarTrack',
      description: '목표 달성률 가로 바의 배경 영역입니다.',
    }),
    successFill: Object.freeze({
      label: '달성 색',
      defaultRole: 'progressBarSuccess',
      description: '목표를 달성했을 때 쓰는 진행 바 색입니다.',
    }),
    valueText: Object.freeze({
      label: '큰 숫자',
      defaultRole: 'progressBarValueText',
      description: '목표 달성률의 큰 숫자 텍스트입니다.',
    }),
    captionText: Object.freeze({
      label: '보조 설명',
      defaultRole: 'progressBarCaptionText',
      description: '현재값과 목표값을 설명하는 보조 텍스트입니다.',
    }),
    emptyText: Object.freeze({
      label: '빈 상태',
      defaultRole: 'progressBarEmptyText',
      description: '데이터가 없을 때 표시하는 텍스트입니다.',
    }),
  }),

  [GRAPH_RENDER_FAMILIES.METRIC_BAR]: Object.freeze({
    barFill: Object.freeze({
      label: '일반 막대',
      defaultRole: 'metricBarFill',
      description: '수치형 막대 카드의 일반 막대 색입니다.',
    }),
    latestBarFill: Object.freeze({
      label: '최신 막대',
      defaultRole: 'metricBarLatestFill',
      description: '가장 최근 값 막대의 강조 색입니다.',
    }),
    goalLine: Object.freeze({
      label: '목표선',
      defaultRole: 'metricBarGoalLine',
      description: '목표 기준선 또는 보조 기준선 색입니다.',
    }),
    valueText: Object.freeze({
      label: '값글씨',
      defaultRole: 'metricBarValueText',
      description: '최신값 또는 대표값 텍스트 색입니다.',
    }),
    captionText: Object.freeze({
      label: '보조 글씨',
      defaultRole: 'metricBarCaptionText',
      description: '기간, 단위, 설명 텍스트 색입니다.',
    }),
    emptyText: Object.freeze({
      label: '빈 상태',
      defaultRole: 'metricBarEmptyText',
      description: '데이터가 없을 때 표시하는 텍스트입니다.',
    }),
  }),

  [GRAPH_RENDER_FAMILIES.STACKED_SEGMENT]: Object.freeze({
    trackFill: Object.freeze({
      label: '전체 배경',
      defaultRole: 'stackedSegmentTrack',
      description: '비율 조각 바의 전체 배경 색입니다.',
    }),
    segmentPrimary: Object.freeze({
      label: '강한 구간',
      defaultRole: 'stackedSegmentPrimary',
      description: '가장 강한 구간 또는 대표 조각 색입니다.',
    }),
    segmentSecondary: Object.freeze({
      label: '중간 구간',
      defaultRole: 'stackedSegmentSecondary',
      description: '중간 강도의 조각 색입니다.',
    }),
    segmentTertiary: Object.freeze({
      label: '약한 구간',
      defaultRole: 'stackedSegmentTertiary',
      description: '약한 조각 색입니다.',
    }),
    segmentMuted: Object.freeze({
      label: '흐린 구간',
      defaultRole: 'stackedSegmentMuted',
      description: '흐리게 표시할 조각 색입니다.',
    }),
    valueText: Object.freeze({
      label: '값 글씨',
      defaultRole: 'stackedSegmentValueText',
      description: '수면 시간 등 대표값 텍스트 색입니다.',
    }),
    captionText: Object.freeze({
      label: '보조 글씨',
      defaultRole: 'stackedSegmentCaptionText',
      description: '범례와 보조 설명 텍스트 색입니다.',
    }),
    emptyText: Object.freeze({
      label: '빈 상태',
      defaultRole: 'stackedSegmentEmptyText',
      description: '데이터가 없을 때 표시하는 텍스트입니다.',
    }),
  }),

  [GRAPH_RENDER_FAMILIES.INFO_CARD]: Object.freeze({
    titleText: Object.freeze({
      label: '제목',
      defaultRole: 'infoCardTitleText',
      description: '정보 카드 제목 텍스트 색입니다.',
    }),
    bodyText: Object.freeze({
      label: '본문',
      defaultRole: 'infoCardBodyText',
      description: '정보 카드 본문 텍스트 색입니다.',
    }),
    captionText: Object.freeze({
      label: '보조 설명',
      defaultRole: 'infoCardCaptionText',
      description: '정보 카드 보조 설명 텍스트 색입니다.',
    }),
    accentText: Object.freeze({
      label: '강조 글씨',
      defaultRole: 'infoCardAccentText',
      description: '보상, 목표 등 강조 텍스트 색입니다.',
    }),
    surfaceFill: Object.freeze({
      label: '내부 배경',
      defaultRole: 'infoCardSurfaceFill',
      description: '정보 카드 내부 보조 배경 색입니다.',
    }),
    divider: Object.freeze({
      label: '구분선',
      defaultRole: 'infoCardDivider',
      description: '정보 카드 내부 구분선 색입니다.',
    }),
    emptyText: Object.freeze({
      label: '빈 상태',
      defaultRole: 'infoCardEmptyText',
      description: '정보가 없을 때 표시하는 텍스트입니다.',
    }),
  }),
});

export const GRAPH_RENDER_LAYOUT_RULES = Object.freeze({
  [GRAPH_RENDER_FAMILIES.OVERALL_PROGRESS]: Object.freeze({
    bodyBaseHeight: 146,
    baseSize: 104,
    baseStroke: 11,
    minScale: 0.75,
    maxScale: 1.45,
    safePadBase: 4,
    safePadMin: 3,
    safePadMax: 8,
    minStroke: 3,
    labelBaseFontSize: 20,
    labelMinFontSize: 11,
    labelMaxFontSize: 21,
    labelLineGap: 2,
    innerRadiusFactor: 1.25,
    minInnerRadius: 2,
  }),

  [GRAPH_RENDER_FAMILIES.CALENDAR]: Object.freeze({
    bodyBaseHeight: 142,
    dowHeight: 14,
    dowFontSize: 10.5,
    gridTopGap: 3,
    bottomPad: 4,
    cellMarginV: 1,
    cellOuterMinHeight: 8,
    cellHeightMin: 8,
    cellFontBase: 10.1,
    cellFontMin: 9.7,
    cellFontMax: 11.4,
    cellFontUpperBase: 11.8,
    cellFontUpperMin: 10.2,
    cellFontUpperMax: 11.5,
    cellLineGap: 2,
    badgeRadius: 8,
    badgeFontBase: 9.2,
    badgeFontMin: 8.9,
    badgeFontMax: 10.3,
    badgeFontUpperBase: 11,
    badgeFontUpperMin: 9.5,
    badgeFontUpperMax: 10.8,
    badgeLineGap: 2,
    badgeMinWidthBase: 14,
    badgeMinWidthMin: 12,
    badgeMinWidthMax: 17,
    badgeMinWidthUpperBase: 18.2,
    badgeMinWidthUpperMin: 15,
    badgeMinWidthUpperMax: 25,
    badgePaddingVBase: 1.2,
    badgePaddingVMin: 1,
    badgePaddingVMax: 2.2,
    compactScaleThreshold: 0.85,
    compactBadgeTextTranslateY: 0.7,
    highlightBorderWidth: 2,
    todayBorderWidth: 2,
  }),

  [GRAPH_RENDER_FAMILIES.WEEKLY_BAR]: Object.freeze({
    baseViewHeight: 168,
    fallbackViewHeight: 168,
    barWidth: 16,
    barRadius: 4,
    segmentGap: 2,
    emptyDotSize: 4,
    pagerDotSize: 5,
    pagerDotActiveSize: 6,
    pagerDotHitWidth: 12,
    pagerArrowHitWidth: 22,
    pagerArrowSize: 15,
  }),

  [GRAPH_RENDER_FAMILIES.LINE]: Object.freeze({
    defaultHeight: 185,
    dashboardBaseHeight: 168,
    dashboardPlotTop: 10,
    dashboardPlotBottom: 30,
    defaultPlotInset: 12,
    defaultPlotTop: 16,
    defaultPlotBottom: 42,
    strokeWidth: 1.6,
    axisStrokeWidth: 1,
    markerRadius: 3.2,
    markerStrokeWidth: 2,
    selectedMarkerRadius: 3.8,
    selectedMarkerStrokeWidth: 2.1,
    areaGap: 6,
    axisLabelFontSize: 10,
    axisLabelYOffset: 16,
    tooltipFontSize: 10,
    tooltipHeight: 18,
    tooltipRadius: 6,
    tooltipBottomPad: 6,
    tooltipCharWidth: 5.5,
    tooltipWidthPad: 10,
    tooltipMinWidth: 70,
    tooltipMaxWidth: 130,
    tooltipGap: 8,
    tooltipEndGap: 10,
    pagerDotRadius: 4,
    pagerDotYOffset: 14,
    pagerDotXGap: 10,
    touchRadius: 16,
  }),

  [GRAPH_RENDER_FAMILIES.GRASS]: Object.freeze({
    baseHeight: 168,
    rows: 7,
    topLabelHeight: 18,
    topLabelGap: 4,
    minCellSize: 8,
    maxCellSize: 18,
    minCellGap: 2,
    maxCellGap: 4,
    cellRadius: 2,
    monthFontSize: 10.5,
    monthLineHeight: 13,
    arrowSize: 15,
    waveWidth: 4,
    waveSpeed: 0.02,
    waveDiagonal: 0.6,
  }),

  [GRAPH_RENDER_FAMILIES.PROGRESS_BAR]: Object.freeze({
    bodyBaseHeight: 96,
    valueFontSize: 28,
    captionFontSize: 10,
    barHeight: 6,
    barRadius: 3,
    barWidthRatio: 0.8,
    gapAfterValue: 4,
    gapBeforeBar: 8,
  }),

  [GRAPH_RENDER_FAMILIES.METRIC_BAR]: Object.freeze({
    bodyBaseHeight: 120,
    chartMinHeight: 40,
    chartBottomReserved: 40,
    barWidth: 14,
    cumulativeBarWidth: 20,
    barRadius: 4,
    minBarHeight: 6,
    valueFontSize: 11,
    captionFontSize: 10,
  }),

  [GRAPH_RENDER_FAMILIES.STACKED_SEGMENT]: Object.freeze({
    bodyBaseHeight: 96,
    segmentHeight: 18,
    segmentRadius: 9,
    labelGap: 8,
    legendGap: 6,
    captionFontSize: 10,
    valueFontSize: 12,
    legendFontSize: 9,
  }),

  [GRAPH_RENDER_FAMILIES.INFO_CARD]: Object.freeze({
    bodyBaseHeight: 72,
    titleFontSize: 13,
    bodyFontSize: 12,
    captionFontSize: 10,
    titleLineHeight: 17,
    bodyLineHeight: 16,
    verticalGap: 5,
    horizontalPadding: 12,
  }),
});

export const GRAPH_RENDER_INTERNAL_COLOR_MAP = Object.freeze({
  [GRAPH_RENDER_FAMILIES.OVERALL_PROGRESS]: Object.freeze({
    progressFill: 'progress',
    trackFill: 'track',
    centerFill: 'centerFill',
    labelText: 'label',
  }),

  [GRAPH_RENDER_FAMILIES.CALENDAR]: Object.freeze({
    certifiedFill: 'certifiedDay',
    certifiedText: 'certifiedText',
    activeDateText: 'activeDateText',
    futureDay: 'futureDateText',
    emptyDay: 'emptyDateText',
    todayFill: 'today',
    todayText: 'todayText',
    activeTodayText: 'certifiedText',
    highlightBorder: 'highlight',
  }),

  [GRAPH_RENDER_FAMILIES.WEEKLY_BAR]: Object.freeze({
    durationBarFill: 'durationBar',
    countBarFill: 'countBar',
    emptyDotFill: 'countBar',
    todayEmptyDotFill: 'accent',
    text: 'text',
    todayText: 'accent',
    pagerActive: 'accent',
    pagerInactive: 'countBar',
  }),

  [GRAPH_RENDER_FAMILIES.LINE]: Object.freeze({
    lineStroke: 'line',
    axisStroke: 'axis',
    labelText: 'text',
    markerFill: 'surface',
    markerStroke: 'marker',
    tooltipFill: 'tooltip',
    tooltipText: 'inverse',
    pagerActive: 'line',
    pagerInactive: 'axis',
  }),

  [GRAPH_RENDER_FAMILIES.GRASS]: Object.freeze({
    level0: 'level0',
    level1: 'level1',
    level2: 'level2',
    level3: 'level3',
    level4: 'level4',
    waveLow: 'level1',
    waveMid: 'level2',
    waveHigh: 'level3',
    wavePeak: 'level4',
    monthLabel: 'monthLabel',
    arrow: 'arrow',
  }),

  [GRAPH_RENDER_FAMILIES.PROGRESS_BAR]: Object.freeze({
    progressFill: 'progressFill',
    trackFill: 'trackFill',
    successFill: 'successFill',
    valueText: 'valueText',
    captionText: 'captionText',
    emptyText: 'emptyText',
  }),

  [GRAPH_RENDER_FAMILIES.METRIC_BAR]: Object.freeze({
    barFill: 'barFill',
    latestBarFill: 'latestBarFill',
    goalLine: 'goalLine',
    valueText: 'valueText',
    captionText: 'captionText',
    emptyText: 'emptyText',
  }),

  [GRAPH_RENDER_FAMILIES.STACKED_SEGMENT]: Object.freeze({
    trackFill: 'trackFill',
    segmentPrimary: 'segmentPrimary',
    segmentSecondary: 'segmentSecondary',
    segmentTertiary: 'segmentTertiary',
    segmentMuted: 'segmentMuted',
    valueText: 'valueText',
    captionText: 'captionText',
    emptyText: 'emptyText',
  }),

  [GRAPH_RENDER_FAMILIES.INFO_CARD]: Object.freeze({
    titleText: 'titleText',
    bodyText: 'bodyText',
    captionText: 'captionText',
    accentText: 'accentText',
    surfaceFill: 'surfaceFill',
    divider: 'divider',
    emptyText: 'emptyText',
  }),
});

export const GRAPH_RENDER_COLOR_SETTING_PRIORITY = Object.freeze([
  'byInstanceId',
  'byGraphId',
  'byFamily',
  'global',
  'default',
]);

export const GRAPH_RENDER_COLOR_SETTING_STORAGE_KEY = 'graph_color_settings_v1';

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cleanColor(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getExplicitGraphRenderFamilyForGraphId(graphId) {
  return GRAPH_RENDER_GRAPH_FAMILY_BY_ID[graphId] || null;
}

export function isKnownGraphRenderGraphId(graphId) {
  return !!getExplicitGraphRenderFamilyForGraphId(graphId);
}

export function getGraphRenderFamilyForGraphId(graphId) {
  return getExplicitGraphRenderFamilyForGraphId(graphId) || GRAPH_RENDER_DEFAULT_FAMILY;
}

export function shouldCreateNewGraphRenderFamily({
  requiresDifferentGeometry = false,
  requiresDifferentColorSlots = false,
  requiresDifferentInteraction = false,
  requiresDifferentDataShape = false,
} = {}) {
  return Boolean(
    requiresDifferentGeometry ||
    requiresDifferentColorSlots ||
    requiresDifferentInteraction ||
    requiresDifferentDataShape
  );
}

export function getGraphRenderEditableColorSlots(family) {
  return GRAPH_RENDER_EDITABLE_COLOR_SLOTS[family] || Object.freeze({});
}

export function getGraphRenderLayoutRules(family) {
  return GRAPH_RENDER_LAYOUT_RULES[family] || Object.freeze({});
}

export function getGraphRenderRoleColor(role) {
  return GRAPH_RENDER_COLOR_ROLES[role] || GRAPH_RENDER_COLOR_ROLES.primary;
}

export function getGraphRenderSlotDefaultRole(family, slot) {
  const slotRule = GRAPH_RENDER_EDITABLE_COLOR_SLOTS[family]?.[slot];
  return slotRule?.defaultRole || 'primary';
}

export function getGraphRenderSlotDefaultColor(family, slot) {
  return getGraphRenderRoleColor(getGraphRenderSlotDefaultRole(family, slot));
}

export function resolveGraphRenderColorSlot({
  family,
  graphId,
  instanceId,
  slot,
  colorSettings,
}) {
  const defaultColor = getGraphRenderSlotDefaultColor(family, slot);

  if (!slot) return defaultColor;
  if (!isObject(colorSettings)) return defaultColor;

  const byInstanceColor = instanceId && cleanColor(colorSettings.byInstanceId?.[instanceId]?.[slot]);
  if (byInstanceColor) return byInstanceColor;

  const byGraphColor = graphId && cleanColor(colorSettings.byGraphId?.[graphId]?.[slot]);
  if (byGraphColor) return byGraphColor;

  const byFamilyColor = family && cleanColor(colorSettings.byFamily?.[family]?.[slot]);
  if (byFamilyColor) return byFamilyColor;

  const globalSlotColor = cleanColor(colorSettings.global?.[slot]);
  if (globalSlotColor) return globalSlotColor;

  const globalRole = getGraphRenderSlotDefaultRole(family, slot);
  const globalRoleColor = cleanColor(colorSettings.global?.[globalRole]);
  if (globalRoleColor) return globalRoleColor;

  return defaultColor;
}

export function resolveGraphRenderColors({
  family,
  graphId,
  instanceId,
  colorSettings,
}) {
  const slots = getGraphRenderEditableColorSlots(family);
  const result = {};

  Object.keys(slots).forEach((slot) => {
    result[slot] = resolveGraphRenderColorSlot({
      family,
      graphId,
      instanceId,
      slot,
      colorSettings,
    });
  });

  const internalMap = GRAPH_RENDER_INTERNAL_COLOR_MAP[family] || {};
  Object.keys(internalMap).forEach((key) => {
    const mappedSlotOrRole = internalMap[key];
    result[key] = result[mappedSlotOrRole] || getGraphRenderRoleColor(mappedSlotOrRole);
  });

  return Object.freeze(result);
}

export function resolveGraphRenderRule({
  family,
  graphId,
  instanceId,
  colorSettings,
}) {
  const resolvedFamily = family || getGraphRenderFamilyForGraphId(graphId);

  return Object.freeze({
    version: GRAPH_RENDER_RULE_VERSION,
    family: resolvedFamily,
    graphId: graphId || null,
    instanceId: instanceId || null,
    colors: resolveGraphRenderColors({
      family: resolvedFamily,
      graphId,
      instanceId,
      colorSettings,
    }),
    layout: getGraphRenderLayoutRules(resolvedFamily),
    editableColorSlots: getGraphRenderEditableColorSlots(resolvedFamily),
  });
}
