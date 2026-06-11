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

const VIEW_BOX = 120;
const DEFAULT_SIZE = 150;

const FAMILY = {
  PIE: 'pie',
  LINE: 'line',
  BAR: 'bar',
  DISTRIBUTION: 'distribution',
  NETWORK: 'network',
};

const METRIC_LABELS = {
  count: '횟수',
  minute: '분',
  duration: 'D',
  date: 'D',
  score: '점',
  percent: '%',
  relation: '관계',
  countMinute: '횟수/분',
  targetActual: '목표',
  prediction: '예상',
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
  return METRIC_LABELS[metricType] ?? (String(metricType ?? '').slice(0, 5) || '값');
}

function PreviewFrame({ children, muted = false }) {
  return (
    <View style={[styles.frame, muted && styles.frameMuted]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_BOX} ${VIEW_BOX}`}>
        <Defs>
          <LinearGradient id="previewSoftFill" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F9FAFB" />
            <Stop offset="1" stopColor="#EEF2F7" />
          </LinearGradient>
        </Defs>
        <Rect x="1" y="1" width="118" height="118" rx="22" fill="url(#previewSoftFill)" />
        <Rect x="1" y="1" width="118" height="118" rx="22" fill="none" stroke="#E5E7EB" strokeWidth="1.5" />
        {children}
      </Svg>
    </View>
  );
}

function MetricTag({ metricType, x = 78, y = 92 }) {
  const label = getMetricLabel(metricType);
  return (
    <G>
      <Rect x={x - 8} y={y - 13} width="34" height="18" rx="9" fill="#111827" opacity="0.92" />
      <SvgText
        x={x + 9}
        y={y}
        fontSize="7"
        fontWeight="800"
        fill="#FFFFFF"
        textAnchor="middle"
      >
        {label}
      </SvgText>
    </G>
  );
}

function LinePreview({ preview }) {
  const values = makeSeries(preview.seed, 6, 20, 85);
  const points = values.map((value, index) => ({
    x: 18 + index * 17,
    y: 92 - value * 0.72,
  }));
  const isSmooth = ['smoothLine', 'curveWithBreak', 'forecastLine'].includes(preview.variant);
  const isDual = preview.variant === 'dualLine';
  const isForecast = preview.variant === 'forecastLine';
  const thePath = isSmooth ? smoothPath(points) : pointPath(points);
  const secondPoints = points.map((point, index) => ({
    x: point.x,
    y: Math.min(92, Math.max(24, point.y + (index % 2 === 0 ? 12 : -8))),
  }));

  return (
    <PreviewFrame>
      <Line x1="16" y1="92" x2="104" y2="92" stroke="#D1D5DB" strokeWidth="2" />
      <Line x1="16" y1="24" x2="16" y2="92" stroke="#D1D5DB" strokeWidth="2" />
      <Path d={thePath} fill="none" stroke="#111827" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {isDual && (
        <Path
          d={smoothPath(secondPoints)}
          fill="none"
          stroke="#6B7280"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="5 4"
        />
      )}
      {isForecast && (
        <Path
          d={`M ${points[3].x} ${points[3].y} L ${points[4].x} ${points[4].y} L ${points[5].x} ${points[5].y}`}
          fill="none"
          stroke="#6B7280"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="4 4"
        />
      )}
      {preview.variant === 'curveWithBreak' && (
        <G>
          <Line x1="67" y1="34" x2="76" y2="47" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
          <Line x1="76" y1="34" x2="67" y2="47" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
        </G>
      )}
      {points.map((point, index) => (
        <Circle
          key={`point-${index}`}
          cx={point.x}
          cy={point.y}
          r={preview.metricType === 'count' ? 4.5 : 3.2}
          fill="#111827"
        />
      ))}
      <MetricTag metricType={preview.metricType} />
    </PreviewFrame>
  );
}

function BarPreview({ preview }) {
  const values = makeSeries(preview.seed, 5, 28, 84);
  const isStacked = preview.variant === 'stackedBars';
  const isCompare = preview.variant === 'compareBars';

  return (
    <PreviewFrame>
      <Line x1="16" y1="92" x2="104" y2="92" stroke="#D1D5DB" strokeWidth="2" />
      {values.map((value, index) => {
        const x = 20 + index * 17;
        const height = value * 0.62;
        const y = 92 - height;

        if (isCompare) {
          const secondHeight = Math.max(10, height - 13 + (index % 2) * 10);
          return (
            <G key={`bar-${index}`}>
              <Rect x={x - 3} y={y} width="6" height={height} rx="3" fill="#111827" />
              <Rect x={x + 5} y={92 - secondHeight} width="6" height={secondHeight} rx="3" fill="#9CA3AF" />
            </G>
          );
        }

        if (isStacked) {
          const topHeight = height * 0.38;
          return (
            <G key={`bar-${index}`}>
              <Rect x={x - 5} y={y} width="11" height={height} rx="5" fill="#111827" />
              <Rect x={x - 5} y={y} width="11" height={topHeight} rx="5" fill="#6B7280" />
            </G>
          );
        }

        return (
          <Rect
            key={`bar-${index}`}
            x={x - 5}
            y={y}
            width="11"
            height={height}
            rx="5"
            fill="#111827"
          />
        );
      })}
      <MetricTag metricType={preview.metricType} />
    </PreviewFrame>
  );
}

function PiePreview({ preview }) {
  const isDonut = preview.variant === 'donut';
  const isSegmented = preview.variant === 'segmentedPie';
  const slices = isSegmented
    ? [
        [0, 118, '#111827'],
        [118, 220, '#6B7280'],
        [220, 360, '#D1D5DB'],
      ]
    : [
        [0, 246, '#111827'],
        [246, 360, '#D1D5DB'],
      ];

  return (
    <PreviewFrame>
      <G>
        {slices.map(([start, end, fill], index) => (
          <Path
            key={`slice-${index}`}
            d={arcPath(60, 58, 34, start - 90, end - 90)}
            fill={fill}
            stroke="#F9FAFB"
            strokeWidth="2"
          />
        ))}
        {isDonut && <Circle cx="60" cy="58" r="16" fill="#F9FAFB" />}
      </G>
      <SvgText x="60" y={isDonut ? 62 : 64} fontSize="12" fontWeight="900" fill={isDonut ? '#111827' : '#FFFFFF'} textAnchor="middle">
        %
      </SvgText>
      <MetricTag metricType={preview.metricType} x={75} y={99} />
    </PreviewFrame>
  );
}

function DistributionPreview({ preview }) {
  const values = makeSeries(preview.seed, 13, 18, 86);
  const isHeat = preview.variant === 'heatGrid';
  const isBox = preview.variant === 'boxPlot';

  if (isHeat) {
    return (
      <PreviewFrame>
        {Array.from({ length: 20 }, (_, index) => {
          const col = index % 5;
          const row = Math.floor(index / 5);
          const opacity = 0.25 + ((index * 17 + hashSeed(preview.seed)) % 60) / 100;
          return (
            <Rect
              key={`heat-${index}`}
              x={24 + col * 14}
              y={28 + row * 14}
              width="10"
              height="10"
              rx="3"
              fill="#111827"
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
        <Line x1="20" y1="62" x2="100" y2="62" stroke="#9CA3AF" strokeWidth="2" />
        <Line x1="28" y1="54" x2="28" y2="70" stroke="#111827" strokeWidth="3" />
        <Line x1="94" y1="54" x2="94" y2="70" stroke="#111827" strokeWidth="3" />
        <Rect x="42" y="44" width="38" height="36" rx="8" fill="#111827" />
        <Line x1="61" y1="44" x2="61" y2="80" stroke="#FFFFFF" strokeWidth="2" />
        <Circle cx="96" cy="36" r="4" fill="#111827" />
        <Circle cx="25" cy="83" r="3.5" fill="#111827" />
        <MetricTag metricType={preview.metricType} />
      </PreviewFrame>
    );
  }

  return (
    <PreviewFrame>
      <Line x1="18" y1="92" x2="104" y2="92" stroke="#D1D5DB" strokeWidth="2" />
      <Line x1="18" y1="62" x2="104" y2="62" stroke="#9CA3AF" strokeWidth="2" strokeDasharray="4 4" />
      {values.map((value, index) => (
        <Circle
          key={`dot-${index}`}
          cx={20 + (index % 7) * 13}
          cy={94 - value * 0.7 + Math.floor(index / 7) * 7}
          r={3.5}
          fill="#111827"
          opacity={0.55 + (index % 3) * 0.15}
        />
      ))}
      <MetricTag metricType={preview.metricType} />
    </PreviewFrame>
  );
}

function NetworkPreview({ preview }) {
  const isCluster = preview.variant === 'clusterNetwork';
  const nodes = isCluster
    ? [
        [33, 35, 7], [58, 31, 9], [82, 42, 7],
        [40, 72, 8], [67, 76, 7], [91, 71, 6],
      ]
    : [
        [36, 38, 8], [68, 31, 9], [86, 62, 7], [47, 78, 8], [74, 85, 6],
      ];

  const links = isCluster
    ? [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [2, 5], [0, 3]]
    : [[0, 1], [1, 2], [1, 3], [3, 4], [2, 4]];

  return (
    <PreviewFrame>
      {links.map(([from, to], index) => (
        <Line
          key={`link-${index}`}
          x1={nodes[from][0]}
          y1={nodes[from][1]}
          x2={nodes[to][0]}
          y2={nodes[to][1]}
          stroke="#9CA3AF"
          strokeWidth={isCluster ? 2.8 : 2.2}
        />
      ))}
      {nodes.map(([x, y, r], index) => (
        <Circle
          key={`node-${index}`}
          cx={x}
          cy={y}
          r={r}
          fill={index === 1 ? '#111827' : '#F9FAFB'}
          stroke="#111827"
          strokeWidth="3"
        />
      ))}
      <MetricTag metricType={preview.metricType} x={72} y={101} />
    </PreviewFrame>
  );
}

function FallbackPreview({ preview }) {
  return (
    <PreviewFrame>
      <Polygon points="28,88 48,44 68,70 92,28 102,88" fill="none" stroke="#111827" strokeWidth="5" strokeLinejoin="round" />
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
