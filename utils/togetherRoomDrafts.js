import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTogetherCardTypeLabel } from './togetherLocalData';
import uuid from 'react-native-uuid';

export const TOGETHER_ROOM_DRAFTS_KEY = 'together_room_drafts_v1';
export const TOGETHER_ROOM_DRAFTS_V2_KEY = 'together_room_drafts_v2';

const safeArray = (value) => (Array.isArray(value) ? value : []);
const parseDrafts = (raw) => {
  if (!raw) return [];
  try {
    return safeArray(JSON.parse(raw));
  } catch {
    return [];
  }
};

const normalizeDraft = (raw) => {
  if (!raw || typeof raw !== 'object' || raw.id == null || raw.challengeId == null) return null;
  const createdAt = Number(raw.createdAt || 0);
  const updatedAt = Number(raw.updatedAt || createdAt || 0);
  return {
    id: String(raw.id),
    status: raw.status === 'draft' ? 'draft' : 'draft',
    challengeId: String(raw.challengeId),
    title: String(raw.title || '함께 활동'),
    typeLabel: String(raw.typeLabel || '도전'),
    sharePolicy: 'completion_only',
    createdAt: Number.isFinite(createdAt) ? createdAt : 0,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
  };
};

const writeDrafts = async ({ storage, drafts }) => {
  await storage.setItem(TOGETHER_ROOM_DRAFTS_KEY, JSON.stringify(drafts));
};

export const loadTogetherRoomDrafts = async ({ storage = AsyncStorage } = {}) => {
  const raw = await storage.getItem(TOGETHER_ROOM_DRAFTS_KEY);
  return parseDrafts(raw)
    .map(normalizeDraft)
    .filter(Boolean)
    .filter((draft) => draft.status === 'draft')
    .sort((a, b) => b.updatedAt - a.updatedAt);
};

export const createOrReuseTogetherRoomDraft = async ({ card, storage = AsyncStorage, now = Date.now() } = {}) => {
  if (!card || card.id == null) throw new Error('TOGETHER_DRAFT_CARD_REQUIRED');
  const challengeId = String(card.id);
  const drafts = await loadTogetherRoomDrafts({ storage });
  const existingIndex = drafts.findIndex((draft) => draft.challengeId === challengeId);
  const timestamp = Number(now);
  const safeTimestamp = Number.isFinite(timestamp) ? timestamp : Date.now();
  const base = {
    status: 'draft',
    challengeId,
    title: String(card.title || '함께 활동'),
    typeLabel: getTogetherCardTypeLabel(card),
    sharePolicy: 'completion_only',
    updatedAt: safeTimestamp,
  };

  let draft;
  if (existingIndex >= 0) {
    draft = { ...drafts[existingIndex], ...base };
    drafts.splice(existingIndex, 1);
  } else {
    draft = {
      id: `together_draft_${safeTimestamp}_${challengeId}`,
      ...base,
      createdAt: safeTimestamp,
    };
  }

  await writeDrafts({ storage, drafts: [draft, ...drafts] });
  return draft;
};

export const loadTogetherRoomDraftById = async ({ draftId, storage = AsyncStorage } = {}) => {
  const id = String(draftId ?? '').trim();
  if (!id) return null;
  const drafts = await loadTogetherRoomDrafts({ storage });
  return drafts.find((draft) => draft.id === id) || null;
};

const normalizeDraftV2 = (raw) => raw?.id && raw?.requestId && raw?.mode && raw?.challengeId ? {
  id: String(raw.id), status: 'draft', requestId: String(raw.requestId), mode: String(raw.mode),
  challengeId: String(raw.challengeId), title: String(raw.title || '함께 활동'),
  typeLabel: String(raw.typeLabel || '도전'), sharedGoal: raw.sharedGoal || null,
  roomId: String(raw.roomId || ''), inviteCode: String(raw.inviteCode || ''),
  inviteExpiresAt: String(raw.inviteExpiresAt || ''),
  createdAt: Number(raw.createdAt) || 0, updatedAt: Number(raw.updatedAt) || 0,
} : null;
const writeV2 = (storage, drafts) => storage.setItem(TOGETHER_ROOM_DRAFTS_V2_KEY, JSON.stringify(drafts));
export const loadTogetherRoomDraftsV2 = async ({ storage = AsyncStorage } = {}) =>
  parseDrafts(await storage.getItem(TOGETHER_ROOM_DRAFTS_V2_KEY)).map(normalizeDraftV2).filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt);
export const createTogetherRoomDraftV2 = async ({ mode, card, sharedGoal = null, storage = AsyncStorage, now = Date.now() } = {}) => {
  if (!mode || !card?.id) throw new Error('TOGETHER_DRAFT_INPUT_REQUIRED');
  const drafts = await loadTogetherRoomDraftsV2({ storage });
  const timestamp = Number(now) || Date.now();
  const draft = normalizeDraftV2({
    id: `together_v2_${timestamp}_${String(card.id)}`, requestId: uuid.v4(), mode,
    challengeId: String(card.id), title: String(card.title || '함께 활동'), typeLabel: getTogetherCardTypeLabel(card),
    sharedGoal, createdAt: timestamp, updatedAt: timestamp,
  });
  await writeV2(storage, [draft, ...drafts.filter((item) => item.id !== draft.id)]);
  return draft;
};
export const loadTogetherRoomDraftByIdV2 = async ({ draftId, storage = AsyncStorage } = {}) =>
  (await loadTogetherRoomDraftsV2({ storage })).find((item) => item.id === String(draftId)) || null;
export const updateTogetherRoomDraftRemoteV2 = async ({ draftId, roomId, inviteCode, inviteExpiresAt, storage = AsyncStorage, now = Date.now() } = {}) => {
  const drafts = await loadTogetherRoomDraftsV2({ storage });
  const index = drafts.findIndex((item) => item.id === String(draftId));
  if (index < 0) throw new Error('TOGETHER_DRAFT_NOT_FOUND');
  drafts[index] = normalizeDraftV2({ ...drafts[index], roomId, inviteCode, inviteExpiresAt, updatedAt: now });
  await writeV2(storage, drafts);
  return drafts[index];
};
export const cancelTogetherRoomDraftV2 = async ({ draftId, storage = AsyncStorage } = {}) => {
  const drafts = await loadTogetherRoomDraftsV2({ storage });
  await writeV2(storage, drafts.filter((item) => item.id !== String(draftId)));
};
