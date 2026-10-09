export const KOREAN_WEEKDAYS =
  Object.freeze([
    '일',
    '월',
    '화',
    '수',
    '목',
    '금',
    '토',
  ]);

export const KOREAN_WEEKDAYS_WEEKDAY =
  Object.freeze([
    '월',
    '화',
    '수',
    '목',
    '금',
  ]);

export const KOREAN_WEEKDAYS_WEEKEND =
  Object.freeze([
    '토',
    '일',
  ]);

const KOREAN_WEEKDAY_INDEX =
  new Map(
    KOREAN_WEEKDAYS.map(
      (
        day,
        index
      ) => [
        day,
        index,
      ]
    )
  );

export const normalizeKoreanWeekdays =
  (
    value = []
  ) => {
    if (
      !Array.isArray(
        value
      )
    ) {
      return [];
    }

    const seen =
      new Set();

    return value
      .map(
        (
          day
        ) =>
          String(
            day
            ?? ''
          ).trim()
      )
      .filter(
        (
          day
        ) => {
          if (
            !KOREAN_WEEKDAY_INDEX.has(
              day
            )
            || seen.has(
              day
            )
          ) {
            return false;
          }

          seen.add(
            day
          );

          return true;
        }
      )
      .sort(
        (
          a,
          b
        ) => (
          KOREAN_WEEKDAY_INDEX.get(
            a
          )
          - KOREAN_WEEKDAY_INDEX.get(
            b
          )
        )
      );
  };

export const koreanWeekdayFromDate =
  (
    value
  ) => {
    const date =
      value instanceof Date
        ? value
        : new Date(
            value
          );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return null;
    }

    return (
      KOREAN_WEEKDAYS[
        date.getDay()
      ]
      ?? null
    );
  };
