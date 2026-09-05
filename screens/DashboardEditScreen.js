import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
 useWindowDimensions,
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
import {
 buildDashboardLayoutFromOrder,
 buildResponsiveDashboardLayout,
 reorderDashboardCardsByInsertion,
 sortDashboardCardsByStoredPosition,
} from '../utils/dashboardAutoLayout';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Line, Rect } from 'react-native-svg';
import DashboardWidgetPreview from '../components/dashboard/DashboardWidgetPreview';
import {
 buttonStyles,
 color,
 control as canonicalControlStyles,
 font,
 layout as canonicalLayoutStyles,
 modal as canonicalModalStyles,
 primitive,
 radius,
 space,
 surface as canonicalSurfaceStyles,
 text as canonicalTextStyles,
} from '../styles/common';

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

const getResizeGridItemFrame = (
 item,
 gridW,
 rowGap = GRID_ROW_GAP,
 columns = GRID_COLUMNS,
) => {
 const safeColumns = Math.max(
 1,
 Number(columns) || GRID_COLUMNS,
 );

 const safeW = Math.max(
 1,
 Math.min(
 GRID_COLUMNS,
 Number(item?.w) || 1,
 ),
 );

 const safeH = Math.max(
 1,
 Number(item?.h) || 1,
 );

 const maxX = Math.max(
 0,
 safeColumns - safeW,
 );

 const safeX = Math.max(
 0,
 Math.min(
 maxX,
 Number(item?.x) || 0,
 ),
 );

 const safeY = Math.max(
 0,
 Number(item?.y) || 0,
 );

 const slotWidth = gridW > 0
 ? gridW / safeColumns
 : 0;

 const safeRowGap = Math.max(
 0,
 Number(rowGap) || 0,
 );

 return {
 left:
 safeX * slotWidth +
 GRID_CELL_PADDING,
 top:
 safeY *
 (GRID_ROW_HEIGHT + safeRowGap),
 width: Math.max(
 0,
 safeW * slotWidth -
 GRID_CELL_PADDING * 2,
 ),
 height:
 safeH * GRID_ROW_HEIGHT,
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

const getResizeGhostVisualFramePx = (
 widgetId,
 origin,
 corner,
 translationX,
 translationY,
 gridW,
 rowGap = GRID_ROW_GAP,
 columns = GRID_COLUMNS,
 maxCardWidth = GRID_COLUMNS,
) => {
 if (!gridW) {
 return {
 visualFramePx: null,
 boundedFramePx: null,
 isBeyondLimit: false,
 };
 }

 const safeColumns = Math.max(
 1,
 Number(columns) || GRID_COLUMNS,
 );

 const safeMaxCardWidth = Math.max(
 1,
 Math.min(
 GRID_COLUMNS,
 safeColumns,
 Number(maxCardWidth) || GRID_COLUMNS,
 ),
 );

 const slotWidth =
 gridW / safeColumns;

 const originFrame =
 getResizeGridItemFrame(
 origin,
 gridW,
 rowGap,
 safeColumns,
 );

 const bounds =
 getResizeCatalogBounds(widgetId);

 const originX = Math.max(
 0,
 Number(origin?.x) || 0,
 );

 const originY = Math.max(
 0,
 Number(origin?.y) || 0,
 );

 const originW = Math.max(
 1,
 Math.min(
 safeMaxCardWidth,
 Number(origin?.w) || 1,
 ),
 );

 const originH = Math.max(
 1,
 Number(origin?.h) || 1,
 );

 const isLeftCorner =
 corner === 'topLeft' ||
 corner === 'bottomLeft';

 const isTopCorner =
 corner === 'topLeft' ||
 corner === 'topRight';

 const minWidthPx = Math.max(
 0,
 bounds.minW * slotWidth -
 GRID_CELL_PADDING * 2,
 );

 const availableWidthCells =
 isLeftCorner
 ? originX + originW
 : safeColumns - originX;

 const maxWidthCells = Math.max(
 bounds.minW,
 Math.min(
 bounds.maxW,
 safeMaxCardWidth,
 availableWidthCells,
 ),
 );

 const maxHeightCells =
 isTopCorner
 ? Math.min(
 bounds.maxH,
 originY + originH,
 )
 : bounds.maxH;

 const maxWidthPx = Math.max(
 minWidthPx,
 maxWidthCells * slotWidth -
 GRID_CELL_PADDING * 2,
 );

 const minHeightPx =
 getResizeGridItemHeight(
 bounds.minH,
 rowGap,
 );

 const maxHeightPx =
 getResizeGridItemHeight(
 maxHeightCells,
 rowGap,
 );

 const originLeft = originFrame.left;
 const originTop = originFrame.top;

 const originRight =
 originFrame.left +
 originFrame.width;

 const originBottom =
 originFrame.top +
 originFrame.height;

 const rawX =
 Number(translationX) || 0;

 const rawY =
 Number(translationY) || 0;

 const rawWidth =
 originFrame.width +
 (isLeftCorner ? -rawX : rawX);

 const rawHeight =
 originFrame.height +
 (isTopCorner ? -rawY : rawY);

 const boundedWidth = Math.max(
 minWidthPx,
 Math.min(
 maxWidthPx,
 rawWidth,
 ),
 );

 const boundedHeight = Math.max(
 minHeightPx,
 Math.min(
 maxHeightPx,
 rawHeight,
 ),
 );

 const visualWidth =
 applyResizeResistancePx(
 rawWidth,
 minWidthPx,
 maxWidthPx,
 );

 const visualHeight =
 applyResizeResistancePx(
 rawHeight,
 minHeightPx,
 maxHeightPx,
 );

 const boundedFramePx = {
 left:
 isLeftCorner
 ? originRight - boundedWidth
 : originLeft,
 top:
 isTopCorner
 ? originBottom - boundedHeight
 : originTop,
 width: boundedWidth,
 height: boundedHeight,
 };

 const visualFramePx = {
 left:
 isLeftCorner
 ? originRight - visualWidth
 : originLeft,
 top:
 isTopCorner
 ? originBottom - visualHeight
 : originTop,
 width: visualWidth,
 height: visualHeight,
 };

 return {
 visualFramePx,
 boundedFramePx,
 isBeyondLimit:
 Math.abs(
 visualFramePx.left -
 boundedFramePx.left,
 ) > 0.5 ||
 Math.abs(
 visualFramePx.top -
 boundedFramePx.top,
 ) > 0.5 ||
 Math.abs(
 visualFramePx.width -
 boundedFramePx.width,
 ) > 0.5 ||
 Math.abs(
 visualFramePx.height -
 boundedFramePx.height,
 ) > 0.5,
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
const WIDE_GRID_COLUMNS = GRID_COLUMNS * 2;
const WIDE_EDIT_MIN_WIDTH = 600;
const WIDE_HALF_SWITCH_HYSTERESIS = 1;

const getDashboardEditItemId = (item) => String(
 item?.widgetId ??
 item?.id ??
 item?.i ??
 '',
);

const getDashboardInsertionIndexFromPoint = (
 items,
 movingId,
 point,
 columns,
) => {
 const safeColumns = Math.max(
 1,
 Number(columns) || GRID_COLUMNS,
 );

 const movingIdentity = String(
 movingId ?? '',
 );

 const orderedItems =
 sortDashboardCardsByStoredPosition(
 Array.isArray(items) ? items : [],
 ).filter(
 (item) => (
 getDashboardEditItemId(item) !==
 movingIdentity
 ),
 );

 const safePointX = Math.max(
 0,
 Math.min(
 safeColumns - 0.001,
 Number(point?.x) || 0,
 ),
 );

 const safePointY = Math.max(
 0,
 Number(point?.y) || 0,
 );

 const pointRow = Math.floor(
 safePointY,
 );

 for (
 let index = 0;
 index < orderedItems.length;
 index += 1
 ) {
 const item = orderedItems[index];

 const itemY = Math.max(
 0,
 Number(item?.y) || 0,
 );

 const itemX = Math.max(
 0,
 Number(item?.x) || 0,
 );

 const itemW = Math.max(
 1,
 Number(item?.w) || 1,
 );

 const itemCenterX =
 itemX + itemW / 2;

 if (pointRow < itemY) {
 return index;
 }

 if (
 pointRow === itemY &&
 safePointX < itemCenterX
 ) {
 return index;
 }
 }

 return orderedItems.length;
};

export default function DashboardEditScreen({ route, navigation }) {
 const insets = useSafeAreaInsets();
 const { width: editWindowWidth } = useWindowDimensions();
 const [editFrameWidth, setEditFrameWidth] = useState(0);
 const effectiveEditWidth =
 editFrameWidth > 0
 ? editFrameWidth
 : editWindowWidth;
 const isWideEditLayout =
 effectiveEditWidth >= WIDE_EDIT_MIN_WIDTH;
 const displayGridColumns = isWideEditLayout
 ? WIDE_GRID_COLUMNS
 : GRID_COLUMNS;

 const editLayoutMode = isWideEditLayout
 ? 'wide'
 : 'narrow';

 const currentEditLayoutModeRef =
 useRef(editLayoutMode);

 const handledEditLayoutModeRef =
 useRef(editLayoutMode);

 const dragGestureLayoutModeRef =
 useRef(null);

 const resizeGestureLayoutModeRef =
 useRef(null);

 currentEditLayoutModeRef.current =
 editLayoutMode;

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
 const gestureDragOffset = useRef(
 new Animated.ValueXY({
 x: 0,
 y: 0,
 }),
 ).current;
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
 const dragVisualStartedWidgetIdRef = useRef(null);
 const longPressCompletingWidgetIdRef = useRef(null);
 const longPressMovedWidgetIdRef = useRef(null);
 const longPressVisualOpacityByWidgetRef = useRef(new Map());
 const previewTargetRef = useRef(null);
 const dragInsertionIndexRef = useRef(null);
 const dragInsertionPreviewInputRef = useRef('');
 const dragWideHalfRef = useRef(null);
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

 useLayoutEffect(() => {
 if (!activeResizeWidgetId) {
 return;
 }

 const activeLongPressOpacity =
 longPressVisualOpacityByWidgetRef.current.get(
 activeResizeWidgetId,
 );

 if (activeLongPressOpacity) {
 activeLongPressOpacity.setValue(0);
 }

 if (
 longPressCompletingWidgetIdRef.current ===
 activeResizeWidgetId
 ) {
 longPressCompletingWidgetIdRef.current = null;
 }
 }, [activeResizeWidgetId]);

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

const clearDragVisualState = useCallback(
(options = {}) => {
 const preserveResize =
 !!options.preserveResize;

 if (!preserveResize) {
 clearResizeGhostBounceTimer();
 }

 stopDashboardAutoScroll();

 setGestureDraggingWidgetId(null);
 setDraggingOriginalWidgetId(null);
 setDragPlaceholder(null);
 setDragOverlayItem(null);
 setDragOverlayStart({
 x: 0,
 y: 0,
 });
 setDragOverlayTouchOffset({
 x: 0,
 y: 0,
 });

 dragOriginRef.current = null;
 lastDropTargetRef.current = null;
 previewLayoutSignatureRef.current = '';
 dragInsertionIndexRef.current = null;
 dragInsertionPreviewInputRef.current = '';
 dragWideHalfRef.current = null;

 if (!preserveResize) {
 setActiveResizeCorner(null);
 setResizeDimWidgetId(null);
 setResizeDraggingWidgetId(null);
 setPreviewLayout(null);
 setResizeGhostFrame(null);


 resizeOriginRef.current = null;
 resizePreviewSizeRef.current = '';
 resizePreviewSignatureRef.current = '';
 }
},
[]);

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

const cancelDashboardGestureForLayoutChange =
useCallback(() => {
 clearScheduledDragVisualCleanup();
 clearResizeDiagonalDelayTimer();
 clearDragVisualState();

 resizeTouchOpacityRef.current.setValue(1);

 previewTargetRef.current = null;

 dragStartScrollYRef.current =
 scrollYRef.current;

 dragGestureLayoutModeRef.current = null;
 resizeGestureLayoutModeRef.current = null;
}, [
 clearScheduledDragVisualCleanup,
 clearResizeDiagonalDelayTimer,
 clearDragVisualState,
]);

useEffect(() => {
 if (
 handledEditLayoutModeRef.current ===
 editLayoutMode
 ) {
 return;
 }

 handledEditLayoutModeRef.current =
 editLayoutMode;

 cancelDashboardGestureForLayoutChange();
}, [
 editLayoutMode,
 cancelDashboardGestureForLayoutChange,
]);

const scheduleDragVisualCleanup = useCallback(() => {
 clearScheduledDragVisualCleanup();

 dragCleanupTimerRef.current =
 setTimeout(() => {
 dragCleanupTimerRef.current = null;

 const preserveResize =
 resizeGestureLayoutModeRef.current !==
 null &&
 resizeOriginRef.current !==
 null;

 clearDragVisualState({
 preserveResize,
 });
 }, 32);
}, [
 clearDragVisualState,
 clearScheduledDragVisualCleanup,
]);

 const decreaseRowGap = useCallback(() => {
 setRowGap((current) => Math.max(DASHBOARD_ROW_GAP_MIN, current - DASHBOARD_ROW_GAP_STEP));
 }, []);

 const increaseRowGap = useCallback(() => {
 setRowGap((current) => Math.min(DASHBOARD_ROW_GAP_MAX, current + DASHBOARD_ROW_GAP_STEP));
 }, []);

 const canDecreaseRowGap = rowGap > DASHBOARD_ROW_GAP_MIN;
 const canIncreaseRowGap = rowGap < DASHBOARD_ROW_GAP_MAX;

 const placedIds = useMemo(() => new Set(layout.map(item => item.widgetId || item.id)), [layout]);

 const canonicalDisplayLayout = useMemo(() => {
 if (
 Array.isArray(previewLayout) &&
 previewLayout.length > 0 &&
 (
 gestureDraggingWidgetId ||
 resizeDraggingWidgetId
 )
 ) {
 return previewLayout.map(normalizeLayoutItem);
 }

 return Array.isArray(layout)
 ? layout.map(normalizeLayoutItem)
 : [];
 }, [
 layout,
 previewLayout,
 gestureDraggingWidgetId,
 resizeDraggingWidgetId,
 ]);

 const displayLayout = useMemo(() => {
 if (!isWideEditLayout) {
 return canonicalDisplayLayout;
 }

 return buildResponsiveDashboardLayout(
 canonicalDisplayLayout,
 {
 columns: WIDE_GRID_COLUMNS,
 maxCardWidth: GRID_COLUMNS,
 },
 );
 }, [
 canonicalDisplayLayout,
 isWideEditLayout,
 ]);

 const interactionDisplayLayout = useMemo(() => {
 const sourceLayout = Array.isArray(layout)
 ? layout.map(normalizeLayoutItem)
 : [];

 if (!isWideEditLayout) {
 return sourceLayout;
 }

 return buildResponsiveDashboardLayout(
 sourceLayout,
 {
 columns: WIDE_GRID_COLUMNS,
 maxCardWidth: GRID_COLUMNS,
 },
 );
 }, [
 layout,
 isWideEditLayout,
 ]);

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
 const safeW = Math.max(
 1,
 Math.min(
 GRID_COLUMNS,
 Number(item?.w) || 1,
 ),
 );

 const safeH = Math.max(
 1,
 Number(item?.h) || 1,
 );

 const maxX = Math.max(
 0,
 displayGridColumns - safeW,
 );

 const safeX = Math.max(
 0,
 Math.min(
 maxX,
 Number(item?.x) || 0,
 ),
 );

 const safeY = Math.max(
 0,
 Number(item?.y) || 0,
 );

 const slotWidth = gridW > 0
 ? gridW / displayGridColumns
 : 0;

 return {
 left: safeX * slotWidth + GRID_CELL_PADDING,
 top: safeY * (GRID_ROW_HEIGHT + rowGap),
 width: Math.max(
 0,
 safeW * slotWidth -
 GRID_CELL_PADDING * 2,
 ),
 height: getGridItemHeight(safeH),
 safeX,
 safeY,
 safeW,
 safeH,
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

 const firstReflowLayout =
 Array.isArray(reflowed)
 ? reflowed
 : resizedLayout;

 const finalReflowLayout =
 reflowDashboardLayoutWithFixedItem(
 firstReflowLayout,
 targetWidgetId,
 resizedItem,
 );

 if (!isPreview) {
 const toResizeDiagnosticSnapshot = (items) => {
 return (Array.isArray(items) ? items : [])
 .map((item) => ({
 id:
 item.widgetId ||
 item.id ||
 item.i ||
 '?',
 x: Number(item.x) || 0,
 y: Number(item.y) || 0,
 w: Number(item.w) || 0,
 h: Number(item.h) || 0,
 }))
 .sort((a, b) => {
 if (a.y !== b.y) return a.y - b.y;
 if (a.x !== b.x) return a.x - b.x;
 return String(a.id).localeCompare(String(b.id));
 });
 };

 const resizedSnapshot =
 toResizeDiagnosticSnapshot(
 resizedLayout,
 );

 const finalSnapshot =
 toResizeDiagnosticSnapshot(
 finalReflowLayout,
 );

 const resizedById =
 new Map(
 resizedSnapshot.map((item) => [
 String(item.id),
 item,
 ]),
 );

 const delta =
 finalSnapshot.map((item) => {
 const before =
 resizedById.get(
 String(item.id),
 );

 if (!before) {
 return {
 id: item.id,
 added: true,
 after: item,
 };
 }

 return {
 id: item.id,
 dx: item.x - before.x,
 dy: item.y - before.y,
 dw: item.w - before.w,
 dh: item.h - before.h,
 };
 });

  }

 return finalReflowLayout;
 } catch (error) {
 const fallbackLayout =
 reflowDashboardLayoutWithFixedItem(
 resizedLayout,
 targetWidgetId,
 resizedItem,
 );

 if (!isPreview) {
 console.warn(
 '[DashboardEditScreen] resize reflow failed:',
 error?.message || error,
 );

 const snapshotFallback = (items) => {
 return (Array.isArray(items) ? items : [])
 .map((item) => ({
 id:
 item.widgetId ||
 item.id ||
 item.i ||
 '?',
 x: Number(item.x) || 0,
 y: Number(item.y) || 0,
 w: Number(item.w) || 0,
 h: Number(item.h) || 0,
 }))
 .sort((a, b) => {
 if (a.y !== b.y) return a.y - b.y;
 if (a.x !== b.x) return a.x - b.x;
 return String(a.id).localeCompare(String(b.id));
 });
 };

  }

 return fallbackLayout;
 }
}, []);

const resizeLayoutItem = useCallback((widgetId, nextSize) => {
 if (!widgetId || !nextSize) return;

 setDashboardLayoutImmediate((prev) => buildResizedLayoutWithReflow(prev, widgetId, nextSize, {
 isPreview: false,
 }));
}, [buildResizedLayoutWithReflow, setDashboardLayoutImmediate]);

const buildResizedDashboardLayoutFromOrder = useCallback((
 sourceLayout,
 targetWidgetId,
 nextSize,
) => {
 if (
 !targetWidgetId ||
 !nextSize
 ) {
 return Array.isArray(sourceLayout)
 ? sourceLayout
 : [];
 }

 const targetIdentity = String(
 targetWidgetId,
 );

 const orderedSource =
 sortDashboardCardsByStoredPosition(
 Array.isArray(sourceLayout)
 ? sourceLayout.map(normalizeLayoutItem)
 : [],
 );

 let targetFound = false;

 const resizedOrderedSource =
 orderedSource.map((item) => {
 const itemIdentity = String(
 item?.widgetId ??
 item?.id ??
 item?.i ??
 '',
 );

 if (itemIdentity !== targetIdentity) {
 return {
 ...item,
 };
 }

 const clampedSize =
 clampDashboardResizeSize(
 targetWidgetId,
 nextSize.w,
 nextSize.h,
 {
 maxW: GRID_COLUMNS,
 },
 );

 targetFound = true;

 return {
 ...item,
 w: clampedSize.w,
 h: clampedSize.h,
 };
 });

 if (!targetFound) {
 return orderedSource;
 }

 return buildDashboardLayoutFromOrder(
 resizedOrderedSource,
 {
 columns: GRID_COLUMNS,
 maxCardWidth: GRID_COLUMNS,
 },
 );
}, []);

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

 navigation.navigateDeprecated('EntryList', entryListParams);
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
 canonicalSurfaceStyles.card,
  styles.graphCardVisualSurface,
 isResizeActive && styles.graphCardResizeActive,
 isResizeActive && resizeTouchOpacity && { opacity: resizeTouchOpacity },
 shouldDimOriginalCard && styles.graphCardDimmed,
 ]}
 />

 <View style={[canonicalLayoutStyles.rowBetween, styles.graphHeader, isCompactCard && styles.graphHeaderCompact]}>
 <View style={[canonicalLayoutStyles.row, styles.graphTitleGroup]}>
 <MarqueeText text={titleText} style={[canonicalTextStyles.bodyStrong, styles.graphTitle]} enabled={isCompactCard || isNarrowTitleCard} />
 </View>
 <View style={[canonicalControlStyles.pill, styles.graphSizeBadge, isCompactCard && styles.graphSizeBadgeCompact]}>
 <Text style={[canonicalTextStyles.metaStrong, styles.graphSizeBadgeText, isCompactCard && styles.graphSizeBadgeTextCompact]}>{displaySizeText}</Text>
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
   const slotW = gridWidth > 0
 ? gridWidth / displayGridColumns
 : 0;
   return (
     <View style={[styles.graphCell, { opacity: 0.5 }]}>
       <View style={[styles.graphCard, { minHeight: h >= 2 ? 120 : 90, backgroundColor: color.surfaceMuted, borderColor: primitive.black, borderStyle: 'dashed' }]} />
     </View>
   );
 }
 const widgetId = item.widgetId || item.id || `graph_${index}`;
 const baseTitleText = item.title || item.name || widgetId;
 const safeW = Math.max(1, Math.min(GRID_COLUMNS, Number(item.w || GRID_COLUMNS)));
 const safeX = Math.max(
 0,
 Math.min(displayGridColumns - safeW,
 Number(item.x || 0),
 ),
 );
 const safeY = Number.isFinite(Number(item.y)) ? Math.max(0, Number(item.y)) : index;
 const safeH = Math.max(1, Number(item.h || 1));
 const isCompactCard = safeH === 1;
 const isNarrowTitleCard = safeW <= 3;
 const titleText = baseTitleText;
 const cardHeight = getGridItemHeight(safeH);
 const innerCardHeight = Math.max(0, cardHeight - RESIZE_FRAME_INSET * 2);
 const slotWidth = gridWidth > 0
 ? gridWidth / displayGridColumns
 : 0;
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

const getCanonicalResizeOriginFromCurrentLayout = () => {
 const findCanonicalItem = (items) => {
 if (!Array.isArray(items)) {
 return null;
 }

 return (
 items.find(
 (sourceItem) =>
 getDashboardEditItemId(
 sourceItem,
 ) ===
 String(widgetId),
 ) ||
 null
 );
 };

 const canonicalItem =
 findCanonicalItem(
 layoutRef.current,
 ) ||
 findCanonicalItem(
 layout,
 );

 if (!canonicalItem) {
 return null;
 }

 const canonicalW =
 Math.max(
 1,
 Math.min(
 GRID_COLUMNS,
 Number(
 canonicalItem.w,
 ) || 1,
 ),
 );

 const canonicalH =
 Math.max(
 1,
 Number(
 canonicalItem.h,
 ) || 1,
 );

 return {
 x:
 Math.max(
 0,
 Math.min(
 GRID_COLUMNS -
 canonicalW,
 Number(
 canonicalItem.x,
 ) || 0,
 ),
 ),
 y:
 Math.max(
 0,
 Number(
 canonicalItem.y,
 ) || 0,
 ),
 w: canonicalW,
 h: canonicalH,
 };
};

const buildResizeGesture = (corner) => Gesture.Pan()
 .enabled(isResizeActive)
 .runOnJS(true)
 .onTouchesDown(() => {
 if (
 currentEditLayoutModeRef.current !==
 editLayoutMode
 ) {
 return;
 }

 resizeTouchOpacityRef.current.setValue(0.16);

 clearResizeDiagonalDelayTimer();

 resizeDiagonalDelayTimerRef.current =
 setTimeout(() => {
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
 })
 .onBegin(() => {
 resizeGestureLayoutModeRef.current =
 editLayoutMode;

 if (
 currentEditLayoutModeRef.current !==
 editLayoutMode
 ) {
 return;
 }

 const sourceCanonicalLayout =
 Array.isArray(layoutRef.current) &&
 layoutRef.current.length > 0
 ? layoutRef.current
 : layout;

 const canonicalOriginItem =
 sourceCanonicalLayout.find(
 (sourceItem) => (
 getDashboardEditItemId(
 sourceItem,
 ) === String(widgetId)
 ),
 );

 const canonicalW = Math.max(
 1,
 Math.min(
 GRID_COLUMNS,
 Number(canonicalOriginItem?.w) ||
 safeW,
 ),
 );

 const canonicalH = Math.max(
 1,
 Number(canonicalOriginItem?.h) ||
 safeH,
 );

 const canonicalX = Math.max(
 0,
 Math.min(
 GRID_COLUMNS - canonicalW,
 Number(canonicalOriginItem?.x) ||
 0,
 ),
 );

 const canonicalY = Math.max(
 0,
 Number(canonicalOriginItem?.y) ||
 0,
 );

 setResizeDraggingWidgetId(widgetId);
 resizeTouchOpacityRef.current.setValue(0.16);

 resizeOriginRef.current = {
 x: canonicalX,
 y: canonicalY,
 w: canonicalW,
 h: canonicalH,
 displayX: safeX,
 displayY: safeY,
 };



 resizePreviewSignatureRef.current = '';
 resizePreviewSizeRef.current =
 `${canonicalX}:${canonicalY}:${canonicalW}:${canonicalH}`;

 clearResizeGhostBounceTimer();
 setPreviewLayout(null);
 setResizeGhostFrame(null);
 })
 .onUpdate((event) => {
 if (
 resizeGestureLayoutModeRef.current !==
 currentEditLayoutModeRef.current
 ) {
 return;
 }


 const origin =
 resizeOriginRef.current ||
 getCanonicalResizeOriginFromCurrentLayout();

 if (!origin) {
 return;
 }

 const deltaColsRaw = slotWidth
 ? event.translationX / slotWidth
 : 0;

 const deltaRowsRaw =
 (event.translationY || 0) /
 (GRID_ROW_HEIGHT + rowGap);

 const deltaCols =
 getResizeStableGridDelta(
 deltaColsRaw,
 );

 const deltaRows =
 getResizeStableGridDelta(
 deltaRowsRaw,
 );

 const nextFrame =
 getAnchoredResizeFrame(
 widgetId,
 origin,
 corner,
 deltaCols,
 deltaRows,
 );

 const displayOrigin = {
 x: Math.max(
 0,
 Number(origin.displayX) ||
 0,
 ),
 y: Math.max(
 0,
 Number(origin.displayY) ||
 0,
 ),
 w: origin.w,
 h: origin.h,
 };

 const ghostState =
 getResizeGhostVisualFramePx(
 widgetId,
 displayOrigin,
 corner,
 event.translationX,
 event.translationY,
 gridWidth,
 rowGap,
 displayGridColumns,
 GRID_COLUMNS,
 );

 const visualFrame =
 ghostState.visualFramePx;

 const boundedFrame =
 ghostState.boundedFramePx;

 const roundVisualValue = (value) => (
 Math.round(
 (Number(value) || 0) * 10,
 ) / 10
 );

 const visualSignature = [
 widgetId,
 nextFrame.x,
 nextFrame.y,
 nextFrame.w,
 nextFrame.h,
 roundVisualValue(
 visualFrame?.left,
 ),
 roundVisualValue(
 visualFrame?.top,
 ),
 roundVisualValue(
 visualFrame?.width,
 ),
 roundVisualValue(
 visualFrame?.height,
 ),
 ].join(':');

 if (
 resizePreviewSignatureRef.current ===
 visualSignature
 ) {
 return;
 }

 resizePreviewSignatureRef.current =
 visualSignature;

 resizePreviewSizeRef.current =
 `${nextFrame.x}:${nextFrame.y}:${nextFrame.w}:${nextFrame.h}`;

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
 scheduleResizeGhostBounceBack(
 widgetId,
 nextFrame,
 boundedFrame,
 visualSignature,
 );
 } else {
 clearResizeGhostBounceTimer();
 }
 })
 .onEnd((event) => {
 if (
 resizeGestureLayoutModeRef.current !==
 currentEditLayoutModeRef.current
 ) {
 return;
 }

 clearResizeDiagonalDelayTimer();


 const origin =
 resizeOriginRef.current ||
 getCanonicalResizeOriginFromCurrentLayout();

 if (!origin) {
 return;
 }

 const deltaColsRaw = slotWidth
 ? event.translationX / slotWidth
 : 0;

 const deltaRowsRaw =
 (event.translationY || 0) /
 (GRID_ROW_HEIGHT + rowGap);

 const deltaCols =
 getResizeStableGridDelta(
 deltaColsRaw,
 );

 const deltaRows =
 getResizeStableGridDelta(
 deltaRowsRaw,
 );

 if (
 deltaCols !== 0 ||
 deltaRows !== 0
 ) {
 const nextFrame =
 getAnchoredResizeFrame(
 widgetId,
 origin,
 corner,
 deltaCols,
 deltaRows,
 );

 const frameChanged =
 nextFrame.x !== origin.x ||
 nextFrame.y !== origin.y ||
 nextFrame.w !== origin.w ||
 nextFrame.h !== origin.h;

 if (frameChanged) {

 resizeLayoutItem(
 widgetId,
 nextFrame,
 );
 }
 }

 clearResizeGhostBounceTimer();
 setPreviewLayout(null);
 setResizeGhostFrame(null);
 setResizeDraggingWidgetId(null);
 resizeTouchOpacityRef.current.setValue(1);

 resizeOriginRef.current = null;
 resizePreviewSignatureRef.current = '';
 resizePreviewSizeRef.current = '';
 })
 .onFinalize(() => {
 const isCurrentLayoutMode =
 resizeGestureLayoutModeRef.current ===
 currentEditLayoutModeRef.current;

 resizeGestureLayoutModeRef.current = null;

 if (!isCurrentLayoutMode) {
 return;
 }

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

const topLeftResizeGesture = isResizeActive
 ? buildResizeGesture('topLeft')
 : null;
const topRightResizeGesture = isResizeActive
 ? buildResizeGesture('topRight')
 : null;
const bottomLeftResizeGesture = isResizeActive
 ? buildResizeGesture('bottomLeft')
 : null;
const bottomRightResizeGesture = isResizeActive
 ? buildResizeGesture('bottomRight')
 : null;

const canMoveCard =
 !resizeDraggingWidgetId &&
 (!activeResizeWidgetId || activeResizeWidgetId === widgetId);

let longPressVisualOpacity =
 longPressVisualOpacityByWidgetRef.current.get(widgetId);

if (!longPressVisualOpacity) {
 longPressVisualOpacity = new Animated.Value(0);
 longPressVisualOpacityByWidgetRef.current.set(
 widgetId,
 longPressVisualOpacity,
 );
}

const startCardDragVisual = (event) => {
 if (dragVisualStartedWidgetIdRef.current === widgetId) {
 return;
 }

 dragVisualStartedWidgetIdRef.current = widgetId;

 if (activeResizeWidgetId) {
 setResizeGhostFrame(null);
 setPreviewLayout(null);
 }

 setDraggingOriginalWidgetId(widgetId);
 setGestureDraggingWidgetId(widgetId);
 gestureDragOffset.setValue({ x: 0, y: 0 });
 const overlayWidth = slotWidth ? slotWidth * safeW : 0;
 const overlayHeight = cardHeight || 0;
 const initialTouchX =
 (Number(event.x) || 0) -
 (Number(event.translationX) || 0);
 const initialTouchY =
 (Number(event.y) || 0) -
 (Number(event.translationY) || 0);
 const localTouchX = Math.max(
 0,
 Math.min(
 overlayWidth || Number.MAX_SAFE_INTEGER,
 initialTouchX,
 ),
 );
 const localTouchY = Math.max(
 0,
 Math.min(
 overlayHeight || Number.MAX_SAFE_INTEGER,
 initialTouchY,
 ),
 );

 setDragOverlayStart({
 x:
 (Number(event.absoluteX) || 0) -
 (Number(event.translationX) || 0),
 y:
 (Number(event.absoluteY) || 0) -
 (Number(event.translationY) || 0),
 });
 setDragOverlayTouchOffset({
 x: localTouchX,
 y: localTouchY,
 });
 setDragOverlayItem({
 widgetId: item.widgetId,
 kind: item.kind,
 w: safeW,
 h: safeH,
 cardHeight,
 isCompactCard,
 safeW,
 safeH,
 titleText,
 });
};

 const testGesture = (!activeResizeWidgetId || isResizeActive)
   ? Gesture.Pan()
   .enabled(canMoveCard)
   .activateAfterLongPress(300)
   .runOnJS(true)
   .onBegin(() => {
     dragVisualStartedWidgetIdRef.current = null;
     longPressMovedWidgetIdRef.current = null;
     dragGestureLayoutModeRef.current =
      editLayoutMode;

     if (
      currentEditLayoutModeRef.current !==
      editLayoutMode
     ) {
      return;
     }

     clearScheduledDragVisualCleanup();
     previewLayoutSignatureRef.current = '';
     dragInsertionIndexRef.current = null;
     dragInsertionPreviewInputRef.current = '';
     dragWideHalfRef.current = null;
     const sourceCanonicalLayout =
 Array.isArray(layoutRef.current) &&
 layoutRef.current.length > 0
 ? layoutRef.current
 : layout;

 const canonicalOriginItem =
 sourceCanonicalLayout.find(
 (sourceItem) => (
 getDashboardEditItemId(
 sourceItem,
 ) === String(widgetId)
 ),
 );

 dragOriginRef.current = {
 x: Math.max(
 0,
 Number(canonicalOriginItem?.x) || 0,
 ),
 y: Math.max(
 0,
 Number(canonicalOriginItem?.y) || 0,
 ),
 w: Math.max(
 1,
 Math.min(
 GRID_COLUMNS,
 Number(canonicalOriginItem?.w) ||
 safeW,
 ),
 ),
 h: Math.max(
 1,
 Number(canonicalOriginItem?.h) ||
 safeH,
 ),
 };
   })
   .onStart((event) => {
     if (
      dragGestureLayoutModeRef.current !==
      currentEditLayoutModeRef.current
     ) {
      return;
     }

     dragStartScrollYRef.current = scrollYRef.current;
     clearScheduledDragVisualCleanup();
   })
   .onUpdate((event) => {
 if (
 dragGestureLayoutModeRef.current !==
 currentEditLayoutModeRef.current
 ) {
 return;
 }

 if (
 Math.abs(event.translationX) > 10 ||
 Math.abs(event.translationY) > 10
 ) {
 longPressMovedWidgetIdRef.current = widgetId;
 longPressVisualOpacity.setValue(0);
 startCardDragVisual(event);
 }

 gestureDragOffset.setValue({
 x: event.translationX,
 y: event.translationY,
 });

 const canonicalSlotWidth =
 gridWidth > 0
 ? gridWidth / GRID_COLUMNS
 : 0;

 const rawGridDX =
 canonicalSlotWidth
 ? event.translationX /
 canonicalSlotWidth
 : 0;

 const scrollDelta =
 scrollYRef.current -
 dragStartScrollYRef.current;

 const insertionDragOrigin =
 dragOriginRef.current;

 const insertionOriginW =
 Math.max(
 1,
 Math.min(
 GRID_COLUMNS,
 Number(
 insertionDragOrigin?.w,
 ) || safeW,
 ),
 );

 const canUseInsertionReorder =
 isWideEditLayout ||
 insertionOriginW < GRID_COLUMNS ||
 String(widgetId) === 'weekly-bars';

 if (canUseInsertionReorder) {
 const displayOriginItem =
 interactionDisplayLayout.find(
 (displayItem) => (
 getDashboardEditItemId(
 displayItem,
 ) === String(widgetId)
 ),
 );

 const displaySlotWidth =
 gridWidth > 0 &&
 displayGridColumns > 0
 ? gridWidth /
 displayGridColumns
 : 0;

 if (
 displayOriginItem &&
 displaySlotWidth > 0
 ) {
 const displayOriginX =
 Math.max(
 0,
 Number(
 displayOriginItem.x,
 ) || 0,
 );

 const displayOriginY =
 Math.max(
 0,
 Number(
 displayOriginItem.y,
 ) || 0,
 );

 const displayOriginW =
 Math.max(
 1,
 Number(
 displayOriginItem.w,
 ) || 1,
 );

 const displayOriginH =
 Math.max(
 1,
 Number(
 displayOriginItem.h,
 ) || 1,
 );

 const rawDisplayDX =
 event.translationX /
 displaySlotWidth;

 const rawDisplayDY =
 (
 event.translationY +
 scrollDelta
 ) /
 (
 GRID_ROW_HEIGHT +
 rowGap
 );

 const movedEnoughForInsertion =
 Math.abs(rawDisplayDX) >= 0.18 ||
 Math.abs(rawDisplayDY) >= 0.18;

 if (!movedEnoughForInsertion) {
 dragInsertionIndexRef.current =
 null;
 dragInsertionPreviewInputRef.current =
 '';
 dragWideHalfRef.current = null;
 previewTargetRef.current =
 null;
 lastDropTargetRef.current =
 null;
 previewLayoutSignatureRef.current =
 '';
 setDragPlaceholder(null);
 setPreviewLayout(null);
 return;
 }

 const insertionPoint = {
 x:
 displayOriginX +
 displayOriginW / 2 +
 rawDisplayDX,
 y:
 displayOriginY +
 displayOriginH / 2 +
 rawDisplayDY,
 };

 const rawInsertionIndex =
 getDashboardInsertionIndexFromPoint(
 displayLayout,
 widgetId,
 insertionPoint,
 displayGridColumns,
 );

 const sourceCanonicalLayout =
 Array.isArray(layoutRef.current) &&
 layoutRef.current.length > 0
 ? layoutRef.current
 : layout;

 const wideHalfAwareInsertion =
 isWideEditLayout &&
 displayGridColumns ===
 WIDE_GRID_COLUMNS;

 const wideMiddleColumn =
 WIDE_GRID_COLUMNS / 2;

 const originDisplayCenterX =
 displayOriginX +
 displayOriginW / 2;

 const movingDisplayCenterX =
 originDisplayCenterX +
 rawDisplayDX;

 const originWideHalf =
 originDisplayCenterX <
 wideMiddleColumn
 ? 'left'
 : 'right';

 const currentWideHalf =
 dragWideHalfRef.current ||
 originWideHalf;

 let intendedWideHalf =
 currentWideHalf;

 if (wideHalfAwareInsertion) {
 if (
 currentWideHalf === 'left' &&
 movingDisplayCenterX >=
 wideMiddleColumn +
 WIDE_HALF_SWITCH_HYSTERESIS
 ) {
 intendedWideHalf = 'right';
 } else if (
 currentWideHalf === 'right' &&
 movingDisplayCenterX <=
 wideMiddleColumn -
 WIDE_HALF_SWITCH_HYSTERESIS
 ) {
 intendedWideHalf = 'left';
 }

 dragWideHalfRef.current =
 intendedWideHalf;
 } else {
 dragWideHalfRef.current = null;
 }

 const insertionPreviewInput = [
 rawInsertionIndex,
 wideHalfAwareInsertion
 ? intendedWideHalf
 : 'single',
 ].join(':');

 if (
 dragInsertionPreviewInputRef.current ===
 insertionPreviewInput
 ) {
 return;
 }

 dragInsertionPreviewInputRef.current =
 insertionPreviewInput;

 const buildInsertionPreview =
 (candidateIndex) => {
 const canonicalLayout =
 reorderDashboardCardsByInsertion(
 sourceCanonicalLayout,
 widgetId,
 candidateIndex,
 {
 columns: GRID_COLUMNS,
 maxCardWidth: GRID_COLUMNS,
 },
 );

 const responsiveLayout =
 isWideEditLayout
 ? buildResponsiveDashboardLayout(
 canonicalLayout,
 {
 columns:
 WIDE_GRID_COLUMNS,
 maxCardWidth:
 GRID_COLUMNS,
 },
 )
 : canonicalLayout;

 const candidateMovingItem =
 responsiveLayout.find(
 (candidateItem) => (
 getDashboardEditItemId(
 candidateItem,
 ) === String(widgetId)
 ),
 );

 const candidateMovingCenterX =
 candidateMovingItem
 ? (
 Math.max(
 0,
 Number(candidateMovingItem.x) || 0,
 ) +
 Math.max(
 1,
 Number(candidateMovingItem.w) || 1,
 ) / 2
 )
 : null;

 const candidateWideHalf =
 candidateMovingCenterX === null
 ? null
 : (
 candidateMovingCenterX <
 wideMiddleColumn
 ? 'left'
 : 'right'
 );

 return {
 insertionIndex: candidateIndex,
 canonicalLayout,
 responsiveLayout,
 wideHalf: candidateWideHalf,
 };
 };

 let resolvedInsertionPreview =
 buildInsertionPreview(
 rawInsertionIndex,
 );

 if (
 wideHalfAwareInsertion &&
 resolvedInsertionPreview.wideHalf !==
 intendedWideHalf
 ) {
 const maxInsertionIndex =
 Math.max(
 0,
 sourceCanonicalLayout.length - 1,
 );

 let matchedInsertionPreview =
 null;

 for (
 let distance = 1;
 distance <=
 maxInsertionIndex + 1;
 distance += 1
 ) {
 const lowerIndex =
 rawInsertionIndex - distance;

 const upperIndex =
 rawInsertionIndex + distance;

 const candidateIndexes =
 intendedWideHalf === 'right'
 ? [upperIndex, lowerIndex]
 : [lowerIndex, upperIndex];

 for (
 const candidateIndex of
 candidateIndexes
 ) {
 if (
 candidateIndex < 0 ||
 candidateIndex >
 maxInsertionIndex
 ) {
 continue;
 }

 const candidatePreview =
 buildInsertionPreview(
 candidateIndex,
 );

 if (
 candidatePreview.wideHalf ===
 intendedWideHalf
 ) {
 matchedInsertionPreview =
 candidatePreview;
 break;
 }
 }

 if (matchedInsertionPreview) {
 break;
 }
 }

 if (!matchedInsertionPreview) {
 return;
 }

 resolvedInsertionPreview =
 matchedInsertionPreview;
 }

 const insertionIndex =
 resolvedInsertionPreview.insertionIndex;

 if (
 dragInsertionIndexRef.current ===
 insertionIndex
 ) {
 return;
 }

 dragInsertionIndexRef.current =
 insertionIndex;

 previewTargetRef.current = {
 type: 'insertion',
 insertionIndex,
 };

 const previewCanonicalLayout =
 resolvedInsertionPreview.canonicalLayout;

 const previewSignature =
 getLayoutPreviewSignature(
 previewCanonicalLayout,
 );

 if (
 previewLayoutSignatureRef.current !==
 previewSignature
 ) {
 previewLayoutSignatureRef.current =
 previewSignature;

 setPreviewLayout(
 previewCanonicalLayout,
 );
 }

 const previewDisplayLayout =
 resolvedInsertionPreview.responsiveLayout;

 const previewMovingItem =
 previewDisplayLayout.find(
 (previewItem) => (
 getDashboardEditItemId(
 previewItem,
 ) === String(widgetId)
 ),
 );

 if (previewMovingItem) {
 setDragPlaceholder({
 ...previewMovingItem,
 widgetId: 'placeholder',
 id: 'placeholder',
 isPlaceholder: true,
 });
 } else {
 setDragPlaceholder(null);
 }

 lastDropTargetRef.current = {
 widgetId,
 type: 'insertion',
 insertionIndex,
 };

 return;
 }
 }

 dragInsertionIndexRef.current = null;
 dragInsertionPreviewInputRef.current = '';
 dragWideHalfRef.current = null;

 const rawGridDY =
 (
 event.translationY +
 scrollDelta
 ) /
 (
 GRID_ROW_HEIGHT +
 rowGap
 );

 const deltaX =
 canonicalSlotWidth
 ? getStableGridDelta(
 rawGridDX,
 )
 : 0;

 const deltaY =
 getStableGridDelta(
 rawGridDY,
 );

 if (
 !canonicalSlotWidth ||
 (
 deltaX === 0 &&
 deltaY === 0
 )
 ) {
 setDragPlaceholder(null);
 setPreviewLayout(null);
 lastDropTargetRef.current = null;
 previewTargetRef.current = null;
 previewLayoutSignatureRef.current = '';
 return;
 }

 const dragOrigin =
 dragOriginRef.current || {
 x: 0,
 y: 0,
 w: safeW,
 h: safeH,
 };

 const originW = Math.max(
 1,
 Math.min(
 GRID_COLUMNS,
 Number(dragOrigin.w) ||
 safeW,
 ),
 );

 const originX = Math.max(
 0,
 Number(dragOrigin.x) || 0,
 );

 const originY = Math.max(
 0,
 Number(dragOrigin.y) || 0,
 );

 const maxX = Math.max(
 0,
 GRID_COLUMNS - originW,
 );

 const targetX =
 originW >= GRID_COLUMNS
 ? 0
 : Math.max(
 0,
 Math.min(
 maxX,
 originX + deltaX,
 ),
 );

 const targetY = Math.max(
 0,
 originY + deltaY,
 );

 const hoverX =
 originX + rawGridDX;

 const hoverY =
 originY + rawGridDY;

 const stableHoverX =
 Math.round(hoverX * 4) / 4;

 const stableHoverY =
 Math.round(hoverY * 4) / 4;

 const previousTarget =
 previewTargetRef.current;

 if (
 previousTarget &&
 previousTarget.x === targetX &&
 previousTarget.y === targetY &&
 previousTarget.hoverX ===
 stableHoverX &&
 previousTarget.hoverY ===
 stableHoverY
 ) {
 return;
 }

 previewTargetRef.current = {
 x: targetX,
 y: targetY,
 hoverX: stableHoverX,
 hoverY: stableHoverY,
 };

 const sourceCanonicalLayout =
 Array.isArray(layoutRef.current) &&
 layoutRef.current.length > 0
 ? layoutRef.current
 : layout;

 try {
 const previewCanonicalLayout =
 calculateReflowLayout(
 sourceCanonicalLayout.map(
 normalizeLayoutItem,
 ),
 widgetId,
 {
 type: 'drop',
 x: targetX,
 y: targetY,
 hoverX: stableHoverX,
 hoverY: stableHoverY,
 isPreview: true,
 },
 );

 const previewSignature =
 getLayoutPreviewSignature(
 previewCanonicalLayout,
 );

 if (
 previewLayoutSignatureRef.current !==
 previewSignature
 ) {
 previewLayoutSignatureRef.current =
 previewSignature;

 setPreviewLayout(
 previewCanonicalLayout,
 );
 }

 const previewDisplayLayout =
 isWideEditLayout
 ? buildResponsiveDashboardLayout(
 previewCanonicalLayout,
 {
 columns:
 WIDE_GRID_COLUMNS,
 maxCardWidth:
 GRID_COLUMNS,
 },
 )
 : previewCanonicalLayout;

 const previewMovingItem =
 previewDisplayLayout.find(
 (previewItem) => (
 getDashboardEditItemId(previewItem,
 ) === String(widgetId)
 ),
 );

 if (previewMovingItem) {
 setDragPlaceholder({
 ...previewMovingItem,
 widgetId: '__placeholder__',
 id: '__placeholder__',
 isPlaceholder: true,
 });
 } else {
 setDragPlaceholder(null);
 }

 lastDropTargetRef.current = {
 widgetId,
 x: targetX,
 y: targetY,
 w: originW,
 h: Math.max(
 1,
 Number(dragOrigin.h) ||
 safeH,
 ),
 hoverX: stableHoverX,
 hoverY: stableHoverY,
 };
 } catch (error) {
 console.warn(
 '[DashboardEditScreen] preview calculation failed:',
 error?.message || error,
 );
 }
 })
 .onEnd((event) => {
 if (
 dragGestureLayoutModeRef.current !==
 currentEditLayoutModeRef.current
 ) {
 return;
 }

 const insertionTarget =
 lastDropTargetRef.current;

 if (
 insertionTarget &&
 insertionTarget.widgetId ===
 widgetId &&
 insertionTarget.type ===
 'insertion'
 ) {
 setDashboardLayoutImmediate(
 (current) =>
 reorderDashboardCardsByInsertion(
 current,
 widgetId,
 insertionTarget.insertionIndex,
 {
 columns: GRID_COLUMNS,
 maxCardWidth: GRID_COLUMNS,
 },
 ),
 );

 dragInsertionIndexRef.current =
 null;
 dragInsertionPreviewInputRef.current =
 '';
 dragWideHalfRef.current = null;
 previewTargetRef.current =
 null;

 if (
 activeResizeWidgetId === widgetId
 ) {
 setActiveResizeWidgetId(null);
 setResizeGhostFrame(null);
 setPreviewLayout(null);
 }

 scheduleDragVisualCleanup();
 return;
 }

 const canonicalSlotWidth =
 gridWidth > 0
 ? gridWidth / GRID_COLUMNS
 : 0;

 const rawGridDX =
 canonicalSlotWidth
 ? event.translationX /
 canonicalSlotWidth
 : 0;

 const scrollDelta =
 scrollYRef.current -
 dragStartScrollYRef.current;

 const rawGridDY =
 (
 event.translationY +
 scrollDelta
 ) /
 (
 GRID_ROW_HEIGHT +
 rowGap
 );

 const deltaX =
 canonicalSlotWidth
 ? getStableGridDelta(
 rawGridDX,
 )
 : 0;

 const deltaY =
 getStableGridDelta(
 rawGridDY,
 );

 const lastTarget =
 lastDropTargetRef.current;

 if (
 lastTarget &&
 lastTarget.widgetId === widgetId
 ) {
 const dropX =
 safeW >= GRID_COLUMNS
 ? 0
 : lastTarget.x;

 moveGraph(
 widgetId,
 {
 type: 'drop',
 x: dropX,
 y: lastTarget.y,
 hoverX:
 lastTarget.hoverX,
 hoverY:
 lastTarget.hoverY,
 },
 );
 } else if (
 deltaX !== 0 ||
 deltaY !== 0
 ) {
 const dragOrigin =
 dragOriginRef.current || {
 x: 0,
 y: 0,
 w: safeW,
 h: safeH,
 };

 const originW = Math.max(
 1,
 Math.min(
 GRID_COLUMNS,
 Number(dragOrigin.w) ||
 safeW,
 ),
 );

 const originX = Math.max(
 0,
 Number(dragOrigin.x) || 0,
 );

 const originY = Math.max(
 0,
 Number(dragOrigin.y) || 0,
 );

 const maxX = Math.max(
 0,
 GRID_COLUMNS - originW,
 );

 const targetX =
 originW >= GRID_COLUMNS
 ? 0
 : Math.max(
 0,
 Math.min(
 maxX,
 originX + deltaX,
 ),
 );

 const targetY = Math.max(
 0,
 originY + deltaY,
 );

 moveGraph(
 widgetId,
 {
 type: 'drop',
 x:
 safeW >= GRID_COLUMNS
 ? 0
 : targetX,
 y: targetY,
 hoverX:
 Math.round(
 (
 originX +
 rawGridDX
 ) * 4,
 ) / 4,
 hoverY:
 Math.round(
 (
 originY +
 rawGridDY
 ) * 4,
 ) / 4,
 },
 );
 }

 if (
 activeResizeWidgetId === widgetId
 ) {
 setActiveResizeWidgetId(null);
 setResizeGhostFrame(null);
 setPreviewLayout(null);
 }

 scheduleDragVisualCleanup();
 })
 .onFinalize(() => {
     const isCurrentLayoutMode =
      dragGestureLayoutModeRef.current ===
      currentEditLayoutModeRef.current;

     dragGestureLayoutModeRef.current = null;
     dragInsertionIndexRef.current = null;
     dragInsertionPreviewInputRef.current = '';
     dragWideHalfRef.current = null;

     if (!isCurrentLayoutMode) {
      return;
     }

     scheduleDragVisualCleanup();
   })
   : null;

const activateCardResizeMode = () => {
 if (
 currentEditLayoutModeRef.current !==
 editLayoutMode
 ) {
 return;
 }

 if (
 activeResizeWidgetId ||
 resizeDraggingWidgetId ||
 gestureDraggingWidgetId
 ) {
 return;
 }

 setActiveResizeWidgetId(widgetId);
};

const tapResizeGesture = !activeResizeWidgetId
 ? Gesture.Tap()
 .runOnJS(true)
 .onEnd(activateCardResizeMode)
 : null;

const completeStationaryLongPress = () => {
 if (
 currentEditLayoutModeRef.current !==
 editLayoutMode ||
 activeResizeWidgetId ||
 resizeDraggingWidgetId ||
 longPressMovedWidgetIdRef.current === widgetId
 ) {
 return false;
 }

 longPressCompletingWidgetIdRef.current = widgetId;
 setActiveResizeWidgetId(widgetId);
 return true;
};

const longPressResizeGesture = !activeResizeWidgetId
 ? Gesture.LongPress()
 .minDuration(300)
 .runOnJS(true)
 .onStart(() => {
 longPressMovedWidgetIdRef.current = null;
 longPressVisualOpacity.setValue(1);
 })
 .onEnd((_event, success) => {
 if (success) {
 completeStationaryLongPress();
 }
 })
 .onFinalize(() => {
 if (
 longPressCompletingWidgetIdRef.current === widgetId
 ) {
 return;
 }

 longPressVisualOpacity.setValue(0);
 })
 : null;

const dismissResizeGesture = activeResizeWidgetId
 ? Gesture.Tap()
 .runOnJS(true)
 .onEnd((_event, success) => {
 if (success) {
 exitResizeMode();
 }
 })
 : null;

const cardGesture = activeResizeWidgetId
 ? (
 isResizeActive
 ? Gesture.Exclusive(
 testGesture,
 dismissResizeGesture,
 )
 : dismissResizeGesture
 )
 : Gesture.Exclusive(
 Gesture.Simultaneous(
 testGesture,
 longPressResizeGesture,
 ),
 tapResizeGesture,
 );

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

const temporaryLongPressResizeOverlay = !activeResizeWidgetId ? (
 <Animated.View
 pointerEvents="none"
 style={[
 styles.resizeActiveOverlay,
 { opacity: longPressVisualOpacity },
 ]}
 >
 {renderResizeCornerDiagonalSvg({
 width: resizeFrameWidth,
 height: cardHeight,
 edgeOffset: RESIZE_CORNER_OUTSET,
 showDiagonal: false,
 showGrid: true,
 gridColumns: safeW,
 gridRows: safeH,
 })}
 </Animated.View>
) : null;

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
 style={[buttonStyles.smallOutline.container, styles.removeBtnBottomRight]}
 onPress={() => removeGraph(widgetId)}
 activeOpacity={0.82}
 >
 <Text style={[buttonStyles.smallOutline.label, styles.removeText]}>삭제</Text>
 </TouchableOpacity>
 ) : null;

 const cardContent = (
 <View
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
 resizeOverlay: (
 <>
 {temporaryLongPressResizeOverlay}
 {resizeCornerOverlay}
 </>
 ),
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
     <GestureDetector
       key={widgetId}
       gesture={cardGesture}
     >
       {cardContent}
     </GestureDetector>
   );
 };
  const renderDragOverlay = () => {
   if (
 !dragOverlayItem ||
 !gestureDraggingWidgetId
 ) return null;
   const o = dragOverlayItem;
   const gy = gestureDragOffset.y;
   const gx = gestureDragOffset.x;
   const slotW = gridWidth > 0
 ? gridWidth / displayGridColumns
 : 0;
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
   const overlayInnerWidth = Math.max(
     0,
     overlayCornerWidth - RESIZE_FRAME_INSET * 2,
   );
   const dragMoveCornerOverlay = overlayCornerWidth > 0 ? (
     <View
       pointerEvents="none"
       style={{
         position: 'absolute',
         left: RESIZE_FRAME_INSET,
         top: RESIZE_FRAME_INSET,
         width: overlayInnerWidth,
         height: overlayInnerHeight,
       }}
     >
       {renderResizeCornerDiagonalSvg({
         width: overlayInnerWidth,
         height: overlayInnerHeight,
         edgeOffset: RESIZE_CORNER_OUTSET,
         showDiagonal: false,
         showGrid: true,
         gridColumns: o.safeW,
         gridRows: o.safeH,
       })}
     </View>
   ) : null;

   return (
     <Animated.View
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
     </Animated.View>
   );
 };

 const renderDragPlaceholderOverlay = () => {
   if (
 !dragPlaceholder ||
 !gridWidth
 ) return null;
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
 if (
 !resizeGhostFrame ||
 !gridWidth ||
 !resizeDraggingWidgetId
 ) return null;

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
 if (
 !activeResizeWidgetId ||
 resizeDraggingWidgetId ||
 gestureDraggingWidgetId ||
 !gridWidth
 ) return null;

 const sourceItems = Array.isArray(displayLayout) ? displayLayout : [];
 const activeItem = sourceItems.find((item) => {
 const itemId = item?.widgetId || item?.id;
 return itemId === activeResizeWidgetId;
 });

 if (!activeItem) return null;

 const activeFrame = getResizeGridItemFrame(
 activeItem,
 gridWidth,
 rowGap,
 displayGridColumns,
 );
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
 if (
 !activeResizeWidgetId ||
 gestureDraggingWidgetId ||
 !gridWidth
 ) return null;

 const sourceItems = Array.isArray(displayLayout) ? displayLayout : [];
 const activeItem = sourceItems.find((item) => {
 const itemId = item?.widgetId || item?.id;
 return itemId === activeResizeWidgetId;
 });

 if (!activeItem) return null;

 const baseFrame = getResizeGridItemFrame(
 activeItem,
 gridWidth,
 rowGap,
 displayGridColumns,
 );
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
 <SafeAreaView style={[canonicalSurfaceStyles.screen, styles.safe]} edges={['top', 'left', 'right']}>
 <View style={[canonicalLayoutStyles.rowBetween, styles.header]}>
 <TouchableOpacity style={[buttonStyles.icon, styles.backBtn]} onPress={() => returnToEntryList('cancel')}>
 <Text style={styles.backText}>‹</Text>
 </TouchableOpacity>
 <Text style={[canonicalTextStyles.headerTitle, styles.screenTitle]}>대시보드 수정</Text>
 <View style={styles.headerSpacer} />
 </View>


 <ScrollView
 ref={scrollRef}
 scrollEnabled={!resizeDraggingWidgetId && !gestureDraggingWidgetId}
 onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
 scrollEventThrottle={16}
 contentContainerStyle={[canonicalLayoutStyles.screenContent, styles.content, { paddingBottom: 112 + insets.bottom }]}
>
 <View style={[canonicalLayoutStyles.rowBetween, styles.contentHeader]}>
 <Text style={[canonicalTextStyles.bodyStrongMuted, styles.challengeTitle]} numberOfLines={1}>{title}</Text>
 <View style={[canonicalLayoutStyles.row, styles.headerActions]}>
 <View style={[canonicalControlStyles.optionRow, styles.rowGapControl]}>
 <Text style={[canonicalTextStyles.metaStrong, styles.rowGapLabel]}>간격 {rowGap}px</Text>
 <View style={[canonicalLayoutStyles.row, styles.rowGapButtons]}>
 <TouchableOpacity
 style={[buttonStyles.icon,
  styles.rowGapButton, !canDecreaseRowGap && styles.rowGapButtonDisabled]}
 onPress={decreaseRowGap}
 disabled={!canDecreaseRowGap}
 activeOpacity={0.8}
 >
 <Text style={[canonicalTextStyles.bodyStrong,
  styles.rowGapButtonText, !canDecreaseRowGap && styles.rowGapButtonTextDisabled]}>-</Text>
 </TouchableOpacity>
 <TouchableOpacity
 style={[
 buttonStyles.icon,
  styles.rowGapButton,
 styles.rowGapButtonWithDivider,
 !canIncreaseRowGap && styles.rowGapButtonDisabled,
 ]}
 onPress={increaseRowGap}
 disabled={!canIncreaseRowGap}
 activeOpacity={0.8}
 >
 <Text style={[canonicalTextStyles.bodyStrong,
  styles.rowGapButtonText, !canIncreaseRowGap && styles.rowGapButtonTextDisabled]}>+</Text>
 </TouchableOpacity>
 </View>
 </View>
 <TouchableOpacity style={[buttonStyles.headerRight.container, styles.addBtn]} onPress={() => setPickerVisible(true)}>
 <Text style={[canonicalTextStyles.bodySmallStrong, styles.addText]}>카드추가</Text>
 </TouchableOpacity>
 </View>
 </View>

 {loading ? (
 <Text style={[canonicalTextStyles.bodyMuted, canonicalTextStyles.center, styles.emptyText]}>불러오는 중...</Text>
 ) : (
 <View
 key={
 isWideEditLayout
 ? 'dashboard-edit-grid-wide'
 : 'dashboard-edit-grid-narrow'
 }
 style={[
 styles.grid,
 {
 overflow: 'visible',
 minHeight: gridBoardHeight,
 },
 ]}
 onLayout={(event) => {
 const nextGridWidth =
 event.nativeEvent.layout.width;

 setGridWidth(
 nextGridWidth,
 );

 setEditFrameWidth(
 nextGridWidth,
 );
 }}
 >
 {renderDragPlaceholderOverlay()}
 {renderResizeDismissOverlay()}
 {(Array.isArray(displayLayout) ? displayLayout : []).map((item, index) => renderAbsoluteGraphCard(item, index))}
 {renderResizeGhostFrameOverlay()}
 {renderResizeGuideOverlay()}
 </View>
 )}
 </ScrollView>

 <View style={[canonicalLayoutStyles.fixedBottomBar, canonicalLayoutStyles.row, styles.footer, { paddingBottom: Math.max(18, insets.bottom + 12) }]}>
 <TouchableOpacity style={[buttonStyles.secondary.container, styles.footerButton, styles.cancelButton]} onPress={() => returnToEntryList('cancel')}>
 <Text style={[buttonStyles.secondary.label, styles.cancelButtonText]}>취소</Text>
 </TouchableOpacity>
 <TouchableOpacity style={[buttonStyles.primary.container, styles.footerButton, styles.saveButton]} onPress={saveLayout}>
 <Text style={[buttonStyles.primary.label, styles.saveButtonText]}>저장</Text>
 </TouchableOpacity>
 </View>

 <Modal
 visible={pickerVisible}
 transparent
 animationType="fade"
 onRequestClose={() => setPickerVisible(false)}
 >
 <View style={[canonicalModalStyles.backdrop, styles.modalOverlay]}>
 <View style={[canonicalModalStyles.sheetBorderless, styles.modalSheet]}>
 <View style={[canonicalLayoutStyles.row, styles.modalHeader]}>
 <Text style={[canonicalTextStyles.headerTitle, styles.modalTitle]}>카드 추가</Text>
 <TouchableOpacity style={[buttonStyles.icon, styles.modalCloseBtn]} onPress={() => setPickerVisible(false)}>
 <Text style={[canonicalTextStyles.title, styles.modalCloseText]}>×</Text>
 </TouchableOpacity>
 </View>

 {pickerWidgets.length === 0 ? (
 <Text style={[canonicalTextStyles.bodyMuted, canonicalTextStyles.center, styles.emptyText]}>추가할 수 있는 카드이 없습니다.</Text>
 ) : (
 <ScrollView style={styles.pickerList}>
 {pickerWidgets.map((widget) => {
 const widgetId = widget.id || widget.widgetId;
 return (
 <TouchableOpacity
 key={widgetId}
 style={[canonicalControlStyles.optionRow, styles.pickerItem]}
 onPress={() => addGraph(widget)}
 >
 <Text style={[canonicalTextStyles.bodyStrong, styles.pickerTitle]}>{widget.title || widget.name || widgetId}</Text>
 <Text style={[canonicalTextStyles.metaTertiary, styles.pickerMeta]}>{widget.description || widgetId}</Text>
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
 backgroundColor: color.surface,
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
 borderBottomColor: color.border,
 },
 backBtn: {
 width: 38,
 height: 38,
 borderWidth: 0,
 borderRadius: 0,
 backgroundColor: 'transparent',
 alignItems: 'center',
 justifyContent: 'center',
 zIndex: 2,
 },
 backText: {
 fontSize: 36,
 color: color.textPrimary,
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
 fontWeight: font.weight.heavy,
 color: color.textPrimary,
 zIndex: 1,
 },
 challengeTitle: {
 flex: 1,
 marginRight: space.sm,
 fontSize: 14,
 fontWeight: font.weight.bold,
 color: color.textSecondary,
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
 gap: space.xs,
 },
 rowGapControl: {
 height: 34,
 paddingVertical: 0,
 paddingHorizontal: 0,
 flexDirection: 'row',
 alignItems: 'center',
 borderRadius: radius.sm,
 borderWidth: 1,
 borderColor: primitive.slate[300],
 backgroundColor: color.surface,
 overflow: 'hidden',
 },
 rowGapLabel: {
 paddingHorizontal: space.xs,
 fontSize: 12,
 fontWeight: font.weight.heavy,
 color: color.textPrimary,
 },
 rowGapButtons: {
 flexDirection: 'row',
 height: '100%',
 borderLeftWidth: 1,
 borderLeftColor: color.border,
 },
 rowGapButton: {
 width: 30,
 height: '100%',
 borderWidth: 0,
 borderRadius: 0,
 alignItems: 'center',
 justifyContent: 'center',
 backgroundColor: color.surface,
 },
 rowGapButtonWithDivider: {
 borderLeftWidth: 1,
 borderLeftColor: color.border,
 },
 rowGapButtonDisabled: {
 backgroundColor: color.surfaceMuted,
 },
 rowGapButtonText: {
 fontSize: 16,
 fontWeight: '900',
 color: color.textPrimary,
 lineHeight: 18,
 includeFontPadding: false,
 },
 rowGapButtonTextDisabled: {
 color: primitive.black,
 },
 addBtn: {
 height: 34,
 paddingHorizontal: space.sm,
 borderRadius: radius.sm,
 borderWidth: 1,
 borderColor: color.borderStrong,
 backgroundColor: color.surface,
 alignItems: 'center',
 justifyContent: 'center',
 },
 addText: {
 color: color.textPrimary,
 fontSize: 13,
 fontWeight: font.weight.heavy,
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
 padding: space.sm,
 },
graphCardCompact: {
 paddingTop: 4,
 paddingBottom: 2,
 paddingHorizontal: space.xs,
 overflow: 'hidden',
 },
graphCardVisualSurface: {
 ...StyleSheet.absoluteFillObject,
 borderRadius: radius.sm,
 borderWidth: 1,
 borderColor: color.border,
 borderTopWidth: 3,
 borderTopColor: color.primary,
 backgroundColor: color.surface,
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
 columnGap: space.xs,
 },
 graphHeaderCompact: {
 minHeight: 18,
 marginBottom: 0,
 },

 graphTitleGroup: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: space.xs,
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
 fontWeight: font.weight.heavy,
 color: color.textPrimary,
 includeFontPadding: false,
 },
 graphSizeBadge: {
 minWidth: 38,
 height: 22,
 paddingVertical: 0,
 paddingHorizontal: 7,
 borderRadius: radius.pill,
 backgroundColor: color.surfaceMuted,
 borderWidth: 1,
 borderColor: color.border,
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
 color: color.textPrimary,
 includeFontPadding: false,
 },
 graphSizeBadgeTextCompact: {
 fontSize: 9,
 lineHeight: 10,
 },
 removeBtnBottomRight: {
 position: 'absolute',
 right: space.sm,
 bottom: space.sm,
 minWidth: 42,
 height: 26,
 minHeight: 26,
 paddingVertical: 0,
 paddingHorizontal: 9,
 borderRadius: radius.pill,
 borderWidth: 1,
 borderColor: color.border,
 alignItems: 'center',
 justifyContent: 'center',
 backgroundColor: color.surface,
 zIndex: 12,
 elevation: 4,
 },
 removeText: {
 fontSize: 11,
 fontWeight: font.weight.heavy,
 color: color.textSecondary,
 lineHeight: 13,
 includeFontPadding: false,
 },
 graphCardResizeActive: {
 borderColor: color.borderStrong,
 shadowColor: primitive.black,
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
 borderColor: color.border,
 backgroundColor: color.surface,
 alignItems: 'center',
 justifyContent: 'center',
},
resizeHandleActive: {
 backgroundColor: color.surface,
 borderColor: color.border,
},
resizeHandleCornerTopRight: {
 position: 'absolute',
 top: 7,
 right: 7,
 width: 8,
 height: 8,
 borderTopWidth: 2,
 borderRightWidth: 2,
 borderColor: color.borderStrong,
},
resizeHandleCornerBottomLeft: {
 position: 'absolute',
 bottom: 7,
 left: 7,
 width: 8,
 height: 8,
 borderBottomWidth: 2,
 borderLeftWidth: 2,
 borderColor: color.borderStrong,
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
 borderColor: color.borderStrong,
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
 borderColor: color.borderStrong,
},
 emptyText: {
 paddingVertical: space.xl,
 textAlign: 'center',
 fontSize: 14,
 color: color.textTertiary,
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
 borderTopColor: color.border,
 backgroundColor: color.surface,
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
 borderColor: color.border,
 backgroundColor: color.surface,
 },
 saveButton: {
 borderWidth: 0,
 backgroundColor: color.primary,
 },
 cancelButtonText: {
 fontSize: 15,
 fontWeight: font.weight.heavy,
 color: color.textPrimary,
 },
 saveButtonText: {
 fontSize: 15,
 fontWeight: font.weight.heavy,
 color: color.textInverse,
 },
 modalOverlay: {
 flex: 1,
 padding: 20,
 backgroundColor: color.overlay,
 alignItems: 'center',
 justifyContent: 'center',
 },
 modalSheet: {
 width: '100%',
 maxHeight: '75%',
 borderRadius: radius.md,
 backgroundColor: color.surface,
 padding: space.md,
 },
 modalHeader: {
 flexDirection: 'row',
 alignItems: 'center',
 marginBottom: space.sm,
 },
 modalTitle: {
 flex: 1,
 textAlign: 'left',
 fontSize: 18,
 fontWeight: font.weight.heavy,color: color.textPrimary,
 },
 modalCloseBtn: {
 width: 32,
 height: 32,
 borderWidth: 0,
 borderRadius: radius.lg,
 alignItems: 'center',
 justifyContent: 'center',
 backgroundColor: color.surfaceMuted,
 },
 modalCloseText: {
 fontSize: 20,
 fontWeight: font.weight.heavy,
 color: color.textSecondary,
 lineHeight: 24,
 },
 pickerList: {
 maxHeight: 420,
 },
 pickerItem: {
 paddingVertical: 13,
 paddingHorizontal: 0,
 borderWidth: 0,
 borderRadius: 0,
 backgroundColor: 'transparent',
 borderBottomWidth: StyleSheet.hairlineWidth,
 borderBottomColor: color.border,
 },
 pickerTitle: {
 fontSize: 15,
 fontWeight: font.weight.heavy,
 color: color.textPrimary,
 },
 pickerMeta: {
 marginTop: space.xxs,
 fontSize: 12,
 color: color.textTertiary,
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
 borderColor: color.textTertiary,
 borderRadius: radius.md,
 backgroundColor: color.surfaceMuted,
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
 borderColor: primitive.neutral[400],
 borderRadius: radius.md,
 backgroundColor: 'transparent',
 overflow: 'visible',
 pointerEvents: 'none',
},
resizeGhostCorner: {
 position: 'absolute',
 width: RESIZE_ACTIVE_CORNER_SIZE,
 height: RESIZE_ACTIVE_CORNER_SIZE,
 borderColor: color.borderStrong,
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
 borderColor: color.borderStrong,
},
});
