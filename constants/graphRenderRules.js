// OFFICIAL_GRAPH_RENDER_RULE: docs/GRAPH_RENDER_RULE.md
// Actual dashboard graph render rules.
// This file defines default roles, editable color slots, and shape rules.
// It is intentionally independent from graph preview rules and app common tokens.

export const GRAPH_RENDER_RULE_VERSION = 1;

export const GRAPH_RENDER_GRAPH_IDS = Object.freeze({
  OVERALL_PROGRESS: 'overall_progress',
  MONTH_CALENDAR: 'month_calendar',
  WEEKLY_BAR: 'weekly_bar',
  LINE_COUNT_CUMULATIVE: 'line_count_cumulative',
  LINE_MINUTES: 'line_minutes',
  GRASS_GRAPH: 'grass_graph',
  HEALTH_STEPS_WEEKLY: 'health_steps_weekly',
  HEALTH_STEPS_TREND: 'health_steps_trend',
});

export const GRAPH_RENDER_FAMILIES = Object.freeze({
  OVERALL_PROGRESS: 'overallProgress',
  CALENDAR: 'calendar',
  WEEKLY_BAR: 'weeklyBar',
  LINE: 'line',
  GRASS: 'grass',
});

export const GRAPH_RENDER_GRAPH_FAMILY_BY_ID = Object.freeze({
  [GRAPH_RENDER_GRAPH_IDS.OVERALL_PROGRESS]: GRAPH_RENDER_FAMILIES.OVERALL_PROGRESS,
  [GRAPH_RENDER_GRAPH_IDS.MONTH_CALENDAR]: GRAPH_RENDER_FAMILIES.CALENDAR,
  [GRAPH_RENDER_GRAPH_IDS.WEEKLY_BAR]: GRAPH_RENDER_FAMILIES.WEEKLY_BAR,
  [GRAPH_RENDER_GRAPH_IDS.LINE_COUNT_CUMULATIVE]: GRAPH_RENDER_FAMILIES.LINE,
  [GRAPH_RENDER_GRAPH_IDS.LINE_MINUTES]: GRAPH_RENDER_FAMILIES.LINE,
  [GRAPH_RENDER_GRAPH_IDS.GRASS_GRAPH]: GRAPH_RENDER_FAMILIES.GRASS,
  [GRAPH_RENDER_GRAPH_IDS.HEALTH_STEPS_WEEKLY]: GRAPH_RENDER_FAMILIES.WEEKLY_BAR,
  [GRAPH_RENDER_GRAPH_IDS.HEALTH_STEPS_TREND]: GRAPH_RENDER_FAMILIES.LINE,
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
});

export const GRAPH_RENDER_EDITABLE_COLOR_SLOTS = Object.freeze({
  [GRAPH_RENDER_FAMILIES.OVERALL_PROGRESS]: Object.freeze({
    progress: Object.freeze({
      label: '진행률',
      defaultRole: 'primary',
      description: '전체 진행률 원형 그래프의 채워진 영역입니다.',
    }),
    track: Object.freeze({
      label: '남은 영역',
      defaultRole: 'track',
      description: '아직 채워지지 않은 진행률 배경입니다.',
    }),
    label: Object.freeze({
      label: '숫자',
      defaultRole: 'primary',
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
});

export const GRAPH_RENDER_LAYOUT_RULES = Object.freeze({
  [GRAPH_RENDER_FAMILIES.OVERALL_PROGRESS]: Object.freeze({
    baseSize: 104,
    baseStroke: 11,
    minScale: 0.75,
    maxScale: 1.45,
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
});

export const GRAPH_RENDER_INTERNAL_COLOR_MAP = Object.freeze({
  [GRAPH_RENDER_FAMILIES.OVERALL_PROGRESS]: Object.freeze({
    progressFill: 'progress',
    trackFill: 'track',
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
