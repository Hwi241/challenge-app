// utils/number.js
// 숫자 전용 입력을 쉽게 처리하기 위한 유틸
// - sanitizeNumber: 숫자 외 문자를 제거
// - toNumberOrZero: 숫자 변환 실패 시 0 반환
// - createNumberChangeHandler: setState에 바로 연결해 쓰는 onChangeText 헬퍼

export function sanitizeNumber(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[^\d]/g, ''); // 0-9만 허용
}

export function toNumberOrZero(text) {
  const cleaned = sanitizeNumber(String(text ?? ''));
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// 사용 예시:
// const [goal, setGoal] = useState('');
// <TextInput onChangeText={createNumberChangeHandler(setGoal)} ... />
export function createNumberChangeHandler(setter) {
  return (input) => {
    setter(sanitizeNumber(input));
  };
}

// TextInput에 기본으로 넣기 좋은 프롭 모음
// platform 별 키보드 차이를 줄이기 위한 권장 세팅
export const numericInputProps = {
  keyboardType: 'numeric', // 안드로이드: 숫자 전용
  inputMode: 'numeric',    // iOS에서도 숫자 전용 힌트
  maxLength: 9,            // 필요시 조정
};
