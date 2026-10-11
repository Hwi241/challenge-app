export const TOGETHER_MODES = Object.freeze({
  WATCH: 'watch',
  SAME_PUSH: 'same_push',
  PAIRED_PUSH: 'paired_push',
  SHARED_GOAL: 'shared_goal',
});

export const TOGETHER_MODE_OPTIONS = Object.freeze([
  { value: TOGETHER_MODES.WATCH, label: '내 PUSH 공유', description: '내 PUSH 진행 상태를 친구가 확인합니다.' },
  { value: TOGETHER_MODES.SAME_PUSH, label: '같은 PUSH 함께하기', description: '같은 PUSH를 각자 진행합니다.' },
  { value: TOGETHER_MODES.PAIRED_PUSH, label: '각자 PUSH 함께하기', description: '각자 다른 PUSH를 연결해 함께 확인합니다.' },
  { value: TOGETHER_MODES.SHARED_GOAL, label: '공동 목표 함께하기', description: '각자의 진행을 합쳐 공동 목표를 달성합니다.' },
]);

export const getTogetherModeOption = (mode) =>
  TOGETHER_MODE_OPTIONS.find((item) => item.value === mode) || null;
export const getTogetherModeLabel = (mode) =>
  getTogetherModeOption(mode)?.label || '함께 활동';
export const getTogetherModeDescription = (mode) =>
  getTogetherModeOption(mode)?.description || '';

export const normalizeTogetherInviteCode = (value) => {
  const code = String(value ?? '').trim().toUpperCase();
  return /^[A-Z0-9]{8,32}$/.test(code) ? code : '';
};

export const buildTogetherInviteLink = (code) => {
  const normalized = normalizeTogetherInviteCode(code);
  return normalized ? `thepush://j/${normalized}` : '';
};

export const parseTogetherInviteCode = (raw) => {
  const direct = normalizeTogetherInviteCode(raw);
  if (direct) return direct;
  try {
    const url = new URL(String(raw ?? '').trim());
    const parts = url.pathname.split('/').filter(Boolean);
    const candidate = url.protocol === 'thepush:' && url.hostname === 'j'
      ? parts[0]
      : parts.length >= 2 && parts[parts.length - 2] === 'j'
        ? parts[parts.length - 1]
        : '';
    return normalizeTogetherInviteCode(candidate);
  } catch {
    return '';
  }
};
