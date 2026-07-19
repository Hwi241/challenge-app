// styles/common.js
import { StyleSheet } from 'react-native';

/**
 * THE PUSH Design System v1
 *
 * 원칙:
 * - 기본 UI는 흑백 기반으로 유지한다.
 * - 색상은 primitive → semantic → component 순서로 사용한다.
 * - 화면 파일에서 raw color / raw radius / raw spacing 사용을 줄인다.
 * - 기존 export 이름은 유지해서 기존 화면을 깨지 않게 한다.
 */

export const APP_DESIGN_SYSTEM_VERSION = 1;

/**
 * 앱 전체 공용 디자인 시스템 정책.
 *
 * styles/common.js가 앱 전체 일반 UI의 canonical source of truth다.
 * colors와 spacing은 기존 화면 호환을 위한 adapter이며,
 * 새 공용 UI 기준은 color와 space를 우선 사용한다.
 */
export const APP_DESIGN_SYSTEM_POLICY = Object.freeze({
 sourceOfTruth: 'styles/common.js',
 canonicalFlow: Object.freeze([
  'primitive',
  'semantic',
  'component',
 ]),
 officialTokenExports: Object.freeze([
  'primitive',
  'color',
  'space',
  'radius',
  'font',
 ]),
 officialComponentExports: Object.freeze([
  'surface',
  'layout',
  'buttonStyles',
  'text',
  'card',
  'input',
  'modal',
  'control',
  'badge',
  'appHeader',
  'header',
 ]),
 compatibilityExports: Object.freeze([
  'colors',
  'spacing',
 ]),
 preserveExistingVisualValues: true,
 allowScreenSpecificValues:
  'onlyWhenNotGeneralReusableUi',
 rawValueMigrationRule:
  'generalReusableUiMustReferenceStylesCommon',
});

/* -------------------------------------------------------------------------- */
/* Primitive tokens */
/* -------------------------------------------------------------------------- */

export const primitive = {
 white: '#FFFFFF',
 black: '#000000',

 neutral: {
 50: '#FAFAFA',
 100: '#F5F5F5',
 200: '#E5E5E5',
 300: '#D4D4D4',
 400: '#A3A3A3',
 500: '#737373',
 600: '#525252',
 700: '#404040',
 800: '#262626',
 900: '#171717',
 950: '#0A0A0A',
 },

 // 기존 화면 fallback에 섞여 있던 slate 계열 호환용.
 // 새 기본 UI는 neutral/color semantic을 우선 사용한다.
 slate: {
 50: '#F8FAFC',
 100: '#F1F5F9',
 200: '#E2E8F0',
 300: '#CBD5E1',
 400: '#94A3B8',
 500: '#64748B',
 600: '#475569',
 700: '#334155',
 800: '#1E293B',
 900: '#0F172A',
 },

 amber: {
 50: '#FFFBEB',
 100: '#FEF3C7',
 200: '#FDE68A',
 300: '#FCD34D',
 400: '#FBBF24',
 500: '#F59E0B',
 600: '#D97706',
 700: '#B45309',
 800: '#92400E',
 900: '#78350F',
 },

 green: {
 50: '#ECFDF5',
 100: '#D1FAE5',
 200: '#A7F3D0',
 500: '#10B981',
 600: '#059669',
 700: '#047857',
 },

 red: {
 50: '#FEF2F2',
 100: '#FEE2E2',
 200: '#FECACA',
 500: '#EF4444',
 600: '#DC2626',
 700: '#B91C1C',
 },

 blue: {
 50: '#EFF6FF',
 100: '#DBEAFE',
 500: '#3B82F6',
 600: '#2563EB',
 700: '#1D4ED8',
 },
};

/* -------------------------------------------------------------------------- */
/* Semantic color tokens */
/* -------------------------------------------------------------------------- */

export const color = {
 background: primitive.white,
 backgroundMuted: primitive.neutral[50],
 surface: primitive.white,
 surfaceMuted: primitive.neutral[100],
 surfacePressed: primitive.neutral[200],

 textPrimary: primitive.neutral[950],
 textSecondary: primitive.neutral[600],
 textTertiary: primitive.neutral[500],
 textDisabled: primitive.neutral[400],
 textInverse: primitive.white,

 border: primitive.neutral[200],
 borderMuted: primitive.neutral[100],
 borderStrong: primitive.neutral[900],
 divider: primitive.neutral[200],

 primary: primitive.neutral[950],
 primaryPressed: primitive.neutral[800],
 primarySoft: primitive.neutral[100],

 success: primitive.green[600],
 successBg: primitive.green[50],
 successBorder: primitive.green[200],

 warning: primitive.amber[500],
 warningBg: primitive.amber[50],
 warningBorder: primitive.amber[200],

 danger: primitive.red[600],
 dangerBg: primitive.red[50],
 dangerBorder: primitive.red[200],

 info: primitive.blue[600],
 infoBg: primitive.blue[50],
 infoBorder: primitive.blue[100],

 star: primitive.amber[500],
 starBg: primitive.amber[50],

 overlay: 'rgba(0,0,0,0.35)',
 overlayStrong: 'rgba(0,0,0,0.5)',
 imageDeleteOverlay: 'rgba(229, 231, 235, 0.85)',
};

/**
 * 기존 코드 호환용 colors.
 * 새 코드는 가능하면 color.* semantic token 사용 권장.
 */
export const colors = {
 white: primitive.white,
 black: primitive.black,

 gray50: primitive.neutral[50],
 gray100: primitive.neutral[100],
 gray200: primitive.neutral[200],
 gray300: primitive.neutral[300],
 gray400: primitive.neutral[400],
 gray500: primitive.neutral[500],
 gray600: primitive.neutral[600],
 gray700: primitive.neutral[700],
 gray800: primitive.neutral[950],

 background: color.background,
 backgroundMuted: color.backgroundMuted,
 surface: color.surface,
 surfaceMuted: color.surfaceMuted,

 primary: color.primary,
 primaryPressed: color.primaryPressed,
 primarySoft: color.primarySoft,

 border: color.border,
 borderMuted: color.borderMuted,
 borderStrong: color.borderStrong,
 borderSoft: color.border,

 textPrimary: color.textPrimary,
 textSecondary: color.textSecondary,
 textTertiary: color.textTertiary,
 textInverse: color.textInverse,

 slate50: primitive.slate[50],
 slate100: primitive.slate[100],
 slate200: primitive.slate[200],
 slate300: primitive.slate[300],
 slate400: primitive.slate[400],
 slate500: primitive.slate[500],
 slate600: primitive.slate[600],
 slate700: primitive.slate[700],
 slate800: primitive.slate[800],
 slate900: primitive.slate[900],

 amber50: primitive.amber[50],
 amber100: primitive.amber[100],
 amber200: primitive.amber[200],
 amber300: primitive.amber[300],
 amber400: primitive.amber[400],
 amber500: primitive.amber[500],
 amber600: primitive.amber[600],
 amber700: primitive.amber[700],
 amber800: primitive.amber[800],
 amber900: primitive.amber[900],

 green50: primitive.green[50],
 green100: primitive.green[100],
 green200: primitive.green[200],
 green500: primitive.green[500],
 green600: primitive.green[600],
 green700: primitive.green[700],

 red50: primitive.red[50],
 red100: primitive.red[100],
 red200: primitive.red[200],
 red500: primitive.red[500],
 red600: primitive.red[600],
 red700: primitive.red[700],

 blue50: primitive.blue[50],
 blue100: primitive.blue[100],
 blue500: primitive.blue[500],
 blue600: primitive.blue[600],
 blue700: primitive.blue[700],

 success: color.success,
 successBg: color.successBg,
 successBorder: color.successBorder,
 warning: color.warning,
 warningBg: color.warningBg,
 warningBorder: color.warningBorder,
 danger: color.danger,
 dangerBg: color.dangerBg,
 dangerBorder: color.dangerBorder,
 info: color.info,
 infoBg: color.infoBg,
 infoBorder: color.infoBorder,
 star: color.star,
 starBg: color.starBg,

 overlay: color.overlay,
 overlayStrong: color.overlayStrong,
 imageDeleteOverlay: color.imageDeleteOverlay,
};

/* -------------------------------------------------------------------------- */
/* Spacing tokens */
/* -------------------------------------------------------------------------- */

/**
 * 신규 4pt 기반 간격 시스템.
 * 앞으로 새 UI는 space.* 사용 권장.
 */
export const space = {
 none: 0,
 xxs: 4,
 xs: 8,
 sm: 12,
 md: 16,
 lg: 20,
 xl: 24,
 xxl: 32,
 xxxl: 40,
};

/**
 * 기존 코드 호환용 spacing.
 * 기존 화면 변화 최소화를 위해 기존 값을 유지한다.
 */
export const spacing = {
 xs: 6,
 sm: 8,
 md: 12,
 lg: 16,
 xl: 24,
 xxl: 36,

 none: space.none,
 xxs: space.xxs,
 xxxl: space.xxxl,
};

/* -------------------------------------------------------------------------- */
/* Radius tokens */
/* -------------------------------------------------------------------------- */

export const radius = {
 none: 0,
 xs: 4,
 sm: 8,
 md: 12,
 lg: 16,
 card: 16,
 sheet: 24,
 pill: 999,
};

/* -------------------------------------------------------------------------- */
/* Typography tokens */
/* -------------------------------------------------------------------------- */

export const font = {
 size: {
 caption: 11,
 meta: 12,
 bodySmall: 13,
 body: 14,
 bodyLarge: 16,
 title: 20,
 screenTitle: 24,
 },

 weight: {
 regular: '400',
 medium: '500',
 semibold: '600',
 bold: '700',
 heavy: '800',
 },
};

const textButton = {
 fontSize: 15,
 fontWeight: font.weight.bold,
 color: color.primary,
};

/* -------------------------------------------------------------------------- */
/* Component tokens */
/* -------------------------------------------------------------------------- */

export const surface = StyleSheet.create({
 screen: {
 flex: 1,
 backgroundColor: color.background,
 },
 screenMuted: {
 flex: 1,
 backgroundColor: color.backgroundMuted,
 },
 card: {
 backgroundColor: color.surface,
 borderColor: color.border,
 borderWidth: 1,
 borderRadius: radius.card,
 },
});

export const buttonStyles = {
 primary: {
 container: {
 minHeight: 48,
 backgroundColor: color.primary,
 borderColor: color.primary,
 borderWidth: 1.5,
 paddingVertical: spacing.sm,
 paddingHorizontal: spacing.lg,
 borderRadius: radius.md,
 alignItems: 'center',
 justifyContent: 'center',
 },
 label: {
 ...textButton,
 color: color.textInverse,
 },
 },
 primaryText: { ...textButton, color: color.textInverse },

 secondary: {
 container: {
 minHeight: 48,
 backgroundColor: color.surface,
 borderColor: color.border,
 borderWidth: 1,
 paddingVertical: spacing.sm,
 paddingHorizontal: spacing.lg,
 borderRadius: radius.md,
 alignItems: 'center',
 justifyContent: 'center',
 },
 label: {
 ...textButton,
 color: color.primary,
 fontWeight: font.weight.semibold,
 },
 },
 secondaryText: { ...textButton, color: color.primary, fontWeight: font.weight.semibold },

 danger: {
 container: {
 minHeight: 48,
 backgroundColor: color.dangerBg,
 borderColor: color.dangerBorder,
 borderWidth: 1,
 paddingVertical: spacing.sm,
 paddingHorizontal: spacing.lg,
 borderRadius: radius.md,
 alignItems: 'center',
 justifyContent: 'center',
 },
 label: {
 ...textButton,
 color: color.danger,
 fontWeight: font.weight.bold,
 },
 },
 dangerText: { ...textButton, color: color.danger, fontWeight: font.weight.bold },

 outlineStrong: {
 container: {
 backgroundColor: color.background,
 borderColor: color.borderStrong,
 borderWidth: 2,
 paddingVertical: spacing.sm,
 paddingHorizontal: spacing.lg,
 borderRadius: radius.md,
 alignItems: 'center',
 justifyContent: 'center',
 },
 label: { ...textButton, color: color.primary },
 },
 outlineStrongText: { ...textButton, color: color.primary },

 outlineSoft: {
 container: {
 backgroundColor: color.background,
 borderColor: color.border,
 borderWidth: 1,
 paddingVertical: spacing.sm,
 paddingHorizontal: spacing.lg,
 borderRadius: radius.md,
 alignItems: 'center',
 justifyContent: 'center',
 },
 label: { ...textButton, color: color.primary, fontWeight: font.weight.semibold },
 },
 outlineSoftText: { ...textButton, color: color.primary, fontWeight: font.weight.semibold },

 compactRight: {
 minHeight: 34,
 backgroundColor: color.primary,
 borderColor: color.primary,
 borderWidth: 1.5,
 paddingVertical: 6,
 paddingHorizontal: spacing.md,
 borderRadius: radius.sm,
 alignItems: 'center',
 justifyContent: 'center',
 },
 compactRightText: {
 ...textButton,
 fontSize: 14,
 fontWeight: font.weight.bold,
 color: color.textInverse,
 },

 icon: {
 width: 40,
 height: 40,
 borderRadius: radius.md,
 alignItems: 'center',
 justifyContent: 'center',
 backgroundColor: color.surface,
 borderColor: color.border,
 borderWidth: 1,
 },

 headerRight: {
 container: {
 minWidth: 44,
 height: 34,
 paddingHorizontal: spacing.md,
 borderColor: color.border,
 borderWidth: 1,
 borderRadius: radius.sm,
 alignItems: 'center',
 justifyContent: 'center',
 backgroundColor: color.background,
 },
 label: {
 ...textButton,
 fontSize: 14,
 fontWeight: font.weight.semibold,
 color: color.primary,
 },
 },

 smallPrimary: {
 container: {
 minWidth: 52,
 minHeight: 34,
 paddingVertical: spacing.xs,
 paddingHorizontal: 10,
 borderRadius: radius.pill,
 borderWidth: 1,
 borderColor: color.primary,
 backgroundColor: color.primary,
 alignItems: 'center',
 justifyContent: 'center',
 },
 label: {
 fontSize: font.size.meta,
 fontWeight: font.weight.heavy,
 color: color.textInverse,
 },
 },

 smallOutline: {
 container: {
 minWidth: 52,
 minHeight: 34,
 paddingVertical: spacing.xs,
 paddingHorizontal: 10,
 borderRadius: radius.pill,
 borderWidth: 1,
 borderColor: color.border,
 backgroundColor: color.surface,
 alignItems: 'center',
 justifyContent: 'center',
 },
 label: {
 fontSize: font.size.meta,
 fontWeight: font.weight.heavy,
 color: color.textPrimary,
 },
 },

 compactSecondary: {
 container: {
 backgroundColor: color.surface,
 borderWidth: 1,
 borderColor: primitive.neutral[300],
 borderRadius: radius.md,
 paddingVertical: spacing.sm,
 paddingHorizontal: spacing.md,
 alignItems: 'center',
 justifyContent: 'center',
 },
 label: {
 color: color.textSecondary,
 fontSize: font.size.body,
 fontWeight: font.weight.semibold,
 },
 },

 formSave: {
 container: {
 marginTop: spacing.xl,
 backgroundColor: color.primary,
 borderRadius: radius.md,
 paddingVertical: spacing.md,
 alignItems: 'center',
 justifyContent: 'center',
 },
 label: {
 color: color.textInverse,
 fontWeight: font.weight.heavy,
 },
 },
};

export const text = StyleSheet.create({
 screenTitle: {
 fontSize: font.size.screenTitle,
 fontWeight: font.weight.heavy,
 color: color.textPrimary,
 },
 title: {
 fontSize: font.size.title,
 fontWeight: font.weight.bold,
 color: color.textPrimary,
 },
 subtitle: {
 fontSize: font.size.bodyLarge,
 fontWeight: font.weight.semibold,
 color: color.textPrimary,
 },
 cardTitle: {
 fontSize: font.size.bodyLarge,
 fontWeight: font.weight.bold,
 color: color.textPrimary,
 },
 body: {
 fontSize: font.size.body,
 fontWeight: font.weight.medium,
 color: color.textPrimary,
 },
 bodyMuted: {
 fontSize: font.size.body,
 fontWeight: font.weight.regular,
 color: color.textSecondary,
 },
 meta: {
 fontSize: font.size.meta,
 fontWeight: font.weight.regular,
 color: color.textSecondary,
 },
 caption: {
 fontSize: font.size.caption,
 fontWeight: font.weight.regular,
 color: color.textTertiary,
 },

 screenTitleCompact: {
 fontSize: font.size.title,
 fontWeight: font.weight.heavy,
 color: color.textPrimary,
 textAlign: 'center',
 },

 headerTitle: {
 fontSize: 18,
 fontWeight: font.weight.heavy,
 color: color.textPrimary,
 textAlign: 'center',
 },

 sectionTitle: {
 fontSize: font.size.bodyLarge,
 fontWeight: font.weight.heavy,
 color: color.textPrimary,
 },

 sectionTitleSpaced: {
 fontSize: font.size.bodyLarge,
 fontWeight: font.weight.heavy,
 color: color.textPrimary,
 marginBottom: spacing.md,
 },

 label: {
 fontSize: font.size.bodySmall,
 fontWeight: font.weight.regular,
 color: color.textSecondary,
 },

 help: {
 fontSize: font.size.meta,
 fontWeight: font.weight.regular,
 color: color.textSecondary,
 },

 value: {
 fontSize: 15,
 fontWeight: font.weight.heavy,
 color: color.textPrimary,
 },

 bodyStrong: {
 fontSize: font.size.body,
 fontWeight: font.weight.heavy,
 color: color.textPrimary,
 },

 labelStrong: {
 fontSize: font.size.bodySmall,
 fontWeight: font.weight.heavy,
 color: color.textSecondary,
 },

 metaTertiary: {
 fontSize: font.size.meta,
 fontWeight: font.weight.regular,
 color: color.textTertiary,
 },

 metaStrong: {
 fontSize: font.size.meta,
 fontWeight: font.weight.heavy,
 color: color.textPrimary,
 },

 center: {
 textAlign: 'center',
 },

 bodySmallMuted: {
 fontSize: font.size.bodySmall,
 fontWeight: font.weight.regular,
 color: color.textSecondary,
 },

 metaStrongMuted: {
 fontSize: font.size.meta,
 fontWeight: font.weight.heavy,
 color: color.textSecondary,
 },

 captionStrongMuted: {
 fontSize: font.size.caption,
 fontWeight: font.weight.heavy,
 color: color.textSecondary,
 },

 bodyStrongMuted: {
 fontSize: font.size.body,
 fontWeight: font.weight.bold,
 color: color.textSecondary,
 },

 captionMuted: {
 fontSize: font.size.caption,
 fontWeight: font.weight.regular,
 color: color.textSecondary,
 },

 bodySmallStrong: {
 fontSize: font.size.bodySmall,
 fontWeight: font.weight.heavy,
 color: color.textPrimary,
 },
});

export const card = StyleSheet.create({
 base: {
 backgroundColor: color.surface,
 borderColor: color.border,
 borderWidth: 1,
 borderRadius: radius.card,
 padding: spacing.lg,
 },
 form: {
 backgroundColor: color.surface,
 borderColor: color.border,
 borderWidth: 1,
 borderRadius: radius.md,
 padding: spacing.lg,
 },
 compact: {
 backgroundColor: color.surface,
 borderColor: color.border,
 borderWidth: 1,
 borderRadius: radius.card,
 padding: spacing.md,
 },

 titleBox: {
 backgroundColor: color.surface,
 borderColor: color.border,
 borderWidth: 1,
 borderRadius: radius.md,
 paddingVertical: spacing.md,
 paddingHorizontal: spacing.lg,
 },

 list: {
 backgroundColor: color.surface,
 borderColor: color.border,
 borderWidth: 1,
 borderRadius: radius.lg,
 paddingHorizontal: spacing.lg,
 paddingVertical: spacing.md,
 },

 notification: {
 backgroundColor: color.surface,
 borderColor: color.border,
 borderWidth: 1,
 borderRadius: radius.lg,
 padding: spacing.md,
 },

 preview: {
 backgroundColor: color.backgroundMuted,
 borderColor: color.borderMuted,
 borderWidth: 1,
 borderRadius: radius.sm,
 padding: spacing.md,
 },

 inset: {
 backgroundColor: color.background,
 borderColor: color.border,
 borderWidth: 1,
 borderRadius: radius.md,
 padding: spacing.md,
 },

 elevated: {
 backgroundColor: color.surface,
 borderColor: color.border,
 borderWidth: 1,
 borderRadius: radius.card,
 padding: spacing.lg,
 shadowColor: primitive.black,
 shadowOpacity: 0.04,
 shadowRadius: 10,
 shadowOffset: { width: 0, height: 4 },
 elevation: 1,
 },
});

export const input = StyleSheet.create({
 base: {
 minHeight: 48,
 borderRadius: radius.md,
 borderWidth: 1,
 borderColor: color.border,
 backgroundColor: color.surface,
 paddingHorizontal: spacing.md,
 paddingVertical: spacing.sm,
 fontSize: font.size.body,
 color: color.textPrimary,
 },
 multiline: {
 minHeight: 120,
 textAlignVertical: 'top',
 },

 compact: {
 borderRadius: radius.md,
 borderWidth: 1,
 borderColor: color.border,
 backgroundColor: color.surface,
 paddingHorizontal: spacing.md,
 paddingVertical: 10,
 fontSize: font.size.body,
 color: color.textPrimary,
 },

 multilineCompact: {
 minHeight: 96,
 lineHeight: 20,
 textAlignVertical: 'top',
 },

 searchContainer: {
 height: 48,
 borderRadius: radius.lg,
 backgroundColor: color.surfaceMuted,
 paddingHorizontal: spacing.md,
 flexDirection: 'row',
 alignItems: 'center',
 },

 searchField: {
 flex: 1,
 height: 48,
 color: color.textPrimary,
 fontSize: font.size.body,
 paddingVertical: 0,
 },

 compactStrongCentered: {
 backgroundColor: color.surface,
 borderWidth: 1,
 borderColor: primitive.neutral[300],
 borderRadius: radius.md,
 paddingHorizontal: spacing.md,
 paddingVertical: 10,
 fontSize: font.size.body,
 color: color.textPrimary,
 textAlign: 'center',
 },
});

export const layout = StyleSheet.create({
 screenContent: {
 padding: spacing.lg,
 backgroundColor: color.background,
 },

 screenContentMuted: {
 padding: spacing.lg,
 backgroundColor: color.backgroundMuted,
 },

 row: {
 flexDirection: 'row',
 alignItems: 'center',
 },

 rowBetween: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 },

 divider: {
 height: 1,
 backgroundColor: color.divider,
 },

 bottomActionRow: {
 flexDirection: 'row',
 gap: spacing.sm,
 marginTop: spacing.lg,
 },

 centeredContent: {
 alignItems: 'center',
 justifyContent: 'center',
 padding: spacing.lg,
 },

 fixedBottomBar: {
 position: 'absolute',
 left: 0,
 right: 0,
 bottom: 0,
 paddingHorizontal: spacing.lg,
 paddingTop: spacing.sm,
 backgroundColor: color.background,
 borderTopWidth: 0,
 borderTopColor: color.border,
 },
});

export const modal = StyleSheet.create({
 backdrop: {
 flex: 1,
 backgroundColor: color.overlay,
 alignItems: 'center',
 justifyContent: 'center',
 padding: spacing.lg,
 },

 sheet: {
 width: '100%',
 backgroundColor: color.surface,
 borderColor: color.border,
 borderWidth: 1,
 borderRadius: radius.lg,
 padding: spacing.lg,
 },

 sheetBorderless: {
 width: '100%',
 backgroundColor: color.surface,
 borderRadius: radius.lg,
 padding: spacing.lg,
 },

 sheetWide: {
 width: '92%',
 maxWidth: 460,
 backgroundColor: color.surface,
 borderColor: color.border,
 borderWidth: 1,
 borderRadius: radius.lg,
 padding: spacing.lg,
 },

 title: {
 fontSize: font.size.bodyLarge,
 fontWeight: font.weight.heavy,
 color: color.textPrimary,
 textAlign: 'center',
 marginBottom: spacing.md,
 },

 actionRow: {
 flexDirection: 'row',
 gap: spacing.sm,
 marginTop: spacing.lg,
 },

 actionButton: {
 flex: 1,
 minHeight: 44,
 paddingVertical: 10,
 borderRadius: radius.md,
 alignItems: 'center',
 justifyContent: 'center',
 },

 actionButtonCompact: {
 flex: 1,
 paddingVertical: 10,
 borderRadius: radius.md,
 alignItems: 'center',
 justifyContent: 'center',
 },

 actionGhost: {
 backgroundColor: color.surfaceMuted,
 },

 actionPrimary: {
 backgroundColor: color.primary,
 },

 actionGhostText: {
 color: color.textPrimary,
 fontWeight: font.weight.heavy,
 },

 actionPrimaryText: {
 color: color.textInverse,
 fontWeight: font.weight.heavy,
 },

 closePill: {
 marginTop: spacing.md,
 alignSelf: 'center',
 paddingVertical: 6,
 paddingHorizontal: 12,
 borderRadius: radius.pill,
 backgroundColor: color.primary,
 },

 closePillText: {
 color: color.textInverse,
 fontWeight: font.weight.bold,
 fontSize: font.size.meta,
 },
});

export const control = StyleSheet.create({
 pill: {
 paddingVertical: 6,
 paddingHorizontal: 10,
 borderRadius: radius.pill,
 borderWidth: 1,
 borderColor: primitive.neutral[300],
 backgroundColor: color.surface,
 alignItems: 'center',
 justifyContent: 'center',
 },

 pillActive: {
 borderColor: color.primary,
 backgroundColor: color.primary,
 },

 pillText: {
 fontSize: font.size.meta,
 fontWeight: font.weight.heavy,
 color: color.textPrimary,
 },

 pillTextActive: {
 color: color.textInverse,
 },

 scopePill: {
 paddingVertical: spacing.sm,
 paddingHorizontal: spacing.md,
 borderRadius: radius.pill,
 backgroundColor: color.surfaceMuted,
 },

 scopePillActive: {
 backgroundColor: color.primary,
 },

 optionRow: {
 paddingVertical: 10,
 paddingHorizontal: spacing.md,
 borderWidth: 1,
 borderColor: color.border,
 borderRadius: radius.md,
 },

 optionRowActive: {
 backgroundColor: color.primary,
 borderColor: color.primary,
 },

 optionText: {
 color: color.textPrimary,
 fontWeight: font.weight.bold,
 },

 optionTextActive: {
 color: color.textInverse,
 },

 radioRow: {
 flexDirection: 'row',
 alignItems: 'center',
 paddingVertical: spacing.sm,
 paddingHorizontal: spacing.sm,
 borderRadius: radius.md,
 },

 radioRowActive: {
 backgroundColor: color.surfaceMuted,
 },

 radioOuter: {
 width: 18,
 height: 18,
 borderRadius: 9,
 borderWidth: 2,
 borderColor: color.primary,
 alignItems: 'center',
 justifyContent: 'center',
 marginRight: 10,
 },

 radioOuterOn: {
 borderColor: color.primary,
 },

 radioInner: {
 width: 8,
 height: 8,
 borderRadius: 4,
 backgroundColor: color.primary,
 },

 radioLabel: {
 color: color.textPrimary,
 fontWeight: font.weight.bold,
 },

 chip: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: color.surfaceMuted,
 borderRadius: radius.pill,
 paddingVertical: 3,
 paddingHorizontal: 6,
 },

 chipFlowItem: {
 marginRight: spacing.xs,
 marginBottom: spacing.xs,
 },

 chipDense: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: color.surfaceMuted,
 borderRadius: radius.pill,
 paddingVertical: 3,
 paddingHorizontal: 5,
 marginRight: spacing.xs,
 marginBottom: spacing.xs,
 },

 chipDenseText: {
 color: color.textPrimary,
 fontSize: font.size.caption,
 lineHeight: 13,
 marginRight: spacing.xs,
 includeFontPadding: false,
 },

 chipUltraDense: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: color.surfaceMuted,
 borderRadius: radius.pill,
 paddingVertical: 2,
 paddingHorizontal: 4,
 maxWidth: '100%',
 },

 chipUltraDenseText: {
 color: color.textPrimary,
 fontSize: font.size.caption,
 lineHeight: 13,
 marginRight: 4,
 includeFontPadding: false,
 },

 chipRemoveCompact: {
 color: color.textTertiary,
 fontSize: font.size.meta,
 fontWeight: font.weight.heavy,
 },

 chipText: {
 color: color.textPrimary,
 fontSize: font.size.meta,
 marginRight: spacing.xs,
 },

 chipRemove: {
 color: color.textTertiary,
 fontSize: 14,
 fontWeight: font.weight.heavy,
 },

 addCircle: {
 width: 28,
 height: 28,
 borderRadius: 14,
 borderWidth: 1,
 borderColor: primitive.neutral[300],
 backgroundColor: color.surface,
 alignItems: 'center',
 justifyContent: 'center',
 },

 addCircleText: {
 color: color.textSecondary,
 fontSize: font.size.bodyLarge,
 fontWeight: font.weight.heavy,
 lineHeight: 16,
 },

 selectCircle28: {
 width: 28,
 height: 28,
 borderRadius: 14,
 borderWidth: 1,
 alignItems: 'center',
 justifyContent: 'center',
 },

 selectCircle36: {
 width: 36,
 height: 36,
 borderRadius: 18,
 borderWidth: 1,
 alignItems: 'center',
 justifyContent: 'center',
 },

 selectCircle40: {
 width: 40,
 height: 40,
 borderRadius: 20,
 borderWidth: 2,
 alignItems: 'center',
 justifyContent: 'center',
 },

 selectCircle40Thin: {
 width: 40,
 height: 40,
 borderRadius: 20,
 borderWidth: 1,
 alignItems: 'center',
 justifyContent: 'center',
 },

 selectCircleOff: {
 borderColor: primitive.neutral[300],
 backgroundColor: color.surface,
 },

 selectCircleOn: {
 borderColor: color.primary,
 backgroundColor: color.primary,
 },

 selectCircleText: {
 fontSize: font.size.meta,
 fontWeight: font.weight.heavy,
 color: color.textSecondary,
 includeFontPadding: false,
 textAlign: 'center',
 },

 selectCircleTextOn: {
 color: color.textInverse,
 },

 radioRowCompact: {
 flexDirection: 'row',
 alignItems: 'center',
 paddingVertical: 10,
 paddingHorizontal: spacing.sm,
 borderRadius: radius.md,
 },

 radioOuterNeutral: {
 width: 18,
 height: 18,
 borderRadius: 9,
 borderWidth: 2,
 borderColor: color.primary,
 alignItems: 'center',
 justifyContent: 'center',
 marginRight: 10,
 },

 radioOuterInfoOn: {
 borderColor: color.info,
 },

 radioInnerInfo: {
 width: 8,
 height: 8,
 borderRadius: 4,
 backgroundColor: color.info,
 },

 choiceWrap: {
 flexDirection: 'row',
 flexWrap: 'wrap',
 gap: spacing.sm,
 marginTop: spacing.md,
 },

 choicePill: {
 paddingVertical: spacing.sm,
 paddingHorizontal: spacing.md,
 borderRadius: radius.pill,
 backgroundColor: color.surfaceMuted,
 },

 choicePillOutline: {
 borderWidth: 1,
 borderColor: color.primary,
 backgroundColor: color.surface,
 },

 choicePillActive: {
 backgroundColor: color.primary,
 borderColor: color.primary,
 },

 choiceText: {
 color: color.textPrimary,
 fontSize: font.size.body,
 fontWeight: font.weight.heavy,
 },

 choiceTextActive: {
 color: color.textInverse,
 },
});

export const badge = StyleSheet.create({
 neutral: {
 borderRadius: radius.pill,
 backgroundColor: color.surfaceMuted,
 paddingHorizontal: spacing.sm,
 paddingVertical: 4,
 },
 success: {
 borderRadius: radius.pill,
 backgroundColor: color.successBg,
 paddingHorizontal: spacing.sm,
 paddingVertical: 4,
 },
 warning: {
 borderRadius: radius.pill,
 backgroundColor: color.warningBg,
 paddingHorizontal: spacing.sm,
 paddingVertical: 4,
 },
 danger: {
 borderRadius: radius.pill,
 backgroundColor: color.dangerBg,
 paddingHorizontal: spacing.sm,
 paddingVertical: 4,
 },
 info: {
 borderRadius: radius.pill,
 backgroundColor: color.infoBg,
 paddingHorizontal: spacing.sm,
 paddingVertical: 4,
 },
});

export const appHeader = StyleSheet.create({
 standardContainer: {
 flexDirection: 'row',
 alignItems: 'center',
 paddingHorizontal: spacing.lg,
 paddingVertical: spacing.md,
 backgroundColor: 'transparent',
 },

 compactContainer: {
 minHeight: 58,
 paddingHorizontal: spacing.lg,
 paddingTop: spacing.sm,
 paddingBottom: 10,
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 backgroundColor: color.background,
 },

 backButton: {
 width: 38,
 height: 38,
 alignItems: 'center',
 justifyContent: 'center',
 zIndex: 2,
 },

 backIcon: {
 fontSize: 32,
 fontWeight: '300',
 lineHeight: 32,
 includeFontPadding: false,
 marginTop: -8,
 color: color.textPrimary,
 },

 title: {
 position: 'absolute',
 left: 0,
 right: 0,
 textAlign: 'center',
 fontSize: font.size.title,
 fontWeight: font.weight.heavy,
 color: color.textPrimary,
 zIndex: -1,
 },

 compactTitle: {
 position: 'absolute',
 left: 0,
 right: 0,
 textAlign: 'center',
 fontSize: 18,
 fontWeight: font.weight.heavy,
 color: color.textPrimary,
 zIndex: 1,
 },

 spacer: {
 width: 38,
 height: 38,
 },
});

export const header = {
 titleAlign: 'center',
 headerStyle: { backgroundColor: color.background },
 headerTintColor: color.primary,
 headerShadowVisible: false,
};

/**
 * 앱 전체 공용 디자인 canonical registry.
 *
 * 기존 export 객체를 복제하지 않고 같은 identity로 참조한다.
 * 화면별 전환 작업은 이 registry의 공식 token과 component를
 * 기준으로 순차 진행한다.
 */
export const APP_DESIGN_SYSTEM_STANDARD = Object.freeze({
 version: APP_DESIGN_SYSTEM_VERSION,
 name: 'THE_PUSH',
 sourceOfTruth:
  APP_DESIGN_SYSTEM_POLICY.sourceOfTruth,
 policy:
  APP_DESIGN_SYSTEM_POLICY,
 tokens: Object.freeze({
  primitive,
  color,
  space,
  radius,
  font,
 }),
 components: Object.freeze({
  surface,
  layout,
  buttonStyles,
  text,
  card,
  input,
  modal,
  control,
  badge,
  appHeader,
  header,
 }),
 compatibility: Object.freeze({
  colors,
  spacing,
 }),
 canonical: true,
});
