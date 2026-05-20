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

export const normalizeDashboardLayout = (layout = [], target = DASHBOARD_TARGETS.CHALLENGE) => {
  const normalizedTarget = resolveDashboardTarget(target);
  const source = Array.isArray(layout) && layout.length
    ? layout
    : getDefaultDashboardLayout(normalizedTarget);

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
  const source = Array.isArray(layout)
    ? layout
    : getDefaultDashboardLayout(target);

  return source
    .filter(Boolean)
    .map((item, index) => {
      const rawId = item.id || item.widgetId || item.i;
      const columnCount = typeof GRID_COLUMNS === 'number' ? GRID_COLUMNS : 3;
      const width = Math.max(1, Math.min(columnCount, Number(item.w) || columnCount));
      const rawY = Number(item.y);
      const safeY = Number.isFinite(rawY) ? Math.max(0, rawY) : index;

      return {
        ...item,
        id: rawId,
        widgetId: item.widgetId || rawId,
        x: Math.max(0, Math.min(columnCount - width, Number(item.x) || 0)),
        y: safeY,
        w: width,
        h: Math.max(1, Number(item.h) || 1),
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
};;

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