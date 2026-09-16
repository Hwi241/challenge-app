import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const module = Platform.OS === 'android' ? NativeModules.FocusOverlay : null;

export const isFocusOverlaySupported = () => !!module;

export const canDrawFocusOverlay = async () => (
  module ? module.canDrawOverlays() : false
);

export const openFocusOverlayPermissionSettings = async () => (
  module ? module.openPermissionSettings() : false
);

export const showOrUpdateFocusOverlay = async (session) => {
  if (!module || !session) return false;
  return module.showOrUpdate({
    id: String(session.id),
    targetTitle: String(session.targetTitle || '집중 타이머'),
    status: session.status,
    mode: session.mode,
    targetSeconds: Number(session.targetSeconds) || 0,
    startedAt: Number(session.startedAt) || 0,
    pausedAt: Number(session.pausedAt) || 0,
    accumulatedPausedMs: Number(session.accumulatedPausedMs) || 0,
  });
};

export const hideFocusOverlay = async () => (
  module ? module.hide() : false
);

export function subscribeFocusOverlayCommands(listener) {
  if (!module || typeof listener !== 'function') return () => {};
  const emitter = new NativeEventEmitter(module);
  const subscription = emitter.addListener('FocusOverlayCommand', listener);
  return () => subscription.remove();
}
