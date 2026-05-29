import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
 Alert,
 Animated,
 Dimensions,
 Easing,
 Modal,
 ScrollView,
 StyleSheet,
 Text,
 TouchableOpacity,
 View,
} from 'react-native';
import { CommonActions } from '@react-navigation/native';

import {
 DASHBOARD_TARGETS,
 GRID_COLUMNS,
 DEFAULT_WIDGET_IDS,
 getDefaultDashboardLayout,
 getShopWidgets,
 getWidgetById,
 supportsWidgetTarget,
} from '../constants/widgetCatalog';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

import {
 getDashboardLayoutStateForChallenge,
 saveDashboardLayoutForChallenge,
} from '../utils/dashboardLayout';

function resolveTarget(params) {
 const rawType = params?.type || params?.challengeType || params?.item?.type || params?.challenge?.type;
 const isHabit = rawType === 'habit' || params?.isHabit === true || params?.habitId;
 return isHabit ? DASHBOARD_TARGETS.HABIT : DASHBOARD_TARGETS.CHALLENGE;
}

function normalizeLayoutItem(item, index) {
 const widgetId = item?.widgetId || item?.id || item?.i || DEFAULT_WIDGET_IDS[index] || `graph_${index}`;
 const catalog = getWidgetById(widgetId) || {};
 const defaultSize = catalog?.defaultSize || { w: GRID_COLUMNS, h: 2 };
 const minSize = catalog?.minSize || { w: 1, h: 1 };
 const maxSize = catalog?.maxSize || { w: GRID_COLUMNS, h: 12 };

 const rawW = Number(item?.w ?? defaultSize.w);
 const rawH = Number(item?.h ?? defaultSize.h);

 const safeW = Math.max(
   Number(minSize.w) || 1,
   Math.min(GRID_COLUMNS, Number(maxSize.w) || GRID_COLUMNS, Number.isFinite(rawW) ? rawW : defaultSize.w)
 );
 const safeH = Math.max(
   Number(minSize.h) || 1,
   Math.min(Number(maxSize.h) || 12, Number.isFinite(rawH) ? rawH : defaultSize.h)
 );

 return {
 ...catalog,
 ...item,
 id: widgetId,
 widgetId,
 x: Number.isFinite(Number(item?.x)) ? Number(item.x) : 0,
 y: Number.isFinite(Number(item?.y)) ? Number(item.y) : index,
 w: safeW,
 h: safeH,
 };
}

function normalizeLayout(layout, target) {
 const source = Array.isArray(layout) ? layout : getDefaultDashboardLayout(target);
 return source.map(normalizeLayoutItem).sort((a, b) => {
 if (a.y !== b.y) return a.y - b.y;
 return a.x - b.x;
 });
}

const repairDashboardLayoutOverlaps = (items) => {
  const source = Array.isArray(items) ? items : [];
  const normalizeRepairItem = (item) => {
    const safeW = Math.max(1, Math.min(GRID_COLUMNS, Number(item?.w) || 1));
    const safeH = Math.max(1, Number(item?.h) || 1);
    const maxX = Math.max(0, GRID_COLUMNS - safeW);
    const safeX = Math.max(0, Math.min(maxX, Number(item?.x) || 0));
    const safeY = Math.max(0, Number(item?.y) || 0);
    return { ...item, x: safeX, y: safeY, w: safeW, h: safeH };
  };

  const overlapsRepair = (a, b) => {
    if (!a || !b) return false;
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  };

  const hasCollisionRepair = (candidate, placedItems) => {
    return placedItems.some((item) => item.widgetId !== candidate.widgetId && overlapsRepair(candidate, item));
  };

  const normalized = source.map(normalizeRepairItem).sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const placed = [];

  normalized.forEach((item) => {
    if (!hasCollisionRepair(item, placed)) {
      placed.push(item);
      return;
    }
    // Find next free position preserving original x when possible
    const safeW = Math.max(1, Math.min(GRID_COLUMNS, Number(item.w) || 1));
    const startX = Math.max(0, Math.min(GRID_COLUMNS - safeW, Number(item.x) || 0));
    const startY = Math.max(0, Number(item.y) || 0);
    const maxSearchY = startY + 80;
    let found = false;
    for (let sy = startY; sy <= maxSearchY && !found; sy++) {
      // Try original x first, then right, then left
      const xOrder = [];
      for (let x = startX; x <= GRID_COLUMNS - safeW; x++) xOrder.push(x);
      for (let x = 0; x < startX; x++) xOrder.push(x);
      for (const sx of xOrder) {
        const candidate = { ...item, x: sx, y: sy };
        if (!hasCollisionRepair(candidate, placed)) {
          placed.push(candidate);
          found = true;
          break;
        }
      }
    }
    if (!found) placed.push({ ...item, x: startX, y: maxSearchY + 1 });
  });

  return placed.sort((a, b) => (a.y - b.y) || (a.x - b.x));
};

const compactDashboardLayoutSpaces = (items) => {
  const source = Array.isArray(items) ? items : [];
  const overlaps = (a, b) => {
    if (!a || !b) return false;
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  };

  const hasCollision = (candidate) => {
    return placedItems.some((p) => p.widgetId !== candidate.widgetId && overlaps(candidate, p));
  };

  const normalizeCompactItem = (item) => {
    const safeW = Math.max(1, Math.min(GRID_COLUMNS, Number(item?.w) || 1));
    const safeH = Math.max(1, Number(item?.h) || 1);
    const maxX = Math.max(0, GRID_COLUMNS - safeW);
    return {
      ...item,
      w: safeW,
      h: safeH,
      x: Math.max(0, Math.min(maxX, Number(item?.x) || 0)),
      y: Math.max(0, Number(item?.y) || 0),
    };
  };

  const findFirstFreePosition = (item) => {
    const safeW = Math.max(1, Math.min(GRID_COLUMNS, Number(item.w) || 1));
    const maxX = Math.max(0, GRID_COLUMNS - safeW);
    const maxExistingY = placedItems.reduce((max, placedItem) => {
      return Math.max(max, (Number(placedItem.y) || 0) + (Number(placedItem.h) || 1));
    }, 0);
    const maxSearchY = Math.max(maxExistingY + 80, 80);

    for (let y = 0; y <= maxSearchY; y += 1) {
      for (let x = 0; x <= maxX; x += 1) {
        const candidate = { ...item, x, y };
        if (!hasCollision(candidate)) return candidate;
      }
    }

    return { ...item, x: 0, y: maxSearchY + 1 };
  };

  const placedItems = [];
  source
    .map(normalizeCompactItem)
    .sort((a, b) => (a.y - b.y) || (a.x - b.x))
    .forEach((item) => {
      placedItems.push(findFirstFreePosition(item));
    });

  return placedItems.sort((a, b) => (a.y - b.y) || (a.x - b.x));
};

const dashboardItemsOverlap = (a, b) => {
  if (!a || !b) return false;
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
};

const reflowDashboardLayoutWithFixedItem = (layout = [], fixedWidgetId, fixedFrame) => {
 const source = Array.isArray(layout) ? layout.map(normalizeLayoutItem) : [];
 const fixedSource = source.find((item) => (item.widgetId || item.id) === fixedWidgetId);

 if (!fixedSource || !fixedWidgetId) {
 return repairDashboardLayoutOverlaps(source);
 }

 const safeW = Math.max(1, Math.min(GRID_COLUMNS, Number(fixedFrame?.w) || Number(fixedSource.w) || 1));
 const safeH = Math.max(1, Number(fixedFrame?.h) || Number(fixedSource.h) || 1);
 const maxX = Math.max(0, GRID_COLUMNS - safeW);
 const safeX = Math.max(0, Math.min(maxX, Number(fixedFrame?.x) || 0));
 const safeY = Math.max(0, Number(fixedFrame?.y) || 0);

 const fixedItem = {
 ...fixedSource,
 x: safeX,
 y: safeY,
 w: safeW,
 h: safeH,
 };

 const placed = [fixedItem];

 const clampReflowItem = (item) => {
 const itemW = Math.max(1, Math.min(GRID_COLUMNS, Number(item?.w) || 1));
 const itemH = Math.max(1, Number(item?.h) || 1);
 const itemMaxX = Math.max(0, GRID_COLUMNS - itemW);
 const itemX = Math.max(0, Math.min(itemMaxX, Number(item?.x) || 0));
 const itemY = Math.max(0, Number(item?.y) || 0);
 return { ...item, x: itemX, y: itemY, w: itemW, h: itemH };
 };

 const hasCollisionWithPlaced = (candidate) => {
 return placed.some((placedItem) => {
 const placedId = placedItem.widgetId || placedItem.id;
 const candidateId = candidate.widgetId || candidate.id;
 if (placedId === candidateId) return false;
 return dashboardItemsOverlap(candidate, placedItem);
 });
 };

 const findNextFreePosition = (item) => {
 const normalized = clampReflowItem(item);
 const startX = normalized.x;
 const startY = normalized.y;
 const maxXForItem = Math.max(0, GRID_COLUMNS - normalized.w);
 const maxPlacedRow = placed.reduce((max, placedItem) => {
 return Math.max(max, (Number(placedItem.y) || 0) + (Number(placedItem.h) || 1));
 }, startY);
 const maxSearchY = Math.max(startY + 80, maxPlacedRow + 80);

 for (let y = startY; y <= maxSearchY; y += 1) {
 const xOrder = [];
 for (let x = startX; x <= maxXForItem; x += 1) xOrder.push(x);
 for (let x = 0; x < startX; x += 1) xOrder.push(x);

 for (const x of xOrder) {
 const candidate = { ...normalized, x, y };
 if (!hasCollisionWithPlaced(candidate)) {
 return candidate;
 }
 }
 }

 return { ...normalized, x: startX, y: maxSearchY + 1 };
 };

 const otherItems = source
 .filter((item) => (item.widgetId || item.id) !== fixedWidgetId)
 .map(clampReflowItem)
 .sort((a, b) => (a.y - b.y) || (a.x - b.x));

 otherItems.forEach((item) => {
 placed.push(findNextFreePosition(item));
 });

 return placed.sort((a, b) => (a.y - b.y) || (a.x - b.x));
};

const clampDashboardResizeSize = (widgetId, rawW, rawH, bounds = {}) => {
 const catalog = getWidgetById(widgetId) || {};
 const minSize = catalog?.minSize || { w: 1, h: 1 };
 const maxSize = catalog?.maxSize || { w: GRID_COLUMNS, h: 12 };

 const minW = Math.max(1, Number(minSize.w) || 1);
 const minH = Math.max(1, Number(minSize.h) || 1);
 const catalogMaxW = Math.max(minW, Math.min(GRID_COLUMNS, Number(maxSize.w) || GRID_COLUMNS));
 const catalogMaxH = Math.max(minH, Number(maxSize.h) || 12);
 const boundMaxW = Number.isFinite(Number(bounds.maxW)) ? Math.max(minW, Number(bounds.maxW)) : catalogMaxW;
 const boundMaxH = Number.isFinite(Number(bounds.maxH)) ? Math.max(minH, Number(bounds.maxH)) : catalogMaxH;
 const maxW = Math.max(minW, Math.min(catalogMaxW, boundMaxW));
 const maxH = Math.max(minH, Math.min(catalogMaxH, boundMaxH));

 return {
 w: Math.max(minW, Math.min(maxW, Number(rawW) || minW)),
 h: Math.max(minH, Math.min(maxH, Number(rawH) || minH)),
 };
};

const getAnchoredResizeFrame = (widgetId, origin, corner, deltaCols, deltaRows) => {
 const safeOrigin = {
 x: Math.max(0, Number(origin?.x) || 0),
 y: Math.max(0, Number(origin?.y) || 0),
 w: Math.max(1, Number(origin?.w) || 1),
 h: Math.max(1, Number(origin?.h) || 1),
 };

 if (corner === 'topRight') {
 const fixedLeft = safeOrigin.x;
 const fixedBottom = safeOrigin.y + safeOrigin.h;
 const rawW = safeOrigin.w + deltaCols;
 const rawH = safeOrigin.h - deltaRows;
 const maxW = Math.max(1, GRID_COLUMNS - fixedLeft);
 const maxH = Math.max(1, fixedBottom);
 const clamped = clampDashboardResizeSize(widgetId, rawW, rawH, { maxW, maxH });

 return {
 x: fixedLeft,
 y: Math.max(0, fixedBottom - clamped.h),
 w: clamped.w,
 h: clamped.h,
 };
 }

 if (corner === 'bottomLeft') {
 const fixedRight = safeOrigin.x + safeOrigin.w;
 const fixedTop = safeOrigin.y;
 const rawW = safeOrigin.w - deltaCols;
 const rawH = safeOrigin.h + deltaRows;
 const maxW = Math.max(1, fixedRight);
 const clamped = clampDashboardResizeSize(widgetId, rawW, rawH, { maxW });

 return {
 x: Math.max(0, fixedRight - clamped.w),
 y: fixedTop,
 w: clamped.w,
 h: clamped.h,
 };
 }

 const fallback = clampDashboardResizeSize(widgetId, safeOrigin.w, safeOrigin.h);
 return {
 x: safeOrigin.x,
 y: safeOrigin.y,
 w: fallback.w,
 h: fallback.h,
 };
};



const applyResizeResistancePx = (rawValue, minValue, maxValue) => {
 const numeric = Number(rawValue) || 0;
 const safeMin = Number(minValue) || 0;
 const safeMax = Math.max(safeMin, Number(maxValue) || safeMin);

 if (numeric < safeMin) {
 return Math.max(
 safeMin - RESIZE_GHOST_MAX_OVERSHOOT,
 safeMin + (numeric - safeMin) * RESIZE_GHOST_RESISTANCE,
 );
 }

 if (numeric > safeMax) {
 return Math.min(
 safeMax + RESIZE_GHOST_MAX_OVERSHOOT,
 safeMax + (numeric - safeMax) * RESIZE_GHOST_RESISTANCE,
 );
 }

 return numeric;
};

const getResizeCatalogBounds = (widgetId) => {
 const catalog = getWidgetById(widgetId) || {};
 const minSize = catalog?.minSize || { w: 1, h: 1 };
 const maxSize = catalog?.maxSize || { w: GRID_COLUMNS, h: 12 };

 const minW = Math.max(1, Number(minSize.w) || 1);
 const minH = Math.max(1, Number(minSize.h) || 1);
 const maxW = Math.max(minW, Math.min(GRID_COLUMNS, Number(maxSize.w) || GRID_COLUMNS));
 const maxH = Math.max(minH, Number(maxSize.h) || 12);

 return { minW, minH, maxW, maxH };
};

const getResizeGridItemFrame = (item, gridW) => {
 const safeW = Math.max(1, Math.min(GRID_COLUMNS, Number(item?.w) || 1));
 const safeH = Math.max(1, Number(item?.h) || 1);
 const maxX = Math.max(0, GRID_COLUMNS - safeW);
 const safeX = Math.max(0, Math.min(maxX, Number(item?.x) || 0));
 const safeY = Math.max(0, Number(item?.y) || 0);
 const slotWidth = gridW > 0 ? gridW / GRID_COLUMNS : 0;

 return {
 left: safeX * slotWidth + GRID_CELL_PADDING,
 top: safeY * (GRID_ROW_HEIGHT + GRID_ROW_GAP),
 width: Math.max(0, safeW * slotWidth - GRID_CELL_PADDING * 2),
 height: safeH * GRID_ROW_HEIGHT + Math.max(0, safeH - 1) * GRID_ROW_GAP,
 safeX,
 safeY,
 safeW,
 safeH,
 };
};

const getResizeGridItemHeight = (h) => {
 const safeH = Math.max(1, Number(h) || 1);
 return safeH * GRID_ROW_HEIGHT + Math.max(0, safeH - 1) * GRID_ROW_GAP;
};

const getResizeGhostVisualFramePx = (widgetId, origin, corner, translationX, translationY, gridW) => {
 if (!gridW) {
 return {
 visualFramePx: null,
 boundedFramePx: null,
 isBeyondLimit: false,
 };
 }

 const slotWidth = gridW / GRID_COLUMNS;
 const originFrame = getResizeGridItemFrame(origin, gridW);
 const bounds = getResizeCatalogBounds(widgetId);

 const originX = Math.max(0, Number(origin?.x) || 0);
 const originY = Math.max(0, Number(origin?.y) || 0);
 const originW = Math.max(1, Number(origin?.w) || 1);
 const originH = Math.max(1, Number(origin?.h) || 1);

 const minWidthPx = Math.max(0, bounds.minW * slotWidth - GRID_CELL_PADDING * 2);
 const maxWidthCells = corner === 'bottomLeft'
 ? Math.min(bounds.maxW, originX + originW)
 : Math.min(bounds.maxW, GRID_COLUMNS - originX);
 const maxHeightCells = corner === 'topRight'
 ? Math.min(bounds.maxH, originY + originH)
 : bounds.maxH;

 const maxWidthPx = Math.max(minWidthPx, maxWidthCells * slotWidth - GRID_CELL_PADDING * 2);
 const minHeightPx = getResizeGridItemHeight(bounds.minH);
 const maxHeightPx = getResizeGridItemHeight(maxHeightCells);

 const originLeft = originFrame.left;
 const originTop = originFrame.top;
 const originRight = originFrame.left + originFrame.width;
 const originBottom = originFrame.top + originFrame.height;

 const rawX = Number(translationX) || 0;
 const rawY = Number(translationY) || 0;

 if (corner === 'topRight') {
 const rawWidth = originFrame.width + rawX;
 const rawHeight = originFrame.height - rawY;
 const boundedWidth = Math.max(minWidthPx, Math.min(maxWidthPx, rawWidth));
 const boundedHeight = Math.max(minHeightPx, Math.min(maxHeightPx, rawHeight));
 const visualWidth = applyResizeResistancePx(rawWidth, minWidthPx, maxWidthPx);
 const visualHeight = applyResizeResistancePx(rawHeight, minHeightPx, maxHeightPx);

 const boundedFramePx = {
 left: originLeft,
 top: originBottom - boundedHeight,
 width: boundedWidth,
 height: boundedHeight,
 };

 const visualFramePx = {
 left: originLeft,
 top: originBottom - visualHeight,
 width: visualWidth,
 height: visualHeight,
 };

 return {
 visualFramePx,
 boundedFramePx,
 isBeyondLimit:
 Math.abs(visualFramePx.left - boundedFramePx.left) > 0.5 ||
 Math.abs(visualFramePx.top - boundedFramePx.top) > 0.5 ||
 Math.abs(visualFramePx.width - boundedFramePx.width) > 0.5 ||
 Math.abs(visualFramePx.height - boundedFramePx.height) > 0.5,
 };
 }

 if (corner === 'bottomLeft') {
 const rawWidth = originFrame.width - rawX;
 const rawHeight = originFrame.height + rawY;
 const boundedWidth = Math.max(minWidthPx, Math.min(maxWidthPx, rawWidth));
 const boundedHeight = Math.max(minHeightPx, Math.min(maxHeightPx, rawHeight));
 const visualWidth = applyResizeResistancePx(rawWidth, minWidthPx, maxWidthPx);
 const visualHeight = applyResizeResistancePx(rawHeight, minHeightPx, maxHeightPx);

 const boundedFramePx = {
 left: originRight - boundedWidth,
 top: originTop,
 width: boundedWidth,
 height: boundedHeight,
 };

 const visualFramePx = {
 left: originRight - visualWidth,
 top: originTop,
 width: visualWidth,
 height: visualHeight,
 };

 return {
 visualFramePx,
 boundedFramePx,
 isBeyondLimit:
 Math.abs(visualFramePx.left - boundedFramePx.left) > 0.5 ||
 Math.abs(visualFramePx.top - boundedFramePx.top) > 0.5 ||
 Math.abs(visualFramePx.width - boundedFramePx.width) > 0.5 ||
 Math.abs(visualFramePx.height - boundedFramePx.height) > 0.5,
 };
 }

 const fallbackFrame = {
 left: originFrame.left,
 top: originFrame.top,
 width: originFrame.width,
 height: originFrame.height,
 };

 return {
 visualFramePx: fallbackFrame,
 boundedFramePx: fallbackFrame,
 isBeyondLimit: false,
 };
};


const GRID_ROW_HEIGHT = 46;
const GRID_ROW_GAP = 4;
const GRID_CELL_PADDING = 4;
const RESIZE_FRAME_INSET = 2;
const RESIZE_ACTIVE_CORNER_SIZE = 12;
const RESIZE_GHOST_RESISTANCE = 0.22;
const RESIZE_GHOST_MAX_OVERSHOOT = 12;
const RESIZE_GHOST_BOUNCE_BACK_MS = 90;
const GRID_DRAG_STEP_THRESHOLD = 0.62;
const RESIZE_GRID_STEP_THRESHOLD = 0.9;
const AUTO_SCROLL_EDGE_SIZE = 110;
const AUTO_SCROLL_STEP = 9;
const AUTO_SCROLL_INTERVAL_MS = 16;

export default function DashboardEditScreen({ route, navigation }) {
 const insets = useSafeAreaInsets();
 const params = route?.params || {};
 const challengeId = params.challengeId || params.id || params.challenge?.id || params.item?.id;
 const title = params.title || params.challengeTitle || params.item?.title || params.challenge?.title || '대시보드';
 const dashboardTarget = useMemo(() => resolveTarget(params), [params]);

 const [layout, setLayout] = useState([]);
 const [pickerVisible, setPickerVisible] = useState(false);
 const [loading, setLoading] = useState(true);
 const [gestureDraggingWidgetId, setGestureDraggingWidgetId] = useState(null);
 const [gestureDragOffset, setGestureDragOffset] = useState({ x: 0, y: 0 });
 const [gridWidth, setGridWidth] = useState(0);
 const [dragPlaceholder, setDragPlaceholder] = useState(null);
 const [dragOverlayItem, setDragOverlayItem] = useState(null);
 const [dragOverlayStart, setDragOverlayStart] = useState({ x: 0, y: 0 });
 const [previewLayout, setPreviewLayout] = useState(null);
const [resizeGhostFrame, setResizeGhostFrame] = useState(null);
const [activeResizeWidgetId, setActiveResizeWidgetId] = useState(null);
const [resizeDraggingWidgetId, setResizeDraggingWidgetId] = useState(null);
 const lastDropTargetRef = useRef(null);
 const dragOriginRef = useRef(null);
 const previewTargetRef = useRef(null);
 const previewLayoutSignatureRef = useRef('');
 const resizeOriginRef = useRef(null);
 const resizePreviewSignatureRef = useRef('');
const resizePreviewSizeRef = useRef('');
 const dragCleanupTimerRef = useRef(null);
 const resizeDashAnimRef = useRef(new Animated.Value(0));
 const resizeGhostBounceTimerRef = useRef(null);
 const resizeGhostBounceSignatureRef = useRef('');
 const scrollRef = useRef(null);
 const scrollYRef = useRef(0);
 const dragStartScrollYRef = useRef(0);
 const autoScrollTimerRef = useRef(null);
 const autoScrollDirectionRef = useRef(0);

 const loadLayout = useCallback(async () => {
 if (!challengeId) {
 setLayout(repairDashboardLayoutOverlaps(normalizeLayout([], dashboardTarget)));
 setLoading(false);
 return;
 }

 try {
 const state = await getDashboardLayoutStateForChallenge(challengeId, dashboardTarget);
 const rawLayout = state?.hasStoredLayout
 ? normalizeLayout(state.layout, dashboardTarget)
 : normalizeLayout(getDefaultDashboardLayout(dashboardTarget), dashboardTarget);
 const nextLayout = repairDashboardLayoutOverlaps(rawLayout);
 setLayout(nextLayout);
 } catch (error) {
 console.log('대시보드 레이아웃 로드 실패:', error?.message || error);
 setLayout(repairDashboardLayoutOverlaps(normalizeLayout(getDefaultDashboardLayout(dashboardTarget), dashboardTarget)));
 } finally {
 setLoading(false);
 }
 }, [challengeId, dashboardTarget]);

 useEffect(() => {
 loadLayout();
 }, [loadLayout]);

 useEffect(() => {
 return () => {
   if (dragCleanupTimerRef.current) {
     clearTimeout(dragCleanupTimerRef.current);
     dragCleanupTimerRef.current = null;
   }
   if (autoScrollTimerRef.current) {
     clearInterval(autoScrollTimerRef.current);
     autoScrollTimerRef.current = null;
   }
 };
 }, []);

useEffect(() => {
 const dashAnim = resizeDashAnimRef.current;
 if (!activeResizeWidgetId) {
   dashAnim.stopAnimation();
   dashAnim.setValue(0);
   return undefined;
 }

 dashAnim.setValue(0);
 const loop = Animated.loop(
   Animated.timing(dashAnim, {
     toValue: 1,
     duration: 900,
     easing: Easing.linear,
     useNativeDriver: true,
   })
 );
 loop.start();

 return () => {
   loop.stop();
 };
}, [activeResizeWidgetId]);
const resizeDashTranslateX = resizeDashAnimRef.current.interpolate({
 inputRange: [0, 1],
 outputRange: [-18, 0],
});

 const clearScheduledDragVisualCleanup = useCallback(() => {
 if (dragCleanupTimerRef.current) {
   clearTimeout(dragCleanupTimerRef.current);
   dragCleanupTimerRef.current = null;
 }
 }, []);

 const clearResizeGhostBounceTimer = useCallback(() => {
 if (resizeGhostBounceTimerRef.current) {
 clearTimeout(resizeGhostBounceTimerRef.current);
 resizeGhostBounceTimerRef.current = null;
 }
 resizeGhostBounceSignatureRef.current = '';
 }, []);

 const stopDashboardAutoScroll = useCallback(() => {
 if (autoScrollTimerRef.current) {
   clearInterval(autoScrollTimerRef.current);
   autoScrollTimerRef.current = null;
 }
 autoScrollDirectionRef.current = 0;
 }, []);

 const startDashboardAutoScroll = useCallback((direction) => {
 const nextDirection = direction < 0 ? -1 : 1;

 if (
   autoScrollTimerRef.current &&
   autoScrollDirectionRef.current === nextDirection
 ) {
   return;
 }

 stopDashboardAutoScroll();
 autoScrollDirectionRef.current = nextDirection;

 autoScrollTimerRef.current = setInterval(() => {
   const currentScrollY = scrollYRef.current;
   const step = nextDirection > 0 ? AUTO_SCROLL_STEP : -AUTO_SCROLL_STEP;
   const nextY = Math.max(0, currentScrollY + step);
   scrollRef.current?.scrollTo({ y: nextY, animated: false });
   scrollYRef.current = nextY;
 }, AUTO_SCROLL_INTERVAL_MS);
 }, []);

 const updateDashboardAutoScroll = useCallback((absoluteY) => {
 if (scrollRef.current == null) return;

 const viewHeight = Dimensions.get('window').height;
 const topEdge = AUTO_SCROLL_EDGE_SIZE;
 const bottomEdge = viewHeight - AUTO_SCROLL_EDGE_SIZE;

 if (absoluteY < topEdge) {
   startDashboardAutoScroll(-1);
 } else if (absoluteY > bottomEdge) {
   startDashboardAutoScroll(1);
 } else {
   stopDashboardAutoScroll();
 }
 }, []);

 const clearDragVisualState = useCallback(() => {
 clearResizeGhostBounceTimer();
 stopDashboardAutoScroll();
 setGestureDraggingWidgetId(null);
 setResizeDraggingWidgetId(null);
 setGestureDragOffset({ x: 0, y: 0 });
 setDragPlaceholder(null);
 setPreviewLayout(null);
 setResizeGhostFrame(null);
 setDragOverlayItem(null);
 setDragOverlayStart({ x: 0, y: 0 });
 dragOriginRef.current = null;
 resizeOriginRef.current = null;
 resizePreviewSizeRef.current = '';
 lastDropTargetRef.current = null;
 previewLayoutSignatureRef.current = '';
 resizePreviewSignatureRef.current = '';
 }, []);

const scheduleDragVisualCleanup = useCallback(() => {
 clearScheduledDragVisualCleanup();
 dragCleanupTimerRef.current = setTimeout(() => {
   dragCleanupTimerRef.current = null;
   clearDragVisualState();
 }, 32);
 }, [clearDragVisualState, clearScheduledDragVisualCleanup]);

 const placedIds = useMemo(() => new Set(layout.map(item => item.widgetId || item.id)), [layout]);

 const displayLayout = useMemo(() => {
   if (Array.isArray(previewLayout) && previewLayout.length > 0 && gestureDraggingWidgetId) {
     return previewLayout.map(normalizeLayoutItem);
   }
   return Array.isArray(layout) ? layout.map(normalizeLayoutItem) : [];
 }, [layout, previewLayout, gestureDraggingWidgetId]);

const getStableGridDelta = (rawDelta) => {
  const numeric = Number(rawDelta) || 0;
  const abs = Math.abs(numeric);
  if (abs < GRID_DRAG_STEP_THRESHOLD) return 0;
  const sign = numeric < 0 ? -1 : 1;
  return sign * Math.floor(abs + (1 - GRID_DRAG_STEP_THRESHOLD));
};

const getResizeStableGridDelta = (rawDelta) => {
  const numeric = Number(rawDelta) || 0;
  const abs = Math.abs(numeric);
  if (abs < RESIZE_GRID_STEP_THRESHOLD) return 0;
  const sign = numeric < 0 ? -1 : 1;
  return sign * Math.floor(abs + (1 - RESIZE_GRID_STEP_THRESHOLD));
};

const getGridItemHeight = (h) => {
  const safeH = Math.max(1, Number(h) || 1);
  return safeH * GRID_ROW_HEIGHT + Math.max(0, safeH - 1) * GRID_ROW_GAP;
};

const getGridItemFrame = (item, gridW) => {
  const safeW = Math.max(1, Math.min(GRID_COLUMNS, Number(item?.w) || 1));
  const safeH = Math.max(1, Number(item?.h) || 1);
  const maxX = Math.max(0, GRID_COLUMNS - safeW);
  const safeX = Math.max(0, Math.min(maxX, Number(item?.x) || 0));
  const safeY = Math.max(0, Number(item?.y) || 0);
  const slotWidth = gridW > 0 ? gridW / GRID_COLUMNS : 0;
  return {
    left: safeX * slotWidth + GRID_CELL_PADDING,
    top: safeY * (GRID_ROW_HEIGHT + GRID_ROW_GAP),
    width: Math.max(0, safeW * slotWidth - GRID_CELL_PADDING * 2),
    height: getGridItemHeight(safeH),
    safeX, safeY, safeW, safeH,
  };
};

const calculateReflowLayout = (sourceLayout, movingWidgetId, target) => {
  const normalizeItem = (item) => {
    const safeW = Math.max(1, Math.min(GRID_COLUMNS, Number(item?.w) || 1));
    const safeH = Math.max(1, Number(item?.h) || 1);
    const maxX = Math.max(0, GRID_COLUMNS - safeW);
    const safeX = Math.max(0, Math.min(maxX, Number(item?.x) || 0));
    const safeY = Math.max(0, Number(item?.y) || 0);
    return { ...item, x: safeX, y: safeY, w: safeW, h: safeH };
  };

  const overlaps = (a, b) => {
    if (!a || !b) return false;
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  };

  const hasCollision = (candidate, placedItems) => {
    return placedItems.some((item) => item.widgetId !== candidate.widgetId && overlaps(candidate, item));
  };

  const clampX = (x, w) => {
    const safeW = Math.max(1, Math.min(GRID_COLUMNS, Number(w) || 1));
    const maxX = Math.max(0, GRID_COLUMNS - safeW);
    return Math.max(0, Math.min(maxX, Number(x) || 0));
  };

  const findNextFreePosition = (item, placedItems) => {
    const safeW = Math.max(1, Math.min(GRID_COLUMNS, Number(item.w) || 1));
    const startX = clampX(item.x, safeW);
    const startY = Math.max(0, Number(item.y) || 0);
    const maxX = Math.max(0, GRID_COLUMNS - safeW);
    const maxExistingRow = placedItems.reduce((max, placedItem) => {
      return Math.max(max, (Number(placedItem.y) || 0) + (Number(placedItem.h) || 1));
    }, startY);
    const maxSearchY = Math.max(startY + 80, maxExistingRow + 80);

    for (let searchY = startY; searchY <= maxSearchY; searchY += 1) {
      const xOrder = [];
      for (let x = startX; x <= maxX; x += 1) xOrder.push(x);
      for (let x = 0; x < startX; x += 1) xOrder.push(x);

      for (const searchX of xOrder) {
        const candidate = { ...item, x: searchX, y: searchY };
        if (!hasCollision(candidate, placedItems)) {
          return candidate;
        }
      }
    }
    return { ...item, x: startX, y: maxSearchY + 1 };
  };

  const compactEmptyRows = (items, reservedRows = new Set()) => {
    const occupiedRows = new Set(reservedRows);
    items.forEach((item) => {
      const startY = Math.max(0, Number(item.y) || 0);
      const safeH = Math.max(1, Number(item.h) || 1);
      for (let row = startY; row < startY + safeH; row += 1) occupiedRows.add(row);
    });
    return items
      .map((item) => {
        const currentY = Math.max(0, Number(item.y) || 0);
        let shiftY = 0;
        for (let row = 0; row < currentY; row += 1) {
          if (!occupiedRows.has(row)) shiftY += 1;
        }
        return { ...item, y: Math.max(0, currentY - shiftY) };
      })
      .sort((a, b) => (a.y - b.y) || (a.x - b.x));
  };

  const layoutItems = Array.isArray(sourceLayout) ? sourceLayout.map(normalizeItem) : [];
  const movingOriginal = layoutItems.find((item) => item.widgetId === movingWidgetId);
  if (!movingOriginal) return layoutItems;

  const movingW = Math.max(1, Math.min(GRID_COLUMNS, Number(movingOriginal.w) || 1));
  const movingH = Math.max(1, Number(movingOriginal.h) || 1);

  const isPreviewReflow = target?.isPreview === true;
  const previewReservedRows = new Set();

  if (isPreviewReflow) {
    const originalY = Math.max(0, Number(movingOriginal.y) || 0);
    for (let row = originalY; row < originalY + movingH; row += 1) {
      previewReservedRows.add(row);
    }
  }
  const targetX = clampX(target?.x, movingW);
  const targetY = Math.max(0, Number(target?.y) || 0);

  const movedItem = { ...movingOriginal, x: targetX, y: targetY, w: movingW, h: movingH };

  const rawHoverX = Number(target?.hoverX);
  const rawHoverY = Number(target?.hoverY);
  const hoverX = Number.isFinite(rawHoverX) ? clampX(rawHoverX, movingW) : targetX;
  const hoverY = Number.isFinite(rawHoverY) ? Math.max(0, rawHoverY) : targetY;
  const movedCollisionItem = { ...movingOriginal, x: hoverX, y: hoverY, w: movingW, h: movingH };

  const otherItems = layoutItems.filter((item) => item.widgetId !== movingWidgetId).sort((a, b) => (a.y - b.y) || (a.x - b.x));

  const deltaX = targetX - movingOriginal.x;
  const deltaY = targetY - movingOriginal.y;
  const isVerticalDrag = Math.abs(deltaY) >= Math.abs(deltaX);

  const getOverlapInfo = (stationaryItem) => {
    const overlapW = Math.min(movedCollisionItem.x + movedCollisionItem.w, stationaryItem.x + stationaryItem.w) - Math.max(movedCollisionItem.x, stationaryItem.x);
    const overlapH = Math.min(movedCollisionItem.y + movedCollisionItem.h, stationaryItem.y + stationaryItem.h) - Math.max(movedCollisionItem.y, stationaryItem.y);
    const safeOverlapW = Math.max(0, overlapW);
    const safeOverlapH = Math.max(0, overlapH);
    const overlapArea = safeOverlapW * safeOverlapH;
    const stationaryArea = Math.max(1, Number(stationaryItem.w) || 1) * Math.max(1, Number(stationaryItem.h) || 1);
    const movingArea = Math.max(1, Number(movedItem.w) || 1) * Math.max(1, Number(movedItem.h) || 1);
    const stationaryCoverage = overlapArea / stationaryArea;
    const movingCoverage = overlapArea / movingArea;
    const coverageScore = Math.max(stationaryCoverage, movingCoverage);
    return { item: stationaryItem, overlapW: safeOverlapW, overlapH: safeOverlapH, overlapArea, stationaryArea, movingArea, stationaryCoverage, movingCoverage, coverageScore };
  };

  const getDirectionRank = (item) => {
    if (isVerticalDrag) {
      if (deltaY > 0) return item.y;
      if (deltaY < 0) return -item.y;
    }
    if (!isVerticalDrag) {
      if (deltaX > 0) return item.x;
      if (deltaX < 0) return -item.x;
    }
    return item.y;
  };

  const collidingItems = otherItems.filter((item) => overlaps(movedCollisionItem, item)).map(getOverlapInfo);

  const coveredCollisionItems = collidingItems.filter((entry) => entry.stationaryCoverage >= 0.5 || entry.movingCoverage >= 0.5).sort((a, b) => {
    if (b.coverageScore !== a.coverageScore) return b.coverageScore - a.coverageScore;
    const rankA = getDirectionRank(a.item);
    const rankB = getDirectionRank(b.item);
    if (rankA !== rankB) return rankA - rankB;
    return (a.item.y - b.item.y) || (a.item.x - b.item.x);
  });

  const passThroughFullWidthItem = collidingItems.map((entry) => entry.item)
    .filter((item) => {
      const itemY = Math.max(0, Number(item.y) || 0);
      const itemW = Math.max(1, Number(item.w) || 1);
      const itemH = Math.max(1, Number(item.h) || 1);
      const movingOriginalY = Math.max(0, Number(movingOriginal.y) || 0);

      return (
        movingW < GRID_COLUMNS &&
        deltaY > 0 &&
        itemY >= movingOriginalY &&
        itemW >= GRID_COLUMNS &&
        itemH > 1
      );
    })
    .sort((a, b) => (a.y - b.y) || (a.x - b.x))[0] || null;

  const passThroughFullWidthY = passThroughFullWidthItem
    ? Math.max(0, Number(passThroughFullWidthItem.y) || 0)
    : 0;
  const passThroughFullWidthH = passThroughFullWidthItem
    ? Math.max(1, Number(passThroughFullWidthItem.h) || 1)
    : 1;
  const passThroughStartY = passThroughFullWidthY + 0.25;

  const isPartialPassThroughFullWidth =
    !!passThroughFullWidthItem && hoverY >= passThroughStartY;

  const thinFullWidthPassThroughItem = collidingItems
    .map((entry) => entry.item)
    .filter((item) => {
      const itemY = Math.max(0, Number(item.y) || 0);
      const itemH = Math.max(1, Number(item.h) || 1);
      const movingOriginalY = Math.max(0, Number(movingOriginal.y) || 0);

      return (
        movingW >= GRID_COLUMNS &&
        movingH === 1 &&
        deltaY > 0 &&
        itemY >= movingOriginalY &&
        itemH > movingH &&
        hoverY >= itemY + 0.25
      );
    })
    .sort((a, b) => {
      const bottomA = (Number(a.y) || 0) + Math.max(1, Number(a.h) || 1);
      const bottomB = (Number(b.y) || 0) + Math.max(1, Number(b.h) || 1);
      if (bottomB !== bottomA) return bottomB - bottomA;
      return (a.y - b.y) || (a.x - b.x);
    })[0] || null;

  const thinFullWidthPassThroughY = thinFullWidthPassThroughItem
    ? Math.max(0, Number(thinFullWidthPassThroughItem.y) || 0)
    : 0;
  const thinFullWidthPassThroughH = thinFullWidthPassThroughItem
    ? Math.max(1, Number(thinFullWidthPassThroughItem.h) || 1)
    : 1;

  const isThinFullWidthPassThrough = !!thinFullWidthPassThroughItem;

  const tallFullWidthPassThroughThinItem = collidingItems
    .map((entry) => entry.item)
    .filter((item) => {
      const itemY = Math.max(0, Number(item.y) || 0);
      const itemW = Math.max(1, Number(item.w) || 1);
      const itemH = Math.max(1, Number(item.h) || 1);
      const movingOriginalY = Math.max(0, Number(movingOriginal.y) || 0);

      return (
        movingW >= GRID_COLUMNS &&
        movingH > 1 &&
        deltaY > 0 &&
        itemY >= movingOriginalY &&
        itemW >= GRID_COLUMNS &&
        itemH < movingH &&
        hoverY + movingH >= itemY + 0.5
      );
    })
    .sort((a, b) => (a.y - b.y) || (a.x - b.x))[0] || null;

  const tallFullWidthPassThroughThinY = tallFullWidthPassThroughThinItem
    ? Math.max(0, Number(tallFullWidthPassThroughThinItem.y) || 0)
    : 0;
  const tallFullWidthPassThroughThinH = tallFullWidthPassThroughThinItem
    ? Math.max(1, Number(tallFullWidthPassThroughThinItem.h) || 1)
    : 1;

  const isTallFullWidthPassThroughThin = !!tallFullWidthPassThroughThinItem;

  const nonAdjacentFullWidthGroupPrimaryItem = coveredCollisionItems[0]?.item || null;
  const nonAdjacentFullWidthGroupTop = nonAdjacentFullWidthGroupPrimaryItem
    ? Math.max(0, Number(nonAdjacentFullWidthGroupPrimaryItem.y) || 0)
    : 0;
  const nonAdjacentFullWidthGroupPrimaryH = nonAdjacentFullWidthGroupPrimaryItem
    ? Math.max(1, Number(nonAdjacentFullWidthGroupPrimaryItem.h) || 1)
    : 1;
  const nonAdjacentFullWidthGroupPrimaryW = nonAdjacentFullWidthGroupPrimaryItem
    ? Math.max(1, Number(nonAdjacentFullWidthGroupPrimaryItem.w) || 1)
    : 1;
  const nonAdjacentFullWidthGroupPrimaryBottom =
    nonAdjacentFullWidthGroupTop + nonAdjacentFullWidthGroupPrimaryH;
  const movingOriginalBottom =
    Math.max(0, Number(movingOriginal.y) || 0) + movingH;
  const nonAdjacentFullWidthGroupItems = nonAdjacentFullWidthGroupPrimaryItem
    ? coveredCollisionItems
        .map((entry) => entry.item)
        .filter((item) => {
          const itemTop = Math.max(0, Number(item.y) || 0);
          const itemBottom = itemTop + Math.max(1, Number(item.h) || 1);
          return (
            itemTop < nonAdjacentFullWidthGroupPrimaryBottom &&
            itemBottom > nonAdjacentFullWidthGroupTop
          );
        })
    : [];

  const nonAdjacentFullWidthGroupBottom = nonAdjacentFullWidthGroupItems.reduce(
    (max, item) => {
      const itemY = Math.max(0, Number(item.y) || 0);
      const itemH = Math.max(1, Number(item.h) || 1);
      return Math.max(max, itemY + itemH);
    },
    nonAdjacentFullWidthGroupPrimaryBottom,
  );

  const isNonAdjacentFullWidthGroupPassThrough =
    movingW >= GRID_COLUMNS &&
    movingH > 1 &&
    deltaY > 0 &&
    !!nonAdjacentFullWidthGroupPrimaryItem &&
    nonAdjacentFullWidthGroupPrimaryW < GRID_COLUMNS &&
    nonAdjacentFullWidthGroupTop > movingOriginalBottom &&
    hoverY + movingH >= nonAdjacentFullWidthGroupTop + 0.5;

  const thinFullWidthUpPartialPrimaryItem = collidingItems
    .map((entry) => entry.item)
    .filter((item) => {
      const itemY = Math.max(0, Number(item.y) || 0);
      const itemW = Math.max(1, Number(item.w) || 1);
      const movingOriginalY = Math.max(0, Number(movingOriginal.y) || 0);

      return (
        movingW >= GRID_COLUMNS &&
        movingH === 1 &&
        deltaY < 0 &&
        itemY <= movingOriginalY &&
        itemW < GRID_COLUMNS &&
        hoverY <= itemY + 0.75
      );
    })
    .sort((a, b) => (b.y - a.y) || (a.x - b.x))[0] || null;

  const thinFullWidthUpPartialTop = thinFullWidthUpPartialPrimaryItem
    ? Math.max(0, Number(thinFullWidthUpPartialPrimaryItem.y) || 0)
    : 0;
  const thinFullWidthUpPartialPrimaryH = thinFullWidthUpPartialPrimaryItem
    ? Math.max(1, Number(thinFullWidthUpPartialPrimaryItem.h) || 1)
    : 1;
  const thinFullWidthUpPartialBottom =
    thinFullWidthUpPartialTop + thinFullWidthUpPartialPrimaryH;

  const thinFullWidthUpPartialGroupItems = thinFullWidthUpPartialPrimaryItem
    ? otherItems.filter((item) => {
        const itemTop = Math.max(0, Number(item.y) || 0);
        const itemBottom = itemTop + Math.max(1, Number(item.h) || 1);
        const itemW = Math.max(1, Number(item.w) || 1);

        return (
          itemW < GRID_COLUMNS &&
          itemTop < thinFullWidthUpPartialBottom &&
          itemBottom > thinFullWidthUpPartialTop
        );
      })
    : [];

  const thinFullWidthUpPartialGroupWidth = thinFullWidthUpPartialGroupItems.reduce(
    (sum, item) => sum + Math.max(1, Number(item.w) || 1),
    0,
  );

  const isThinFullWidthUpPartialGroup =
    !!thinFullWidthUpPartialPrimaryItem &&
    thinFullWidthUpPartialGroupItems.length > 0 &&
    thinFullWidthUpPartialGroupWidth >= GRID_COLUMNS;

  const thinFullWidthUpMovedItem = isThinFullWidthUpPartialGroup
    ? {
        ...movedItem,
        y: thinFullWidthUpPartialTop,
      }
    : null;

  const thinFullWidthUpPartialGroupMovedItems = isThinFullWidthUpPartialGroup
    ? thinFullWidthUpPartialGroupItems.map((item) => ({
        ...item,
        y: Math.max(0, Number(item.y) || 0) + movingH,
      }))
    : [];

  const targetPositionHasCollision = otherItems.some((item) =>
    overlaps(movedItem, item),
  );

  if (
    collidingItems.length > 0 &&
    coveredCollisionItems.length === 0 &&
    targetPositionHasCollision &&
    !isPartialPassThroughFullWidth &&
    !isThinFullWidthPassThrough &&
    !isTallFullWidthPassThroughThin &&
    !isNonAdjacentFullWidthGroupPassThrough &&
    !isThinFullWidthUpPartialGroup
  ) {
    return layoutItems.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  }

  const primaryCollisionItem = coveredCollisionItems[0]?.item || null;

  const sameSizeSwapItem = (() => {
    const item = primaryCollisionItem;
    if (!item) return null;
    if (item.w !== movingW || item.h !== movingH) return null;
    return item;
  })();

  const passThroughMovedItem = isPartialPassThroughFullWidth
    ? {
        ...movedItem,
        y: passThroughFullWidthY + passThroughFullWidthH,
      }
    : null;

  const thinFullWidthPassThroughMovedItem = isThinFullWidthPassThrough
    ? {
        ...movedItem,
        y: thinFullWidthPassThroughY + thinFullWidthPassThroughH,
      }
    : null;

  const tallFullWidthPassThroughThinMovedItem = isTallFullWidthPassThroughThin
    ? {
        ...movedItem,
        y: tallFullWidthPassThroughThinY + tallFullWidthPassThroughThinH,
      }
    : null;

  const nonAdjacentFullWidthGroupMovedItem =
    isNonAdjacentFullWidthGroupPassThrough
      ? {
          ...movedItem,
          y: nonAdjacentFullWidthGroupBottom,
        }
      : null;

  let placedItems = [];
  let remainingItems = otherItems;

  if (sameSizeSwapItem) {
    placedItems = [
      { ...movedItem, x: sameSizeSwapItem.x, y: sameSizeSwapItem.y },
      { ...sameSizeSwapItem, x: movingOriginal.x, y: movingOriginal.y },
    ];
    remainingItems = otherItems.filter((item) => item.widgetId !== sameSizeSwapItem.widgetId);
  } else if (passThroughMovedItem) {
    placedItems = [passThroughMovedItem];
    remainingItems = otherItems;
  } else if (thinFullWidthPassThroughMovedItem) {
    placedItems = [thinFullWidthPassThroughMovedItem];
    remainingItems = otherItems;
  } else if (tallFullWidthPassThroughThinMovedItem) {
    placedItems = [tallFullWidthPassThroughThinMovedItem];
    remainingItems = otherItems;
  } else if (nonAdjacentFullWidthGroupMovedItem) {
    placedItems = [nonAdjacentFullWidthGroupMovedItem];
    remainingItems = otherItems;
  } else if (thinFullWidthUpMovedItem) {
    const thinFullWidthUpGroupIds = new Set(
      thinFullWidthUpPartialGroupItems.map((item) => item.widgetId),
    );
    placedItems = [thinFullWidthUpMovedItem, ...thinFullWidthUpPartialGroupMovedItems];
    remainingItems = otherItems.filter(
      (item) => !thinFullWidthUpGroupIds.has(item.widgetId),
    );
  } else if (primaryCollisionItem && movingW >= GRID_COLUMNS) {
    const primaryTop = Math.max(0, Number(primaryCollisionItem.y) || 0);
    const primaryBottom = primaryTop + Math.max(1, Number(primaryCollisionItem.h) || 1);
    const movingOriginalY = Math.max(0, Number(movingOriginal.y) || 0);

    const collisionGroupItems = coveredCollisionItems
      .map((entry) => entry.item)
      .filter((item) => {
        const itemTop = Math.max(0, Number(item.y) || 0);
        const itemBottom = itemTop + Math.max(1, Number(item.h) || 1);
        return itemTop < primaryBottom && itemBottom > primaryTop;
      })
      .sort((a, b) => (a.x - b.x) || (a.y - b.y));

    const displacedGroupItems = collisionGroupItems.map((item) => {
      const itemY = Math.max(0, Number(item.y) || 0);
      const relativeY = itemY - primaryTop;
      return {
        ...item,
        x: clampX(item.x, item.w),
        y: Math.max(0, movingOriginalY + relativeY),
      };
    });

    const canPlaceDisplacedGroup =
      displacedGroupItems.length > 0 &&
      displacedGroupItems.every((item, index) => {
        const previousGroupItems = displacedGroupItems.slice(0, index);
        return !hasCollision(item, [movedItem, ...previousGroupItems]);
      });

    if (canPlaceDisplacedGroup) {
      const displacedGroupIds = new Set(displacedGroupItems.map((item) => item.widgetId));
      placedItems = [movedItem, ...displacedGroupItems];
      remainingItems = otherItems.filter((item) => !displacedGroupIds.has(item.widgetId));
    } else {
      const displacedPrimaryStart = {
        ...primaryCollisionItem,
        x: clampX(primaryCollisionItem.x, primaryCollisionItem.w),
        y: movingOriginalY,
      };
      const displacedPrimaryItem = hasCollision(displacedPrimaryStart, [movedItem])
        ? findNextFreePosition(displacedPrimaryStart, [movedItem])
        : displacedPrimaryStart;
      placedItems = [movedItem, displacedPrimaryItem];
      remainingItems = otherItems.filter((item) => item.widgetId !== primaryCollisionItem.widgetId);
    }
  } else {
    placedItems = [movedItem];
  }

  remainingItems.forEach((item) => {
    if (!hasCollision(item, placedItems)) {
      placedItems.push(item);
      return;
    }
    placedItems.push(findNextFreePosition(item, placedItems));
  });

  return compactEmptyRows(placedItems, previewReservedRows);
};

const renderAbsoluteGraphCard = (item, index) => {
  if (!gridWidth) return null;
  const frame = getGridItemFrame(item, gridWidth);
  const key = item.widgetId || item.id || String(index);
  return (
    <View key={'abs-' + key} style={[styles.absoluteGraphCell, {
      left: frame.left, top: frame.top, width: frame.width, height: frame.height,
    }]}>
      {renderGraphCard(item, index)}
    </View>
  );
};

const gridBoardHeight = useMemo(() => {
  const items = Array.isArray(displayLayout) ? displayLayout : [];
  const maxRow = items.reduce((max, item) => {
    const y = Math.max(0, Number(item?.y) || 0);
    const h = Math.max(1, Number(item?.h) || 1);
    return Math.max(max, y + h);
  }, 0);
  if (maxRow <= 0) return GRID_ROW_HEIGHT;
  return maxRow * GRID_ROW_HEIGHT + Math.max(0, maxRow - 1) * GRID_ROW_GAP;
}, [displayLayout]);

const layoutRows = useMemo(() => {
 const rows = new Map();
 (Array.isArray(displayLayout) ? displayLayout : []).forEach((item, index) => {
 const safeW = Math.max(1, Math.min(GRID_COLUMNS, Number(item?.w || GRID_COLUMNS)));
 const safeX = Math.max(0, Math.min(GRID_COLUMNS - safeW, Number(item?.x || 0)));
 const safeY = Number.isFinite(Number(item?.y)) ? Math.max(0, Number(item.y)) : index;
 const normalized = { ...item, x: safeX, y: safeY, w: safeW };
 if (!rows.has(safeY)) rows.set(safeY, []);
 rows.get(safeY).push(normalized);
 });

 return Array.from(rows.entries())
 .sort((a, b) => a[0] - b[0])
 .map(([rowY, items]) => {
 const sortedItems = items.sort((a, b) => {
 if (a.x !== b.x) return a.x - b.x;
 return String(a.widgetId || a.id || '').localeCompare(String(b.widgetId || b.id || ''));
 });
 const slots = [];
 let cursor = 0;

 sortedItems.forEach((item, index) => {
 const itemX = Math.max(cursor, Number(item.x || 0));
 if (itemX > cursor) {
 slots.push({ type: 'spacer', key: `spacer-${rowY}-${index}`, w: itemX - cursor });
 }
 const itemW = Math.max(1, Math.min(GRID_COLUMNS - itemX, Number(item.w || GRID_COLUMNS)));
 slots.push({ type: 'item', key: `item-${rowY}-${item.widgetId || item.id || index}`, item: { ...item, x: itemX, w: itemW }, w: itemW });
 cursor = Math.min(GRID_COLUMNS, itemX + itemW);
 });

 if (cursor < GRID_COLUMNS) {
 slots.push({ type: 'spacer', key: `spacer-${rowY}-end`, w: GRID_COLUMNS - cursor });
 }

 return { rowY, slots };
 });
 }, [displayLayout]);


 const pickerWidgets = useMemo(() => {
 const byId = new Map();

 DEFAULT_WIDGET_IDS.forEach((id) => {
 const widget = getWidgetById(id);
 if (widget) byId.set(id, widget);
 });

 getShopWidgets().forEach((widget) => {
 const id = widget?.id || widget?.widgetId;
 if (id) byId.set(id, widget);
 });

 return Array.from(byId.values()).filter((widget) => {
 const id = widget?.id || widget?.widgetId;
 if (!id || placedIds.has(id)) return false;
 if (typeof supportsWidgetTarget === 'function' && !supportsWidgetTarget(widget, dashboardTarget)) return false;
 return true;
 });
 }, [dashboardTarget, placedIds]);

 const addGraph = useCallback((widget) => {
 const widgetId = widget?.id || widget?.widgetId;
 if (!widgetId) return;

 setLayout((current) => {
 if (current.some(item => (item.widgetId || item.id) === widgetId)) return current;

 const nextItem = {
   ...widget,
   id: widgetId,
   widgetId,
   x: 0,
   y: 0,
   w: Math.max(1, Math.min(GRID_COLUMNS, Number(widget?.defaultSize?.w || GRID_COLUMNS))),
   h: Math.max(1, Number(widget?.defaultSize?.h || 1)),
 };

 return compactDashboardLayoutSpaces(
   repairDashboardLayoutOverlaps(
     normalizeLayout([...current, nextItem], dashboardTarget),
   ),
 );
 });

 setPickerVisible(false);
 }, [dashboardTarget]);
 const moveGraph = useCallback((widgetId, direction) => {
  setLayout((current) => {
    const source = Array.isArray(current) ? current.map(normalizeLayoutItem) : [];
    const movingItem = source.find((item) => item.widgetId === widgetId);
    if (!movingItem) return current;

    const getSize = (item) => {
      const w = Math.max(1, Math.min(GRID_COLUMNS, Number(item.w) || 1));
      const h = Math.max(1, Number(item.h) || 1);
      return { w, h };
    };

    const clampItem = (item) => {
      const { w, h } = getSize(item);
      return {
        ...item,
        w,
        h,
        x: Math.max(0, Math.min(GRID_COLUMNS - w, Number(item.x) || 0)),
        y: Math.max(0, Number(item.y) || 0),
      };
    };

    const overlaps = (a, b) => {
      const aItem = clampItem(a);
      const bItem = clampItem(b);
      const xOverlap = aItem.x < bItem.x + bItem.w && aItem.x + aItem.w > bItem.x;
      const yOverlap = aItem.y < bItem.y + bItem.h && aItem.y + aItem.h > bItem.y;
      return xOverlap && yOverlap;
    };

    const isFree = (candidate, placed) => !placed.some((item) => overlaps(candidate, item));

    const findNextFreePosition = (seedItem, placed) => {
      const base = clampItem(seedItem);
      const maxScanY = Math.max(
        base.y + 30,
        ...placed.map((item) => (Number(item.y) || 0) + (Number(item.h) || 1) + 30)
      );

      for (let y = base.y; y <= maxScanY; y += 1) {
        const startX = y === base.y ? base.x : 0;
        for (let x = startX; x <= GRID_COLUMNS - base.w; x += 1) {
          const candidate = { ...base, x, y };
          if (isFree(candidate, placed)) return candidate;
        }
      }

      return { ...base, x: 0, y: maxScanY + 1 };
    };

    const reflowInOrder = (orderedItems) => {
      const placed = [];

      orderedItems.forEach((item) => {
        const seedItem = clampItem({ ...item, y: 0 });
        const nextItem = findNextFreePosition(seedItem, placed);
        placed.push(nextItem);
      });

      return placed.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    };

    const movingSize = getSize(movingItem);
    const isDropTarget = direction && typeof direction === 'object' && direction.type === 'drop';

    if (!isDropTarget && movingSize.w >= GRID_COLUMNS && (direction === 'left' || direction === 'right')) {
      return current;
    }

    if (!isDropTarget && movingSize.w >= GRID_COLUMNS && (direction === 'up' || direction === 'down')) {
      const sorted = source
        .map(clampItem)
        .sort((a, b) => (a.y - b.y) || (a.x - b.x));

      const rows = [];
      sorted.forEach((item) => {
        const lastRow = rows[rows.length - 1];
        if (!lastRow || lastRow.y !== item.y) {
          rows.push({ y: item.y, items: [item] });
        } else {
          lastRow.items.push(item);
        }
      });

      const rowIndex = rows.findIndex((row) =>
        row.items.some((item) => item.widgetId === widgetId)
      );

      if (rowIndex < 0) return current;

      const targetRowIndex = direction === 'up' ? rowIndex - 1 : rowIndex + 1;
      if (targetRowIndex < 0 || targetRowIndex >= rows.length) return current;

      const nextRows = [...rows];
      const [movingRow] = nextRows.splice(rowIndex, 1);
      nextRows.splice(targetRowIndex, 0, movingRow);

      const orderedItems = nextRows.flatMap((row) => row.items);
      return reflowInOrder(orderedItems);
    }

    let targetX = Number(movingItem.x) || 0;
    let targetY = Number(movingItem.y) || 0;

    if (isDropTarget) {
      targetX = Number(direction.x) || 0;
      targetY = Number(direction.y) || 0;
    } else {
      if (direction === 'left') targetX -= 1;
      if (direction === 'right') targetX += 1;
      if (direction === 'up') targetY -= 1;
      if (direction === 'down') targetY += 1;
    }

    const targetHoverX =
      isDropTarget && Number.isFinite(Number(direction.hoverX))
        ? Number(direction.hoverX)
        : targetX;
    const targetHoverY =
      isDropTarget && Number.isFinite(Number(direction.hoverY))
        ? Number(direction.hoverY)
        : targetY;

    if (isDropTarget) {
      const resultLayout = calculateReflowLayout(source, widgetId, {
        x: targetX,
        y: targetY,
        hoverX: targetHoverX,
        hoverY: targetHoverY,
      });
      return resultLayout;
    }

    const movedItem = clampItem({ ...movingItem, x: targetX, y: targetY });

    if (movedItem.x === movingItem.x && movedItem.y === movingItem.y) {
      return current;
    }

    const placed = [movedItem];
    const remaining = source
      .filter((item) => item.widgetId !== widgetId)
      .map(clampItem)
      .sort((a, b) => (a.y - b.y) || (a.x - b.x));

    remaining.forEach((item) => {
      const nextItem = findNextFreePosition(item, placed);
      placed.push(nextItem);
    });

    const resultLayout = placed.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    return resultLayout;
  });
}, [dashboardTarget]);

 const removeGraph = useCallback((widgetId) => {
 setLayout((current) => {
 if (current.length <= 1) {
 Alert.alert('안내', '대시보드에는 그래프가 1개 이상 있어야 합니다.');
 return current;
 }
 const nextLayout = current.filter(item => (item.widgetId || item.id) !== widgetId);
 return compactDashboardLayoutSpaces(
   repairDashboardLayoutOverlaps(
     normalizeLayout(nextLayout, dashboardTarget),
   ),
 );
 });
 }, [dashboardTarget]);

const buildResizedLayoutWithReflow = useCallback((sourceLayout, targetWidgetId, nextSize, options = {}) => {
 if (!targetWidgetId || !nextSize) {
 return Array.isArray(sourceLayout) ? sourceLayout : [];
 }

 const source = Array.isArray(sourceLayout) ? sourceLayout.map(normalizeLayoutItem) : [];
 let resizedItem = null;

 const resizedLayout = source.map((item) => {
 const currentId = item.widgetId || item.id;
 if (currentId !== targetWidgetId) return item;

 const nextW = Number(nextSize.w);
 const nextH = Number(nextSize.h);
 const clamped = clampDashboardResizeSize(targetWidgetId, nextW, nextH);
 const maxX = Math.max(0, GRID_COLUMNS - clamped.w);
 const rawX = Number.isFinite(Number(nextSize.x)) ? Number(nextSize.x) : Number(item.x) || 0;
 const rawY = Number.isFinite(Number(nextSize.y)) ? Number(nextSize.y) : Number(item.y) || 0;
 const safeX = Math.max(0, Math.min(maxX, rawX));
 const safeY = Math.max(0, rawY);

 resizedItem = {
 ...item,
 x: safeX,
 y: safeY,
 w: clamped.w,
 h: clamped.h,
 };

 return resizedItem;
 });

 if (!resizedItem) return source;

 const isPreview = options?.isPreview === true;

 try {
 const reflowed = calculateReflowLayout(resizedLayout, targetWidgetId, {
 type: 'resize',
 x: resizedItem.x,
 y: resizedItem.y,
 w: resizedItem.w,
 h: resizedItem.h,
 hoverX: resizedItem.x,
 hoverY: resizedItem.y,
 isPreview,
 });

 return reflowDashboardLayoutWithFixedItem(
 Array.isArray(reflowed) ? reflowed : resizedLayout,
 targetWidgetId,
 resizedItem,
 );
 } catch (error) {
 if (!isPreview) {
 console.warn('[DashboardEditScreen] resize reflow failed:', error?.message || error);
 }
 return reflowDashboardLayoutWithFixedItem(
 resizedLayout,
 targetWidgetId,
 resizedItem,
 );
 }
}, []);

const resizeLayoutItem = useCallback((widgetId, nextSize) => {
 if (!widgetId || !nextSize) return;

 setLayout((prev) => buildResizedLayoutWithReflow(prev, widgetId, nextSize, {
 isPreview: false,
 }));
}, [buildResizedLayoutWithReflow]);

const getLayoutPreviewSignature = useCallback((items) => {
 return Array.isArray(items)
 ? items
 .map((item) => [
 item.widgetId || item.id || '',
 Number(item.x) || 0,
 Number(item.y) || 0,
 Number(item.w) || 0,
 Number(item.h) || 0,
 ].join(':'))
 .join('|')
 : '';
}, []);

 const signalDashboardEditReturn = useCallback((mode) => {
    const returnRouteKey = route?.params?.returnRouteKey;
    if (!returnRouteKey) return;

    const dashboardEditReturnedAt = Date.now();
        navigation.dispatch({
      ...CommonActions.setParams({
        dashboardEditReturnMode: mode,
        dashboardEditReturnedAt,
      }),
      source: returnRouteKey,
    });
  }, [challengeId, navigation, route?.params?.returnRouteKey]);

  const saveLayout = useCallback(async () => {
 if (!challengeId) {
 Alert.alert('오류', '대시보드 대상을 찾지 못했습니다.');
 return;
 }

 try {
 await saveDashboardLayoutForChallenge(challengeId, layout, dashboardTarget);
     const returnRouteKey = route?.params?.returnRouteKey;
    const dashboardEditReturnedAt = Date.now();

    if (returnRouteKey) {
            navigation.dispatch({
        ...CommonActions.setParams({
          dashboardEditReturnMode: 'save',
          dashboardEditReturnedAt,
        }),
        source: returnRouteKey,
      });
    }
    navigation.goBack();
 } catch (error) {
 console.log('대시보드 저장 실패:', error?.message || error);
 Alert.alert('오류', '대시보드를 저장하지 못했습니다.');
 }
 }, [challengeId, dashboardTarget, layout, navigation, route?.params]);

 const renderGraphCard = (item, index) => {
 if (item.isPlaceholder) {
   const ph = item;
   const w = Math.max(1, Math.min(GRID_COLUMNS, Number(ph.w || GRID_COLUMNS)));
   const h = Math.max(1, Number(ph.h || 1));
   const slotW = gridWidth > 0 ? gridWidth / GRID_COLUMNS : 0;
   return (
     <View style={[styles.graphCell, { opacity: 0.5 }]}>
       <View style={[styles.graphCard, { minHeight: h >= 2 ? 120 : 90, backgroundColor: '#E5E7EB', borderColor: '#9CA3AF', borderStyle: 'dashed' }]} />
     </View>
   );
 }
 const widgetId = item.widgetId || item.id || `graph_${index}`;
 const titleText = item.title || item.name || widgetId;
 const safeW = Math.max(1, Math.min(GRID_COLUMNS, Number(item.w || GRID_COLUMNS)));
 const safeX = Math.max(0, Math.min(GRID_COLUMNS - safeW, Number(item.x || 0)));
 const safeY = Number.isFinite(Number(item.y)) ? Math.max(0, Number(item.y)) : index;
 const safeH = Math.max(1, Number(item.h || 1));
 const isCompactCard = safeH === 1;
 const cardHeight = getGridItemHeight(safeH);
 const innerCardHeight = Math.max(0, cardHeight - RESIZE_FRAME_INSET * 2);
 const slotWidth = gridWidth > 0 ? gridWidth / GRID_COLUMNS : 0;
const isResizeActive = activeResizeWidgetId === widgetId;
const isThisResizeDragging = resizeDraggingWidgetId === widgetId;

const resizeFrameWidth = slotWidth ? Math.max(0, slotWidth * safeW) : 0;
const resizeCornerSize = RESIZE_ACTIVE_CORNER_SIZE;
const resizeDashMotionPad = 36;

const ghostDiagonalH = isResizeActive && resizeGhostFrame?.visualFramePx ? resizeGhostFrame.visualFramePx.height : cardHeight;
const ghostDiagonalW = isResizeActive && resizeGhostFrame?.visualFramePx ? resizeGhostFrame.visualFramePx.width : resizeFrameWidth;

const resizeDiagonalStartX = resizeCornerSize;
const resizeDiagonalStartY = Math.max(resizeCornerSize, ghostDiagonalH - resizeCornerSize);
const resizeDiagonalEndX = Math.max(resizeDiagonalStartX, ghostDiagonalW - resizeCornerSize);
const resizeDiagonalEndY = resizeCornerSize;
const resizeDiagonalDX = resizeDiagonalEndX - resizeDiagonalStartX;
const resizeDiagonalDY = resizeDiagonalEndY - resizeDiagonalStartY;
const resizeDiagonalLength = Math.max(1, Math.sqrt(
 resizeDiagonalDX * resizeDiagonalDX + resizeDiagonalDY * resizeDiagonalDY
));
const resizeDiagonalAngle = Math.atan2(resizeDiagonalDY, resizeDiagonalDX) * (180 / Math.PI);
const resizeDiagonalMidX = (resizeDiagonalStartX + resizeDiagonalEndX) / 2;
const resizeDiagonalMidY = (resizeDiagonalStartY + resizeDiagonalEndY) / 2;
const resizeDiagonalTrackStyle = {
 left: resizeDiagonalMidX - resizeDiagonalLength / 2,
 top: resizeDiagonalMidY - 5,
 width: resizeDiagonalLength,
 transform: [{ rotate: `${resizeDiagonalAngle}deg` }],
};
const resizeDiagonalDashStyle = {
 width: resizeDiagonalLength + resizeDashMotionPad,
 transform: [{ translateX: resizeDashTranslateX }],
};

 const scheduleResizeGhostBounceBack = (widgetId, nextFrame, boundedFramePx, signature) => {
 if (!widgetId || !boundedFramePx || !signature) return;

 clearResizeGhostBounceTimer();
 resizeGhostBounceSignatureRef.current = signature;

 resizeGhostBounceTimerRef.current = setTimeout(() => {
 if (resizeGhostBounceSignatureRef.current !== signature) return;

 setResizeGhostFrame((current) => {
 if (!current || current.widgetId !== widgetId) return current;

 return {
 ...current,
 x: nextFrame.x,
 y: nextFrame.y,
 w: nextFrame.w,
 h: nextFrame.h,
 visualFramePx: boundedFramePx,
 boundedFramePx,
 };
 });

 resizeGhostBounceTimerRef.current = null;
 }, RESIZE_GHOST_BOUNCE_BACK_MS);
};

const buildResizeGesture = (corner) => Gesture.Pan()
 .enabled(isResizeActive)
 .runOnJS(true)
 .onBegin(() => {
 setResizeDraggingWidgetId(widgetId);
 resizeOriginRef.current = {
 x: safeX,
 y: safeY,
 w: safeW,
 h: safeH,
 };
 resizePreviewSignatureRef.current = '';
 resizePreviewSizeRef.current = `${safeX}:${safeY}:${safeW}:${safeH}`;
 clearResizeGhostBounceTimer();
 setPreviewLayout(null);
 const initialGhostState = getResizeGhostVisualFramePx(
 widgetId,
 { x: safeX, y: safeY, w: safeW, h: safeH },
 corner,
 0,
 0,
 gridWidth,
 );
 setResizeGhostFrame({
 widgetId,
 x: safeX,
 y: safeY,
 w: safeW,
 h: safeH,
 visualFramePx: initialGhostState.visualFramePx,
 boundedFramePx: initialGhostState.boundedFramePx,
 });
 })
 .onUpdate((event) => {
 const origin = resizeOriginRef.current || {
 x: safeX,
 y: safeY,
 w: safeW,
 h: safeH,
 };

 const deltaColsRaw = slotWidth ? event.translationX / slotWidth : 0;
 const deltaRowsRaw = (event.translationY || 0) / (GRID_ROW_HEIGHT + GRID_ROW_GAP);
 const deltaCols = getResizeStableGridDelta(deltaColsRaw);
 const deltaRows = getResizeStableGridDelta(deltaRowsRaw);

 const nextFrame = getAnchoredResizeFrame(widgetId, origin, corner, deltaCols, deltaRows);
 const ghostState = getResizeGhostVisualFramePx(
 widgetId,
 origin,
 corner,
 event.translationX,
 event.translationY,
 gridWidth,
 );

 const visualFrame = ghostState.visualFramePx;
 const boundedFrame = ghostState.boundedFramePx;
 const visualSignature = [
 widgetId,
 nextFrame.x,
 nextFrame.y,
 nextFrame.w,
 nextFrame.h,
 Math.round(Number(visualFrame?.left) || 0),
 Math.round(Number(visualFrame?.top) || 0),
 Math.round(Number(visualFrame?.width) || 0),
 Math.round(Number(visualFrame?.height) || 0),
 ].join(':');

 if (resizePreviewSignatureRef.current === visualSignature) {
 return;
 }

 resizePreviewSignatureRef.current = visualSignature;
 resizePreviewSizeRef.current = `${nextFrame.x}:${nextFrame.y}:${nextFrame.w}:${nextFrame.h}`;

 setResizeGhostFrame({
 widgetId,
 x: nextFrame.x,
 y: nextFrame.y,
 w: nextFrame.w,
 h: nextFrame.h,
 visualFramePx: visualFrame,
 boundedFramePx: boundedFrame,
 });

 if (ghostState.isBeyondLimit) {
 scheduleResizeGhostBounceBack(widgetId, nextFrame, boundedFrame, visualSignature);
 } else {
 clearResizeGhostBounceTimer();
 }
 })
 .onEnd((event) => {
 const origin = resizeOriginRef.current || {
 x: safeX,
 y: safeY,
 w: safeW,
 h: safeH,
 };

 const deltaColsRaw = slotWidth ? event.translationX / slotWidth : 0;
 const deltaRowsRaw = (event.translationY || 0) / (GRID_ROW_HEIGHT + GRID_ROW_GAP);
 const deltaCols = getResizeStableGridDelta(deltaColsRaw);
 const deltaRows = getResizeStableGridDelta(deltaRowsRaw);

 if (deltaCols === 0 && deltaRows === 0) {
 clearResizeGhostBounceTimer();
 setPreviewLayout(null);
 setResizeGhostFrame(null);
 setResizeDraggingWidgetId(null);
 resizeOriginRef.current = null;
 resizePreviewSignatureRef.current = '';
 resizePreviewSizeRef.current = '';
 return;
 }

 const nextFrame = getAnchoredResizeFrame(widgetId, origin, corner, deltaCols, deltaRows);
 resizeLayoutItem(widgetId, nextFrame);
 clearResizeGhostBounceTimer();
 setPreviewLayout(null);
 setResizeGhostFrame(null);
 setResizeDraggingWidgetId(null);
 resizeOriginRef.current = null;
 resizePreviewSignatureRef.current = '';
 resizePreviewSizeRef.current = '';
 })
 .onFinalize(() => {
 clearResizeGhostBounceTimer();
 setResizeDraggingWidgetId(null);
 resizeOriginRef.current = null;
 resizePreviewSignatureRef.current = '';
 resizePreviewSizeRef.current = '';
 setPreviewLayout(null);
 setResizeGhostFrame(null);
 });

const topRightResizeGesture = buildResizeGesture('topRight');
const bottomLeftResizeGesture = buildResizeGesture('bottomLeft');

const canMoveCard = !activeResizeWidgetId && !resizeDraggingWidgetId;

 const testGesture = Gesture.Pan()
   .enabled(canMoveCard)
   .activateAfterLongPress(300)
   .runOnJS(true)
   .onBegin(() => {
     clearScheduledDragVisualCleanup();
     setPreviewLayout(null);
     previewLayoutSignatureRef.current = '';
     dragOriginRef.current = { x: safeX, y: safeY, w: safeW, h: safeH };
   })
   .onStart((event) => {
     dragStartScrollYRef.current = scrollYRef.current;
     clearScheduledDragVisualCleanup();
     setGestureDraggingWidgetId(widgetId);
     setGestureDragOffset({ x: 0, y: 0 });
     setDragOverlayStart({ x: Number(event.absoluteX) || 0, y: Number(event.absoluteY) || 0 });
     setDragOverlayItem({
       widgetId: item.widgetId,
       w: safeW, h: safeH, cardHeight, isCompactCard, safeW, safeH,
       titleText,
     });
   })
   .onUpdate((event) => {
     const nextOffset = { x: event.translationX, y: event.translationY };
     setGestureDragOffset(nextOffset);
     updateDashboardAutoScroll(event.absoluteY);
     const rawGridDX = slotWidth ? event.translationX / slotWidth : 0;
     const scrollDelta = scrollYRef.current - dragStartScrollYRef.current;
     const rawGridDY = (event.translationY + scrollDelta) / (GRID_ROW_HEIGHT + GRID_ROW_GAP);
     const dX = slotWidth ? getStableGridDelta(rawGridDX) : 0;
     const dY = getStableGridDelta(rawGridDY);
     if (!slotWidth || (dX === 0 && dY === 0)) {
       setDragPlaceholder(null);
       lastDropTargetRef.current = null;
     } else {
       const dragOrigin = dragOriginRef.current || { x: safeX, y: safeY, w: safeW, h: safeH };
       const originW = Math.max(1, Math.min(GRID_COLUMNS, Number(dragOrigin.w) || safeW));
       const originX = Math.max(0, Number(dragOrigin.x) || 0);
       const originY = Math.max(0, Number(dragOrigin.y) || 0);
       const maxX = Math.max(0, GRID_COLUMNS - originW);
       const tX = originW >= GRID_COLUMNS ? 0 : Math.max(0, Math.min(maxX, originX + dX));
       const tY = Math.max(0, originY + dY);
       setDragPlaceholder((prev) => {
         if (prev && prev.x === tX && prev.y === tY && prev.w === safeW && prev.h === safeH) return prev;
         return { widgetId: '__placeholder__', x: tX, y: tY, w: safeW, h: safeH, isPlaceholder: true };
       });
       const hoverX = originX + (slotWidth ? event.translationX / slotWidth : 0);
       const hoverY = originY + (event.translationY / (GRID_ROW_HEIGHT + GRID_ROW_GAP));
       const stableHoverX = Math.round(hoverX * 4) / 4;
       const stableHoverY = Math.round(hoverY * 4) / 4;
       lastDropTargetRef.current = {
         widgetId,
         x: tX,
         y: tY,
         w: safeW,
         h: safeH,
         hoverX: stableHoverX,
         hoverY: stableHoverY,
       };
       const prevTarget = previewTargetRef.current;
       if (!prevTarget || prevTarget.x !== tX || prevTarget.y !== tY || prevTarget.hoverX !== stableHoverX || prevTarget.hoverY !== stableHoverY) {
         previewTargetRef.current = { x: tX, y: tY, hoverX: stableHoverX, hoverY: stableHoverY };
         try {
           const src = Array.isArray(layout) ? layout.map(normalizeLayoutItem) : [];
           const previewResult = calculateReflowLayout(src, widgetId, { x: tX, y: tY, hoverX: stableHoverX, hoverY: stableHoverY, isPreview: true });
           const previewSignature = Array.isArray(previewResult)
             ? previewResult
                 .map((r) => [
                   r.widgetId || r.id || '',
                   Number(r.x) || 0,
                   Number(r.y) || 0,
                   Number(r.w) || 0,
                   Number(r.h) || 0,
                 ].join(':'))
                 .join('|')
             : '';
           if (previewLayoutSignatureRef.current !== previewSignature) {
             previewLayoutSignatureRef.current = previewSignature;
             setPreviewLayout(previewResult);
           }
         } catch (e) {
           console.warn('[DashboardEditScreen] preview calculation failed:', e?.message || e);
         }
       }
     }
   })
   .onEnd((event) => {
     const rawGridDX = slotWidth ? event.translationX / slotWidth : 0;
     const scrollDelta = scrollYRef.current - dragStartScrollYRef.current;
     const rawGridDY = (event.translationY + scrollDelta) / (GRID_ROW_HEIGHT + GRID_ROW_GAP);
     const deltaX = slotWidth ? getStableGridDelta(rawGridDX) : 0;
     const deltaY = getStableGridDelta(rawGridDY);
     const lastTarget = lastDropTargetRef.current;
     if (lastTarget && lastTarget.widgetId === widgetId) {
       const dropX = safeW >= GRID_COLUMNS ? 0 : lastTarget.x;
       const dropY = lastTarget.y;
       moveGraph(widgetId, {
         type: 'drop',
         x: dropX,
         y: dropY,
         hoverX: lastTarget.hoverX,
         hoverY: lastTarget.hoverY,
       });
     } else if (deltaX !== 0 || deltaY !== 0) {
       const dragOrigin = dragOriginRef.current || { x: safeX, y: safeY, w: safeW, h: safeH };
       const originW = Math.max(1, Math.min(GRID_COLUMNS, Number(dragOrigin.w) || safeW));
       const originX = Math.max(0, Number(dragOrigin.x) || 0);
       const originY = Math.max(0, Number(dragOrigin.y) || 0);
       const maxX = Math.max(0, GRID_COLUMNS - originW);
       const tX = originW >= GRID_COLUMNS ? 0 : Math.max(0, Math.min(maxX, originX + deltaX));
       const tY = Math.max(0, originY + deltaY);
       const dropX = safeW >= GRID_COLUMNS ? 0 : tX;
       const dropY = tY;
       const fallbackHoverX = originX + (slotWidth ? event.translationX / slotWidth : 0);
       const fallbackHoverY = originY + (event.translationY / (GRID_ROW_HEIGHT + GRID_ROW_GAP));
       const stableFallbackHoverX = Math.round(fallbackHoverX * 4) / 4;
       const stableFallbackHoverY = Math.round(fallbackHoverY * 4) / 4;
       moveGraph(widgetId, {
         type: 'drop',
         x: dropX,
         y: dropY,
         hoverX: stableFallbackHoverX,
         hoverY: stableFallbackHoverY,
       });
     }

     scheduleDragVisualCleanup();
   })
   .onFinalize(() => {
     scheduleDragVisualCleanup();
   });

const cardLeftPx = safeX * slotWidth + GRID_CELL_PADDING;
const cardTopPx = safeY * (GRID_ROW_HEIGHT + GRID_ROW_GAP);
const ghostVisualFrame = isResizeActive && resizeGhostFrame?.visualFramePx;
const resizeOverlayDynamicStyle = ghostVisualFrame
 ? {
 position: 'absolute',
 left: ghostVisualFrame.left - cardLeftPx,
 top: ghostVisualFrame.top - cardTopPx,
 width: ghostVisualFrame.width,
 height: ghostVisualFrame.height,
 zIndex: 12,
 }
 : styles.resizeActiveOverlay;

 const cardContent = (
 <View key={widgetId} style={styles.graphCell}>
 <View style={[
 styles.resizeFrame,
 { minHeight: cardHeight, height: cardHeight },
 gestureDraggingWidgetId === widgetId && {
   opacity: 0.16,
 },
]}>
 {isResizeActive && (
 <View pointerEvents="box-none" style={resizeOverlayDynamicStyle}>
 <GestureDetector gesture={topRightResizeGesture}>
 <View style={[styles.resizeActiveCornerHitbox, styles.resizeActiveCornerHitboxTopRight]}>
 {!isThisResizeDragging && (
 <View style={[styles.resizeActiveCorner, styles.resizeActiveCornerTopRight]} />
 )}
 </View>
 </GestureDetector>

 <GestureDetector gesture={bottomLeftResizeGesture}>
 <View style={[styles.resizeActiveCornerHitbox, styles.resizeActiveCornerHitboxBottomLeft]}>
 {!isThisResizeDragging && (
 <View style={[styles.resizeActiveCorner, styles.resizeActiveCornerBottomLeft]} />
 )}
 </View>
 </GestureDetector>

 {!isThisResizeDragging && (
 <View pointerEvents="none" style={[styles.resizeActiveDiagonalTrack, resizeDiagonalTrackStyle]}>
 <Animated.View
 style={[
 styles.resizeActiveDiagonalDash,
 resizeDiagonalDashStyle,
 ]}
 />
 </View>
 )}
 </View>
 )}

 <View style={[
 styles.graphCard,
 {
 minHeight: innerCardHeight,
 height: innerCardHeight,
 margin: RESIZE_FRAME_INSET,
 },
 isCompactCard && { paddingVertical: 8, paddingHorizontal: 12 },
 isResizeActive && styles.graphCardResizeActive,
 isThisResizeDragging && styles.graphCardResizeDraggingHidden,
 ]}>
 <View style={styles.graphHeader}>
 <Text style={styles.graphTitle} numberOfLines={1}>{titleText}</Text>
 <TouchableOpacity style={styles.removeBtn} onPress={() => removeGraph(widgetId)}>
 <Text style={styles.removeText}>×</Text>
 </TouchableOpacity>
 </View>
 <Text style={[styles.graphMeta, isCompactCard && { marginTop: 4 }]}>{safeW + 'x' + safeH}</Text>
 </View>

 <View pointerEvents="box-none" style={styles.resizeHandleCenterLayer}>
 <TouchableOpacity
 activeOpacity={0.82}
 style={[
 styles.resizeHandle,
 isResizeActive && styles.resizeHandleActive,
 ]}
 onPress={(event) => {
 event?.stopPropagation?.();
 setActiveResizeWidgetId((current) => current === widgetId ? null : widgetId);
 }}
 >
 <View style={styles.resizeHandleCornerTopRight} />
 <View style={styles.resizeHandleCornerBottomLeft} />
 </TouchableOpacity>
</View>
 </View>
 </View>
 );
   return (
     <GestureDetector gesture={testGesture}>{cardContent}</GestureDetector>
   );
 };
 const renderGridSlot = (slot, index) => {
 const widthPct = ((Math.max(0, Number(slot.w || 0)) / GRID_COLUMNS) * 100) + '%';
 if (slot.type === 'spacer') {
 return <View key={slot.key || index} style={[styles.gridSpacer, { width: widthPct }]} />;
 }
 const isDraggingSlot = slot.item?.widgetId && slot.item.widgetId === gestureDraggingWidgetId;
 return (
 <View key={slot.key || index} style={{ width: widthPct, zIndex: isDraggingSlot ? 999 : 0, elevation: isDraggingSlot ? 12 : 0 }}>
 {renderGraphCard(slot.item, index)}
 </View>
 );
 };

 const renderDragOverlay = () => {
   if (!dragOverlayItem || !gestureDraggingWidgetId) return null;
   const o = dragOverlayItem;
   const gy = gestureDragOffset.y;
   const gx = gestureDragOffset.x;
   const slotW = gridWidth > 0 ? gridWidth / GRID_COLUMNS : 0;
   const overlayW = slotW ? slotW * Math.max(1, Number(o.w || 1)) : '90%';
   const overlayH = o.cardHeight || 120;
   const touchX = Number(dragOverlayStart.x) || 0;
   const touchY = Number(dragOverlayStart.y) || 0;
   const left = touchX ? touchX - overlayW / 2 : 16;
   const top = touchY ? touchY - overlayH / 2 : 120;
   return (
     <View pointerEvents="none" style={{
       position: 'absolute', zIndex: 9999, elevation: 50,
       width: overlayW,
       minHeight: overlayH,
       left, top,
       transform: [{ translateX: gx }, { translateY: gy }],
       borderRadius: 8,
       borderWidth: 1, borderColor: '#d8d8d8',
       backgroundColor: '#fff',
       padding: 12,
       shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
       shadowOpacity: 0.2, shadowRadius: 12,
     }}>
       <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
         <Text style={{ fontSize: 15, fontWeight: '800', color: '#111' }} numberOfLines={1}>{o.titleText}</Text>
       </View>
       <Text style={{ marginTop: 10, fontSize: 12, color: '#777' }}>{o.safeW + 'x' + o.safeH}</Text>
     </View>
   );
 };

 const renderDragPlaceholderOverlay = () => {
   if (!dragPlaceholder || !gridWidth) return null;
   const frame = getGridItemFrame(dragPlaceholder, gridWidth);
   return (
     <View pointerEvents="none" style={[styles.dragPlaceholderOverlay, {
       left: frame.left,
       top: frame.top,
       width: frame.width,
       height: frame.height,
     }]} />
   );
 };

 const renderResizeGhostFrameOverlay = () => {
 if (!resizeGhostFrame || !gridWidth || !resizeDraggingWidgetId) return null;

 const snapFrame = getGridItemFrame(resizeGhostFrame, gridWidth);
 const visualFrame = resizeGhostFrame.visualFramePx || snapFrame;
 const width = Math.max(1, Number(visualFrame.width) || 1);
 const height = Math.max(1, Number(visualFrame.height) || 1);
 const cornerSize = RESIZE_ACTIVE_CORNER_SIZE;

 const diagonalStartX = cornerSize;
 const diagonalStartY = Math.max(cornerSize, height - cornerSize);
 const diagonalEndX = Math.max(diagonalStartX, width - cornerSize);
 const diagonalEndY = cornerSize;
 const diagonalDX = diagonalEndX - diagonalStartX;
 const diagonalDY = diagonalEndY - diagonalStartY;
 const diagonalLength = Math.max(1, Math.sqrt(
 diagonalDX * diagonalDX + diagonalDY * diagonalDY
 ));
 const diagonalAngle = Math.atan2(diagonalDY, diagonalDX) * (180 / Math.PI);
 const diagonalMidX = (diagonalStartX + diagonalEndX) / 2;
 const diagonalMidY = (diagonalStartY + diagonalEndY) / 2;

 const diagonalTrackStyle = {
 left: diagonalMidX - diagonalLength / 2,
 top: diagonalMidY - 2,
 width: diagonalLength,
 transform: [{ rotate: `${diagonalAngle}deg` }],
 };

 return (
 <View
 pointerEvents="none"
 style={[
 styles.resizeGhostFrameOverlay,
 {
 left: visualFrame.left,
 top: visualFrame.top,
 width,
 height,
 },
 ]}
 >
 <View style={[styles.resizeGhostCorner, styles.resizeGhostCornerTopRight]} />
 <View style={[styles.resizeGhostCorner, styles.resizeGhostCornerBottomLeft]} />
 <View style={[styles.resizeGhostDiagonalTrack, diagonalTrackStyle]}>
 <View style={styles.resizeGhostDiagonalDash} />
 </View>
 </View>
 );
 };

 return (
 <GestureHandlerRootView style={{ flex: 1 }}>
 <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
 <View style={styles.header}>
 <TouchableOpacity style={styles.backBtn} onPress={() => { signalDashboardEditReturn('cancel'); navigation.goBack(); }}>
 <Text style={styles.backText}>‹</Text>
 </TouchableOpacity>
 <Text style={styles.screenTitle}>대시보드 수정</Text>
 <View style={styles.headerSpacer} />
 </View>

 <ScrollView
 ref={scrollRef}
 scrollEnabled={!resizeDraggingWidgetId}
 onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
 scrollEventThrottle={16}
 contentContainerStyle={[styles.content, { paddingBottom: 112 + insets.bottom }]}
>
 <View style={styles.contentHeader}>
 <Text style={styles.challengeTitle} numberOfLines={1}>{title}</Text>
 <TouchableOpacity style={styles.addBtn} onPress={() => setPickerVisible(true)}>
 <Text style={styles.addText}>위젯 추가</Text>
 </TouchableOpacity>
 </View>

 {loading ? (
 <Text style={styles.emptyText}>불러오는 중...</Text>
 ) : (
 <View style={[styles.grid, { overflow: 'visible', minHeight: gridBoardHeight }]} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
 {renderDragPlaceholderOverlay()}
 {(Array.isArray(displayLayout) ? displayLayout : []).map((item, index) => renderAbsoluteGraphCard(item, index))}
 {renderResizeGhostFrameOverlay()}
 </View>
 )}
 </ScrollView>

 <View style={[styles.footer, { paddingBottom: Math.max(18, insets.bottom + 12) }]}>
 <TouchableOpacity style={[styles.footerButton, styles.cancelButton]} onPress={() => { signalDashboardEditReturn('cancel'); navigation.goBack(); }}>
 <Text style={styles.cancelButtonText}>취소</Text>
 </TouchableOpacity>
 <TouchableOpacity style={[styles.footerButton, styles.saveButton]} onPress={saveLayout}>
 <Text style={styles.saveButtonText}>저장</Text>
 </TouchableOpacity>
 </View>

 <Modal
 visible={pickerVisible}
 transparent
 animationType="fade"
 onRequestClose={() => setPickerVisible(false)}
 >
 <View style={styles.modalOverlay}>
 <View style={styles.modalSheet}>
 <View style={styles.modalHeader}>
 <Text style={styles.modalTitle}>위젯 추가</Text>
 <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setPickerVisible(false)}>
 <Text style={styles.modalCloseText}>×</Text>
 </TouchableOpacity>
 </View>

 {pickerWidgets.length === 0 ? (
 <Text style={styles.emptyText}>추가할 수 있는 위젯이 없습니다.</Text>
 ) : (
 <ScrollView style={styles.pickerList}>
 {pickerWidgets.map((widget) => {
 const widgetId = widget.id || widget.widgetId;
 return (
 <TouchableOpacity
 key={widgetId}
 style={styles.pickerItem}
 onPress={() => addGraph(widget)}
 >
 <Text style={styles.pickerTitle}>{widget.title || widget.name || widgetId}</Text>
 <Text style={styles.pickerMeta}>{widget.description || widgetId}</Text>
 </TouchableOpacity>
 );
 })}
 </ScrollView>
 )}
 </View>
 </View>

 </Modal>
 {renderDragOverlay()}
 </SafeAreaView>
 </GestureHandlerRootView>
 );
}

const styles = StyleSheet.create({
 safe: {
 flex: 1,
 backgroundColor: '#fff',
 },
 header: {
 minHeight: 58,
 paddingHorizontal: 18,
 paddingTop: 8,
 paddingBottom: 10,
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 borderBottomWidth: StyleSheet.hairlineWidth,
 borderBottomColor: '#e6e6e6',
 },
 backBtn: {
 width: 38,
 height: 38,
 alignItems: 'center',
 justifyContent: 'center',
 zIndex: 2,
 },
 backText: {
 fontSize: 36,
 color: '#111',
 lineHeight: 38,
 },
 headerSpacer: {
 width: 38,
 height: 38,
 },
 screenTitle: {
 position: 'absolute',
 left: 0,
 right: 0,
 textAlign: 'center',
 fontSize: 18,
 fontWeight: '800',
 color: '#111',
 zIndex: 1,
 },
 challengeTitle: {
 flex: 1,
 marginRight: 12,
 fontSize: 14,
 fontWeight: '700',
 color: '#444',
 },
  content: {
 paddingHorizontal: 18,
 paddingTop: 14,
 },
 contentHeader: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 marginBottom: 14,
 },
 addBtn: {
 height: 34,
 paddingHorizontal: 12,
 borderRadius: 8,
 borderWidth: 1,
 borderColor: '#111',
 backgroundColor: '#fff',
 alignItems: 'center',
 justifyContent: 'center',
 },
 addText: {
 color: '#111',
 fontSize: 13,
 fontWeight: '800',
 },
 grid: {
 position: 'relative',
 gap: 10,
 },
 gridRow: {
 width: '100%',
 flexDirection: 'row',
 },
 graphCell: {
 width: '100%',
 paddingHorizontal: 0,
 },
 gridSpacer: {
 minHeight: 1,
 },
 resizeFrame: {
 position: 'relative',
 width: '100%',
},
graphCard: {
 minHeight: 132,
 borderRadius: 8,
 borderWidth: 1,
 borderColor: '#d8d8d8',
 borderTopWidth: 3,
 borderTopColor: '#111',
 backgroundColor: '#fff',
 padding: 12,
 },
 graphHeader: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: 8,
 },
 graphTitle: {
 flex: 1,
 fontSize: 15,
 fontWeight: '800',
 color: '#111',
 },
 removeBtn: {
 width: 28,
 height: 28,
 borderRadius: 14,
 borderWidth: 1,
 borderColor: '#ccc',
 alignItems: 'center',
 justifyContent: 'center',
 backgroundColor: '#fff',
 },
 removeText: {
 fontSize: 18,
 fontWeight: '800',
 color: '#444',
 lineHeight: 22,
 },
 graphMeta: {
 marginTop: 10,
 fontSize: 12,
 color: '#777',
 },
 graphCardResizeActive: {
 borderColor: '#111',
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 4 },
 shadowOpacity: 0.08,
 shadowRadius: 8,
 elevation: 3,
},
graphCardResizeDraggingHidden: {
 opacity: 0,
},
resizeHandleCenterLayer: {
 ...StyleSheet.absoluteFillObject,
 alignItems: 'center',
 justifyContent: 'center',
 zIndex: 20,
 elevation: 8,
},
resizeHandle: {
 width: 34,
 height: 34,
 borderRadius: 17,
 backgroundColor: '#111',
 alignItems: 'center',
 justifyContent: 'center',
},
resizeHandleActive: {
 backgroundColor: '#000',
 transform: [{ scale: 1.08 }],
},
resizeHandleCornerTopRight: {
 position: 'absolute',
 top: 8,
 right: 8,
 width: 9,
 height: 9,
 borderTopWidth: 2,
 borderRightWidth: 2,
 borderColor: '#fff',
},
resizeHandleCornerBottomLeft: {
 position: 'absolute',
 bottom: 8,
 left: 8,
 width: 9,
 height: 9,
 borderBottomWidth: 2,
 borderLeftWidth: 2,
 borderColor: '#fff',
},
resizeActiveOverlay: {
 ...StyleSheet.absoluteFillObject,
 zIndex: 12,
},
resizeActiveCornerHitbox: {
 position: 'absolute',
 width: 56,
 height: 56,
 zIndex: 24,
 elevation: 10,
},
resizeActiveCornerHitboxTopRight: {
 top: -8,
 right: -8,
 alignItems: 'flex-end',
 justifyContent: 'flex-start',
},
resizeActiveCornerHitboxBottomLeft: {
 left: -8,
 bottom: -8,
 alignItems: 'flex-start',
 justifyContent: 'flex-end',
},
resizeActiveCorner: {
 position: 'absolute',
 width: RESIZE_ACTIVE_CORNER_SIZE,
 height: RESIZE_ACTIVE_CORNER_SIZE,
 borderColor: '#111',
},
resizeActiveCornerTopRight: {
 top: 0,
 right: 0,
 borderTopWidth: 3,
 borderRightWidth: 3,
},
resizeActiveCornerBottomLeft: {
 left: 0,
 bottom: 0,
 borderLeftWidth: 3,
 borderBottomWidth: 3,
},
resizeActiveDiagonalTrack: {
 position: 'absolute',
 height: 10,
 overflow: 'hidden',
 justifyContent: 'center',
},
resizeActiveDiagonalDash: {
 borderTopWidth: 2,
 borderStyle: 'dashed',
 borderColor: '#111',
},
 emptyText: {
 paddingVertical: 24,
 textAlign: 'center',
 fontSize: 14,
 color: '#777',
 },
 footer: {
 position: 'absolute',
 left: 0,
 right: 0,
 bottom: 0,
 flexDirection: 'row',
 gap: 10,
 paddingHorizontal: 18,
 paddingTop: 12,
 borderTopWidth: StyleSheet.hairlineWidth,
 borderTopColor: '#e6e6e6',
 backgroundColor: '#fff',
 },
 footerButton: {
 flex: 1,
 height: 48,
 borderRadius: 8,
 alignItems: 'center',
 justifyContent: 'center',
 },
 cancelButton: {
 borderWidth: 1,
 borderColor: '#bbb',
 backgroundColor: '#fff',
 },
 saveButton: {
 backgroundColor: '#111',
 },
 cancelButtonText: {
 fontSize: 15,
 fontWeight: '800',
 color: '#111',
 },
 saveButtonText: {
 fontSize: 15,
 fontWeight: '800',
 color: '#fff',
 },
 modalOverlay: {
 flex: 1,
 padding: 20,
 backgroundColor: 'rgba(0,0,0,0.38)',
 alignItems: 'center',
 justifyContent: 'center',
 },
 modalSheet: {
 width: '100%',
 maxHeight: '75%',
 borderRadius: 12,
 backgroundColor: '#fff',
 padding: 16,
 },
 modalHeader: {
 flexDirection: 'row',
 alignItems: 'center',
 marginBottom: 12,
 },
 modalTitle: {
 flex: 1,
 fontSize: 18,
 fontWeight: '800',color: '#111',
 },
 modalCloseBtn: {
 width: 32,
 height: 32,
 borderRadius: 16,
 alignItems: 'center',
 justifyContent: 'center',
 backgroundColor: '#f1f1f1',
 },
 modalCloseText: {
 fontSize: 20,
 fontWeight: '800',
 color: '#333',
 lineHeight: 24,
 },
 pickerList: {
 maxHeight: 420,
 },
 pickerItem: {
 paddingVertical: 13,
 borderBottomWidth: StyleSheet.hairlineWidth,
 borderBottomColor: '#e5e5e5',
 },
 pickerTitle: {
 fontSize: 15,
 fontWeight: '800',
 color: '#111',
 },
 pickerMeta: {
 marginTop: 4,
 fontSize: 12,
 color: '#777',
 },
 absoluteGraphCell: {
 position: 'absolute',
 },
 dragPlaceholderOverlay: {
 position: 'absolute',
 borderWidth: 1.2,
 borderColor: '#999',
 borderRadius: 10,
 backgroundColor: 'rgba(0,0,0,0.04)',
 zIndex: 998,
 pointerEvents: 'none',
 },
resizeGhostFrameOverlay: {
 position: 'absolute',
 zIndex: 9998,
 elevation: 40,
 borderWidth: 1.5,
 borderStyle: 'solid',
 borderColor: '#B8B8B8',
 borderRadius: 10,
 backgroundColor: 'transparent',
 overflow: 'visible',
 pointerEvents: 'none',
},
resizeGhostCorner: {
 position: 'absolute',
 width: RESIZE_ACTIVE_CORNER_SIZE,
 height: RESIZE_ACTIVE_CORNER_SIZE,
 borderColor: '#111',
},
resizeGhostCornerTopRight: {
 top: 0,
 right: 0,
 borderTopWidth: 3,
 borderRightWidth: 3,
},
resizeGhostCornerBottomLeft: {
 left: 0,
 bottom: 0,
 borderLeftWidth: 3,
 borderBottomWidth: 3,
},
resizeGhostDiagonalTrack: {
 position: 'absolute',
 height: 4,
 overflow: 'hidden',
 justifyContent: 'center',
},
resizeGhostDiagonalDash: {
 borderTopWidth: 1.5,
 borderStyle: 'dashed',
 borderColor: '#111',
},
});
