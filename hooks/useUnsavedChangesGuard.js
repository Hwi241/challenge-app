import { useCallback, useEffect, useRef } from 'react';
import { Alert, BackHandler, Platform } from 'react-native';

export default function useUnsavedChangesGuard({
  navigation,
  enabled = true,
  hasUnsavedChanges = false,
  title = '작성 중인 내용이 있어요',
  message = '뒤로 가면 작성한 내용이 저장되지 않습니다.',
  stayText = '계속 작성',
  leaveText = '나가기',
} = {}) {
  const savedRef = useRef(false);
  const confirmedLeaveRef = useRef(false);
  const alertOpenRef = useRef(false);

  const getHasUnsavedChanges = useCallback(() => {
    if (typeof hasUnsavedChanges === 'function') {
      return !!hasUnsavedChanges();
    }
    return !!hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  const shouldBlockLeave = useCallback(() => {
    if (!enabled) return false;
    if (savedRef.current) return false;
    if (confirmedLeaveRef.current) return false;
    return getHasUnsavedChanges();
  }, [enabled, getHasUnsavedChanges]);

  const confirmLeave = useCallback((onConfirm) => {
    if (!shouldBlockLeave()) {
      if (typeof onConfirm === 'function') {
        onConfirm();
      }
      return;
    }

    if (alertOpenRef.current) return;
    alertOpenRef.current = true;

    Alert.alert(
      title,
      message,
      [
        {
          text: stayText,
          style: 'cancel',
          onPress: () => {
            alertOpenRef.current = false;
          },
        },
        {
          text: leaveText,
          style: 'destructive',
          onPress: () => {
            alertOpenRef.current = false;
            confirmedLeaveRef.current = true;
            if (typeof onConfirm === 'function') {
              onConfirm();
            }
          },
        },
      ]
    );
  }, [leaveText, message, shouldBlockLeave, stayText, title]);

  const handleBackPress = useCallback(() => {
    confirmLeave(() => {
      navigation?.goBack?.();
    });
  }, [confirmLeave, navigation]);

  const markAsSaved = useCallback(() => {
    savedRef.current = true;
    confirmedLeaveRef.current = true;
    alertOpenRef.current = false;
  }, []);

  const allowNextLeave = useCallback(() => {
    confirmedLeaveRef.current = true;
    alertOpenRef.current = false;
  }, []);

  const resetGuard = useCallback(() => {
    savedRef.current = false;
    confirmedLeaveRef.current = false;
    alertOpenRef.current = false;
  }, []);

  useEffect(() => {
    if (!enabled || !navigation?.addListener) return undefined;

    const remove = navigation.addListener('beforeRemove', (event) => {
      if (!shouldBlockLeave()) return;

      event.preventDefault();

      confirmLeave(() => {
        navigation.dispatch(event.data.action);
      });
    });

    return remove;
  }, [confirmLeave, enabled, navigation, shouldBlockLeave]);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'android') return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!shouldBlockLeave()) return false;

      confirmLeave(() => {
        navigation?.goBack?.();
      });
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [confirmLeave, enabled, navigation, shouldBlockLeave]);

  return {
    handleBackPress,
    confirmLeave,
    markAsSaved,
    allowNextLeave,
    resetGuard,
    shouldBlockLeave,
  };
}
