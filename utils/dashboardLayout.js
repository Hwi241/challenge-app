import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DASHBOARD_TARGETS,
  GRID_COLUMNS,
  getDefaultDashboardLayout,
  getWidgetById,
  supportsWidgetTarget,
} from '../constants/widgetCatalog';

export const DASHBOARD_LAYOUTS_KEY = 'dashboard_layouts_by_challenge';

const parseJson = (raw, fallback) => {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export const resolveDashboardTarget = (value) => {
  const v = String(value || '').toLowerCase();
  return v === DASHBOARD_TARGETS.HABIT ? DASHBOARD_TARGETS.HABIT : DASHBOARD_TARGETS.CHALLENGE;
};

const clampNumber = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const LEGACY_GRID_HEIGHT_BY_WIDGET_ID = {
  overall_progress: 2,
  goal_black_box: 1,
  month_calendar: 2,
  weekly_bar: 2,
  line_count_cumulative: 2,
  line_minutes: 2,
  grass_graph: 2,
};

const INTERNAL_GRID_HEIGHT_BY_WIDGET_ID = {
  overall_progress: 4,
  goal_black_box: 2,
  month_calendar: 4,
  weekly_bar: 4,
  line_count_cumulative: 4,
  line_minutes: 4,
  grass_graph: 4,
};

const getLayoutItemWidgetId = (item) => item?.widgetId || item?.id || item?.i || '';

const looksLikeLegacyDashboardLayout = (layout = []) => {
  if (!Array.isArray(layout) || layout.length === 0) return false;

  let legacyMatches = 0;
  let internalMatches = 0;

  layout.forEach((item) => {
    const widgetId = getLayoutItemWidgetId(item);
    const h = Number(item?.h);
    if (!Number.isFinite(h)) return;

    if (LEGACY_GRID_HEIGHT_BY_WIDGET_ID[widgetId] === h) {
      legacyMatches += 1;
    }
    if (INTERNAL_GRID_HEIGHT_BY_WIDGET_ID[widgetId] === h) {
      internalMatches += 1;
    }
  });

  return legacyMatches > 0 && legacyMatches >= internalMatches;
};

const migrateDashboardLayoutToInternalGrid = (layout = []) => {
  if (!looksLikeLegacyDashboardLayout(layout)) return layout;

  return layout.map((item) => {
    const widgetId = getLayoutItemWidgetId(item);
    const rawY = Number(item?.y);
    const rawH = Number(item?.h);
    const safeY = Number.isFinite(rawY) ? Math.max(0, rawY) : 0;
    const safeH = Number.isFinite(rawH) ? Math.max(1, rawH) : 1;

    const legacyH = LEGACY_GRID_HEIGHT_BY_WIDGET_ID[widgetId];
    const internalH = INTERNAL_GRID_HEIGHT_BY_WIDGET_ID[widgetId];

    let nextH = safeH;

    if (widgetId === 'goal_black_box') {
      nextH = safeH <= 2 ? 2 : safeH;
    } else if (Number.isFinite(legacyH) && Number.isFinite(internalH)) {
      if (safeH === legacyH || safeH < internalH) {
        nextH = internalH;
      }
    } else {
      nextH = safeH * 2;
    }

    return {
      ...item,
      y: safeY * 2,
      h: nextH,
    };
  });
};

export const normalizeDashboardLayout = (layout = [], target = DASHBOARD_TARGETS.CHALLENGE) => {
  const normalizedTarget = resolveDashboardTarget(target);
  const sourceBeforeMigration = Array.isArray(layout) && layout.length
    ? layout
    : getDefaultDashboardLayout(normalizedTarget);
  const source = migrateDashboardLayoutToInternalGrid(sourceBeforeMigration);

  return source
    .map((item, index) => {
      const widget = getWidgetById(item?.widgetId);
      if (!widget || !supportsWidgetTarget(widget, normalizedTarget)) return null;

      const defaultSize = widget.defaultSize || { w: 1, h: 1 };
      const minSize = widget.minSize || { w: 1, h: 1 };
      const maxSize = widget.maxSize || { w: GRID_COLUMNS, h: 3 };

      const w = clampNumber(item?.w, minSize.w, Math.min(GRID_COLUMNS, maxSize.w), defaultSize.w);
      const h = clampNumber(item?.h, minSize.h, maxSize.h, defaultSize.h);
      const x = clampNumber(item?.x, 0, Math.max(0, GRID_COLUMNS - w), 0);
      const y = clampNumber(item?.y, 0, 999, index);

      return {
        widgetId: widget.id,
        x,
        y,
        w,
        h,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));
};

const readLayoutMap = async () => {
  const raw = await AsyncStorage.getItem(DASHBOARD_LAYOUTS_KEY);
  const parsed = parseJson(raw, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
};

const writeLayoutMap = async (map) => {
  await AsyncStorage.setItem(DASHBOARD_LAYOUTS_KEY, JSON.stringify(map || {}));
};

const sanitizeDashboardLayout = (layout, target) => {
  const sourceBeforeMigration = Array.isArray(layout)
    ? layout
    : getDefaultDashboardLayout(target);
  const source = migrateDashboardLayoutToInternalGrid(sourceBeforeMigration);

  return source
    .filter(Boolean)
    .map((item, index) => {
      const rawId = item.id || item.widgetId || item.i;
      const widgetId = item.widgetId || rawId;
      const widget = getWidgetById(widgetId) || null;
      const columnCount = typeof GRID_COLUMNS === 'number' ? GRID_COLUMNS : 3;

      const defaultSize = widget?.defaultSize || { w: columnCount, h: 1 };
      const minSize = widget?.minSize || { w: 1, h: 1 };
      const maxSize = widget?.maxSize || { w: columnCount, h: 12 };

      const rawW = Number(item.w);
      const rawH = Number(item.h);

      const fallbackW = Math.max(1, Math.min(columnCount, Number(defaultSize.w) || columnCount));
      const fallbackH = Math.max(1, Number(defaultSize.h) || 1);

      const width = Math.max(
        Number(minSize.w) || 1,
        Math.min(
          columnCount,
          Number(maxSize.w) || columnCount,
          Number.isFinite(rawW) ? rawW : fallbackW
        )
      );

      const height = Math.max(
        Number(minSize.h) || 1,
        Math.min(
          Number(maxSize.h) || 12,
          Number.isFinite(rawH) ? rawH : fallbackH
        )
      );

      const rawY = Number(item.y);
      const safeY = Number.isFinite(rawY) ? Math.max(0, rawY) : index;

      return {
        ...item,
        id: rawId,
        widgetId,
        x: Math.max(0, Math.min(columnCount - width, Number(item.x) || 0)),
        y: safeY,
        w: width,
        h: height,
      };
    })
    .filter((item) => item.id || item.widgetId);
};

export const getDashboardLayoutForChallenge = async (challengeId, target) => {
  if (!challengeId) {
    return sanitizeDashboardLayout(getDefaultDashboardLayout(target), target);
  }

  try {
    const raw = await AsyncStorage.getItem(DASHBOARD_LAYOUTS_KEY);
    const allLayouts = raw ? JSON.parse(raw) : {};
    const storedLayout = allLayouts[String(challengeId)];

    if (Array.isArray(storedLayout)) {
      return sanitizeDashboardLayout(storedLayout, target);
    }

    return sanitizeDashboardLayout(getDefaultDashboardLayout(target), target);
  } catch (error) {
    console.warn('Failed to load dashboard layout', error);
    return sanitizeDashboardLayout(getDefaultDashboardLayout(target), target);
  }
};

export const saveDashboardLayoutForChallenge = async (challengeId, layout, target) => {
  if (!challengeId) return false;

  const nextLayout = sanitizeDashboardLayout(layout, target);

  try {
    const raw = await AsyncStorage.getItem(DASHBOARD_LAYOUTS_KEY);
    const allLayouts = raw ? JSON.parse(raw) : {};

    allLayouts[String(challengeId)] = nextLayout;

    await AsyncStorage.setItem(DASHBOARD_LAYOUTS_KEY, JSON.stringify(allLayouts));
    return nextLayout;
  } catch (error) {
    console.warn('Failed to save dashboard layout', error);
    throw error;
  }
};

export const resetDashboardLayoutForChallenge = async (challengeId, target = DASHBOARD_TARGETS.CHALLENGE) => {
  const id = String(challengeId || '');
  const normalizedTarget = resolveDashboardTarget(target);
  const defaults = normalizeDashboardLayout(getDefaultDashboardLayout(normalizedTarget), normalizedTarget);
  if (!id) return defaults;

  const map = await readLayoutMap();
  map[id] = defaults;
  await writeLayoutMap(map);
  return defaults;
};


export const getDashboardLayoutStateForChallenge = async (challengeId, target) => {
  if (!challengeId) {
    return {
      hasStoredLayout: false,
      layout: sanitizeDashboardLayout(getDefaultDashboardLayout(target), target),
    };
  }

  try {
    const raw = await AsyncStorage.getItem(DASHBOARD_LAYOUTS_KEY);
    const allLayouts = raw ? JSON.parse(raw) : {};
    const key = String(challengeId);
    const hasStoredLayout = Object.prototype.hasOwnProperty.call(allLayouts, key);
    const storedLayout = allLayouts[key];

    if (hasStoredLayout && Array.isArray(storedLayout)) {
      return {
        hasStoredLayout: true,
        layout: sanitizeDashboardLayout(storedLayout, target),
      };
    }

    return {
      hasStoredLayout: false,
      layout: sanitizeDashboardLayout(getDefaultDashboardLayout(target), target),
    };
  } catch (error) {
    console.warn('Failed to load dashboard layout state', error);
    return {
      hasStoredLayout: false,
      layout: sanitizeDashboardLayout(getDefaultDashboardLayout(target), target),
    };
  }
};