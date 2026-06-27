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

 success: color.success,
 successBg: color.successBg,
 warning: color.warning,
 warningBg: color.warningBg,
 danger: color.danger,
 dangerBg: color.dangerBg,
 info: color.info,
 infoBg: color.infoBg,
 star: color.star,
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
});

export const card = StyleSheet.create({
 base: {
 backgroundColor: color.surface,
 borderColor: color.border,
 borderWidth: 1,
 borderRadius: radius.card,
 padding: spacing.lg,
 },
 compact: {
 backgroundColor: color.surface,
 borderColor: color.border,
 borderWidth: 1,
 borderRadius: radius.card,
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

export const header = {
 titleAlign: 'center',
 headerStyle: { backgroundColor: color.background },
 headerTintColor: color.primary,
 headerShadowVisible: false,
};
