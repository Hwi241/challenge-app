// styles/common.js
import { StyleSheet } from 'react-native';

export const colors = {
  white: '#FFFFFF',
  gray500: '#737373',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  primary: '#111111',
  black: '#000000',
  gray800: '#111111',
  gray600: '#525252',
  gray400: '#9CA3AF',
  borderStrong: '#111111',
  borderSoft: '#D9D9D9',
};

export const spacing = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 36,
};

export const radius = {
  pill: 999,
  sm: 8,
  md: 12,
  lg: 16,
};

const textButton = {
  fontSize: 15,
  fontWeight: '700',
  color: colors.primary,
};

// 중첩(container/label) + 평평(flat) 동시 지원 (기존 코드 호환)
export const buttonStyles = {
  primary: {
    container: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      borderWidth: 1.5,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      ...textButton,
      color: colors.background,
    },
  },
  primaryText: { ...textButton, color: colors.background },

  outlineStrong: {
    container: {
      backgroundColor: colors.background,
      borderColor: colors.borderStrong,
      borderWidth: 2,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: { ...textButton, color: colors.primary },
  },
  outlineStrongText: { ...textButton, color: colors.primary },

  outlineSoft: {
    container: {
      backgroundColor: colors.background,
      borderColor: colors.borderSoft,
      borderWidth: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: { ...textButton, color: colors.primary, fontWeight: '600' },
  },
  outlineSoftText: { ...textButton, color: colors.primary, fontWeight: '600' },

  // ✅ 헤더 우측 소형 버튼(기존 compactRight = 검은 버튼)
  compactRight: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
    fontWeight: '700',
    color: colors.background,
  },

  // (남겨두되 미사용 가능) 흰 배경 아웃라인 소형 버튼
  headerRight: {
    container: {
      minWidth: 44,
      height: 34,
      paddingHorizontal: spacing.md,
      borderColor: colors.borderSoft,
      borderWidth: 1,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    label: { ...textButton, fontSize: 14, fontWeight: '600', color: colors.primary },
  },
};

export const text = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700', color: colors.primary },
  subtitle: { fontSize: 16, fontWeight: '600', color: colors.primary },
  body: { fontSize: 15, color: colors.primary },
  meta: { fontSize: 13, color: colors.gray600 },
});

export const card = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
});

export const header = {
  titleAlign: 'center',
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.primary,
  headerShadowVisible: false,
};
