import { CHALLENGE_TYPE, getChallengeType } from './challengeType';
import { loadChallenges, upsertChallenge } from './challengeStore';
import { createAndSaveRotationRoutine } from './rotationRoutineStore';
import { syncWidgetChallengeList } from './widgetSync';

const text = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const roomLocalId = (roomId) => `together_${String(roomId ?? '').replace(/-/g, '')}`;

export const buildTogetherPushTemplate = (card) => {
  if (!card) throw new Error('TOGETHER_TEMPLATE_CARD_REQUIRED');
  const type = getChallengeType(card);
  const base = { version: 1, type, title: text(card.title, 120), description: text(card.description) };
  if (type === CHALLENGE_TYPE.ROTATION) {
    const items = card?.rotation?.items || card?.rotationItems || [];
    return { ...base, rotationItems: items.map((item) => ({ name: text(item?.name, 120), targetSeconds: Math.max(1, Number(item?.targetSeconds) || 1) })) };
  }
  if (type === CHALLENGE_TYPE.HABIT) {
    return { ...base, startDate: card.startDate || null, endDate: card.endDate || null, habitCycle: card.habitCycle || null };
  }
  return { ...base, goalScore: Math.max(1, Number(card.goalScore) || 1), startDate: card.startDate || null, endDate: card.endDate || null };
};

export const createLocalPushFromTogetherTemplate = async ({ template, roomId, now = Date.now() } = {}) => {
  const id = roomLocalId(roomId);
  if (!id || !template?.type) throw new Error('TOGETHER_TEMPLATE_REQUIRED');
  const existing = (await loadChallenges()).find((item) => String(item.id) === id);
  if (existing) return existing;
  if (template.type === CHALLENGE_TYPE.ROTATION) {
    const result = await createAndSaveRotationRoutine({ id, title: text(template.title, 120), description: text(template.description), items: (template.rotationItems || []).map((item) => ({ name: text(item.name, 120), targetSeconds: Math.max(1, Number(item.targetSeconds) || 1) })) });
    return result.routine;
  }
  const challenge = await upsertChallenge({
    id, type: template.type, title: text(template.title, 120), description: text(template.description),
    goalScore: template.type === CHALLENGE_TYPE.CHALLENGE ? Math.max(1, Number(template.goalScore) || 1) : 0,
    currentScore: 0, startDate: template.startDate || null, endDate: template.endDate || null,
    habitCycle: template.type === CHALLENGE_TYPE.HABIT ? template.habitCycle || null : undefined,
    notification: { mode: null, payload: null }, reward: '', status: 'active', completedAt: 0,
    createdAt: now, updatedAt: now,
  });
  await syncWidgetChallengeList();
  return challenge;
};
