const text = (value) =>
  String(value ?? '').trim();

const normalizeCode = (value) =>
  text(value).toUpperCase();

export const findLocalOwnerInviteV2 = ({
  code,
  drafts = [],
} = {}) => {
  const target = normalizeCode(code);

  if (!target || !Array.isArray(drafts)) {
    return null;
  }

  for (const draft of drafts) {
    if (
      normalizeCode(draft?.inviteCode) !== target
    ) {
      continue;
    }

    const roomId = text(draft?.roomId);

    if (roomId) {
      return {
        roomId,
        draftId: text(draft?.id),
      };
    }
  }

  return null;
};

export const isVerifiedOwnerInviteV2 = ({
  snapshot,
  sessionUserId,
  expectedRoomId,
} = {}) => {
  const room = snapshot?.room;

  const userId = text(sessionUserId);
  const roomId = text(room?.id);
  const ownerId = text(room?.ownerUserId);
  const expectedId = text(expectedRoomId);

  return Boolean(
    userId &&
    roomId &&
    ownerId &&
    expectedId &&
    roomId === expectedId &&
    ownerId === userId &&
    room?.myRole === 'owner'
  );
};

export const resolveTogetherAcceptOutcomeV2 = ({
  joinStatus,
  roomId,
  bindingComplete = false,
} = {}) => {
  const status = text(joinStatus).toLowerCase();
  const id = text(roomId);

  if (status === 'pending') {
    return {
      state: 'pending',
      roomId: '',
    };
  }

  if (
    status === 'active' ||
    status === 'joined' ||
    status === 'accepted' ||
    status === 'complete'
  ) {
    if (id && bindingComplete === true) {
      return {
        state: 'complete',
        roomId: id,
      };
    }

    return {
      state: 'incomplete',
      roomId: '',
    };
  }

  return {
    state: 'unknown',
    roomId: '',
  };
};
