const asText = (value) =>
  String(value ?? '').trim();

export const getTogetherInvitePresenceV2 = (
  snapshot
) => {
  const room = snapshot?.room;

  if (
    !room ||
    typeof room !== 'object' ||
    !asText(room.id)
  ) {
    throw new Error(
      'TOGETHER_INVITE_SNAPSHOT_INVALID'
    );
  }

  const ownerUserId = asText(
    room.ownerUserId
  );

  if (
    !ownerUserId ||
    room.myRole !== 'owner'
  ) {
    return {
      status: 'unavailable',
      joinedCount: 0,
      joinedNames: [],
    };
  }

  const members = Array.isArray(
    snapshot?.members
  )
    ? snapshot.members
    : [];

  const joined = [];
  const seen = new Set();

  for (const member of members) {
    const userId = asText(
      member?.userId
    );

    if (
      !userId ||
      userId === ownerUserId ||
      seen.has(userId) ||
      member?.status !== 'active'
    ) {
      continue;
    }

    seen.add(userId);

    joined.push({
      userId,
      displayName:
        asText(member?.displayName)
        || '친구',
    });
  }

  return {
    status:
      joined.length > 0
        ? 'joined'
        : 'waiting',

    joinedCount: joined.length,

    joinedNames: joined.map(
      (member) => member.displayName
    ),
  };
};
