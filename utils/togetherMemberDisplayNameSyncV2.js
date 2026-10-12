import {
  updateTogetherMemberDisplayNameV2,
} from './togetherRemoteV2';
import {
  loadTogetherDisplayName,
} from './togetherProfile';

const syncedNameByRoom = new Map();
const pendingByRoom = new Map();

export const syncTogetherMemberDisplayNameV2 = async ({
  roomId,
} = {}) => {
  const id = String(roomId ?? '').trim();

  if (!id) {
    throw new Error('TOGETHER_ROOM_REQUIRED');
  }

  const displayName = await loadTogetherDisplayName();

  if (syncedNameByRoom.get(id) === displayName) {
    return false;
  }

  const pending = pendingByRoom.get(id);

  if (pending?.displayName === displayName) {
    return pending.task;
  }

  const task = updateTogetherMemberDisplayNameV2({
    roomId: id,
    displayName,
  }).then((changed) => {
    syncedNameByRoom.set(id, displayName);
    return changed === true;
  }).finally(() => {
    if (pendingByRoom.get(id)?.task === task) {
      pendingByRoom.delete(id);
    }
  });

  pendingByRoom.set(id, {
    displayName,
    task,
  });

  return task;
};
