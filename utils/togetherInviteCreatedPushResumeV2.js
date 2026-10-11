const asId = (value) =>
  String(value ?? '').trim();

export const resolveTogetherCreatedPushResumeV2 = ({
  result,
  createdPushId,
  cards,
} = {}) => {
  const pushId = asId(createdPushId);
  const roomId = asId(result?.roomId);
  const mode = asId(result?.mode);
  const joinStatus = asId(result?.joinStatus);

  if (!pushId) {
    return {
      status: 'no-push',
      card: null,
    };
  }

  if (
    !roomId ||
    joinStatus !== 'active' ||
    (
      mode !== 'paired_push' &&
      mode !== 'shared_goal'
    )
  ) {
    return {
      status: 'invalid-acceptance',
      card: null,
    };
  }

  const card = (
    Array.isArray(cards) ? cards : []
  ).find(
    (item) =>
      asId(item?.id) === pushId
  );

  if (!card) {
    return {
      status: 'card-not-found',
      card: null,
    };
  }

  return {
    status: 'ready',
    card,
    roomId,
    mode,
  };
};
