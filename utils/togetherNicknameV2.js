import { getSupabaseClient } from './supabaseClient';
import {
  ensureTogetherAnonymousSession,
} from './togetherRemoteAuth';

const getAuthenticatedClient = async () => {
  const client = getSupabaseClient();

  if (!client) {
    throw new Error('TOGETHER_NICKNAME_UNAVAILABLE');
  }

  const auth = await ensureTogetherAnonymousSession({ client });

  if (!auth?.ok || !auth?.userId) {
    throw new Error('TOGETHER_NICKNAME_AUTH_FAILED');
  }

  return client;
};

export const saveTogetherNicknameV2 = async (value) => {
  const nickname = String(value ?? '').trim();

  if (Array.from(nickname).length > 40) {
    throw new Error('TOGETHER_NICKNAME_TOO_LONG');
  }

  const client = await getAuthenticatedClient();

  const { data, error } = await client.rpc(
    'set_my_together_nickname_v2',
    { p_nickname: nickname }
  );

  if (error) {
    const message = String(error.message || '');

    if (
      message.includes('TOGETHER_NICKNAME_TAKEN')
      || error.code === '23505'
    ) {
      throw new Error('TOGETHER_NICKNAME_TAKEN');
    }

    if (message.includes('TOGETHER_NICKNAME_TOO_LONG')) {
      throw new Error('TOGETHER_NICKNAME_TOO_LONG');
    }

    throw new Error('TOGETHER_NICKNAME_SAVE_FAILED');
  }

  return String(data ?? nickname);
};

export const loadOfficialTogetherNicknameV2 = async () => {
  const client = await getAuthenticatedClient();

  const { data, error } = await client.rpc(
    'get_my_together_nickname_v2'
  );

  if (error) {
    throw new Error('TOGETHER_NICKNAME_LOAD_FAILED');
  }

  return String(data ?? '');
};
