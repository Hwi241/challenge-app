const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const getTogetherWeeklyDateRelationV4 = (
  localDate,
  todayKey
) => {
  const date = String(localDate ?? '');
  const today = String(todayKey ?? '');

  if (
    !DATE_PATTERN.test(date)
    || !DATE_PATTERN.test(today)
  ) {
    return 'invalid';
  }

  if (date === today) return 'today';
  if (date < today) return 'past';

  return 'future';
};

export const getTogetherWeeklyDayPresentationV4 = ({
  status,
  localDate,
  todayKey,
} = {}) => {
  const relation = getTogetherWeeklyDateRelationV4(
    localDate,
    todayKey
  );

  if (relation === 'invalid') {
    return {
      symbol: '?',
      label: '기록 확인 실패',
      relation,
    };
  }

  if (relation === 'future') {
    return {
      symbol: '–',
      label: '아직 오지 않은 날',
      relation,
    };
  }

  if (status === 'unknown') {
    return {
      symbol: '?',
      label: '기록 확인 실패',
      relation,
    };
  }

  if (status === 'off') {
    return {
      symbol: '–',
      label: '활동 제외',
      relation,
    };
  }

  if (status === 'done') {
    return {
      symbol: '✓',
      label: '완료',
      relation,
    };
  }

  if (status === 'pending') {
    return relation === 'today'
      ? {
          symbol: '·',
          label: '오늘 미기록',
          relation,
        }
      : {
          symbol: '✕',
          label: '미완료',
          relation,
        };
  }

  return {
    symbol: '?',
    label: '기록 확인 실패',
    relation,
  };
};
