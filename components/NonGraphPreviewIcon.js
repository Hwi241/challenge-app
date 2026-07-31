// components/NonGraphPreviewIcon.js
// Official metadata-driven preview renderer for non-graph dashboard widgets.

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
 getWidgetPreviewNonKpiLayout,
 getWidgetPreviewSampleData,
 getWidgetPreviewSizeRule,
 isRenderedWidgetPreviewDefinition,
 resolveWidgetPreviewSizeMode,
} from '../constants/widgetPreviewRules';

const normalizeLabel = (title) => {
 const value = String(title || '').trim();
 return value || '미리보기';
};

export const supportsNonGraphPreview = (preview) => (
 isRenderedWidgetPreviewDefinition(preview)
);

const PreviewLabel = ({
 label,
 layout,
 dark = false,
}) => (
 <Text
 style={[
 styles.label,
 {
 fontSize: layout.labelFontSize,
 lineHeight: layout.labelLineHeight,
 },
 dark && styles.textDark,
 ]}
 numberOfLines={1}
 adjustsFontSizeToFit
 minimumFontScale={0.72}
 >
 {label}
 </Text>
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
 const isTiny =
 sizeMode === WIDGET_PREVIEW_SIZE_MODES.TINY;

 const withIcon =
 preview.variant ===
 WIDGET_PREVIEW_VARIANTS.COUNT_WITH_ICON;

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
 isTiny && styles.kpiCardTiny,
 ]}
 >
 <PreviewLabel
 label={label}
 layout={layout}
 />

 <KpiValue
 value={sample.value}
 icon={withIcon ? '★' : ''}
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
 const isTiny =
 sizeMode === WIDGET_PREVIEW_SIZE_MODES.TINY;

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
 isTiny && styles.kpiCardTiny,
 ]}
 >
 <PreviewLabel
 label={label}
 layout={layout}
 dark
 />

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

const NonKpiCard = ({
 layout,
 children,
}) => (
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
 ]}
 >
 {children}
 </View>
);

const AvatarPreview = ({
 label,
 layout,
 sizeMode,
}) => {
 const isTiny =
 sizeMode === WIDGET_PREVIEW_SIZE_MODES.TINY;

 return (
 <NonKpiCard layout={layout}>
 <View style={styles.avatarContent}>
 <View
 style={[
 styles.avatarCircle,
 {
 width: layout.avatarSize,
 height: layout.avatarSize,
 borderRadius: layout.avatarSize / 2,
 },
 ]}
 >
 <View
 style={[
 styles.avatarHead,
 {
 width: layout.avatarSize * 0.28,
 height: layout.avatarSize * 0.28,
 borderRadius: layout.avatarSize * 0.14,
 },
 ]}
 />
 <View
 style={[
 styles.avatarBody,
 {
 width: layout.avatarSize * 0.58,
 height: layout.avatarSize * 0.24,
 borderTopLeftRadius: layout.avatarSize * 0.29,
 borderTopRightRadius: layout.avatarSize * 0.29,
 marginTop: layout.avatarSize * 0.08,
 },
 ]}
 />
 </View>

 {!isTiny && (
 <PreviewLabel
 label={label}
 layout={layout}
 />
 )}
 </View>
 </NonKpiCard>
 );
};

const ProfileSummaryPreview = ({
 label,
 layout,
 sizeRule,
}) => {
 const lineCount = Math.max(
 1,
 Math.min(3, sizeRule.maxTextLines),
 );

 const widths = ['58%', '86%', '72%'];

 return (
 <NonKpiCard layout={layout}>
 <View style={[styles.summaryWrap, { rowGap: layout.gap }]}>
 <PreviewLabel
 label={label}
 layout={layout}
 />

 {Array.from({ length: lineCount }, (_, index) => (
 <View
 key={`profile-line-${index}`}
 style={[
 styles.skeletonLine,
 {
 width: widths[index],
 height: layout.lineHeight,
 borderRadius: layout.lineHeight / 2,
 },
 index === 0 && styles.skeletonLineStrong,
 ]}
 />
 ))}
 </View>
 </NonKpiCard>
 );
};

const BatteryPreview = ({
 label,
 layout,
 sizeRule,
 sample,
}) => {
 const progress = Math.max(
 34,
 Math.min(86, 34 + (sample.value % 53)),
 );

 return (
 <NonKpiCard layout={layout}>
 <View style={[styles.sectionWrap, { rowGap: layout.gap }]}>
 <PreviewLabel
 label={label}
 layout={layout}
 />

 <View
 style={[
 styles.batteryTrack,
 {
 height: Math.max(7, layout.rowHeight),
 borderRadius: Math.max(7, layout.rowHeight) / 2,
 },
 ]}
 >
 <View
 style={[
 styles.batteryFill,
 {
 width: `${progress}%`,
 borderRadius: Math.max(7, layout.rowHeight) / 2,
 },
 ]}
 />
 </View>

 {sizeRule.showSecondary && (
 <Text
 style={[
 styles.secondaryText,
 {
 fontSize: layout.labelFontSize,
 lineHeight: layout.labelLineHeight,
 },
 ]}
 numberOfLines={1}
 >
 {progress}% 채움
 </Text>
 )}
 </View>
 </NonKpiCard>
 );
};

const ConnectionListPreview = ({
 label,
 layout,
 sizeRule,
}) => {
 const rowCount = Math.max(
 1,
 Math.min(3, sizeRule.maxListRows),
 );

 return (
 <NonKpiCard layout={layout}>
 <View style={[styles.sectionWrap, { rowGap: layout.gap }]}>
 <PreviewLabel
 label={label}
 layout={layout}
 />

 <View
 style={[
 styles.rowList,
 { rowGap: Math.max(3, layout.gap - 2) },
 ]}
 >
 {Array.from({ length: rowCount }, (_, index) => (
 <View
 key={`connection-${index}`}
 style={[
 styles.statusRow,
 { minHeight: layout.rowHeight },
 ]}
 >
 <View
 style={[
 styles.statusDot,
 {
 width: layout.dotSize,
 height: layout.dotSize,
 borderRadius: layout.dotSize / 2,
 },
 index === 1 && styles.statusDotMuted,
 ]}
 />

 <View
 style={[
 styles.statusLine,
 {
 height: layout.lineHeight,
 borderRadius: layout.lineHeight / 2,
 width: `${68 - index * 8}%`,
 },
 ]}
 />

 <View
 style={[
 styles.statusPill,
 {
 width: Math.max(15, layout.rowHeight * 2.4),
 height: Math.max(5, layout.lineHeight),
 borderRadius: Math.max(5, layout.lineHeight) / 2,
 },
 index === 1 && styles.statusPillMuted,
 ]}
 />
 </View>
 ))}
 </View>
 </View>
 </NonKpiCard>
 );
};

const MemoLinesPreview = ({
 label,
 layout,
 sizeRule,
}) => {
 const lineCount = Math.max(
 1,
 Math.min(3, sizeRule.maxTextLines),
 );

 const widths = ['88%', '100%', '64%'];

 return (
 <NonKpiCard layout={layout}>
 <View style={[styles.sectionWrap, { rowGap: layout.gap }]}>
 <PreviewLabel
 label={label}
 layout={layout}
 />

 <View
 style={[
 styles.memoLines,
 { rowGap: Math.max(3, layout.gap - 1) },
 ]}
 >
 {Array.from({ length: lineCount }, (_, index) => (
 <View
 key={`memo-line-${index}`}
 style={[
 styles.skeletonLine,
 {
 width: widths[index],
 height: layout.lineHeight,
 borderRadius: layout.lineHeight / 2,
 },
 index === 0 && styles.skeletonLineStrong,
 ]}
 />
 ))}
 </View>
 </View>
 </NonKpiCard>
 );
};

const TabbedListPreview = ({
 label,
 layout,
 sizeRule,
}) => {
 const rowCount = Math.max(
 1,
 Math.min(3, sizeRule.maxListRows),
 );

 const tabCount = sizeRule.showSecondary ? 3 : 2;

 return (
 <NonKpiCard layout={layout}>
 <View style={[styles.sectionWrap, { rowGap: layout.gap }]}>
 <PreviewLabel
 label={label}
 layout={layout}
 />

 {sizeRule.showSecondary && (
 <View
 style={[
 styles.tabRow,
 { columnGap: Math.max(3, layout.gap - 2) },
 ]}
 >
 {Array.from({ length: tabCount }, (_, index) => (
 <View
 key={`tab-${index}`}
 style={[
 styles.tab,
 {
 height: layout.tabHeight,
 borderRadius: layout.tabHeight / 2,
 },
 index === 0 && styles.tabActive,
 ]}
 />
 ))}
 </View>
 )}

 <View
 style={[
 styles.listWrap,
 { rowGap: Math.max(3, layout.gap - 2) },
 ]}
 >
 {Array.from({ length: rowCount }, (_, index) => (
 <View
 key={`list-row-${index}`}
 style={[
 styles.listRow,
 { minHeight: layout.rowHeight },
 ]}
 >
 <View
 style={[
 styles.listLine,
 {
 width: `${72 - index * 7}%`,
 height: layout.lineHeight,
 borderRadius: layout.lineHeight / 2,
 },
 ]}
 />

 <View
 style={[
 styles.listBadge,
 {
 width: Math.max(16, layout.rowHeight * 2.6),
 height: Math.max(5, layout.lineHeight),
 borderRadius: Math.max(5, layout.lineHeight) / 2,
 },
 index === rowCount - 1 && styles.listBadgeMuted,
 ]}
 />
 </View>
 ))}
 </View>
 </View>
 </NonKpiCard>
 );
};

const renderPreviewContent = ({
 preview,
 label,
 kpiLayout,
 nonKpiLayout,
 sizeMode,
 sizeRule,
 sample,
}) => {
 switch (preview.variant) {
 case WIDGET_PREVIEW_VARIANTS.DUAL_COUNT:
 return (
 <DualCountKpiPreview
 label={label}
 layout={kpiLayout}
 sizeMode={sizeMode}
 sample={sample}
 />
 );

 case WIDGET_PREVIEW_VARIANTS.COUNT_WITH_NOTE:
 case WIDGET_PREVIEW_VARIANTS.COUNT_WITH_ICON:
 return (
 <CountKpiPreview
 label={label}
 preview={preview}
 layout={kpiLayout}
 sizeMode={sizeMode}
 sample={sample}
 />
 );

 case WIDGET_PREVIEW_VARIANTS.AVATAR:
 return (
 <AvatarPreview
 label={label}
 layout={nonKpiLayout}
 sizeMode={sizeMode}
 />
 );

 case WIDGET_PREVIEW_VARIANTS.PROFILE_SUMMARY:
 return (
 <ProfileSummaryPreview
 label={label}
 layout={nonKpiLayout}
 sizeRule={sizeRule}
 />
 );

 case WIDGET_PREVIEW_VARIANTS.BATTERY:
 return (
 <BatteryPreview
 label={label}
 layout={nonKpiLayout}
 sizeRule={sizeRule}
 sample={sample}
 />
 );

 case WIDGET_PREVIEW_VARIANTS.CONNECTION_LIST:
 return (
 <ConnectionListPreview
 label={label}
 layout={nonKpiLayout}
 sizeRule={sizeRule}
 />
 );

 case WIDGET_PREVIEW_VARIANTS.MEMO_LINES:
 return (
 <MemoLinesPreview
 label={label}
 layout={nonKpiLayout}
 sizeRule={sizeRule}
 />
 );

 case WIDGET_PREVIEW_VARIANTS.TABBED_LIST:
 return (
 <TabbedListPreview
 label={label}
 layout={nonKpiLayout}
 sizeRule={sizeRule}
 />
 );

 default:
 return null;
 }
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
 const sizeRule = getWidgetPreviewSizeRule(sizeMode);
 const kpiLayout = getWidgetPreviewKpiLayout(sizeMode);
 const nonKpiLayout = getWidgetPreviewNonKpiLayout(sizeMode);

 const sample = useMemo(
 () => getWidgetPreviewSampleData(preview),
 [preview],
 );

 if (!supported) {
 return null;
 }

 const label = normalizeLabel(title);

 const content = renderPreviewContent({
 preview,
 label,
 kpiLayout,
 nonKpiLayout,
 sizeMode,
 sizeRule,
 sample,
 });

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
 kpiCardTiny: {
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
 avatarContent: {
 alignItems: 'center',
 justifyContent: 'center',
 rowGap: 5,
 },
 avatarCircle: {
 alignItems: 'center',
 justifyContent: 'center',
 backgroundColor: WIDGET_PREVIEW_COLORS.surface,
 },
 avatarHead: {
 backgroundColor: WIDGET_PREVIEW_COLORS.primary,
 },
 avatarBody: {
 backgroundColor: WIDGET_PREVIEW_COLORS.primary,
 },
 summaryWrap: {
 width: '100%',
 justifyContent: 'center',
 },
 sectionWrap: {
 width: '100%',
 justifyContent: 'center',
 },
 skeletonLine: {
 backgroundColor: WIDGET_PREVIEW_COLORS.track,
 },
 skeletonLineStrong: {
 backgroundColor: WIDGET_PREVIEW_COLORS.primary,
 },
 batteryTrack: {
 width: '100%',
 backgroundColor: WIDGET_PREVIEW_COLORS.track,
 overflow: 'hidden',
 },
 batteryFill: {
 height: '100%',
 backgroundColor: WIDGET_PREVIEW_COLORS.primary,
 },
 secondaryText: {
 color: WIDGET_PREVIEW_COLORS.muted,
 fontWeight: '700',
 includeFontPadding: false,
 },
 rowList: {
 width: '100%',
 },
 statusRow: {
 width: '100%',
 flexDirection: 'row',
 alignItems: 'center',
 columnGap: 6,
 },
 statusDot: {
 backgroundColor: WIDGET_PREVIEW_COLORS.primary,
 },
 statusDotMuted: {
 backgroundColor: WIDGET_PREVIEW_COLORS.muted,
 },
 statusLine: {
 backgroundColor: WIDGET_PREVIEW_COLORS.track,
 },
 statusPill: {
 marginLeft: 'auto',
 backgroundColor: WIDGET_PREVIEW_COLORS.primary,
 },
 statusPillMuted: {
 backgroundColor: WIDGET_PREVIEW_COLORS.track,
 },
 memoLines: {
 width: '100%',
 },
 tabRow: {
 width: '100%',
 flexDirection: 'row',
 alignItems: 'center',
 },
 tab: {
 flex: 1,
 backgroundColor: WIDGET_PREVIEW_COLORS.track,
 },
 tabActive: {
 backgroundColor: WIDGET_PREVIEW_COLORS.primary,
 },
 listWrap: {
 width: '100%',
 },
 listRow: {
 width: '100%',
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 columnGap: 8,
 },
 listLine: {
 backgroundColor: WIDGET_PREVIEW_COLORS.track,
 },
 listBadge: {
 backgroundColor: WIDGET_PREVIEW_COLORS.primary,
 },
 listBadgeMuted: {
 backgroundColor: WIDGET_PREVIEW_COLORS.muted,
 },
});
