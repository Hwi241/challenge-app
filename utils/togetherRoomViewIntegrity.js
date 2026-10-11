const asArray = (value) =>
  Array.isArray(value) ? value : [];

const asText = (value) =>
  String(value ?? '').trim();

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getServerRoomId = (value) => {
  if (!value || typeof value !== 'object') {
    return '';
  }

  const candidates = [
    value.serverRoomId,
    value.roomId,
    value.room_id,
    value.room?.id,
    value.id,
  ];

  for (const candidate of candidates) {
    const id = asText(candidate);

    if (UUID_PATTERN.test(id)) {
      return id.toLowerCase();
    }
  }

  return '';
};

const getAcceptedRoom = (value) =>
  value?.room || value;

export const resolveTogetherRoomPresentation = ({
  remoteRows = [],
  acceptedRows = [],
  drafts = [],
  invitations = [],
} = {}) => {
  const remoteIds = new Set();
  const visibleRemoteRows = [];

  for (const row of asArray(remoteRows)) {
    const roomId = getServerRoomId(row);

    if (roomId && remoteIds.has(roomId)) {
      continue;
    }

    if (roomId) {
      remoteIds.add(roomId);
    }

    visibleRemoteRows.push(row);
  }

  const acceptedIds = new Set();
  const visibleAcceptedRows = [];

  for (const row of asArray(acceptedRows)) {
    const roomId = getServerRoomId(
      getAcceptedRoom(row)
    );

    if (
      roomId &&
      (
        remoteIds.has(roomId) ||
        acceptedIds.has(roomId)
      )
    ) {
      continue;
    }

    if (roomId) {
      acceptedIds.add(roomId);
    }

    visibleAcceptedRows.push(row);
  }

  const draftRoomIds = new Map();

  for (const invitation of asArray(invitations)) {
    const draftId = asText(invitation?.draftId);
    const roomId = getServerRoomId(invitation);

    if (!draftId || !roomId) {
      continue;
    }

    if (!draftRoomIds.has(draftId)) {
      draftRoomIds.set(draftId, new Set());
    }

    draftRoomIds.get(draftId).add(roomId);
  }

  const visibleDrafts = asArray(drafts).filter(
    (draft) => {
      const associatedRoomIds = new Set(
        draftRoomIds.get(asText(draft?.id)) || []
      );

      const directRoomId = getServerRoomId(draft);

      if (directRoomId) {
        associatedRoomIds.add(directRoomId);
      }

      for (const roomId of associatedRoomIds) {
        if (
          remoteIds.has(roomId) ||
          acceptedIds.has(roomId)
        ) {
          return false;
        }
      }

      return true;
    }
  );

  return {
    remoteRows: visibleRemoteRows,
    acceptedRows: visibleAcceptedRows,
    drafts: visibleDrafts,

    suppressedCount:
      asArray(remoteRows).length -
        visibleRemoteRows.length +
      asArray(acceptedRows).length -
        visibleAcceptedRows.length +
      asArray(drafts).length -
        visibleDrafts.length,
  };
};
