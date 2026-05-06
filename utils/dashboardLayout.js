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

export const getDashboardLayoutForChallenge = async (challengeId, target = DASHBOARD_TARGETS.CHALLENGE) => {
  const id = String(challengeId || '');
  const normalizedTarget = resolveDashboardTarget(target);
  if (!id) return normalizeDashboardLayout([], normalizedTarget);

  const map = await readLayoutMap();
  return normalizeDashboardLayout(map[id], normalizedTarget);
};

export const saveDashboardLayoutForChallenge = async (challengeId, layout = [], target = DASHBOARD_TARGETS.CHALLENGE) => {
  const id = String(challengeId || '');
  if (!id) return normalizeDashboardLayout(layout, target);

  const normalizedTarget = resolveDashboardTarget(target);
  const normalized = normalizeDashboardLayout(layout, normalizedTarget);
  const map = await readLayoutMap();
  map[id] = normalized;
  await writeLayoutMap(map);
  return normalized;
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
