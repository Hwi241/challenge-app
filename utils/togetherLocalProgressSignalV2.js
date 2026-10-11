const listeners = new Set();

export const emitTogetherLocalProgressChangedV2 = () => {
  for (const listener of Array.from(listeners)) {
    try {
      listener();
    } catch (error) {
      console.warn(
        '[Together] local progress listener failed',
        String(error?.message || 'unknown')
      );
    }
  }
};

export const subscribeTogetherLocalProgressV2 = (
  listener
) => {
  if (typeof listener !== 'function') {
    throw new Error('TOGETHER_SYNC_LISTENER_REQUIRED');
  }

  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};
