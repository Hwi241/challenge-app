export const REWARD_FEEDBACK_KIND = {
  XP: 'xp',
  STAR: 'star',
};

const MAX_PENDING = 12;
const MAX_PENDING_AGE_MS = 6000;

let nextId = 1;
let listeners = new Set();
let pending = [];

const normalizeAmount = (value) => {
  const numeric = Math.floor(Number(value) || 0);
  return Math.max(0, numeric);
};

const prunePending = () => {
  const cutoff = Date.now() - MAX_PENDING_AGE_MS;

  pending = pending
    .filter((event) => event.createdAt >= cutoff)
    .slice(-MAX_PENDING);
};

export const emitRewardFeedback = (kind, amount, meta = {}) => {
  const normalizedAmount = normalizeAmount(amount);

  if (
    normalizedAmount <= 0
    || !Object.values(REWARD_FEEDBACK_KIND).includes(kind)
  ) {
    return null;
  }

  const event = {
    id: `reward_feedback_${nextId++}`,
    kind,
    amount: normalizedAmount,
    createdAt: Date.now(),
    meta,
  };

  if (listeners.size === 0) {
    prunePending();

    pending.push(event);
    pending = pending.slice(-MAX_PENDING);

    return event;
  }

  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.warn('[RewardFeedback] listener failed', error);
    }
  });

  return event;
};

export const subscribeRewardFeedback = (listener) => {
  if (typeof listener !== 'function') {
    return () => {};
  }

  listeners.add(listener);

  prunePending();

  if (pending.length > 0) {
    const queued = [...pending];
    pending = [];

    queued.forEach((event) => {
      try {
        listener(event);
      } catch (error) {
        console.warn('[RewardFeedback] queued listener failed', error);
      }
    });
  }

  return () => {
    listeners.delete(listener);
  };
};
