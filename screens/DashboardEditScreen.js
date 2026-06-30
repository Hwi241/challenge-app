import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
 Alert,
 Animated,
 BackHandler,
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
 getDashboardEditableWidgets,
 getWidgetById,
 supportsWidgetTarget,
} from '../constants/widgetCatalog';
import { getPurchasedGraphIds } from '../utils/graphOwnership';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Line, Rect } from 'react-native-svg';
import DashboardWidgetPreview from '../components/dashboard/DashboardWidgetPreview';
import { colors, radius, spacing } from '../styles/common';

const AnimatedSvgLine = Animated.createAnimatedComponent(Line);

import {
 DASHBOARD_ROW_GAP_DEFAULT,
 DASHBOARD_ROW_GAP_MAX,
 DASHBOARD_ROW_GAP_MIN,
 DASHBOARD_ROW_GAP_STEP,
 getDashboardLayoutStateForChallenge,
 getDashboardRowGapForChallenge,
 saveDashboardLayoutForChallenge,
 saveDashboardRowGapForChallenge,
} from '../utils/dashboardLayout';

function resolveTarget(params) {
 const rawTarget = params?.target || params?.dashboardTarget;
 if (rawTarget === DASHBOARD_TARGETS.RECORD_ROOM || rawTarget === 'recordRoom') {
 return DASHBOARD_TARGETS.RECORD_ROOM;
 }

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

 if (corner === 'topLeft') {
 const fixedRight = safeOrigin.x + safeOrigin.w;
 const fixedBottom = safeOrigin.y + safeOrigin.h;
 const rawW = safeOrigin.w - deltaCols;
 const rawH = safeOrigin.h - deltaRows;
 const maxW = Math.max(1, fixedRight);
 const maxH = Math.max(1, fixedBottom);
 const clamped = clampDashboardResizeSize(widgetId, rawW, rawH, { maxW, maxH });
 return {
 x: Math.max(0, fixedRight - clamped.w),
 y: Math.max(0, fixedBottom - clamped.h),
 w: clamped.w,
 h: clamped.h,
 };
 }

 if (corner === 'bottomRight') {
 const fixedLeft = safeOrigin.x;
 const fixedTop = safeOrigin.y;
 const rawW = safeOrigin.w + deltaCols;
 const rawH = safeOrigin.h + deltaRows;
 const maxW = Math.max(1, GRID_COLUMNS - fixedLeft);
 const clamped = clampDashboardResizeSize(widgetId, rawW, rawH, { maxW });
 return {
 x: fixedLeft,
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
 safeMax + RESIZE_GHOST_MAX_EXPAND_OVERSHOOT,
 safeMax + (numeric - safeMax) * RESIZE_GHOST_MAX_EXPAND_RESISTANCE,
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

const getResizeGridItemFrame = (item, gridW, rowGap = GRID_ROW_GAP) => {
 const safeW = Math.max(1, Math.min(GRID_COLUMNS, Number(item?.w) || 1));
 const safeH = Math.max(1, Number(item?.h) || 1);
 const maxX = Math.max(0, GRID_COLUMNS - safeW);
 const safeX = Math.max(0, Math.min(maxX, Number(item?.x) || 0));
 const safeY = Math.max(0, Number(item?.y) || 0);
 const slotWidth = gridW > 0 ? gridW / GRID_COLUMNS : 0;
 const safeRowGap = Math.max(0, Number(rowGap) || 0);

 return {
 left: safeX * slotWidth + GRID_CELL_PADDING,
 top: safeY * (GRID_ROW_HEIGHT + safeRowGap),
 width: Math.max(0, safeW * slotWidth - GRID_CELL_PADDING * 2),
 height: safeH * GRID_ROW_HEIGHT,
 safeX,
 safeY,
 safeW,
 safeH,
 };
};

const getResizeGridItemHeight = (h, rowGap = GRID_ROW_GAP) => {
 const safeH = Math.max(1, Number(h) || 1);
 return safeH * GRID_ROW_HEIGHT;
};

const getResizeGhostVisualFramePx = (widgetId, origin, corner, translationX, translationY, gridW, rowGap = GRID_ROW_GAP) => {
 if (!gridW) {
 return {
 visualFramePx: null,
 boundedFramePx: null,
 isBeyondLimit: false,
 };
 }

 const slotWidth = gridW / GRID_COLUMNS;
 const originFrame = getResizeGridItemFrame(origin, gridW, rowGap);
 const bounds = getResizeCatalogBounds(widgetId);

 const originX = Math.max(0, Number(origin?.x) || 0);
 const originY = Math.max(0, Number(origin?.y) || 0);
 const originW = Math.max(1, Number(origin?.w) || 1);
 const originH = Math.max(1, Number(origin?.h) || 1);

 const isLeftCorner = corner === 'topLeft' || corner === 'bottomLeft';
 const isTopCorner = corner === 'topLeft' || corner === 'topRight';

 const minWidthPx = Math.max(0, bounds.minW * slotWidth - GRID_CELL_PADDING * 2);
 const maxWidthCells = isLeftCorner
 ? Math.min(bounds.maxW, originX + originW)
 : Math.min(bounds.maxW, GRID_COLUMNS - originX);
 const maxHeightCells = isTopCorner
 ? Math.min(bounds.maxH, originY + originH)
 : bounds.maxH;

 const maxWidthPx = Math.max(minWidthPx, maxWidthCells * slotWidth - GRID_CELL_PADDING * 2);
 const minHeightPx = getResizeGridItemHeight(bounds.minH, rowGap);
 const maxHeightPx = getResizeGridItemHeight(maxHeightCells, rowGap);

 const originLeft = originFrame.left;
 const originTop = originFrame.top;
 const originRight = originFrame.left + originFrame.width;
 const originBottom = originFrame.top + originFrame.height;

 const rawX = Number(translationX) || 0;
 const rawY = Number(translationY) || 0;

 const rawWidth = originFrame.width + (isLeftCorner ? -rawX : rawX);
 const rawHeight = originFrame.height + (isTopCorner ? -rawY : rawY);
 const boundedWidth = Math.max(minWidthPx, Math.min(maxWidthPx, rawWidth));
 const boundedHeight = Math.max(minHeightPx, Math.min(maxHeightPx, rawHeight));
 const visualWidth = applyResizeResistancePx(rawWidth, minWidthPx, maxWidthPx);
 const visualHeight = applyResizeResistancePx(rawHeight, minHeightPx, maxHeightPx);

 const boundedFramePx = {
 left: isLeftCorner ? originRight - boundedWidth : originLeft,
 top: isTopCorner ? originBottom - boundedHeight : originTop,
 width: boundedWidth,
 height: boundedHeight,
 };

 const visualFramePx = {
 left: isLeftCorner ? originRight - visualWidth : originLeft,
 top: isTopCorner ? originBottom - visualHeight : originTop,
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
};


const GRID_ROW_HEIGHT = 60;
const GRID_ROW_GAP = 4;
const GRID_CELL_PADDING = 4;
const RESIZE_FRAME_INSET = 2;
const RESIZE_ACTIVE_CORNER_SIZE = 12;
const RESIZE_CORNER_OUTSET = 5;
const RESIZE_GHOST_RESISTANCE = 0.58;
const RESIZE_GHOST_MAX_OVERSHOOT = 42;
const RESIZE_GHOST_MAX_EXPAND_RESISTANCE = 0.72;
const RESIZE_GHOST_MAX_EXPAND_OVERSHOOT = 64;
const RESIZE_GHOST_BOUNCE_BACK_MS = 260;
const RESIZE_DIAGONAL_TOUCH_DELAY_MS = 120;
const RESIZE_DISMISS_SAFE_PADDING = 20;
const GRID_DRAG_STEP_THRESHOLD = 0.62;
const RESIZE_GRID_STEP_THRESHOLD = 0.45;
const AUTO_SCROLL_EDGE_SIZE = 110;
const AUTO_SCROLL_STEP = 9;
const AUTO_SCROLL_INTERVAL_MS = 16;

export default function DashboardEditScreen({ route, navigation }) {
 const insets = useSafeAreaInsets();
 const params = route?.params || {};
 const dashboardTarget = useMemo(() => resolveTarget(params), [params]);
 const isRecordRoomDashboard = dashboardTarget === DASHBOARD_TARGETS.RECORD_ROOM;
 const sourceChallengeId = params.challengeId || params.id || params.challenge?.id || params.item?.id;
 const challengeId = isRecordRoomDashboard ? 'recordRoom' : sourceChallengeId;
 const title = params.title || params.challengeTitle || params.item?.title || params.challenge?.title || (isRecordRoomDashboard ? '내 기록실' : '대시보드');

 const [layout, setLayout] = useState([]);
 const layoutRef = useRef([]);
 const [rowGap, setRowGap] = useState(DASHBOARD_ROW_GAP_DEFAULT);
 const [pickerVisible, setPickerVisible] = useState(false);
 const [loading, setLoading] = useState(true);
 const [purchasedGraphIds, setPurchasedGraphIds] = useState([]);
 const [gestureDraggingWidgetId, setGestureDraggingWidgetId] = useState(null);
 const [draggingOriginalWidgetId, setDraggingOriginalWidgetId] = useState(null);
 const [gestureDragOffset, setGestureDragOffset] = useState({ x: 0, y: 0 });
 const [gridWidth, setGridWidth] = useState(0);
 const [dragPlaceholder, setDragPlaceholder] = useState(null);
 const [dragOverlayItem, setDragOverlayItem] = useState(null);
 const [dragOverlayStart, setDragOverlayStart] = useState({ x: 0, y: 0 });
 const [dragOverlayTouchOffset, setDragOverlayTouchOffset] = useState({ x: 0, y: 0 });
 const [previewLayout, setPreviewLayout] = useState(null);
const [resizeGhostFrame, setResizeGhostFrame] = useState(null);
const [activeResizeWidgetId, setActiveResizeWidgetId] = useState(null);
const [activeResizeCorner, setActiveResizeCorner] = useState(null);
const [resizeDraggingWidgetId, setResizeDraggingWidgetId] = useState(null);
const [resizeDimWidgetId, setResizeDimWidgetId] = useState(null);
 const lastDropTargetRef = useRef(null);
 const dragOriginRef = useRef(null);
 const previewTargetRef = useRef(null);
 const previewLayoutSignatureRef = useRef('');
 const resizeOriginRef = useRef(null);
 const resizePreviewSignatureRef = useRef('');
const resizePreviewSizeRef = useRef('');
 const dragCleanupTimerRef = useRef(null);
 const resizeDashAnimRef = useRef(new Animated.Value(0));
 const resizeTouchOpacityRef = useRef(new Animated.Value(1));
const resizeDiagonalDelayTimerRef = useRef(null);
 const resizeGhostBounceTimerRef = useRef(null);
 const resizeGhostBounceSignatureRef = useRef('');
 const scrollRef = useRef(null);
 const scrollYRef = useRef(0);
 const dragStartScrollYRef = useRef(0);
 const autoScrollTimerRef = useRef(null);
 const autoScrollDirectionRef = useRef(0);

const setDashboardLayoutImmediate = useCallback((updater) => {
  setLayout((current) => {
    const calculatedLayout = typeof updater === 'function'
      ? updater(current)
      : updater;
    const nextLayout = Array.isArray(calculatedLayout)
      ? calculatedLayout
      : current;
    layoutRef.current = Array.isArray(nextLayout)
      ? nextLayout.map((item) => ({ ...item }))
      : [];
    return nextLayout;
  });
}, []);

 const loadLayout = useCallback(async () => {
 if (!challengeId) {
 setRowGap(DASHBOARD_ROW_GAP_DEFAULT);
 setDashboardLayoutImmediate(repairDashboardLayoutOverlaps(normalizeLayout([], dashboardTarget)));
 setLoading(false);
 return;
 }

 try {
 const [state, storedRowGap] = await Promise.all([
 getDashboardLayoutStateForChallenge(challengeId, dashboardTarget),
 getDashboardRowGapForChallenge(challengeId, dashboardTarget),
 ]);
 setRowGap(storedRowGap);

 const rawLayout = state?.hasStoredLayout
 ? normalizeLayout(state.layout, dashboardTarget)
 : normalizeLayout(getDefaultDashboardLayout(dashboardTarget), dashboardTarget);
 const nextLayout = repairDashboardLayoutOverlaps(rawLayout);
 setDashboardLayoutImmediate(nextLayout);
 } catch (error) {
 console.log('대시보드 레이아웃 로드 실패:', error?.message || error);
 setRowGap(DASHBOARD_ROW_GAP_DEFAULT);
 setDashboardLayoutImmediate(repairDashboardLayoutOverlaps(normalizeLayout(getDefaultDashboardLayout(dashboardTarget), dashboardTarget)));
 } finally {
 setLoading(false);
 }
 }, [challengeId, dashboardTarget, setDashboardLayoutImmediate]);

 useEffect(() => {
 loadLayout();
 }, [loadLayout]);

 useEffect(() => {
   if (!pickerVisible) return;
   let cancelled = false;
   (async () => {
     const ids = await getPurchasedGraphIds();
     if (!cancelled) setPurchasedGraphIds(ids);
   })();
   return () => { cancelled = true; };
 }, [pickerVisible, dashboardTarget]);

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
     duration: 650,
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
const clearResizeDiagonalDelayTimer = useCallback(() => {
 if (resizeDiagonalDelayTimerRef.current) {
  clearTimeout(resizeDiagonalDelayTimerRef.current);
  resizeDiagonalDelayTimerRef.current = null;
 }
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
 setActiveResizeCorner(null);
 setDraggingOriginalWidgetId(null);
 setResizeDimWidgetId(null);
 setResizeDraggingWidgetId(null);
 setGestureDragOffset({ x: 0, y: 0 });
 setDragPlaceholder(null);
 setPreviewLayout(null);
 setResizeGhostFrame(null);
 setDragOverlayItem(null);
 setDragOverlayStart({ x: 0, y: 0 });
 setDragOverlayTouchOffset({ x: 0, y: 0 });
 dragOriginRef.current = null;
 resizeOriginRef.current = null;
 resizePreviewSizeRef.current = '';
 lastDropTargetRef.current = null;
 previewLayoutSignatureRef.current = '';
 resizePreviewSignatureRef.current = '';
 }, []);

const resetResizeInteractionState = useCallback(() => {
 clearResizeGhostBounceTimer();
 stopDashboardAutoScroll();
 setActiveResizeWidgetId(null);
 setActiveResizeCorner(null);
 setResizeDraggingWidgetId(null);
 setResizeDimWidgetId(null);
 setResizeGhostFrame(null);
 setPreviewLayout(null);
 resizeTouchOpacityRef.current.setValue(1);
 resizeOriginRef.current = null;
 resizePreviewSignatureRef.current = '';
 resizePreviewSizeRef.current = '';
}, [clearResizeGhostBounceTimer, stopDashboardAutoScroll]);

const exitResizeMode = useCallback(() => {
 resetResizeInteractionState();
}, [resetResizeInteractionState]);

const scheduleDragVisualCleanup = useCallback(() => {
 clearScheduledDragVisualCleanup();
 dragCleanupTimerRef.current = setTimeout(() => {
   dragCleanupTimerRef.current = null;
   clearDragVisualState();
 }, 32);
 }, [clearDragVisualState, clearScheduledDragVisualCleanup]);

 const decreaseRowGap = useCallback(() => {
 setRowGap((current) => Math.max(DASHBOARD_ROW_GAP_MIN, current - DASHBOARD_ROW_GAP_STEP));
 }, []);

 const increaseRowGap = useCallback(() => {
 setRowGap((current) => Math.min(DASHBOARD_ROW_GAP_MAX, current + DASHBOARD_ROW_GAP_STEP));
 }, []);

 const canDecreaseRowGap = rowGap > DASHBOARD_ROW_GAP_MIN;
 const canIncreaseRowGap = rowGap < DASHBOARD_ROW_GAP_MAX;

 const placedIds = useMemo(() => new Set(layout.map(item => item.widgetId || item.id)), [layout]);

 const displayLayout = useMemo(() => {
   if (Array.isArray(previewLayout) && previewLayout.length > 0 && gestureDraggingWidgetId) {
     return previewLayout.map(normalizeLayoutItem);
   }
   return Array.isArray(layout) ? layout.map(normalizeLayoutItem) : [];
 }, [layout, previewLayout, gestureDraggingWidgetId]);

useEffect(() => {
 if (!activeResizeWidgetId) return;

 const hasActiveItem = Array.isArray(layout) && layout.some((item) => {
 const itemId = item?.widgetId || item?.id;
 return itemId === activeResizeWidgetId;
 });

 if (!hasActiveItem) {
 resetResizeInteractionState();
 }
}, [activeResizeWidgetId, layout, resetResizeInteractionState]);

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
  return safeH * GRID_ROW_HEIGHT;
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
    top: safeY * (GRID_ROW_HEIGHT + rowGap),
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
  const isActiveAbsoluteCard = key === activeResizeWidgetId;

  return (
    <View
 key={'abs-' + key}
 style={[
 styles.absoluteGraphCell,
 {
 left: frame.left,
 top: frame.top,
 width: frame.width,
 height: frame.height,
 },
 isActiveAbsoluteCard && styles.absoluteGraphCellResizeActive,
 ]}
 >
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
  return maxRow * GRID_ROW_HEIGHT + Math.max(0, maxRow - 1) * rowGap;
}, [displayLayout, rowGap]);

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
 const sourceWidgets = typeof getDashboardEditableWidgets === 'function'
 ? getDashboardEditableWidgets(dashboardTarget)
 : [];

 const purchasedWidgetIdSet = new Set(purchasedGraphIds);

 return sourceWidgets.filter((widget) => {
 const id = widget?.id || widget?.widgetId;
 if (!id || placedIds.has(id)) return false;
 if (typeof supportsWidgetTarget === 'function' && !supportsWidgetTarget(widget, dashboardTarget)) return false;

 // defaultOwned → always show; shop=false (free) → always show
 if (widget.defaultOwned || widget.shop === false) return true;

 // purchased-only graphs → only show if owned
 return purchasedWidgetIdSet.has(String(id));
 });
 }, [dashboardTarget, placedIds, purchasedGraphIds]);

 const addGraph = useCallback((widget) => {
 resetResizeInteractionState();

 const widgetId = widget?.id || widget?.widgetId;
 if (!widgetId) return;

 setDashboardLayoutImmediate((current) => {
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
 }, [dashboardTarget, resetResizeInteractionState, setDashboardLayoutImmediate]);
 const moveGraph = useCallback((widgetId, direction) => {
  setDashboardLayoutImmediate((current) => {
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
}, [dashboardTarget, setDashboardLayoutImmediate]);

 const removeGraph = useCallback((widgetId) => {
 const targetItem = layout.find((item) => (item.widgetId || item.id) === widgetId);
 const targetTitle = targetItem?.title || targetItem?.name || widgetId || '카드';

 if (layout.length <= 1) {
 Alert.alert('안내', '대시보드에는 그래프가 1개 이상 있어야 합니다.');
 return;
 }

 Alert.alert(
 '카드 삭제',
 `"${targetTitle}" 카드을 대시보드에서 삭제할까요?`,
 [
 { text: '취소', style: 'cancel' },
 {
 text: '삭제',
 style: 'destructive',
 onPress: () => {
 resetResizeInteractionState();

 setDashboardLayoutImmediate((current) => {
 if (current.length <= 1) {
 Alert.alert('안내', '대시보드에는 그래프가 1개 이상 있어야 합니다.');
 return current;
 }

 const nextLayout = current.filter((item) => (item.widgetId || item.id) !== widgetId);
 return compactDashboardLayoutSpaces(
 repairDashboardLayoutOverlaps(
 normalizeLayout(nextLayout, dashboardTarget),
 ),
 );
 });
 },
 },
 ],
 );
 }, [dashboardTarget, layout, resetResizeInteractionState, setDashboardLayoutImmediate]);

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

 setDashboardLayoutImmediate((prev) => buildResizedLayoutWithReflow(prev, widgetId, nextSize, {
 isPreview: false,
 }));
}, [buildResizedLayoutWithReflow, setDashboardLayoutImmediate]);

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

  const returnToEntryList = useCallback((mode = 'cancel') => {
 signalDashboardEditReturn(mode);

 if (isRecordRoomDashboard) {
 navigation.goBack();
 return;
 }

 if (!challengeId) {
 navigation.goBack();
 return;
 }

 const entryListParams = {
 challengeId,
 title,
 challengeTitle: title,
 targetScore:
 params?.targetScore ??
 params?.goalScore ??
 params?.challenge?.targetScore ??
 params?.challenge?.goalScore ??
 params?.item?.targetScore ??
 params?.item?.goalScore,
 goalScore:
 params?.goalScore ??
 params?.targetScore ??
 params?.challenge?.goalScore ??
 params?.challenge?.targetScore ??
 params?.item?.goalScore ??
 params?.item?.targetScore,
 type: params?.type,
 challengeType: params?.challengeType,
 isHabit: params?.isHabit,
 habitId: params?.habitId,
 item: params?.item,
 challenge: params?.challenge,
 };

 if (typeof navigation.replace === 'function') {
 navigation.replace('EntryList', entryListParams);
 return;
 }

 navigation.navigate('EntryList', entryListParams);
 }, [challengeId, isRecordRoomDashboard, navigation, params, signalDashboardEditReturn, title]);

 useEffect(() => {
 const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
 returnToEntryList('cancel');
 return true;
 });

 return () => {
 subscription.remove();
 };
 }, [returnToEntryList]);

    const renderResizeCornerDiagonalSvg = ({
  width,
  height,
  edgeOffset = RESIZE_CORNER_OUTSET,
  showDiagonal = true,
  showGrid = true,
  activeCorner = null,
  gridColumns = 1,
  gridRows = 1,
  }) => {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const safeOffset = Math.max(0, Number(edgeOffset) || 0);

  const cornerSize = RESIZE_ACTIVE_CORNER_SIZE;
  const cornerStroke = 3;
  const diagonalStroke = 1.2;
  const bottomCornerLift = 2;

  const svgWidth = safeWidth + safeOffset * 2;
  const svgHeight = safeHeight + safeOffset * 2;

  const topLeftOuter = {
   x: 0,
   y: 0,
  };
  const topLeftJoint = {
   x: 0,
   y: 0,
  };

  const topRightOuter = {
   x: svgWidth - cornerSize,
   y: 0,
  };
  const topRightJoint = {
   x: svgWidth,
   y: 0,
  };

  const bottomLeftOuter = {
   x: 0,
   y: svgHeight - cornerSize - bottomCornerLift,
  };
  const bottomLeftJoint = {
   x: 0,
   y: svgHeight - bottomCornerLift,
  };

  const bottomRightOuter = {
   x: svgWidth - cornerSize,
   y: svgHeight - cornerSize - bottomCornerLift,
  };
  const bottomRightJoint = {
   x: svgWidth,
   y: svgHeight - bottomCornerLift,
  };

  const diagonalPair = (() => {
   if (activeCorner === 'topLeft') {
    return { start: topLeftJoint, end: bottomRightJoint };
   }
   if (activeCorner === 'topRight') {
    return { start: topRightJoint, end: bottomLeftJoint };
   }
   if (activeCorner === 'bottomLeft') {
    return { start: bottomLeftJoint, end: topRightJoint };
   }
   if (activeCorner === 'bottomRight') {
    return { start: bottomRightJoint, end: topLeftJoint };
   }
   return null;
  })();

  const safeGridColumns = Math.max(1, Math.min(GRID_COLUMNS, Math.round(Number(gridColumns) || 1)));
  const safeGridRows = Math.max(1, Math.min(12, Math.round(Number(gridRows) || 1)));

  return (
   <Svg
    pointerEvents="none"
    width={svgWidth}
    height={svgHeight}
    overflow="visible"
    style={[
     StyleSheet.absoluteFill,
     {
      left: -safeOffset,
      top: -safeOffset,
      width: svgWidth,
      height: svgHeight,
      overflow: 'visible',
     },
    ]}
   >
    {showGrid && Array.from({ length: Math.max(0, safeGridColumns - 1) }).map((_, index) => {
     const x = safeOffset + (safeWidth / safeGridColumns) * (index + 1);
     return (
      <Line
       key={"resize-grid-v-" + index}
       x1={x}
       y1={safeOffset}
       x2={x}
       y2={safeOffset + safeHeight}
       stroke="#111"
       strokeWidth={0.6}
       opacity={0.16}
      />
     );
    })}

    {showGrid && Array.from({ length: Math.max(0, safeGridRows - 1) }).map((_, index) => {
     const y = safeOffset + (safeHeight / safeGridRows) * (index + 1);
     return (
      <Line
       key={"resize-grid-h-" + index}
       x1={safeOffset}
       y1={y}
       x2={safeOffset + safeWidth}
       y2={y}
       stroke="#111"
       strokeWidth={0.6}
       opacity={0.16}
      />
     );
    })}

    <Rect
     x={topLeftOuter.x}
     y={topLeftOuter.y}
     width={cornerSize}
     height={cornerStroke}
     fill="#111"
    />
    <Rect
     x={topLeftOuter.x}
     y={topLeftOuter.y}
     width={cornerStroke}
     height={cornerSize}
     fill="#111"
    />

    <Rect
     x={topRightOuter.x}
     y={topRightOuter.y}
     width={cornerSize}
     height={cornerStroke}
     fill="#111"
    />
    <Rect
     x={svgWidth - cornerStroke - 1}
     y={topRightOuter.y}
     width={cornerStroke + 1}
     height={cornerSize}
     fill="#111"
    />

    <Rect
     x={bottomLeftOuter.x}
     y={bottomLeftJoint.y - cornerStroke}
     width={cornerSize}
     height={cornerStroke}
     fill="#111"
    />
    <Rect
     x={bottomLeftOuter.x}
     y={bottomLeftOuter.y}
     width={cornerStroke}
     height={cornerSize}
     fill="#111"
    />

    <Rect
     x={bottomRightOuter.x}
     y={bottomRightJoint.y - cornerStroke}
     width={cornerSize}
     height={cornerStroke}
     fill="#111"
    />
    <Rect
     x={svgWidth - cornerStroke - 1}
     y={bottomRightOuter.y}
     width={cornerStroke + 1}
     height={cornerSize}
     fill="#111"
    />

    {showDiagonal && diagonalPair && (
     <AnimatedSvgLine
      x1={diagonalPair.start.x}
      y1={diagonalPair.start.y}
      x2={diagonalPair.end.x}
      y2={diagonalPair.end.y}
      stroke="#111"
      strokeWidth={diagonalStroke}
      strokeDasharray="6 5"
      strokeDashoffset={resizeDashTranslateX}
      strokeLinecap="butt"
     />
    )}
   </Svg>
  );
 };
 const saveLayout = useCallback(async () => {
 if (!challengeId) {
 Alert.alert('오류', '대시보드 대상을 찾지 못했습니다.');
 return;
 }

 try {
 const layoutToSave = Array.isArray(layoutRef.current) && layoutRef.current.length > 0
   ? layoutRef.current.map((item) => ({ ...item }))
   : layout;

 await saveDashboardLayoutForChallenge(challengeId, layoutToSave, dashboardTarget);
 await saveDashboardRowGapForChallenge(challengeId, rowGap, dashboardTarget);

 const returnRouteKey = route?.params?.returnRouteKey;
    const dashboardEditReturnedAt = Date.now();

    if (returnRouteKey) {
            navigation.dispatch({
        ...CommonActions.setParams({
          dashboardEditReturnMode: 'save',
          dashboardEditReturnedAt,
          dashboardEditLayout: Array.isArray(layoutToSave) ? layoutToSave.map((item) => ({ ...item })) : [],
          dashboardEditRowGap: rowGap,
        }),
        source: returnRouteKey,
      });

      setTimeout(() => {
        navigation.goBack();
      }, 50);
      return;
    }
    navigation.goBack();
 } catch (error) {
 const errorMessage = error?.message || String(error);
 console.log('대시보드 저장 실패:', errorMessage);
 Alert.alert('오류', '대시보드를 저장하지 못했습니다.');
 }
 }, [challengeId, dashboardTarget, layout, navigation, route?.params, rowGap]);

/**
 * 작은 카드에서 제목을 좌우로 천천히 움직이는 Marquee.
 * narrow (w<=3) 카드에서만 활성화.
 */
const MARQUEE_START_DELAY_MS = 700;
const MARQUEE_RESET_DELAY_MS = 420;
const MARQUEE_PX_PER_SECOND = 26;
const MARQUEE_MIN_DISTANCE = 18;

function estimateMarqueeTextWidth(content) {
 const source = String(content ?? '');
 if (!source) return 0;

 let width = 0;
 Array.from(source).forEach((char) => {
 if (/\s/.test(char)) {
 width += 4;
 } else if (/[A-Z0-9]/.test(char)) {
 width += 9.5;
 } else if (/[a-z]/.test(char)) {
 width += 8;
 } else if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(char)) {
 width += 15.5;
 } else {
 width += 10;
 }
 });

 return Math.ceil(width);
}

function MarqueeText({ text, style, enabled = true }) {
 const translateX = useRef(new Animated.Value(0)).current;
 const [containerWidth, setContainerWidth] = useState(0);
 const [measuredTextWidth, setMeasuredTextWidth] = useState(0);
 const content = String(text ?? '');
 const estimatedTextWidth = useMemo(() => estimateMarqueeTextWidth(content), [content]);
 const textWidth = Math.max(measuredTextWidth, estimatedTextWidth);
 const shouldAnimate = enabled && containerWidth > 0 && textWidth > containerWidth + 6;

 useEffect(() => {
 translateX.stopAnimation();
 translateX.setValue(0);

 if (!shouldAnimate) {
 return undefined;
 }

 const distance = Math.max(MARQUEE_MIN_DISTANCE, textWidth - containerWidth + 30);
 const duration = Math.max(2200, Math.round((distance / MARQUEE_PX_PER_SECOND) * 1000));

 const loop = Animated.loop(
 Animated.sequence([
 Animated.delay(MARQUEE_START_DELAY_MS),
 Animated.timing(translateX, {
 toValue: -distance,
 duration,
 easing: Easing.linear,
 useNativeDriver: true,
 }),
 Animated.delay(MARQUEE_RESET_DELAY_MS),
 Animated.timing(translateX, {
 toValue: 0,
 duration: 420,
 easing: Easing.out(Easing.quad),
 useNativeDriver: true,
 }),
 ]),
 );

 loop.start();

 return () => {
 loop.stop();
 translateX.stopAnimation();
 };
 }, [content, containerWidth, shouldAnimate, textWidth, translateX]);

 return (
 <View
 style={styles.marqueeClip}
 onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
 >
 <Animated.Text
 style={[
 style,
 styles.marqueeText,
 { minWidth: shouldAnimate ? textWidth : undefined },
 { transform: [{ translateX }] },
 ]}
 numberOfLines={1}
 ellipsizeMode="clip"
 onTextLayout={(event) => {
 const measuredWidth = event?.nativeEvent?.lines?.[0]?.width;
 if (Number.isFinite(Number(measuredWidth)) && Number(measuredWidth) > 0) {
 setMeasuredTextWidth(Number(measuredWidth));
 }
 }}
 >
 {content}
 </Animated.Text>
 </View>
 );
}

 const renderGraphCardVisualContent = ({
 titleText,
 displaySizeText,
 cardHeight,
 innerCardHeight,
 isCompactCard,
 isNarrowTitleCard,
 isResizeActive = false,
 shouldDimOriginalCard = false,
 resizeTouchOpacity = null,
 resizeOverlay = null,
 actionOverlay = null,
 previewNode = null,
 }) => (
 <View style={[
 styles.resizeFrame,
 { minHeight: cardHeight, height: cardHeight },
 ]}>
 {resizeOverlay}

 <View style={[
 styles.graphCard,
 {
 minHeight: innerCardHeight,
 height: innerCardHeight,
 margin: RESIZE_FRAME_INSET,
 },
 isCompactCard && styles.graphCardCompact,
 ]}>
 <Animated.View
 pointerEvents="none"
 style={[
 styles.graphCardVisualSurface,
 isResizeActive && styles.graphCardResizeActive,
 isResizeActive && resizeTouchOpacity && { opacity: resizeTouchOpacity },
 shouldDimOriginalCard && styles.graphCardDimmed,
 ]}
 />

 <View style={[styles.graphHeader, isCompactCard && styles.graphHeaderCompact]}>
 <View style={styles.graphTitleGroup}>
 <MarqueeText text={titleText} style={styles.graphTitle} enabled={isCompactCard || isNarrowTitleCard} />
 </View>
 <View style={[styles.graphSizeBadge, isCompactCard && styles.graphSizeBadgeCompact]}>
 <Text style={[styles.graphSizeBadgeText, isCompactCard && styles.graphSizeBadgeTextCompact]}>{displaySizeText}</Text>
 </View>
 </View>
 {previewNode}
 </View>

 {actionOverlay}
 </View>
 );

 const renderGraphCard = (item, index) => {
 if (item.isPlaceholder) {
   const ph = item;
   const w = Math.max(1, Math.min(GRID_COLUMNS, Number(ph.w || GRID_COLUMNS)));
   const h = Math.max(1, Number(ph.h || 1));
   const slotW = gridWidth > 0 ? gridWidth / GRID_COLUMNS : 0;
   return (
     <View style={[styles.graphCell, { opacity: 0.5 }]}>
       <View style={[styles.graphCard, { minHeight: h >= 2 ? 120 : 90, backgroundColor: colors.surfaceMuted, borderColor: colors.textDisabled, borderStyle: 'dashed' }]} />
     </View>
   );
 }
 const widgetId = item.widgetId || item.id || `graph_${index}`;
 const baseTitleText = item.title || item.name || widgetId;
 const safeW = Math.max(1, Math.min(GRID_COLUMNS, Number(item.w || GRID_COLUMNS)));
 const safeX = Math.max(0, Math.min(GRID_COLUMNS - safeW, Number(item.x || 0)));
 const safeY = Number.isFinite(Number(item.y)) ? Math.max(0, Number(item.y)) : index;
 const safeH = Math.max(1, Number(item.h || 1));
 const isCompactCard = safeH === 1;
 const isNarrowTitleCard = safeW <= 3;
 const titleText = baseTitleText;
 const cardHeight = getGridItemHeight(safeH);
 const innerCardHeight = Math.max(0, cardHeight - RESIZE_FRAME_INSET * 2);
 const slotWidth = gridWidth > 0 ? gridWidth / GRID_COLUMNS : 0;
const resizeTouchOpacity = resizeTouchOpacityRef.current;
const isResizeActive = activeResizeWidgetId === widgetId;
const isThisResizeDragging = resizeDraggingWidgetId === widgetId;
const isThisResizeDimActive = resizeDimWidgetId === widgetId;
const isThisGestureDragging =
 draggingOriginalWidgetId === widgetId ||
 gestureDraggingWidgetId === widgetId ||
 dragOverlayItem?.widgetId === widgetId;
const shouldDimOriginalCard = isThisGestureDragging;
const displaySizeText =
 isResizeActive && resizeGhostFrame?.widgetId === widgetId
 ? `${resizeGhostFrame.w}x${resizeGhostFrame.h}`
 : `${safeW}x${safeH}`;

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
 .onTouchesDown(() => {
 resizeTouchOpacityRef.current.setValue(0.16);
 clearResizeDiagonalDelayTimer();
 resizeDiagonalDelayTimerRef.current = setTimeout(() => {
  setActiveResizeCorner(corner);
  resizeDiagonalDelayTimerRef.current = null;
 }, RESIZE_DIAGONAL_TOUCH_DELAY_MS);
 })
.onTouchesUp(() => {
 clearResizeDiagonalDelayTimer();
 resizeTouchOpacityRef.current.setValue(1);
 setActiveResizeCorner(null);
 })
.onTouchesCancelled(() => {
 clearResizeDiagonalDelayTimer();
 resizeTouchOpacityRef.current.setValue(1);
 setActiveResizeCorner(null);
 }) .onBegin(() => {
  setResizeDraggingWidgetId(widgetId);
 resizeTouchOpacityRef.current.setValue(0.16);
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
 })
 .onUpdate((event) => {
 const origin = resizeOriginRef.current || {
 x: safeX,
 y: safeY,
 w: safeW,
 h: safeH,
 };

 const deltaColsRaw = slotWidth ? event.translationX / slotWidth : 0;
 const deltaRowsRaw = (event.translationY || 0) / (GRID_ROW_HEIGHT + rowGap);
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
 rowGap,
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
 corner,
 });

 if (ghostState.isBeyondLimit) {
 scheduleResizeGhostBounceBack(widgetId, nextFrame, boundedFrame, visualSignature);
 } else {
 clearResizeGhostBounceTimer();
 }
 })
 .onEnd((event) => {
 clearResizeDiagonalDelayTimer();
const origin = resizeOriginRef.current || {
 x: safeX,
 y: safeY,
 w: safeW,
 h: safeH,
 };

 const deltaColsRaw = slotWidth ? event.translationX / slotWidth : 0;
 const deltaRowsRaw = (event.translationY || 0) / (GRID_ROW_HEIGHT + rowGap);
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
 clearResizeDiagonalDelayTimer();
clearResizeGhostBounceTimer();
 setActiveResizeCorner(null);
 setResizeDraggingWidgetId(null);
 resizeTouchOpacityRef.current.setValue(1);
 resizeOriginRef.current = null;
 resizePreviewSignatureRef.current = '';
 resizePreviewSizeRef.current = '';
 setPreviewLayout(null);
 setResizeGhostFrame(null);
 });

const topLeftResizeGesture = buildResizeGesture('topLeft');
const topRightResizeGesture = buildResizeGesture('topRight');
const bottomLeftResizeGesture = buildResizeGesture('bottomLeft');
const bottomRightResizeGesture = buildResizeGesture('bottomRight');

const canMoveCard =
 !resizeDraggingWidgetId &&
 (!activeResizeWidgetId || activeResizeWidgetId === widgetId);

 const testGesture = Gesture.Pan()
   .enabled(canMoveCard)
   .activateAfterLongPress(300)
   .runOnJS(true)
   .onBegin(() => {
     clearScheduledDragVisualCleanup();
     previewLayoutSignatureRef.current = '';
     dragOriginRef.current = { x: safeX, y: safeY, w: safeW, h: safeH };
   })
   .onStart((event) => {
     dragStartScrollYRef.current = scrollYRef.current;
     clearScheduledDragVisualCleanup();

     if (activeResizeWidgetId) {
 setResizeGhostFrame(null);
 setPreviewLayout(null);
 }

     setDraggingOriginalWidgetId(widgetId);
     setGestureDraggingWidgetId(widgetId);
     setGestureDragOffset({ x: 0, y: 0 });
     const overlayWidth = slotWidth ? slotWidth * safeW : 0;
     const overlayHeight = cardHeight || 0;
     const localTouchX = Math.max(
      0,
      Math.min(
       overlayWidth || Number.MAX_SAFE_INTEGER,
       Number(event.x) || 0,
      ),
     );
     const localTouchY = Math.max(
      0,
      Math.min(
       overlayHeight || Number.MAX_SAFE_INTEGER,
       Number(event.y) || 0,
      ),
     );

     setDragOverlayStart({ x: Number(event.absoluteX) || 0, y: Number(event.absoluteY) || 0 });
     setDragOverlayTouchOffset({
      x: localTouchX,
      y: localTouchY,
     });
     setDragOverlayItem({
       widgetId: item.widgetId,
       kind: item.kind,
       w: safeW, h: safeH, cardHeight, isCompactCard, safeW, safeH,
       titleText,
     });
   })
   .onUpdate((event) => {
     const nextOffset = { x: event.translationX, y: event.translationY };
     setGestureDragOffset(nextOffset);
     const rawGridDX = slotWidth ? event.translationX / slotWidth : 0;
     const scrollDelta = scrollYRef.current - dragStartScrollYRef.current;
     const rawGridDY = (event.translationY + scrollDelta) / (GRID_ROW_HEIGHT + rowGap);
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
       const hoverY = originY + ((event.translationY + scrollDelta) / (GRID_ROW_HEIGHT + rowGap));
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
       const fallbackHoverY = originY + ((event.translationY + scrollDelta) / (GRID_ROW_HEIGHT + rowGap));
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

if (activeResizeWidgetId === widgetId) {
 setActiveResizeWidgetId(null);
 setResizeGhostFrame(null);
 setPreviewLayout(null);
}

     scheduleDragVisualCleanup();
   })
   .onFinalize(() => {
     scheduleDragVisualCleanup();
   });

const tapResizeGesture = Gesture.Tap()
 .runOnJS(true)
 .onEnd(() => {
 if (activeResizeWidgetId || resizeDraggingWidgetId || gestureDraggingWidgetId) return;
 setActiveResizeWidgetId(widgetId);
 });

const disabledCardGesture = Gesture.Tap().enabled(false);

const cardGesture = activeResizeWidgetId
 ? (isResizeActive ? testGesture : disabledCardGesture)
 : Gesture.Exclusive(testGesture, tapResizeGesture);

const cardLeftPx = safeX * slotWidth + GRID_CELL_PADDING;
const cardTopPx = safeY * (GRID_ROW_HEIGHT + rowGap);
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


 const resizeCornerOverlay = isResizeActive ? (
 <View pointerEvents="box-none" style={resizeOverlayDynamicStyle}>
 <GestureDetector gesture={topLeftResizeGesture}>
 <View style={[styles.resizeActiveCornerHitbox, styles.resizeActiveCornerHitboxTopLeft]} />
 </GestureDetector>

 <GestureDetector gesture={topRightResizeGesture}>
 <View style={[styles.resizeActiveCornerHitbox, styles.resizeActiveCornerHitboxTopRight]} />
 </GestureDetector>

 <GestureDetector gesture={bottomLeftResizeGesture}>
 <View style={[styles.resizeActiveCornerHitbox, styles.resizeActiveCornerHitboxBottomLeft]} />
 </GestureDetector>

 <GestureDetector gesture={bottomRightResizeGesture}>
 <View style={[styles.resizeActiveCornerHitbox, styles.resizeActiveCornerHitboxBottomRight]} />
 </GestureDetector>
 </View>
 ) : null;
 const removeActionOverlay = isResizeActive && !isThisGestureDragging ? (
 <TouchableOpacity
 style={styles.removeBtnBottomRight}
 onPress={() => removeGraph(widgetId)}
 activeOpacity={0.82}
 >
 <Text style={styles.removeText}>삭제</Text>
 </TouchableOpacity>
 ) : null;

 const cardContent = (
 <View
key={widgetId}
style={[
styles.graphCell,
isResizeActive && styles.graphCellResizeActive,
]}
>
 {renderGraphCardVisualContent({
 titleText,
 displaySizeText,
 cardHeight,
 innerCardHeight,
 isCompactCard,
 isNarrowTitleCard,
 isResizeActive,
 shouldDimOriginalCard,
 resizeTouchOpacity,
 resizeOverlay: resizeCornerOverlay,
 actionOverlay: removeActionOverlay,
 previewNode: (
 <DashboardWidgetPreview
 widgetId={widgetId}
 kind={item.kind}
 previewFamily={item.previewFamily}
 placeholder={item.placeholder}
 title={titleText}
 w={safeW}
 h={safeH}
 isResizeActive={isResizeActive || isThisResizeDragging || isThisGestureDragging}
 />
 ),
 })}
 </View>
 );
   return (
     <GestureDetector gesture={cardGesture}>{cardContent}</GestureDetector>
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
   const overlayW = slotW ? Math.max(0, slotW * Math.max(1, Number(o.w || 1)) - GRID_CELL_PADDING * 2) : '90%';
   const overlayH = o.cardHeight || 120;
   const touchX = Number(dragOverlayStart.x) || 0;
   const touchY = Number(dragOverlayStart.y) || 0;
   const touchOffsetX = Math.max(0, Number(dragOverlayTouchOffset.x) || 0);
   const touchOffsetY = Math.max(0, Number(dragOverlayTouchOffset.y) || 0);
   const left = touchX ? touchX - touchOffsetX : 16;
   const top = touchY ? touchY - touchOffsetY : 120;
   const overlayInnerHeight = Math.max(0, overlayH - RESIZE_FRAME_INSET * 2);
   const overlayCornerWidth = typeof overlayW === 'number' ? overlayW : 0;
   const dragMoveCornerOverlay = overlayCornerWidth > 0 ? (
     <View pointerEvents="none" style={StyleSheet.absoluteFill}>
       {renderResizeCornerDiagonalSvg({
         width: overlayCornerWidth,
         height: overlayH,
         edgeOffset: RESIZE_CORNER_OUTSET,
         showDiagonal: false,
         showGrid: false,
       })}
     </View>
   ) : null;

   return (
     <View
       pointerEvents="none"
       style={{
         position: 'absolute',
         zIndex: 9999,
         elevation: 50,
         width: overlayW,
         minHeight: overlayH,
         left,
         top,
         transform: [{ translateX: gx }, { translateY: gy }],
       }}
     >
       {renderGraphCardVisualContent({
         titleText: o.titleText,
         displaySizeText: o.safeW + 'x' + o.safeH,
         cardHeight: overlayH,
         innerCardHeight: overlayInnerHeight,
         isCompactCard: o.isCompactCard,
         isNarrowTitleCard: o.safeW <= 3,
         isResizeActive: false,
         shouldDimOriginalCard: false,
         actionOverlay: dragMoveCornerOverlay,
       previewNode: (
         <DashboardWidgetPreview
           widgetId={o.widgetId}
           kind={o.kind}
           title={o.titleText}
           w={o.safeW}
           h={o.safeH}
           isResizeActive={false}
         />
       ),
       })}
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
 const guideFrame = {
 left: visualFrame.left,
 top: visualFrame.top,
 width: Math.max(1, Number(visualFrame.width) || 1),
 height: Math.max(1, Number(visualFrame.height) || 1),
 };
 const width = guideFrame.width;
 const height = guideFrame.height;
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

 const ghostDashMotionPad = 36;
 const ghostDiagonalDashStyle = {
 width: diagonalLength + ghostDashMotionPad * 2,
 marginLeft: -ghostDashMotionPad,
 transform: [{ translateX: resizeDashTranslateX }],
 };

 return (
 <View
 pointerEvents="none"
 style={[
 styles.resizeGhostFrameOverlay,
 {
 left: guideFrame.left,
 top: guideFrame.top,
 width,
 height,
 },
 ]}
 >
 </View>
 );
 };

const renderResizeDismissOverlay = () => {
 if (!activeResizeWidgetId || resizeDraggingWidgetId || gestureDraggingWidgetId || !gridWidth) return null;

 const sourceItems = Array.isArray(displayLayout) ? displayLayout : [];
 const activeItem = sourceItems.find((item) => {
 const itemId = item?.widgetId || item?.id;
 return itemId === activeResizeWidgetId;
 });

 if (!activeItem) return null;

 const activeFrame = getResizeGridItemFrame(activeItem, gridWidth, rowGap);
 const safePadding = RESIZE_DISMISS_SAFE_PADDING;

 const dismissFrame = {
 left: Math.max(0, activeFrame.left - safePadding),
 top: Math.max(0, activeFrame.top - safePadding),
 width: Math.min(gridWidth, activeFrame.left + activeFrame.width + safePadding) - Math.max(0, activeFrame.left - safePadding),
 height: activeFrame.height + safePadding * 2,
 };

 const boardHeight = Math.max(
 gridBoardHeight,
 dismissFrame.top + dismissFrame.height,
 );

 const topHeight = Math.max(0, dismissFrame.top);
 const bottomTop = dismissFrame.top + dismissFrame.height;
 const bottomHeight = Math.max(0, boardHeight - bottomTop);
 const leftWidth = Math.max(0, dismissFrame.left);
 const rightLeft = dismissFrame.left + dismissFrame.width;
 const rightWidth = Math.max(0, gridWidth - rightLeft);

 const renderDismissZone = (key, styleData) => {
 const w = Number(styleData?.width);
 const h = Number(styleData?.height);
 if (w <= 0 || h <= 0) return null;
 return (
 <TouchableOpacity
 key={key}
 activeOpacity={1}
 onPress={exitResizeMode}
 style={[styles.resizeDismissZone, styleData]}
 />
 );
 };

 return (
 <>
 {renderDismissZone('top', {
 left: 0,
 top: 0,
 width: gridWidth,
 height: topHeight,
 })}
 {renderDismissZone('bottom', {
 left: 0,
 top: bottomTop,
 width: gridWidth,
 height: bottomHeight,
 })}
 {renderDismissZone('left', {
 left: 0,
 top: dismissFrame.top,
 width: leftWidth,
 height: dismissFrame.height,
 })}
 {renderDismissZone('right', {
 left: rightLeft,
 top: dismissFrame.top,
 width: rightWidth,
 height: dismissFrame.height,
 })}
 </>
 );
 };

const renderResizeGuideOverlay = () => {
 if (!activeResizeWidgetId || gestureDraggingWidgetId || !gridWidth) return null;

 const sourceItems = Array.isArray(displayLayout) ? displayLayout : [];
 const activeItem = sourceItems.find((item) => {
 const itemId = item?.widgetId || item?.id;
 return itemId === activeResizeWidgetId;
 });

 if (!activeItem) return null;

 const baseFrame = getResizeGridItemFrame(activeItem, gridWidth, rowGap);
 const dragFrame = resizeGhostFrame?.visualFramePx;
 const guideFrame = dragFrame || baseFrame;
 const guideWidth = Math.max(1, Number(guideFrame.width) || 1);
 const guideHeight = Math.max(1, Number(guideFrame.height) || 1);
 const guideW = Math.max(1, Number(resizeGhostFrame?.w ?? activeItem?.w) || 1);
 const guideH = Math.max(1, Number(resizeGhostFrame?.h ?? activeItem?.h) || 1);
 const activeDiagonalCorner = activeResizeCorner || resizeGhostFrame?.corner || null;
 const isDraggingResizeCorner = Boolean(activeDiagonalCorner);

 return (
 <View
 pointerEvents="none"
 style={[
 styles.resizeGhostFrameOverlay,
 {
 left: guideFrame.left,
 top: guideFrame.top,
 width: guideWidth,
 height: guideHeight,
 },
 ]}
 >
 {renderResizeCornerDiagonalSvg({
 width: guideWidth,
 height: guideHeight,
 edgeOffset: RESIZE_CORNER_OUTSET,
 activeCorner: activeDiagonalCorner,
 showDiagonal: Boolean(activeDiagonalCorner),
 showGrid: true,
 gridColumns: guideW,
 gridRows: guideH,
 })}
 </View>
 );
 };

 return (
 <GestureHandlerRootView style={{ flex: 1 }}>
 <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
 <View style={styles.header}>
 <TouchableOpacity style={styles.backBtn} onPress={() => returnToEntryList('cancel')}>
 <Text style={styles.backText}>‹</Text>
 </TouchableOpacity>
 <Text style={styles.screenTitle}>대시보드 수정</Text>
 <View style={styles.headerSpacer} />
 </View>

 <ScrollView
 ref={scrollRef}
 scrollEnabled={!resizeDraggingWidgetId && !gestureDraggingWidgetId}
 onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
 scrollEventThrottle={16}
 contentContainerStyle={[styles.content, { paddingBottom: 112 + insets.bottom }]}
>
 <View style={styles.contentHeader}>
 <Text style={styles.challengeTitle} numberOfLines={1}>{title}</Text>
 <View style={styles.headerActions}>
 <View style={styles.rowGapControl}>
 <Text style={styles.rowGapLabel}>간격 {rowGap}px</Text>
 <View style={styles.rowGapButtons}>
 <TouchableOpacity
 style={[styles.rowGapButton, !canDecreaseRowGap && styles.rowGapButtonDisabled]}
 onPress={decreaseRowGap}
 disabled={!canDecreaseRowGap}
 activeOpacity={0.8}
 >
 <Text style={[styles.rowGapButtonText, !canDecreaseRowGap && styles.rowGapButtonTextDisabled]}>-</Text>
 </TouchableOpacity>
 <TouchableOpacity
 style={[
 styles.rowGapButton,
 styles.rowGapButtonWithDivider,
 !canIncreaseRowGap && styles.rowGapButtonDisabled,
 ]}
 onPress={increaseRowGap}
 disabled={!canIncreaseRowGap}
 activeOpacity={0.8}
 >
 <Text style={[styles.rowGapButtonText, !canIncreaseRowGap && styles.rowGapButtonTextDisabled]}>+</Text>
 </TouchableOpacity>
 </View>
 </View>
 <TouchableOpacity style={styles.addBtn} onPress={() => setPickerVisible(true)}>
 <Text style={styles.addText}>카드추가</Text>
 </TouchableOpacity>
 </View>
 </View>

 {loading ? (
 <Text style={styles.emptyText}>불러오는 중...</Text>
 ) : (
 <View style={[styles.grid, { overflow: 'visible', minHeight: gridBoardHeight }]} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
 {renderDragPlaceholderOverlay()}
 {renderResizeDismissOverlay()}
 {(Array.isArray(displayLayout) ? displayLayout : []).map((item, index) => renderAbsoluteGraphCard(item, index))}
 {renderResizeGhostFrameOverlay()}
 {renderResizeGuideOverlay()}
 </View>
 )}
 </ScrollView>

 <View style={[styles.footer, { paddingBottom: Math.max(18, insets.bottom + 12) }]}>
 <TouchableOpacity style={[styles.footerButton, styles.cancelButton]} onPress={() => returnToEntryList('cancel')}>
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
 <Text style={styles.modalTitle}>카드 추가</Text>
 <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setPickerVisible(false)}>
 <Text style={styles.modalCloseText}>×</Text>
 </TouchableOpacity>
 </View>

 {pickerWidgets.length === 0 ? (
 <Text style={styles.emptyText}>추가할 수 있는 카드이 없습니다.</Text>
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
 backgroundColor: colors.surface,
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
 borderBottomColor: colors.border,
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
 color: colors.textPrimary,
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
 color: colors.textPrimary,
 zIndex: 1,
 },
 challengeTitle: {
 flex: 1,
 marginRight: 12,
 fontSize: 14,
 fontWeight: '700',
 color: colors.textSecondary,
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
 headerActions: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: spacing.sm,
 },
 rowGapControl: {
 height: 34,
 flexDirection: 'row',
 alignItems: 'center',
 borderRadius: radius.sm,
 borderWidth: 1,
 borderColor: colors.slate300,
 backgroundColor: colors.surface,
 overflow: 'hidden',
 },
 rowGapLabel: {
 paddingHorizontal: 8,
 fontSize: 12,
 fontWeight: '800',
 color: colors.textPrimary,
 },
 rowGapButtons: {
 flexDirection: 'row',
 height: '100%',
 borderLeftWidth: 1,
 borderLeftColor: colors.border,
 },
 rowGapButton: {
 width: 30,
 height: '100%',
 alignItems: 'center',
 justifyContent: 'center',
 backgroundColor: colors.surface,
 },
 rowGapButtonWithDivider: {
 borderLeftWidth: 1,
 borderLeftColor: colors.border,
 },
 rowGapButtonDisabled: {
 backgroundColor: colors.surfaceMuted,
 },
 rowGapButtonText: {
 fontSize: 16,
 fontWeight: '900',
 color: colors.textPrimary,
 lineHeight: 18,
 includeFontPadding: false,
 },
 rowGapButtonTextDisabled: {
 color: colors.textDisabled,
 },
 addBtn: {
 height: 34,
 paddingHorizontal: 12,
 borderRadius: radius.sm,
 borderWidth: 1,
 borderColor: colors.borderStrong,
 backgroundColor: colors.surface,
 alignItems: 'center',
 justifyContent: 'center',
 },
 addText: {
 color: colors.textPrimary,
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
graphCellResizeActive: {
 position: 'relative',
 zIndex: 80,
 elevation: 20,
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
 borderRadius: radius.sm,
 padding: 12,
 },
graphCardCompact: {
 paddingTop: 4,
 paddingBottom: 2,
 paddingHorizontal: 8,
 overflow: 'hidden',
 },
graphCardVisualSurface: {
 ...StyleSheet.absoluteFillObject,
 borderRadius: radius.sm,
 borderWidth: 1,
 borderColor: colors.border,
 borderTopWidth: 3,
 borderTopColor: colors.primary,
 backgroundColor: colors.surface,
 zIndex: 0,
 elevation: 0,
 },
 graphHeader: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 position: 'relative',
 zIndex: 2,
 elevation: 1,
 columnGap: 8,
 },
 graphHeaderCompact: {
 minHeight: 18,
 marginBottom: 0,
 },
 
 graphTitleGroup: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: 8,
 flex: 1,
 minWidth: 0,
 overflow: 'hidden',
 },
 marqueeClip: {
 flex: 1,
 minWidth: 0,
 overflow: 'hidden',
 },
 marqueeText: {
 alignSelf: 'flex-start',
 flexShrink: 0,
 },
 graphTitle: {
 fontSize: 15,
 lineHeight: 18,
 fontWeight: '800',
 color: colors.textPrimary,
 includeFontPadding: false,
 },
 graphSizeBadge: {
 minWidth: 38,
 height: 22,
 paddingHorizontal: 7,
 borderRadius: radius.pill,
 backgroundColor: colors.surfaceMuted,
 borderWidth: 1,
 borderColor: colors.border,
 alignItems: 'center',
 justifyContent: 'center',
 },
 graphSizeBadgeCompact: {
 minWidth: 32,
 height: 18,
 paddingHorizontal: 5,
 borderRadius: radius.pill,
 },
 graphSizeBadgeText: {
 fontSize: 11,
 lineHeight: 13,
 fontWeight: '900',
 color: colors.textPrimary,
 includeFontPadding: false,
 },
 graphSizeBadgeTextCompact: {
 fontSize: 9,
 lineHeight: 10,
 },
 removeBtnBottomRight: {
 position: 'absolute',
 right: 12,
 bottom: 12,
 minWidth: 42,
 height: 26,
 paddingHorizontal: 9,
 borderRadius: radius.pill,
 borderWidth: 1,
 borderColor: colors.border,
 alignItems: 'center',
 justifyContent: 'center',
 backgroundColor: colors.surface,
 zIndex: 12,
 elevation: 4,
 },
 removeText: {
 fontSize: 11,
 fontWeight: '800',
 color: colors.textSecondary,
 lineHeight: 13,
 includeFontPadding: false,
 },
 graphCardResizeActive: {
 borderColor: colors.borderStrong,
 shadowColor: colors.black,
 shadowOffset: { width: 0, height: 4 },
 shadowOpacity: 0.08,
 shadowRadius: 8,
 elevation: 3,
},
graphCardResizeDraggingHidden: {
 opacity: 0.35,
},
graphCardDimmed: {
 opacity: 0.16,
},
resizeHandle: {
 width: 28,
 height: 28,
 borderRadius: radius.pill,
 borderWidth: 1,
 borderColor: colors.border,
 backgroundColor: colors.surface,
 alignItems: 'center',
 justifyContent: 'center',
},
resizeHandleActive: {
 backgroundColor: colors.surface,
 borderColor: colors.border,
},
resizeHandleCornerTopRight: {
 position: 'absolute',
 top: 7,
 right: 7,
 width: 8,
 height: 8,
 borderTopWidth: 2,
 borderRightWidth: 2,
 borderColor: colors.borderStrong,
},
resizeHandleCornerBottomLeft: {
 position: 'absolute',
 bottom: 7,
 left: 7,
 width: 8,
 height: 8,
 borderBottomWidth: 2,
 borderLeftWidth: 2,
 borderColor: colors.borderStrong,
},
resizeActiveOverlay: {
 ...StyleSheet.absoluteFillObject,
 zIndex: 12,
},
resizeActiveCornerHitbox: {
 position: 'absolute',
 width: 64,
 height: 64,
 zIndex: 24,
 elevation: 10,
},
resizeActiveCornerHitboxTopRight: {
 top: -(RESIZE_CORNER_OUTSET + RESIZE_FRAME_INSET),
 right: -(RESIZE_CORNER_OUTSET + RESIZE_FRAME_INSET),
 alignItems: 'flex-end',
 justifyContent: 'flex-start',
},
resizeActiveCornerHitboxBottomLeft: {
 left: -(RESIZE_CORNER_OUTSET + RESIZE_FRAME_INSET),
 bottom: -(RESIZE_CORNER_OUTSET + RESIZE_FRAME_INSET),
 alignItems: 'flex-start',
 justifyContent: 'flex-end',
},
resizeActiveCornerHitboxTopLeft: {
 left: -(RESIZE_CORNER_OUTSET + RESIZE_FRAME_INSET),
 top: -(RESIZE_CORNER_OUTSET + RESIZE_FRAME_INSET),
 alignItems: 'flex-start',
 justifyContent: 'flex-start',
},
resizeActiveCornerHitboxBottomRight: {
 right: -(RESIZE_CORNER_OUTSET + RESIZE_FRAME_INSET),
 bottom: -(RESIZE_CORNER_OUTSET + RESIZE_FRAME_INSET),
 alignItems: 'flex-end',
 justifyContent: 'flex-end',
},
resizeActiveCorner: {
 position: 'absolute',
 width: RESIZE_ACTIVE_CORNER_SIZE,
 height: RESIZE_ACTIVE_CORNER_SIZE,
 borderColor: colors.borderStrong,
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
 borderTopWidth: 1.2,
 borderStyle: 'dashed',
 borderColor: colors.borderStrong,
},
 emptyText: {
 paddingVertical: 24,
 textAlign: 'center',
 fontSize: 14,
 color: colors.textTertiary,
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
 borderTopColor: colors.border,
 backgroundColor: colors.surface,
 },
 footerButton: {
 flex: 1,
 height: 48,
 borderRadius: radius.sm,
 alignItems: 'center',
 justifyContent: 'center',
 },
 cancelButton: {
 borderWidth: 1,
 borderColor: colors.border,
 backgroundColor: colors.surface,
 },
 saveButton: {
 backgroundColor: colors.primary,
 },
 cancelButtonText: {
 fontSize: 15,
 fontWeight: '800',
 color: colors.textPrimary,
 },
 saveButtonText: {
 fontSize: 15,
 fontWeight: '800',
 color: colors.textInverse,
 },
 modalOverlay: {
 flex: 1,
 padding: 20,
 backgroundColor: colors.overlay,
 alignItems: 'center',
 justifyContent: 'center',
 },
 modalSheet: {
 width: '100%',
 maxHeight: '75%',
 borderRadius: radius.md,
 backgroundColor: colors.surface,
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
 fontWeight: '800',color: colors.textPrimary,
 },
 modalCloseBtn: {
 width: 32,
 height: 32,
 borderRadius: radius.lg,
 alignItems: 'center',
 justifyContent: 'center',
 backgroundColor: colors.surfaceMuted,
 },
 modalCloseText: {
 fontSize: 20,
 fontWeight: '800',
 color: colors.textSecondary,
 lineHeight: 24,
 },
 pickerList: {
 maxHeight: 420,
 },
 pickerItem: {
 paddingVertical: 13,
 borderBottomWidth: StyleSheet.hairlineWidth,
 borderBottomColor: colors.border,
 },
 pickerTitle: {
 fontSize: 15,
 fontWeight: '800',
 color: colors.textPrimary,
 },
 pickerMeta: {
 marginTop: 4,
 fontSize: 12,
 color: colors.textTertiary,
 },
 absoluteGraphCell: {
 position: 'absolute',
 },
absoluteGraphCellResizeActive: {
 zIndex: 120,
 elevation: 30,
},
 dragPlaceholderOverlay: {
 position: 'absolute',
 borderWidth: 1.2,
 borderColor: colors.textTertiary,
 borderRadius: radius.md,
 backgroundColor: colors.surfaceMuted,
 zIndex: 998,
 pointerEvents: 'none',
 },
resizeDismissZone: {
 position: 'absolute',
 zIndex: 20,
 elevation: 0,
 backgroundColor: 'transparent',
},
resizeGhostFrameOverlay: {
 position: 'absolute',
 zIndex: 9998,
 elevation: 0,
 borderWidth: 1.5,
 borderStyle: 'solid',
 borderColor: colors.gray400,
 borderRadius: radius.md,
 backgroundColor: 'transparent',
 overflow: 'visible',
 pointerEvents: 'none',
},
resizeGhostCorner: {
 position: 'absolute',
 width: RESIZE_ACTIVE_CORNER_SIZE,
 height: RESIZE_ACTIVE_CORNER_SIZE,
 borderColor: colors.borderStrong,
},
resizeGhostCornerTopRight: {
 top: -(RESIZE_CORNER_OUTSET + RESIZE_FRAME_INSET),
 right: -(RESIZE_CORNER_OUTSET + RESIZE_FRAME_INSET),
 borderTopWidth: 3,
 borderRightWidth: 3,
},
resizeGhostCornerBottomLeft: {
 left: -(RESIZE_CORNER_OUTSET + RESIZE_FRAME_INSET),
 bottom: -(RESIZE_CORNER_OUTSET + RESIZE_FRAME_INSET),
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
 borderTopWidth: 1.2,
 borderStyle: 'dashed',
 borderColor: colors.borderStrong,
},
});
