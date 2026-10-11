const asText = (value) =>
  String(value ?? '').trim();

export const formatTogetherStateDateV2 = (
  value
) => {
  const raw = asText(value);

  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    raw
  );

  if (!matched) {
    return '';
  }

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return '';
  }

  return [
    matched[1],
    matched[2],
    matched[3],
  ].join('.');
};

const pad2 = (value) =>
  String(value).padStart(2, '0');

export const formatTogetherStateSyncTimeV2 = (
  value
) => {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '';
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return '';
  }

  return (
    `${date.getFullYear()}.` +
    `${pad2(date.getMonth() + 1)}.` +
    `${pad2(date.getDate())} ` +
    `${pad2(date.getHours())}:` +
    `${pad2(date.getMinutes())}`
  );
};

export const getTogetherMemberActivityDisplayV2 = (
  member
) => {
  const active =
    member?.status === 'active';

  const state =
    active &&
    member?.state &&
    typeof member.state === 'object' &&
    !Array.isArray(member.state)
      ? member.state
      : null;

  const localDate =
    formatTogetherStateDateV2(
      state?.localDate
    );

  const syncedAt =
    formatTogetherStateSyncTimeV2(
      state?.updatedAt
    );

  const hasCompletion =
    Boolean(localDate) &&
    typeof state?.completed === 'boolean';

  let completionLabel =
    '활동 상태 미수신';

  if (!active) {
    completionLabel =
      '참가 상태 확인 필요';
  } else if (hasCompletion) {
    completionLabel =
      state.completed
        ? '기준일 완료'
        : '기준일 미완료';
  }

  return {
    completionLabel,
    dateLabel: localDate
      ? `활동 기준 ${localDate}`
      : '',
    syncedLabel: syncedAt
      ? `마지막 상태 동기화 ${syncedAt}`
      : '',
    hasCompletion,
  };
};
