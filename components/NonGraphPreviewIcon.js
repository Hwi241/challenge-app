// components/NonGraphPreviewIcon.js
// Official metadata-driven preview renderer for non-graph dashboard widgets.
// This first implementation supports KPI previews only.

import React, { memo, useMemo } from 'react';
import {
 StyleSheet,
 Text,
 View,
} from 'react-native';

import {
 WIDGET_PREVIEW_COLORS,
 WIDGET_PREVIEW_FAMILIES,
 WIDGET_PREVIEW_SIZE_MODES,
 WIDGET_PREVIEW_VARIANTS,
 getWidgetPreviewKpiLayout,
 getWidgetPreviewSampleData,
 isValidWidgetPreviewDefinition,
 resolveWidgetPreviewSizeMode,
} from '../constants/widgetPreviewRules';

const SUPPORTED_KPI_VARIANTS = Object.freeze([
 WIDGET_PREVIEW_VARIANTS.COUNT_WITH_NOTE,
 WIDGET_PREVIEW_VARIANTS.COUNT_WITH_ICON,
 WIDGET_PREVIEW_VARIANTS.DUAL_COUNT,
]);

const normalizeLabel = (title) => {
 const value = String(title || '').trim();
 return value || '지표';
};

export const supportsNonGraphPreview = (preview) => (
 isValidWidgetPreviewDefinition(preview) &&
 preview.family === WIDGET_PREVIEW_FAMILIES.KPI &&
 SUPPORTED_KPI_VARIANTS.includes(preview.variant)
);

const KpiNoteLine = ({ layout, dark = false }) => (
 <View
 style={[
 styles.noteLine,
 {
 width: layout.noteWidth,
 height: layout.noteHeight,
 borderRadius: layout.noteHeight / 2,
 },
 dark && styles.noteLineDark,
 ]}
 />
);

const KpiValue = ({
 value,
 icon,
 layout,
 dark = false,
}) => (
 <View
 style={[
 styles.valueRow,
 { columnGap: layout.gap },
 ]}
 >
 {!!icon && (
 <Text
 style={[
 styles.icon,
 {
 fontSize: layout.iconFontSize,
 lineHeight: layout.iconLineHeight,
 },
 dark && styles.textDark,
 ]}
 >
 {icon}
 </Text>
 )}

 <Text
 style={[
 styles.value,
 {
 fontSize: layout.valueFontSize,
 lineHeight: layout.valueLineHeight,
 },
 dark && styles.textDark,
 ]}
 numberOfLines={1}
 adjustsFontSizeToFit
 minimumFontScale={0.65}
 >
 {value}
 </Text>
 </View>
);

const CountKpiPreview = ({
 label,
 preview,
 layout,
 sizeMode,
 sample,
}) => {
 const isTiny = sizeMode === WIDGET_PREVIEW_SIZE_MODES.TINY;
 const withIcon =
 preview.variant === WIDGET_PREVIEW_VARIANTS.COUNT_WITH_ICON;
 const icon = withIcon ? '★' : '';

 return (
 <View
 style={[
 styles.card,
 {
 maxWidth: layout.maxWidth,
 height: layout.height,
 borderRadius: layout.radius,
 paddingHorizontal: layout.paddingHorizontal,
 paddingVertical: layout.paddingVertical,
 },
 isTiny && styles.cardTiny,
 ]}
 >
 <Text
 style={[
 styles.label,
 {
 fontSize: layout.labelFontSize,
 lineHeight: layout.labelLineHeight,
 },
 ]}
 numberOfLines={1}
 adjustsFontSizeToFit
 minimumFontScale={0.72}
 >
 {label}
 </Text>

 <KpiValue
 value={sample.value}
 icon={icon}
 layout={layout}
 />

 {!isTiny && (
 <KpiNoteLine layout={layout} />
 )}
 </View>
 );
};

const DualCountKpiPreview = ({
 label,
 layout,
 sizeMode,
 sample,
}) => {
 const isTiny = sizeMode === WIDGET_PREVIEW_SIZE_MODES.TINY;

 return (
 <View
 style={[
 styles.card,
 styles.cardDark,
 {
 maxWidth: layout.maxWidth,
 height: layout.height,
 borderRadius: layout.radius,
 paddingHorizontal: layout.paddingHorizontal,
 paddingVertical: layout.paddingVertical,
 },
 isTiny && styles.cardTiny,
 ]}
 >
 <Text
 style={[
 styles.label,
 styles.textDark,
 {
 fontSize: layout.labelFontSize,
 lineHeight: layout.labelLineHeight,
 },
 ]}
 numberOfLines={1}
 adjustsFontSizeToFit
 minimumFontScale={0.72}
 >
 {label}
 </Text>

 <KpiValue
 value={sample.total}
 layout={layout}
 dark
 />

 {!isTiny && (
 <Text
 style={[
 styles.dualNote,
 {
 fontSize: layout.labelFontSize,
 lineHeight: layout.labelLineHeight,
 },
 ]}
 numberOfLines={1}
 >
 도전 {sample.first} · 기록 {sample.second}
 </Text>
 )}
 </View>
 );
};

function NonGraphPreviewIcon({
 preview,
 title,
 w = 1,
 h = 1,
 muted = false,
 style,
}) {
 const supported = supportsNonGraphPreview(preview);
 const sizeMode = resolveWidgetPreviewSizeMode({ w, h });
 const layout = getWidgetPreviewKpiLayout(sizeMode);

 const sample = useMemo(
 () => getWidgetPreviewSampleData(preview),
 [preview],
 );

 if (!supported) {
 return null;
 }

 const label = normalizeLabel(title);

 const content =
 preview.variant === WIDGET_PREVIEW_VARIANTS.DUAL_COUNT ? (
 <DualCountKpiPreview
 label={label}
 layout={layout}
 sizeMode={sizeMode}
 sample={sample}
 />
 ) : (
 <CountKpiPreview
 label={label}
 preview={preview}
 layout={layout}
 sizeMode={sizeMode}
 sample={sample}
 />
 );

 return (
 <View
 style={[
 styles.root,
 muted && styles.rootMuted,
 style,
 ]}
 >
 {content}
 </View>
 );
}

export default memo(NonGraphPreviewIcon);

const styles = StyleSheet.create({
 root: {
 width: '100%',
 minHeight: 0,
 alignItems: 'center',
 justifyContent: 'center',
 },
 rootMuted: {
 opacity: 0.58,
 },
 card: {
 width: '100%',
 alignSelf: 'center',
 justifyContent: 'center',
 backgroundColor: WIDGET_PREVIEW_COLORS.white,
 borderWidth: 1,
 borderColor: WIDGET_PREVIEW_COLORS.border,
 overflow: 'hidden',
 },
 cardTiny: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 },
 cardDark: {
 backgroundColor: WIDGET_PREVIEW_COLORS.primary,
 borderColor: WIDGET_PREVIEW_COLORS.primary,
 },
 label: {
 color: WIDGET_PREVIEW_COLORS.secondary,
 fontWeight: '800',
 includeFontPadding: false,
 },
 textDark: {
 color: WIDGET_PREVIEW_COLORS.white,
 },
 valueRow: {
 flexDirection: 'row',
 alignItems: 'center',
 minWidth: 0,
 },
 value: {
 color: WIDGET_PREVIEW_COLORS.primary,
 fontWeight: '900',
 includeFontPadding: false,
 },
 icon: {
 color: WIDGET_PREVIEW_COLORS.primary,
 fontWeight: '900',
 includeFontPadding: false,
 },
 noteLine: {
 marginTop: 2,
 backgroundColor: WIDGET_PREVIEW_COLORS.track,
 },
 noteLineDark: {
 backgroundColor: WIDGET_PREVIEW_COLORS.white,
 opacity: 0.38,
 },
 dualNote: {
 marginTop: 1,
 color: WIDGET_PREVIEW_COLORS.white,
 fontWeight: '700',
 opacity: 0.68,
 includeFontPadding: false,
 },
});
