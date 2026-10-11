import {
  getSupabaseClient,
} from './supabaseClient';

export const subscribeTogetherHomeChangesV2 = ({
  onChange,
  client = null,
} = {}) => {
  if (typeof onChange !== 'function') {
    throw new Error(
      'TOGETHER_HOME_LISTENER_REQUIRED'
    );
  }

  const supabase =
    client || getSupabaseClient();

  if (!supabase) {
    throw new Error(
      'TOGETHER_REMOTE_NOT_CONFIGURED'
    );
  }

  const channel = supabase
    .channel('together-home-v2')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'together_rooms',
      },
      () => onChange()
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'together_room_members',
      },
      () => onChange()
    )
    .subscribe((status) => {
      if (
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT'
      ) {
        console.warn(
          '[TogetherHome] realtime status',
          status
        );
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
};
