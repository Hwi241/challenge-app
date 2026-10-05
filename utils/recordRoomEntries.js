const storedEntryArray = (parsed) => {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return [];
  for (const field of ['entries', 'items', 'data', 'list']) {
    if (Array.isArray(parsed[field])) return parsed[field];
  }
  return [];
};

const hasEntryIdentity = (item) => (
  item?.id != null
  || typeof item?.text === 'string'
  || typeof item?.imageUri === 'string'
  || Array.isArray(item?.linkedRecords)
  || Number(item?.duration) > 0
  || Number(item?.durationSeconds) > 0
);

const normalizeStoredEntry = (item, challengeId) => {
  if (!item || typeof item !== 'object' || !hasEntryIdentity(item)) return null;
  const date = new Date(item.timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return {
    ...item,
    id: item.id == null ? null : String(item.id),
    challengeId: String(challengeId),
    timestamp: date.toISOString(),
    duration: Number(item.duration ?? 0) || 0,
  };
};

const fallbackIdentity = (entry) => JSON.stringify([
  entry.challengeId,
  entry.timestamp,
  entry.text ?? null,
  entry.imageUri ?? null,
  entry.duration ?? 0,
  entry.durationSeconds ?? 0,
  entry.linkedRecords ?? null,
]);

const ownerIdentity = (card) => {
  const rawCID = String(card?.id ?? card?.challengeId ?? '');
  if (!rawCID) return null;
  const numCID = (rawCID.match(/\d+/g) || []).join('');
  const chCID = rawCID.startsWith('ch_') ? rawCID : (numCID ? `ch_${numCID}` : rawCID);
  const aliases = [
    `entries_${chCID}`,
    `entries_${rawCID}`,
    numCID ? `entries_${numCID}` : null,
    `challenge_${chCID}_entries`,
    `challenge_${rawCID}_entries`,
    numCID ? `challenge_${numCID}_entries` : null,
  ].filter(Boolean);
  return {
    card,
    canonicalId: rawCID,
    familyId: chCID,
    keys: Array.from(new Set(aliases)),
  };
};

const validOwners = ({ cards = [], hallCards = [], trashCards = [] } = {}) => {
  const trashFamilies = new Set(trashCards.map(ownerIdentity).filter(Boolean).map((owner) => owner.familyId));
  const owners = new Map();
  [...cards, ...hallCards].forEach((card) => {
    const owner = ownerIdentity(card);
    if (!owner || trashFamilies.has(owner.familyId) || owners.has(owner.familyId)) return;
    owners.set(owner.familyId, owner);
  });
  return [...owners.values()];
};

const parsePairArray = (raw) => {
  if (typeof raw !== 'string' || !raw) return [];
  try { return storedEntryArray(JSON.parse(raw)); } catch { return []; }
};

export const parseOwnerScopedRecordRoomEntries = ({ pairs = [], cards = [], hallCards = [], trashCards = [] } = {}) => {
  const owners = validOwners({ cards, hallCards, trashCards });
  const pairMap = new Map(pairs);
  const seen = new Set();
  const entries = [];

  owners.forEach((owner) => {
    let ownerEntryCount = 0;
    const append = (item) => {
      const entry = normalizeStoredEntry(item, owner.canonicalId);
      if (!entry) return;
      const identity = entry.id
        ? `${owner.canonicalId}|id|${entry.id}`
        : `${owner.canonicalId}|fallback|${fallbackIdentity(entry)}`;
      if (seen.has(identity)) return;
      seen.add(identity);
      entries.push(entry);
      ownerEntryCount += 1;
    };

    owner.keys.forEach((key) => parsePairArray(pairMap.get(key)).forEach(append));
    if (ownerEntryCount === 0) {
      const embedded = Array.isArray(owner.card?.entries) && owner.card.entries.length
        ? owner.card.entries
        : (Array.isArray(owner.card?.logs) ? owner.card.logs : []);
      embedded.forEach(append);
    }
  });

  return entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

export const loadRecordRoomEntries = async ({ storage, cards = [], hallCards = [], trashCards = [] }) => {
  const owners = validOwners({ cards, hallCards, trashCards });
  const entryKeys = Array.from(new Set(owners.flatMap((owner) => owner.keys)));
  const pairs = entryKeys.length ? await storage.multiGet(entryKeys) : [];
  return parseOwnerScopedRecordRoomEntries({ pairs, cards, hallCards, trashCards });
};
