const asArray = (value) =>
  Array.isArray(value) ? value : [];

const text = (value) =>
  String(value ?? '').trim();

const positiveNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) && number >= 0
    ? number
    : null;
};

export const getTogetherRoomDateKeyV3 = (
  now = Date.now(),
  timezone = 'Asia/Seoul'
) => {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) return '';

  if (timezone === 'Asia/Seoul') {
    const korea = new Date(date.getTime() + 9 * 3600000);
    return [
      korea.getUTCFullYear(),
      String(korea.getUTCMonth() + 1).padStart(2, '0'),
      String(korea.getUTCDate()).padStart(2, '0'),
    ].join('-');
  }

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const part = (type) =>
      parts.find((item) => item.type === type)?.value || '';

    const year = part('year');
    const month = part('month');
    const day = part('day');

    return year && month && day
      ? `${year}-${month}-${day}`
      : '';
  } catch {
    return '';
  }
};

export const buildTogetherRoomOverviewV3 = ({
  room,
  members,
  now = Date.now(),
} = {}) => {
  const mode = text(room?.mode);
  const todayKey = getTogetherRoomDateKeyV3(
    now,
    text(room?.timezone) || 'Asia/Seoul'
  );

  const activeMembers = asArray(members)
    .filter((member) => member?.status === 'active')
    .map((member) => {
      const state = member?.state;
      const validState =
        state &&
        typeof state === 'object' &&
        !Array.isArray(state)
          ? state
          : null;

      const isCurrent =
        Boolean(todayKey) &&
        text(validState?.localDate) === todayKey;

      const activity = !isCurrent ||
        typeof validState?.completed !== 'boolean'
          ? 'unknown'
          : validState.completed
            ? 'done'
            : 'not_done';

      return {
        ...member,
        name: text(member.displayName) || '멤버',
        activity,
        progress: positiveNumber(validState?.progress),
        streak: positiveNumber(validState?.streak),
        contribution: positiveNumber(validState?.contribution),
      };
    });

  const owner = activeMembers.find(
    (member) =>
      text(member.userId) === text(room?.ownerUserId)
  ) || activeMembers.find(
    (member) => member.role === 'owner'
  ) || null;

  const trackedMembers = mode === 'watch'
    ? owner ? [owner] : []
    : activeMembers;

  const completedCount = trackedMembers.filter(
    (member) => member.activity === 'done'
  ).length;

  const knownCount = trackedMembers.filter(
    (member) => member.activity !== 'unknown'
  ).length;

  const contributionMembers = activeMembers.filter(
    (member) => member.contribution !== null
  );

  const contributionTotal = contributionMembers.reduce(
    (sum, member) => sum + member.contribution,
    0
  );

  const rawTarget = positiveNumber(room?.sharedGoal?.target);
  const target = rawTarget !== null && rawTarget > 0
    ? rawTarget
    : null;

  const percentage = target === null ||
    contributionMembers.length === 0
      ? null
      : Math.min(
          100,
          Math.max(0, contributionTotal / target * 100)
        );

  return {
    mode,
    todayKey,
    members: activeMembers,
    owner,
    supporterCount: owner
      ? Math.max(0, activeMembers.length - 1)
      : 0,
    trackedCount: trackedMembers.length,
    completedCount,
    knownCount,
    unknownCount: trackedMembers.length - knownCount,
    contributionKnownCount: contributionMembers.length,
    contributionTotal,
    target,
    percentage,
    unit: text(room?.sharedGoal?.unit),
  };
};
