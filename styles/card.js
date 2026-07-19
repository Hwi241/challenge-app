// challenge-app/styles/card.js
import { card as canonicalCardStyles } from './common';

/**
 * 기존 styles/card.js 호환 adapter.
 *
 * 앱 전체 카드 디자인의 canonical source of truth는
 * styles/common.js의 card 객체다.
 *
 * 기존 import 경로와 container 이름은 유지하면서
 * compact 카드 객체를 복제하지 않고 동일 identity로 참조한다.
 */
const cardStyles = Object.freeze({
 container: canonicalCardStyles.compact,
});

export default cardStyles;
export { cardStyles };
