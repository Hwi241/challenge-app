import { useEffect } from 'react';
import { AppState } from 'react-native';
import { subscribeTogetherLocalProgressV2 } from '../utils/togetherLocalProgressSignalV2';
import { requestTogetherImmediateSyncV2 } from '../utils/togetherImmediateSyncV2';

export default function TogetherSyncController() {
  useEffect(() => {
    return subscribeTogetherLocalProgressV2(() => {
      void requestTogetherImmediateSyncV2();
    });
  }, []);

  useEffect(() => {
    let active = AppState.currentState === 'active';
    const run = () => { if (active) void requestTogetherImmediateSyncV2(); };
    const initial = setTimeout(run, 2000);
    let interval = active ? setInterval(run, 30000) : null;
    const subscription = AppState.addEventListener('change', (state) => {
      active = state === 'active';
      if (interval) clearInterval(interval);
      interval = active ? setInterval(run, 30000) : null;
      if (active) run();
    });
    return () => { clearTimeout(initial); if (interval) clearInterval(interval); subscription.remove(); };
  }, []);
  return null;
}
