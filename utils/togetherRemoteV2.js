import { getSupabaseClient } from './supabaseClient';
import { ensureTogetherAnonymousSession } from './togetherRemoteAuth';

const clientOf = (client) => { const value = client || getSupabaseClient(); if (!value) throw new Error('TOGETHER_REMOTE_NOT_CONFIGURED'); return value; };
const required = (value, code) => { const text = String(value ?? '').trim(); if (!text) throw new Error(code); return text; };
const rpc = async (client, name, args) => { const result = await clientOf(client).rpc(name, args); if (result.error) throw new Error(String(result.error.message || name)); return result.data; };
const first = (data) => Array.isArray(data) ? data[0] : data;
let togetherRoomV2ChannelSeq = 0;

export const createTogetherRoomV2 = async ({ mode, title, timezone, pushTemplate = null, sharedGoal = null, requestId, displayName, client = null } = {}) => {
  const row = first(await rpc(client, 'create_together_room_v2', { p_mode: mode, p_title: title, p_timezone: timezone, p_push_template: pushTemplate, p_shared_goal: sharedGoal, p_client_request_id: requestId, p_display_name: displayName }));
  const roomId = required(row?.room_id ?? row?.roomId, 'TOGETHER_REMOTE_ROOM_INVALID_RESPONSE');
  return { roomId, inviteCode: required(row?.invite_code ?? row?.inviteCode, 'TOGETHER_REMOTE_INVITE_INVALID_RESPONSE'), inviteExpiresAt: required(row?.invite_expires_at ?? row?.inviteExpiresAt, 'TOGETHER_REMOTE_INVITE_INVALID_RESPONSE') };
};
export const getTogetherInvitePreviewV2 = async ({ code, client = null } = {}) => first(await rpc(client, 'get_together_invite_preview_v2', { p_code: required(code, 'TOGETHER_CODE_REQUIRED') }));
export const acceptTogetherInviteV2 = async ({ code, displayName, client = null } = {}) => first(await rpc(client, 'accept_together_invite_v2', { p_code: required(code, 'TOGETHER_CODE_REQUIRED'), p_display_name: displayName }));
export const loadMyTogetherRoomsV2 = async ({ client = null } = {}) => { const data = await rpc(client, 'get_my_together_rooms_v2'); return Array.isArray(data) ? data : []; };
export const loadTogetherRoomSnapshotV2 = async ({ roomId, client = null } = {}) => first(await rpc(client, 'get_together_room_snapshot_v2', { p_room_id: required(roomId, 'TOGETHER_ROOM_REQUIRED') }));
export const upsertTogetherMemberStateV2 = ({ roomId, localDate, completed, progress, streak, contribution, displayName, client = null } = {}) => rpc(client, 'upsert_together_member_state_v2', { p_room_id: roomId, p_local_date: localDate, p_completed: completed, p_progress: progress, p_streak: streak, p_contribution: contribution, p_display_name: displayName });

const action = (name, map) => async (values = {}) => {
  await ensureTogetherAnonymousSession();
  return rpc(values.client, name, map(values));
};
export const renameTogetherRoomV2 = action('rename_together_room_v2', (v) => ({ p_room_id: v.roomId, p_title: v.title }));
export const setTogetherRoomLockedV2 = action('set_together_room_locked_v2', (v) => ({ p_room_id: v.roomId, p_locked: v.locked }));
export const setTogetherJoinPolicyV2 = action('set_together_join_policy_v2', (v) => ({ p_room_id: v.roomId, p_join_policy: v.joinPolicy }));
export const reissueTogetherInviteV2 = action('reissue_together_invite_v2', (v) => ({ p_room_id: v.roomId }));
export const revokeTogetherInvitesV2 = action('revoke_together_invites_v2', (v) => ({ p_room_id: v.roomId }));
export const setTogetherMemberRoleV2 = action('set_together_member_role_v2', (v) => ({ p_room_id: v.roomId, p_user_id: v.userId, p_role: v.role }));
export const removeTogetherMemberV2 = action('remove_together_member_v2', (v) => ({ p_room_id: v.roomId, p_user_id: v.userId, p_block: v.block }));
export const unblockTogetherMemberV2 = action('unblock_together_member_v2', (v) => ({ p_room_id: v.roomId, p_user_id: v.userId }));
export const transferTogetherOwnershipV2 = action('transfer_together_ownership_v2', (v) => ({ p_room_id: v.roomId, p_user_id: v.userId }));
export const leaveTogetherRoomV2 = action('leave_together_room_v2', (v) => ({ p_room_id: v.roomId }));
export const closeTogetherRoomV2 = action('close_together_room_v2', (v) => ({ p_room_id: v.roomId }));
export const resolveTogetherJoinRequestV2 = action('resolve_together_join_request_v2', (v) => ({ p_room_id: v.roomId, p_user_id: v.userId, p_approve: v.approve }));

export const subscribeTogetherRoomV2 = ({ roomId, onChange, client = null } = {}) => {
  const supabase = clientOf(client);
  required(roomId, 'TOGETHER_ROOM_REQUIRED');
  const channel = supabase.channel(`together-room-${roomId}-${++togetherRoomV2ChannelSeq}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'together_rooms' }, () => onChange?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'together_room_members' }, () => onChange?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'together_member_states' }, () => onChange?.())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
};
