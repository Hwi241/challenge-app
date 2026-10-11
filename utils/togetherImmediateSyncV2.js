import {
  syncTogetherBindingsOnce,
} from './togetherStateSync';

let activeTask = null;
let rerunRequested = false;

const runPendingSyncs = async () => {
  while (rerunRequested) {
    rerunRequested = false;

    try {
      await syncTogetherBindingsOnce();
    } catch (error) {
      console.warn(
        '[Together] immediate sync failed',
        String(error?.message || 'unknown')
      );
    }
  }
};

export const requestTogetherImmediateSyncV2 = () => {
  rerunRequested = true;

  if (!activeTask) {
    activeTask = runPendingSyncs().finally(() => {
      activeTask = null;

      if (rerunRequested) {
        void requestTogetherImmediateSyncV2();
      }
    });
  }

  return activeTask;
};
