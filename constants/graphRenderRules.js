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
      label: '인증일',
      defaultRole: 'primary',
      description: '인증이 완료된 날짜의 배경입니다.',
    }),
    dateText: Object.freeze({
      label: '날짜 글씨',
      defaultRole: 'secondary',
      description: '일반 날짜와 보조 날짜 텍스트입니다.',
    }),
    today: Object.freeze({
      label: '오늘',
      defaultRole: 'track',
      description: '오늘 날짜가 아직 인증되지 않았을 때의 표시입니다.',
    }),
    highlight: Object.freeze({
      label: '선택 강조',
      defaultRole: 'highlight',
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
    base: Object.freeze({
      label: '기록 색',
      defaultRole: 'primary',
      description: '잔디그래프에서 가장 강한 기록 단계 색입니다.',
    }),
    empty: Object.freeze({
      label: '빈 칸',
      defaultRole: 'track',
      description: '기록이 없거나 가장 약한 칸의 색입니다.',
    }),
    text: Object.freeze({
      label: '월 글씨',
      defaultRole: 'secondary',
      description: '잔디그래프 상단 월 라벨 색입니다.',
    }),
    accent: Object.freeze({
      label: '강조 효과',
      defaultRole: 'primary',
      description: '웨이브 애니메이션과 강조 효과의 기준 색입니다.',
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
    badgeRadius: 8,
    todayBorderWidth: 2,
  }),

  [GRAPH_RENDER_FAMILIES.WEEKLY_BAR]: Object.freeze({
    barWidth: 16,
    barRadius: 4,
    segmentGap: 2,
    emptyDotSize: 4,
    pagerDotSize: 5,
    pagerDotActiveSize: 6,
  }),

  [GRAPH_RENDER_FAMILIES.LINE]: Object.freeze({
    strokeWidth: 1.6,
    axisStrokeWidth: 1,
    markerRadius: 3.2,
    selectedMarkerRadius: 3.8,
    tooltipRadius: 6,
    tooltipFontSize: 10,
    touchRadius: 16,
  }),

  [GRAPH_RENDER_FAMILIES.GRASS]: Object.freeze({
    rows: 7,
    minCellSize: 8,
    maxCellSize: 18,
    minCellGap: 2,
    maxCellGap: 4,
    cellRadius: 2,
    monthFontSize: 10.5,
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
    certifiedText: 'inverse',
    dateText: 'dateText',
    futureDay: 'tertiary',
    emptyDay: 'axis',
    todayFill: 'today',
    todayText: 'primary',
    activeTodayText: 'inverse',
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
    level0: 'empty',
    level1: 'empty',
    level2: 'tertiary',
    level3: 'text',
    level4: 'base',
    waveLow: 'empty',
    waveMid: 'tertiary',
    waveHigh: 'text',
    wavePeak: 'accent',
    monthLabel: 'text',
    arrow: 'accent',
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

export function getGraphRenderFamilyForGraphId(graphId) {
  return GRAPH_RENDER_GRAPH_FAMILY_BY_ID[graphId] || null;
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
