// styles/common.js
// 앱 전반에서 재사용할 공통 스타일 모음
// - Primary 버튼(검은색)
// - Compact Right 버튼(작고 오른쪽 정렬)
// - 간단한 색상/여백 토큰

import { StyleSheet } from 'react-native';

export const colors = {
  black: '#000000',
  white: '#FFFFFF',
  gray50: '#FAFAFA',
  gray100: '#F5F5F5',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray600: '#4B5563',
  gray800: '#1F2937',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 9999,
};

export const buttonStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.black,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  compactRight: {
    alignSelf: 'flex-end',
    backgroundColor: colors.black,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  compactRightText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 12,
  },
  disabled: {
    opacity: 0.5,
  },
});

export const chipStyles = StyleSheet.create({
  chip: {
    backgroundColor: colors.gray100,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 12,
    color: colors.gray800,
  },
});

export const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray800,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 12,
    color: colors.gray600,
  },
});
