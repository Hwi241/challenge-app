// challenge-app/styles/card.js
import { StyleSheet } from 'react-native';
import { colors, spacing, radius } from './common';

/**
 * 카드 기본 스타일
 * - 공통 디자인 토큰을 바라보는 카드 기준 스타일
 * - 카드 라운딩은 THE PUSH Design System v1 기준인 radius.card를 사용
 */
const cardStyles = StyleSheet.create({
 container: {
 backgroundColor: colors.surface,
 borderRadius: radius.card,
 borderWidth: 1,
 borderColor: colors.border,
 paddingVertical: spacing.md,
 paddingHorizontal: spacing.md,
 },
});

export default cardStyles;
export { cardStyles };
