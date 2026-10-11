import {
  useCallback,
  useState,
} from 'react';

import {
  useFocusEffect,
} from '@react-navigation/native';

import {
  loadTogetherRoomSnapshotV2,
  subscribeTogetherRoomV2,
} from '../utils/togetherRemoteV2';

import {
  getTogetherInvitePresenceV2,
} from '../utils/togetherInvitePresenceV2';

const INITIAL_STATE = {
  status: 'idle',
  joinedCount: 0,
  joinedNames: [],
  loading: false,
  error: '',
};

export default function useTogetherInvitePresenceV2(
  roomId
) {
  const [state, setState] = useState(
    INITIAL_STATE
  );

  useFocusEffect(
    useCallback(() => {
      const id = String(
        roomId ?? ''
      ).trim();

      if (!id) {
        setState(INITIAL_STATE);
        return undefined;
      }

      let active = true;
      let requestSequence = 0;
      let unsubscribe = () => {};

      const refresh = async () => {
        const sequence = ++requestSequence;

        try {
          const snapshot =
            await loadTogetherRoomSnapshotV2({
              roomId: id,
            });

          const presence =
            getTogetherInvitePresenceV2(
              snapshot
            );

          if (
            !active ||
            sequence !== requestSequence
          ) {
            return;
          }

          setState({
            ...presence,
            loading: false,
            error: '',
          });
        } catch (error) {
          if (
            !active ||
            sequence !== requestSequence
          ) {
            return;
          }

          console.warn(
            '[TogetherInvitePresence] refresh failed',
            String(
              error?.message || 'unknown'
            )
          );

          setState((previous) => ({
            ...previous,
            loading: false,
            error:
              '친구의 참가 상태를 확인하지 못했어요.',
          }));
        }
      };

      setState((previous) => ({
        ...previous,
        loading: true,
        error: '',
      }));

      try {
        unsubscribe =
          subscribeTogetherRoomV2({
            roomId: id,
            onChange: () => {
              if (active) {
                void refresh();
              }
            },
          });
      } catch (error) {
        console.warn(
          '[TogetherInvitePresence] subscribe failed',
          String(
            error?.message || 'unknown'
          )
        );
      }

      void refresh();

      return () => {
        active = false;
        requestSequence += 1;

        if (
          typeof unsubscribe === 'function'
        ) {
          unsubscribe();
        }
      };
    }, [roomId])
  );

  return state;
}
