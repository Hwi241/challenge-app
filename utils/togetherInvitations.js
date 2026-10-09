import AsyncStorage from '@react-native-async-storage/async-storage';

export const TOGETHER_INVITATIONS_KEY = 'together_invitations_v1';
export const TOGETHER_INVITATION_VERSION = 1;

const LINK_PREFIX = 'thepush://together/invite?data=';
const safeArray = (value) => (Array.isArray(value) ? value : []);

const parseArray = (raw) => {
  if (!raw) return [];
  try {
    return safeArray(JSON.parse(raw));
  } catch {
    return [];
  }
};

const safeText = (value, fallback = '', maxLength = 120) => String(value ?? fallback).trim().slice(0, maxLength);

const makeDefaultInvitationId = (now) => `together_invite_${Math.trunc(now).toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const normalizePublicPayload = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const version = Number(raw.v ?? raw.version);
  if (version !== TOGETHER_INVITATION_VERSION) return null;
  const invitationId = safeText(raw.i ?? raw.invitationId, '', 100);
  const title = safeText(raw.t ?? raw.title, '', 120);
  const typeLabel = safeText(raw.k ?? raw.typeLabel, '', 20);
  const sharePolicy = safeText(raw.p ?? raw.sharePolicy, '', 40);
  const createdAt = Number(raw.c ?? raw.createdAt);
  if (!invitationId || !title || !typeLabel || sharePolicy !== 'completion_only' || !Number.isFinite(createdAt) || createdAt <= 0) return null;
  return {
    version: TOGETHER_INVITATION_VERSION,
    invitationId,
    title,
    typeLabel,
    sharePolicy,
    createdAt,
  };
};

export const buildTogetherInvitationLink = (payload) => {
  const normalized = normalizePublicPayload(payload);
  if (!normalized) throw new Error('TOGETHER_INVITATION_INVALID_PAYLOAD');
  const compactPayload = {
    v: normalized.version,
    i: normalized.invitationId,
    t: normalized.title,
    k: normalized.typeLabel,
    p: normalized.sharePolicy,
    c: normalized.createdAt,
  };
  return LINK_PREFIX + encodeURIComponent(JSON.stringify(compactPayload));
};

export const parseTogetherInvitationLink = (link) => {
  const value = String(link ?? '').trim();
  if (!value.startsWith(LINK_PREFIX)) return null;
  const encoded = value.slice(LINK_PREFIX.length);
  if (!encoded) return null;
  try {
    return normalizePublicPayload(JSON.parse(decodeURIComponent(encoded)));
  } catch {
    return null;
  }
};

const normalizeStoredInvitation = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const id = safeText(raw.id, '', 100);
  const draftId = safeText(raw.draftId, '', 160);
  const challengeId = safeText(raw.challengeId, '', 160);
  const title = safeText(raw.title, '', 120);
  const typeLabel = safeText(raw.typeLabel, '', 20);
  const createdAt = Number(raw.createdAt);
  const updatedAt = Number(raw.updatedAt);
  const payload = (
    normalizePublicPayload(
      raw.payload
    )
  );

  const link = safeText(
    raw.link,
    '',
    2000
  );

  if (
    !id
    || !draftId
    || !challengeId
    || !title
    || !typeLabel
    || !payload
    || !link
    || !Number.isFinite(
      createdAt
    )
    || createdAt <= 0
  ) {
    return null;
  }

  return {
    id,
    status: 'ready',
    draftId,
    challengeId,
    title,
    typeLabel,
    sharePolicy: 'completion_only',
    createdAt,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : createdAt,
    payload,
    link,
  };
};

const writeInvitations = async ({ storage, invitations }) => {
  await storage.setItem(TOGETHER_INVITATIONS_KEY, JSON.stringify(invitations));
};

export const loadTogetherInvitations = async ({ storage = AsyncStorage } = {}) => {
  const raw = await storage.getItem(TOGETHER_INVITATIONS_KEY);
  return parseArray(raw).map(normalizeStoredInvitation).filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt);
};

export const loadTogetherInvitationByDraftId = async ({ draftId, storage = AsyncStorage } = {}) => {
  const id = safeText(draftId, '', 160);
  if (!id) return null;
  const invitations = await loadTogetherInvitations({ storage });
  return invitations.find((item) => item.draftId === id) || null;
};

export const createOrReuseTogetherInvitation = async ({
  draft,
  storage = AsyncStorage,
  now = Date.now(),
  invitationIdFactory = makeDefaultInvitationId,
} = {}) => {
  if (!draft || !draft.id || !draft.challengeId) throw new Error('TOGETHER_INVITATION_DRAFT_REQUIRED');
  const timestamp = Number(now);
  const safeTimestamp = Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now();
  const invitations = await loadTogetherInvitations({ storage });
  const existingIndex = invitations.findIndex((item) => item.draftId === String(draft.id));
  const existing = existingIndex >= 0 ? invitations[existingIndex] : null;
  const invitationId = existing?.id || safeText(invitationIdFactory(safeTimestamp), '', 100);
  if (!invitationId) throw new Error('TOGETHER_INVITATION_ID_REQUIRED');
  const createdAt = existing?.createdAt || safeTimestamp;
  const title = safeText(draft.title, '함께 활동', 120);
  const typeLabel = safeText(draft.typeLabel, '도전', 20);
  const compactPayload = {
    v: TOGETHER_INVITATION_VERSION,
    i: invitationId,
    t: title,
    k: typeLabel,
    p: 'completion_only',
    c: createdAt,
  };
  const payload = normalizePublicPayload(compactPayload);
  const link = buildTogetherInvitationLink(compactPayload);
  const invitation = {
    id: invitationId,
    status: 'ready',
    draftId: String(draft.id),
    challengeId: String(draft.challengeId),
    title,
    typeLabel,
    sharePolicy: 'completion_only',
    createdAt,
    updatedAt: safeTimestamp,
    payload,
    link,
  };
  if (existingIndex >= 0) invitations.splice(existingIndex, 1);
  await writeInvitations({ storage, invitations: [invitation, ...invitations] });
  return invitation;
};
