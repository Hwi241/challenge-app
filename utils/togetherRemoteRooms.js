import {
  getSupabaseClient,
} from './supabaseClient';

const requiredText = (value, errorCode) => {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(errorCode);
  return text;
};

const getRpcClient = (client) => {
  const resolved = client || getSupabaseClient();
  if (!resolved) throw new Error('TOGETHER_REMOTE_NOT_CONFIGURED');
  return resolved;
};

const extractCreatedRoom = (data) => {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;
  const roomId = String(row.room_id ?? '').trim();
  const inviteToken = String(row.invite_token ?? '').trim();
  const inviteExpiresAt = String(row.invite_expires_at ?? '').trim();
  if (!roomId || !inviteToken || !inviteExpiresAt) return null;
  return { roomId, inviteToken, inviteExpiresAt };
};

const extractAcceptedRoomId = (data) => {
  if (typeof data === 'string') return data.trim();
  if (Array.isArray(data)) {
    const first = data[0];
    if (typeof first === 'string') return first.trim();
    if (first && typeof first === 'object') {
      return String(first.accept_together_invite ?? first.room_id ?? '').trim();
    }
    return '';
  }
  if (data && typeof data === 'object') {
    return String(data.accept_together_invite ?? data.room_id ?? '').trim();
  }
  return '';
};

export const createTogetherRemoteRoom = async ({ client = null } = {}) => {
  const supabase = getRpcClient(client);
  const { data, error } = await supabase.rpc('create_together_room');
  if (error) {
    throw new Error(String(error.message || 'TOGETHER_REMOTE_ROOM_CREATE_FAILED'));
  }
  const room = extractCreatedRoom(data);
  if (!room) throw new Error('TOGETHER_REMOTE_ROOM_INVALID_RESPONSE');
  return room;
};

export const acceptTogetherRemoteInvite = async ({ inviteToken, client = null } = {}) => {
  const token = requiredText(inviteToken, 'TOGETHER_REMOTE_INVITE_TOKEN_REQUIRED');
  const supabase = getRpcClient(client);
  const { data, error } = await supabase.rpc('accept_together_invite', {
    p_invite_token: token,
  });
  if (error) {
    throw new Error(String(error.message || 'TOGETHER_REMOTE_INVITE_ACCEPT_FAILED'));
  }
  const roomId = extractAcceptedRoomId(data);
  if (!roomId) throw new Error('TOGETHER_REMOTE_INVITE_INVALID_RESPONSE');
  return { roomId };
};
