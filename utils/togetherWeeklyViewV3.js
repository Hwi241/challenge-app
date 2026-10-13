const DAY_MS = 86400000;

const STATUS = Object.freeze({
  done: 'done',
  pending: 'pending',
  off: 'off',
  unknown: 'unknown',
});

const text = (value) =>
  String(value ?? '').trim();

const dateTime = (value) => {
  const key = text(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    return null;
  }

  const timestamp =
    Date.parse(`${key}T00:00:00Z`);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp)
    .toISOString()
    .slice(0, 10) === key
    ? timestamp
    : null;
};

const safeStatus = (value) =>
  Object.prototype.hasOwnProperty.call(
    STATUS,
    value
  )
    ? STATUS[value]
    : STATUS.unknown;

export const buildTogetherWeeklyViewV3 = ({
  room,
  members = [],
  week,
} = {}) => {
  if (
    !room
    || !week
    || !Array.isArray(week.members)
  ) {
    return null;
  }

  const start = dateTime(week.startDate);
  const end = dateTime(week.endDate);

  if (
    start === null
    || end === null
    || end < start
    || end - start > DAY_MS * 6
  ) {
    return null;
  }

  const dates = [];

  for (
    let cursor = start;
    cursor <= end;
    cursor += DAY_MS
  ) {
    dates.push(
      new Date(cursor).toISOString().slice(0, 10)
    );
  }

  const localMembers = new Map(
    (Array.isArray(members) ? members : [])
      .filter((member) =>
        member?.status === 'active'
      )
      .map((member) => [
        text(member.userId),
        member,
      ])
  );

  const ownerId = text(room.ownerUserId);
  const mode = text(room.mode);
  const seen = new Set();

  const rows = week.members
    .filter((entry) => {
      const userId = text(entry?.userId);

      if (
        !userId
        || seen.has(userId)
        || !localMembers.has(userId)
      ) {
        return false;
      }

      if (
        mode === 'watch'
        && userId !== ownerId
      ) {
        return false;
      }

      seen.add(userId);
      return true;
    })
    .slice(0, 8)
    .map((entry) => {
      const userId = text(entry.userId);
      const member = localMembers.get(userId);

      const statuses = new Map();

      (Array.isArray(entry.days)
        ? entry.days
        : []
      ).forEach((day) => {
        const key = text(day?.localDate);

        if (
          !dates.includes(key)
          || statuses.has(key)
        ) {
          return;
        }

        const status = safeStatus(day?.status);

        if (status !== STATUS.unknown) {
          statuses.set(key, status);
        }
      });

      const days = dates.map((localDate) => ({
        localDate,
        status:
          statuses.get(localDate)
          || STATUS.unknown,
      }));

      return {
        userId,
        name:
          text(member?.displayName)
          || '멤버',
        role: text(member?.role),
        days,
        completedCount:
          days.filter(
            (day) => day.status === STATUS.done
          ).length,
        unknownCount:
          days.filter(
            (day) => day.status === STATUS.unknown
          ).length,
      };
    });

  const count = Number(week.memberCount);
  const memberCount =
    Number.isSafeInteger(count) && count >= 0
      ? count
      : rows.length;

  return {
    mode,
    dates,
    rows,
    memberCount,
    limited: memberCount > 8,
    startDate: week.startDate,
    endDate: week.endDate,
  };
};
