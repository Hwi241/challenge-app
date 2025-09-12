// challenge-app/styles/card.js
import { StyleSheet } from 'react-native';
import { colors, spacing, radius } from './common';

/**
 * 카드 기본 스타일
 * - 기존 카드 모양을 해치지 않게 아주 중립적으로만 정의
 * - 각 화면이 여백/테두리를 덮어써도 문제 없도록 최소 토큰만 사용
 */
const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
});

export default cardStyles;
export { cardStyles };
