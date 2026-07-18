// OFFICIAL_GRAPH_PREVIEW_RULE: docs/GRAPH_PREVIEW_RULE.md
// Graph preview icons must be generated from graphCatalog.preview metadata.
// Do not add manual PNG/JPG/WebP preview images for individual graphs.

// components/GraphPreviewIcon.js
// Auto-generated graph preview icon for the graph shop.
// The visual is derived from graph.preview metadata, not from hand-drawn images.

import React, { memo, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import {
 GRAPH_PREVIEW_BAR,
 GRAPH_PREVIEW_CALENDAR,
 GRAPH_PREVIEW_COLORS,
 GRAPH_PREVIEW_CUMULATIVE_BAR,
 GRAPH_PREVIEW_DEFAULT_SIZE,
 GRAPH_PREVIEW_DISTRIBUTION,
 GRAPH_PREVIEW_FALLBACK,
 GRAPH_PREVIEW_FRAME,
 GRAPH_PREVIEW_GRASS,
 GRAPH_PREVIEW_HORIZONTAL_PROGRESS,
 GRAPH_PREVIEW_INFO_CARD,
 GRAPH_PREVIEW_LINE,
 GRAPH_PREVIEW_METRIC_TAG,
 GRAPH_PREVIEW_NETWORK,
 GRAPH_PREVIEW_PIE,
 GRAPH_PREVIEW_STACKED_SEGMENT,
 GRAPH_PREVIEW_VIEW_BOX,
 GRAPH_PREVIEW_WEEKLY_GOAL,
 getGraphPreviewMetricLabel,
} from '../constants/graphPreviewRules';

const VIEW_BOX = GRAPH_PREVIEW_VIEW_BOX;
const DEFAULT_SIZE = GRAPH_PREVIEW_DEFAULT_SIZE;

const FAMILY = {
  PIE: 'pie',
  LINE: 'line',
  BAR: 'bar',
  DISTRIBUTION: 'distribution',
  NETWORK: 'network',
  CALENDAR: 'calendar',
  INFO_CARD: 'infoCard',
  PROGRESS: 'progress',
  GRASS: 'grass',
};


function hashSeed(seed) {
  const raw = String(seed ?? 'graph');
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) % 9973;
  }
  return hash || 1;
}

function makeSeries(seed, length = 6, min = 20, max = 88) {
  const base = hashSeed(seed);
  const range = Math.max(1, max - min);
  return Array.from({ length }, (_, index) => {
    const n = (base * (index + 3) + index * index * 17 + 23) % range;
    return min + n;
  });
}

function pointPath(points) {
  if (!points.length) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}

function smoothPath(points) {
  if (points.length < 2) return pointPath(points);
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const current = points[i];
    const midX = (prev.x + current.x) / 2;
    d += ` Q ${midX} ${prev.y}, ${current.x} ${current.y}`;
  }
  return d;
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const angleRad = (Math.PI / 180) * angleDeg;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
    'Z',
  ].join(' ');
}

function normalizePreview(preview) {
  return {
    family: preview?.family || FAMILY.LINE,
    variant: preview?.variant || 'basic',
    metricType: preview?.metricType || 'count',
    seed: preview?.seed ?? `${preview?.variant ?? ''}-preview`,
    features: Array.isArray(preview?.features) ? preview.features : [],
  };
}

function getMetricLabel(metricType) {
  return getGraphPreviewMetricLabel(metricType);
}

function PreviewFrame({ children, muted = false }) {
 const frame = GRAPH_PREVIEW_FRAME;
 const colors = GRAPH_PREVIEW_COLORS;

 return (
 <View style={[styles.frame, muted && styles.frameMuted]}>
 <Svg width="100%" height="100%" viewBox={`0 0 ${frame.viewBox} ${frame.viewBox}`}>
 <Defs>
 <LinearGradient id="previewSoftFill" x1="0" y1="0" x2="1" y2="1">
 <Stop offset="0" stopColor={frame.gradientStartColor || colors.backgroundStart} />
 <Stop offset="1" stopColor={frame.gradientEndColor || colors.backgroundEnd} />
 </LinearGradient>
 </Defs>
 <Rect
 x={frame.inset}
 y={frame.inset}
 width={frame.width}
 height={frame.height}
 rx={frame.radius}
 fill="url(#previewSoftFill)"
 />
 <Rect
 x={frame.inset}
 y={frame.inset}
 width={frame.width}
 height={frame.height}
 rx={frame.radius}
 fill="none"
 stroke={frame.borderColor || colors.border}
 strokeWidth={frame.borderWidth}
 />
 {children}
 </Svg>
 </View>
 );
}

function MetricTag({
 metricType,
 x = GRAPH_PREVIEW_METRIC_TAG.defaultX,
 y = GRAPH_PREVIEW_METRIC_TAG.defaultY,
}) {
 const label = getMetricLabel(metricType);
 const tag = GRAPH_PREVIEW_METRIC_TAG;
 const colors = GRAPH_PREVIEW_COLORS;

 if (tag.enabled === false) return null;

 return (
 <G>
 <Rect
 x={x + tag.xOffset}
 y={y + tag.yOffset}
 width={tag.width}
 height={tag.height}
 rx={tag.radius}
 fill={tag.fillColor || colors.primary}
 opacity={tag.opacity}
 />
 <SvgText
 x={x + tag.textOffsetX}
 y={y}
 fontSize={tag.fontSize}
 fontWeight={tag.fontWeight}
 fill={tag.textColor || colors.white}
 textAnchor="middle"
 >
 {label}
 </SvgText>
 </G>
 );
}

function LinePreview({ preview }) {
 const lineRule = GRAPH_PREVIEW_LINE;
 const colors = GRAPH_PREVIEW_COLORS;
 const values = makeSeries(
 preview.seed,
 lineRule.pointCount,
 lineRule.minValue,
 lineRule.maxValue,
 );
 const points = values.map((value, index) => ({
 x: lineRule.startX + index * lineRule.stepX,
 y: lineRule.baselineY - value * lineRule.yScale,
 }));
 const isSmooth = ['smoothLine', 'curveWithBreak', 'forecastLine'].includes(preview.variant);
 const isDual = preview.variant === 'dualLine';
 const isForecast = preview.variant === 'forecastLine';
 const thePath = isSmooth ? smoothPath(points) : pointPath(points);
 const secondPoints = points.map((point, index) => ({
 x: point.x,
 y: Math.min(
 lineRule.baselineY,
 Math.max(
 lineRule.axisTopY,
 point.y + (index % 2 === 0 ? lineRule.secondLineEvenOffset : lineRule.secondLineOddOffset),
 ),
 ),
 }));

 return (
 <PreviewFrame>
 <Line
 x1={lineRule.axisStartX}
 y1={lineRule.baselineY}
 x2={lineRule.axisEndX}
 y2={lineRule.baselineY}
 stroke={colors.axis}
 strokeWidth={lineRule.axisStrokeWidth}
 />
 <Line
 x1={lineRule.axisStartX}
 y1={lineRule.axisTopY}
 x2={lineRule.axisStartX}
 y2={lineRule.baselineY}
 stroke={colors.axis}
 strokeWidth={lineRule.axisStrokeWidth}
 />
 <Path
 d={thePath}
 fill="none"
 stroke={colors.primary}
 strokeWidth={lineRule.strokeWidth}
 strokeLinecap="round"
 strokeLinejoin="round"
 />
 {isDual && (
 <Path
 d={smoothPath(secondPoints)}
 fill="none"
 stroke={colors.secondary}
 strokeWidth={lineRule.secondaryStrokeWidth}
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeDasharray={lineRule.dualDasharray}
 />
 )}
 {isForecast && (
 <Path
 d={`M ${points[3].x} ${points[3].y} L ${points[4].x} ${points[4].y} L ${points[5].x} ${points[5].y}`}
 fill="none"
 stroke={colors.secondary}
 strokeWidth={lineRule.secondaryStrokeWidth}
 strokeLinecap="round"
 strokeDasharray={lineRule.forecastDasharray}
 />
 )}
 {preview.variant === 'curveWithBreak' && (
 <G>
 <Line x1="67" y1="34" x2="76" y2="47" stroke={colors.primary} strokeWidth="3" strokeLinecap="round" />
 <Line x1="76" y1="34" x2="67" y2="47" stroke={colors.primary} strokeWidth="3" strokeLinecap="round" />
 </G>
 )}
 {points.map((point, index) => (
 <Circle
 key={`point-${index}`}
 cx={point.x}
 cy={point.y}
 r={preview.metricType === 'count' ? lineRule.countDotRadius : lineRule.dotRadius}
 fill={colors.primary}
 />
 ))}
 <MetricTag metricType={preview.metricType} />
 </PreviewFrame>
 );
}

function WeeklyGoalBarPreview({ preview }) {
 const barRule = GRAPH_PREVIEW_BAR;
 const goalRule = GRAPH_PREVIEW_WEEKLY_GOAL;
 const colors = GRAPH_PREVIEW_COLORS;
 const values = makeSeries(
 preview.seed,
 barRule.barCount,
 barRule.minValue,
 barRule.maxValue,
 );

 return (
 <PreviewFrame>
 <Line
 x1={barRule.axisStartX}
 y1={barRule.baselineY}
 x2={barRule.axisEndX}
 y2={barRule.baselineY}
 stroke={colors.axis}
 strokeWidth={barRule.axisStrokeWidth}
 />
 {values.map((value, index) => {
 const x = barRule.startX + index * barRule.stepX;
 const height = value * barRule.yScale;
 const y = barRule.baselineY - height;

 return (
 <Rect
 key={`weekly-goal-${index}`}
 x={x + barRule.barXOffset}
 y={y}
 width={barRule.barWidth}
 height={height}
 rx={barRule.radius}
 fill={colors.primary}
 />
 );
 })}
 <Line
 x1={barRule.axisStartX}
 y1={goalRule.goalLineY}
 x2={barRule.axisEndX}
 y2={goalRule.goalLineY}
 stroke={colors.tertiary}
 strokeWidth={goalRule.goalLineStrokeWidth}
 strokeDasharray={goalRule.goalLineDasharray}
 />
 <SvgText
 x={goalRule.goalLabelX}
 y={goalRule.goalLabelY}
 fontSize={goalRule.goalLabelFontSize}
 fontWeight={goalRule.goalLabelFontWeight}
 fill={colors.secondary}
 textAnchor="end"
 >
 {goalRule.goalLabel}</SvgText>
 <MetricTag metricType={preview.metricType} />
 </PreviewFrame>
 );
}

function CumulativeBarPreview({ preview }) {
 const barRule = GRAPH_PREVIEW_BAR;
 const cumulativeRule = GRAPH_PREVIEW_CUMULATIVE_BAR;
 const colors = GRAPH_PREVIEW_COLORS;

 return (
 <PreviewFrame>
 <Line
 x1={barRule.axisStartX}
 y1={barRule.baselineY}
 x2={barRule.axisEndX}
 y2={barRule.baselineY}
 stroke={colors.axis}
 strokeWidth={barRule.axisStrokeWidth}
 />
 {cumulativeRule.values.map((value, index) => {
 const x = barRule.startX + index * barRule.stepX;
 const height = value * barRule.yScale;
 const y = barRule.baselineY - height;
 const isLatest = index === cumulativeRule.values.length - 1;

 return (
 <Rect
 key={`cumulative-bar-${index}`}
 x={x + barRule.barXOffset}
 y={y}
 width={barRule.barWidth}
 height={height}
 rx={barRule.radius}
 fill={colors.primary}
 opacity={
 isLatest
 ? 1
 : cumulativeRule.opacityStart
 + index * cumulativeRule.opacityStep
 }
 stroke={isLatest ? colors.secondary : 'none'}
 strokeWidth={
 isLatest
 ? cumulativeRule.latestStrokeWidth
 : 0
 }
 />
 );
 })}
 <MetricTag metricType={preview.metricType} />
 </PreviewFrame>
 );
}

function StackedSegmentPreview({ preview }) {
 const rule = GRAPH_PREVIEW_STACKED_SEGMENT;
 const colors = GRAPH_PREVIEW_COLORS;

 let cursorX = rule.x;
 const segments = rule.segments.map((segment, index) => {
 const isLast = index === rule.segments.length - 1;
 const width = isLast
 ? rule.x + rule.width - cursorX
 : rule.width * segment.ratio;
 const item = {
 ...segment,
 x: cursorX,
 width,
 };
 cursorX += width;
 return item;
 });

 return (
 <PreviewFrame>
 <Rect
 x={rule.x}
 y={rule.y}
 width={rule.width}
 height={rule.height}
 rx={rule.radius}
 fill={colors.border}
 />
 {segments.map((segment, index) => (
 <Rect
 key={`stacked-segment-${index}`}
 x={segment.x}
 y={rule.y}
 width={segment.width}
 height={rule.height}
 rx={
 index === 0 || index === segments.length - 1
 ? rule.radius
 : 0
 }
 fill={colors[segment.colorKey] || colors.primary}
 />
 ))}
 {rule.segments.map((segment, index) => (
 <Circle
 key={`stacked-legend-${index}`}
 cx={rule.legendStartX + index * rule.legendStepX}
 cy={rule.legendY}
 r={rule.legendDotRadius}
 fill={colors[segment.colorKey] || colors.primary}
 />
 ))}
 <MetricTag
 metricType={preview.metricType}
 x={rule.metricTagX}
 y={rule.metricTagY}
 />
 </PreviewFrame>
 );
}

function BarPreview({ preview }) {
 if (preview.variant === 'weeklyGoal') {
 return <WeeklyGoalBarPreview preview={preview} />;
 }

 if (preview.variant === 'cumulativeBars') {
 return <CumulativeBarPreview preview={preview} />;
 }

 if (preview.variant === 'stackedSegment') {
 return <StackedSegmentPreview preview={preview} />;
 }

 const barRule = GRAPH_PREVIEW_BAR;
 const colors = GRAPH_PREVIEW_COLORS;
 const values = makeSeries(
 preview.seed,
 barRule.barCount,
 barRule.minValue,
 barRule.maxValue,
 );
 const isStacked = preview.variant === 'stackedBars';
 const isCompare = preview.variant === 'compareBars';

 return (
 <PreviewFrame>
 <Line
 x1={barRule.axisStartX}
 y1={barRule.baselineY}
 x2={barRule.axisEndX}
 y2={barRule.baselineY}
 stroke={colors.axis}
 strokeWidth={barRule.axisStrokeWidth}
 />
 {values.map((value, index) => {
 const x = barRule.startX + index * barRule.stepX;
 const height = value * barRule.yScale;
 const y = barRule.baselineY - height;

 if (isCompare) {
 const secondHeight = Math.max(
 barRule.compareSecondMinHeight,
 height + barRule.compareSecondBaseDelta + (index % 2) * barRule.compareSecondOddOffset,
 );
 return (
 <G key={`bar-${index}`}>
 <Rect
 x={x + barRule.comparePrimaryXOffset}
 y={y}
 width={barRule.compareBarWidth}
 height={height}
 rx={barRule.compareRadius}
 fill={colors.primary}
 />
 <Rect
 x={x + barRule.compareSecondaryXOffset}
 y={barRule.baselineY - secondHeight}
 width={barRule.compareBarWidth}
 height={secondHeight}
 rx={barRule.compareRadius}
 fill={colors.tertiary}
 />
 </G>
 );
 }

 if (isStacked) {
 const topHeight = height * barRule.stackedTopRatio;
 return (
 <G key={`bar-${index}`}>
 <Rect
 x={x + barRule.stackedXOffset}
 y={y}
 width={barRule.barWidth}
 height={height}
 rx={barRule.radius}
 fill={colors.primary}
 />
 <Rect
 x={x + barRule.stackedXOffset}
 y={y}
 width={barRule.barWidth}
 height={topHeight}
 rx={barRule.radius}
 fill={colors.secondary}
 />
 </G>
 );
 }

 return (
 <Rect
 key={`bar-${index}`}
 x={x + barRule.barXOffset}
 y={y}
 width={barRule.barWidth}
 height={height}
 rx={barRule.radius}
 fill={colors.primary}
 />
 );
 })}
 <MetricTag metricType={preview.metricType} />
 </PreviewFrame>
 );
}

function PiePreview({ preview }) {
 const pieRule = GRAPH_PREVIEW_PIE;
 const colors = GRAPH_PREVIEW_COLORS;
 const isDonut = preview.variant === 'donut';
 const isSegmented = preview.variant === 'segmentedPie';
 const slices = isSegmented ? pieRule.segmentedSlices : pieRule.defaultSlices;
 const sliceStrokeColor = colors[pieRule.sliceStrokeColorKey] || colors.surface;
 const labelFill = isDonut ? colors.primary : colors.white;

 return (
 <PreviewFrame>
 <G>
 {slices.map(({ start, end, colorKey }, index) => (
 <Path
 key={`slice-${index}`}
 d={arcPath(
 pieRule.centerX,
 pieRule.centerY,
 pieRule.radius,
 start + pieRule.startAngleOffset,
 end + pieRule.startAngleOffset,
 )}
 fill={colors[colorKey] || colors.primary}
 stroke={sliceStrokeColor}
 strokeWidth={pieRule.sliceStrokeWidth}
 />
 ))}
 {isDonut && (
 <Circle
 cx={pieRule.centerX}
 cy={pieRule.centerY}
 r={pieRule.donutHoleRadius}
 fill={sliceStrokeColor}
 />
 )}
 </G>
 <SvgText
 x={pieRule.centerX}
 y={isDonut ? pieRule.donutLabelY : pieRule.labelY}
 fontSize={pieRule.labelFontSize}
 fontWeight={pieRule.labelFontWeight}
 fill={labelFill}
 textAnchor="middle"
 >
 {pieRule.labelText}
 </SvgText>
 <MetricTag
 metricType={preview.metricType}
 x={pieRule.metricTagX}
 y={pieRule.metricTagY}
 />
 </PreviewFrame>
 );
}

function DistributionPreview({ preview }) {
 const distributionRule = GRAPH_PREVIEW_DISTRIBUTION;
 const colors = GRAPH_PREVIEW_COLORS;
 const values = makeSeries(
 preview.seed,
 distributionRule.dotCount,
 distributionRule.minValue,
 distributionRule.maxValue,
 );
 const isHeat = preview.variant === 'heatGrid';
 const isBox = preview.variant === 'boxPlot';

 if (isHeat) {
 return (
 <PreviewFrame>
 {Array.from({ length: distributionRule.heatCellCount }, (_, index) => {
 const col = index % distributionRule.heatCols;
 const row = Math.floor(index / distributionRule.heatCols);
 const opacity = distributionRule.heatOpacityBase
 + ((index * distributionRule.heatOpacityStep + hashSeed(preview.seed))
 % distributionRule.heatOpacityMod) / distributionRule.heatOpacityDivisor;
 return (
 <Rect
 key={`heat-${index}`}
 x={distributionRule.heatStartX + col * distributionRule.heatStepX}
 y={distributionRule.heatStartY + row * distributionRule.heatStepY}
 width={distributionRule.heatCellSize}
 height={distributionRule.heatCellSize}
 rx={distributionRule.heatRadius}
 fill={colors.primary}
 opacity={opacity}
 />
 );
 })}
 <MetricTag metricType={preview.metricType} />
 </PreviewFrame>
 );
 }

 if (isBox) {
 return (
 <PreviewFrame>
 <Line
 x1={distributionRule.boxCenterLine.x1}
 y1={distributionRule.boxCenterLine.y1}
 x2={distributionRule.boxCenterLine.x2}
 y2={distributionRule.boxCenterLine.y2}
 stroke={colors.tertiary}
 strokeWidth={distributionRule.boxLineStrokeWidth}
 />
 {distributionRule.boxWhiskers.map((whisker, index) => (
 <Line
 key={`whisker-${index}`}
 x1={whisker.x}
 y1={whisker.y1}
 x2={whisker.x}
 y2={whisker.y2}
 stroke={colors.primary}
 strokeWidth={distributionRule.boxWhiskerStrokeWidth}
 />
 ))}
 <Rect
 x={distributionRule.boxRect.x}
 y={distributionRule.boxRect.y}
 width={distributionRule.boxRect.width}
 height={distributionRule.boxRect.height}
 rx={distributionRule.boxRect.radius}
 fill={colors.primary}
 />
 <Line
 x1={distributionRule.boxMedianLine.x}
 y1={distributionRule.boxMedianLine.y1}
 x2={distributionRule.boxMedianLine.x}
 y2={distributionRule.boxMedianLine.y2}
 stroke={colors.white}
 strokeWidth={distributionRule.boxMedianStrokeWidth}
 />
 {distributionRule.boxOutliers.map((outlier, index) => (
 <Circle
 key={`outlier-${index}`}
 cx={outlier.cx}
 cy={outlier.cy}
 r={outlier.r}
 fill={colors.primary}
 />
 ))}
 <MetricTag metricType={preview.metricType} />
 </PreviewFrame>
 );
 }

 return (
 <PreviewFrame>
 <Line
 x1={distributionRule.baselineX1}
 y1={distributionRule.baselineY}
 x2={distributionRule.baselineX2}
 y2={distributionRule.baselineY}
 stroke={colors.axis}
 strokeWidth={distributionRule.baselineStrokeWidth}
 />
 <Line
 x1={distributionRule.baselineX1}
 y1={distributionRule.averageLineY}
 x2={distributionRule.baselineX2}
 y2={distributionRule.averageLineY}
 stroke={colors.tertiary}
 strokeWidth={distributionRule.averageStrokeWidth}
 strokeDasharray={distributionRule.averageDasharray}
 />
 {values.map((value, index) => (
 <Circle
 key={`dot-${index}`}
 cx={distributionRule.dotStartX + (index % distributionRule.dotColumns) * distributionRule.dotStepX}
 cy={
 distributionRule.dotBaseY
 - value * distributionRule.dotYScale
 + Math.floor(index / distributionRule.dotColumns) * distributionRule.dotRowOffset
 }
 r={distributionRule.dotRadius}
 fill={colors.primary}
 opacity={
 distributionRule.dotOpacityBase
 + (index % distributionRule.dotOpacityCycle) * distributionRule.dotOpacityStep
 }
 />
 ))}
 <MetricTag metricType={preview.metricType} />
 </PreviewFrame>
 );
}

function NetworkPreview({ preview }) {
  const networkRule = GRAPH_PREVIEW_NETWORK;
  const colors = GRAPH_PREVIEW_COLORS;
  const isCluster = preview.variant === 'clusterNetwork';
  const nodes = isCluster ? networkRule.clusterNodes : networkRule.defaultNodes;
  const links = isCluster ? networkRule.clusterLinks : networkRule.defaultLinks;

  return (
    <PreviewFrame>
      {links.map(([from, to], index) => (
        <Line
          key={`link-${index}`}
          x1={nodes[from].x}
          y1={nodes[from].y}
          x2={nodes[to].x}
          y2={nodes[to].y}
          stroke={colors[networkRule.linkColorKey]}
          strokeWidth={isCluster ? networkRule.clusterLinkWidth : networkRule.linkWidth}
        />
      ))}
      {nodes.map((node, index) => (
        <Circle
          key={`node-${index}`}
          cx={node.x}
          cy={node.y}
          r={node.r}
          fill={index === networkRule.primaryNodeIndex ? colors[networkRule.primaryNodeFillColorKey] : colors[networkRule.secondaryNodeFillColorKey]}
          stroke={colors[networkRule.nodeStrokeColorKey]}
          strokeWidth={networkRule.nodeStrokeWidth}
        />
      ))}
      <MetricTag metricType={preview.metricType} x={networkRule.metricTagX} y={networkRule.metricTagY} />
    </PreviewFrame>
  );
}

function CalendarPreview({ preview }) {
 const rule = GRAPH_PREVIEW_CALENDAR;
 const colors = GRAPH_PREVIEW_COLORS;
 const active = new Set(rule.activeIndices);
 const totalCells = rule.columns * rule.rows;

 return (
 <PreviewFrame>
 {rule.weekdays.map((weekday, index) => (
 <SvgText
 key={`weekday-${index}`}
 x={
 rule.startX
 + index * rule.stepX
 + rule.cellSize / 2
 }
 y={rule.weekdayY}
 fontSize={rule.weekdayFontSize}
 fontWeight={rule.weekdayFontWeight}
 fill={colors.tertiary}
 textAnchor="middle"
 >
 {weekday}
 </SvgText>
 ))}
 {Array.from({ length: totalCells }, (_, index) => {
 const column = index % rule.columns;
 const row = Math.floor(index / rule.columns);
 const isActive = active.has(index);
 const isToday = index === rule.todayIndex;

 return (
 <Rect
 key={`calendar-cell-${index}`}
 x={rule.startX + column * rule.stepX}
 y={rule.startY + row * rule.stepY}
 width={rule.cellSize}
 height={rule.cellSize}
 rx={rule.radius}
 fill={isActive ? colors.primary : colors.border}
 stroke={isToday ? colors.secondary : 'none'}
 strokeWidth={isToday ? rule.todayStrokeWidth : 0}
 />
 );
 })}
 <MetricTag
 metricType={preview.metricType}
 x={rule.metricTagX}
 y={rule.metricTagY}
 />
 </PreviewFrame>
 );
}

function InfoCardPreview({ preview }) {
 const rule = GRAPH_PREVIEW_INFO_CARD;
 const colors = GRAPH_PREVIEW_COLORS;

 return (
 <PreviewFrame>
 <Rect
 x={rule.x}
 y={rule.y}
 width={rule.width}
 height={rule.height}
 rx={rule.radius}
 fill={colors.surface}
 stroke={colors.primary}
 strokeWidth={rule.borderWidth}
 />
 <Rect
 x={rule.titleLine.x}
 y={rule.titleLine.y}
 width={rule.titleLine.width}
 height={rule.titleLine.height}
 rx={rule.titleLine.radius}
 fill={colors.primary}
 />
 <Rect
 x={rule.subtitleLine.x}
 y={rule.subtitleLine.y}
 width={rule.subtitleLine.width}
 height={rule.subtitleLine.height}
 rx={rule.subtitleLine.radius}
 fill={colors.tertiary}
 />
 <Line
 x1={rule.divider.x1}
 y1={rule.divider.y1}
 x2={rule.divider.x2}
 y2={rule.divider.y2}
 stroke={colors.border}
 strokeWidth={rule.divider.strokeWidth}
 />
 <Rect
 x={rule.valueBox.x}
 y={rule.valueBox.y}
 width={rule.valueBox.width}
 height={rule.valueBox.height}
 rx={rule.valueBox.radius}
 fill={colors.primary}
 />
 <SvgText
 x={rule.valueTextX}
 y={rule.valueTextY}
 fontSize={rule.valueFontSize}
 fontWeight={rule.valueFontWeight}
 fill={colors.white}
 textAnchor="middle"
 >
 {rule.valueText}
 </SvgText>
 <Rect
 x={rule.rewardLine.x}
 y={rule.rewardLine.y}
 width={rule.rewardLine.width}
 height={rule.rewardLine.height}
 rx={rule.rewardLine.radius}
 fill={colors.secondary}
 />
 <Rect
 x={rule.rewardLineShort.x}
 y={rule.rewardLineShort.y}
 width={rule.rewardLineShort.width}
 height={rule.rewardLineShort.height}
 rx={rule.rewardLineShort.radius}
 fill={colors.axis}
 />
 <MetricTag
 metricType={preview.metricType}
 x={rule.metricTagX}
 y={rule.metricTagY}
 />
 </PreviewFrame>
 );
}

function HorizontalProgressPreview({ preview }) {
 const rule = GRAPH_PREVIEW_HORIZONTAL_PROGRESS;
 const colors = GRAPH_PREVIEW_COLORS;

 return (
 <PreviewFrame>
 <SvgText
 x={rule.labelX}
 y={rule.labelY}
 fontSize={rule.labelFontSize}
 fontWeight={rule.labelFontWeight}
 fill={colors.primary}
 textAnchor="middle"
 >
 {rule.labelText}
 </SvgText>
 <Rect
 x={rule.trackX}
 y={rule.trackY}
 width={rule.trackWidth}
 height={rule.trackHeight}
 rx={rule.radius}
 fill={colors.axis}
 />
 <Rect
 x={rule.trackX}
 y={rule.trackY}
 width={rule.trackWidth * rule.fillRatio}
 height={rule.trackHeight}
 rx={rule.radius}
 fill={colors.primary}
 />
 <Rect
 x={rule.captionLineX}
 y={rule.captionY}
 width={rule.captionLineWidth}
 height={rule.captionLineHeight}
 rx={rule.captionLineRadius}
 fill={colors.tertiary}
 />
 <MetricTag
 metricType={preview.metricType}
 x={rule.metricTagX}
 y={rule.metricTagY}
 />
 </PreviewFrame>
 );
}

function GrassPreview({ preview }) {
 const rule = GRAPH_PREVIEW_GRASS;
 const colors = GRAPH_PREVIEW_COLORS;
 const base = hashSeed(preview.seed);
 const totalCells = rule.columns * rule.rows;

 return (
 <PreviewFrame>
 {Array.from({ length: totalCells }, (_, index) => {
 const column = index % rule.columns;
 const row = Math.floor(index / rule.columns);
 const level =
 (base + index * 7 + row * 3) %
 rule.levelColorKeys.length;
 const colorKey = rule.levelColorKeys[level];
 const isToday = index === rule.todayIndex;

 return (
 <Rect
 key={`grass-cell-${index}`}
 x={rule.startX + column * rule.stepX}
 y={rule.startY + row * rule.stepY}
 width={rule.cellSize}
 height={rule.cellSize}
 rx={rule.radius}
 fill={colors[colorKey] || colors.border}
 stroke={isToday ? colors.primary : 'none'}
 strokeWidth={isToday ? rule.todayStrokeWidth : 0}
 />
 );
 })}
 <MetricTag
 metricType={preview.metricType}
 x={rule.metricTagX}
 y={rule.metricTagY}
 />
 </PreviewFrame>
 );
}

function FallbackPreview({ preview }) {
  const fallbackRule = GRAPH_PREVIEW_FALLBACK;
  const colors = GRAPH_PREVIEW_COLORS;
  const strokeColor = colors[fallbackRule.strokeColorKey] || colors.primary;
  return (
    <PreviewFrame>
      <Polygon points={fallbackRule.polygonPoints} fill={fallbackRule.polygonFill} stroke={strokeColor} strokeWidth={fallbackRule.strokeWidth} strokeLinejoin={fallbackRule.strokeLinejoin} />
      <MetricTag metricType={preview.metricType} />
    </PreviewFrame>
  );
}

function GraphPreviewIcon({
  graph,
  preview,
  size = DEFAULT_SIZE,
  muted = false,
  style,
}) {
  const normalizedPreview = useMemo(
    () => normalizePreview(preview || graph?.preview),
    [graph, preview]
  );

  const content = (() => {
    switch (normalizedPreview.family) {
      case FAMILY.PIE:
        return <PiePreview preview={normalizedPreview} />;
      case FAMILY.LINE:
        return <LinePreview preview={normalizedPreview} />;
      case FAMILY.BAR:
        return <BarPreview preview={normalizedPreview} />;
      case FAMILY.DISTRIBUTION:
        return <DistributionPreview preview={normalizedPreview} />;
      case FAMILY.NETWORK:
        return <NetworkPreview preview={normalizedPreview} />;
      case FAMILY.CALENDAR:
        return <CalendarPreview preview={normalizedPreview} />;
      case FAMILY.INFO_CARD:
        return <InfoCardPreview preview={normalizedPreview} />;
      case FAMILY.PROGRESS:
        return <HorizontalProgressPreview preview={normalizedPreview} />;
      case FAMILY.GRASS:
        return <GrassPreview preview={normalizedPreview} />;
      default:
        return <FallbackPreview preview={normalizedPreview} />;
    }
  })();

  return (
    <View style={[styles.root, { width: size, height: size }, muted && styles.rootMuted, style]}>
      {React.cloneElement(content, { muted })}
    </View>
  );
}

export default memo(GraphPreviewIcon);

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rootMuted: {
    opacity: 0.55,
  },
  frame: {
    width: '100%',
    height: '100%',
  },
  frameMuted: {
    opacity: 0.6,
  },
});
