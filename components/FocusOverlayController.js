import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import {
  finishFocusSession,
  loadActiveFocusSession,
  pauseFocusSession,
  resumeFocusSession,
  subscribeFocusSessions,
} from '../utils/focusSessionStore';
import {
  getFocusOverlayTimerEnabled,
  subscribeAppSettings,
} from '../utils/appSettings';
import {
  canDrawFocusOverlay,
  hideFocusOverlay,
  isFocusOverlaySupported,
  showOrUpdateFocusOverlay,
  subscribeFocusOverlayCommands,
} from '../utils/focusOverlay';

export default function FocusOverlayController() {
  const syncingRef = useRef(false);
  const pendingRef = useRef(false);

  const sync = useCallback(async () => {
    if (Platform.OS !== 'android' || !isFocusOverlaySupported()) return;
    if (syncingRef.current) {
      pendingRef.current = true;
      return;
    }
    syncingRef.current = true;
    try {
      const [enabled, session, permitted] = await Promise.all([
        getFocusOverlayTimerEnabled(),
        loadActiveFocusSession(),
        canDrawFocusOverlay(),
      ]);
      if (enabled && session && permitted) {
        await showOrUpdateFocusOverlay(session);
      } else {
        await hideFocusOverlay();
      }
    } catch (error) {
      console.warn('focus overlay sync failed:', error);
    } finally {
      syncingRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        sync();
      }
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android' || !isFocusOverlaySupported()) return undefined;
    sync();
    const unsubscribeSessions = subscribeFocusSessions(sync);
    const unsubscribeSettings = subscribeAppSettings(sync);
    const unsubscribeCommands = subscribeFocusOverlayCommands(async ({ command, sessionId }) => {
      try {
        if (command === 'pause') await pauseFocusSession(sessionId);
        if (command === 'resume') await resumeFocusSession(sessionId);
        if (command === 'complete') await finishFocusSession(sessionId);
      } catch (error) {
        console.warn('focus overlay command failed:', error);
      } finally {
        sync();
      }
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => {
      unsubscribeSessions();
      unsubscribeSettings();
      unsubscribeCommands();
      appState.remove();
    };
  }, [sync]);

  return null;
}
