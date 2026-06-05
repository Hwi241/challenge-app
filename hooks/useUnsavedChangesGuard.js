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
  const saveAlertOpenRef = useRef(false);

  const getHasUnsavedChanges = useCallback(() => {
    if (typeof hasUnsavedChanges === 'function') {
      return !!hasUnsavedChanges();
    }
    return !!hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  const isScreenFocused = useCallback(() => {
    if (!navigation || typeof navigation.isFocused !== 'function') return true;
    return navigation.isFocused();
  }, [navigation]);

  const shouldBlockLeave = useCallback(() => {
    if (!isScreenFocused()) return false;
    if (!enabled) return false;
    if (savedRef.current) return false;
    if (confirmedLeaveRef.current) return false;
    return getHasUnsavedChanges();
  }, [enabled, getHasUnsavedChanges, isScreenFocused]);

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
    if (!isScreenFocused()) return;

    confirmLeave(() => {
      navigation?.goBack?.();
    });
  }, [confirmLeave, isScreenFocused, navigation]);

  const markAsSaved = useCallback(() => {
    savedRef.current = true;
    confirmedLeaveRef.current = true;
    alertOpenRef.current = false;
    saveAlertOpenRef.current = false;
  }, []);

  const confirmSave = useCallback(({
    title: saveTitle = '저장하시겠습니까?',
    message: saveMessage = '변경한 내용을 저장할까요?',
    cancelText = '취소',
    confirmText = '저장',
    onConfirm,
  } = {}) => {
    if (saveAlertOpenRef.current) return;
    saveAlertOpenRef.current = true;

    Alert.alert(
      saveTitle,
      saveMessage,
      [
        {
          text: cancelText,
          style: 'cancel',
          onPress: () => {
            saveAlertOpenRef.current = false;
          },
        },
        {
          text: confirmText,
          onPress: () => {
            saveAlertOpenRef.current = false;
            if (typeof onConfirm === 'function') {
              onConfirm();
            }
          },
        },
      ]
    );
  }, []);

  const allowNextLeave = useCallback(() => {
    confirmedLeaveRef.current = true;
    alertOpenRef.current = false;
    saveAlertOpenRef.current = false;
  }, []);

  const resetGuard = useCallback(() => {
    savedRef.current = false;
    confirmedLeaveRef.current = false;
    alertOpenRef.current = false;
    saveAlertOpenRef.current = false;
  }, []);

  useEffect(() => {
    if (!enabled || !navigation?.addListener) return undefined;

    const remove = navigation.addListener('beforeRemove', (event) => {
      if (!isScreenFocused()) return;
      if (!shouldBlockLeave()) return;

      event.preventDefault();

      confirmLeave(() => {
        navigation.dispatch(event.data.action);
      });
    });

    return remove;
  }, [confirmLeave, enabled, isScreenFocused, navigation, shouldBlockLeave]);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'android') return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isScreenFocused()) return false;
      if (!shouldBlockLeave()) return false;

      confirmLeave(() => {
        navigation?.goBack?.();
      });
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [confirmLeave, enabled, isScreenFocused, navigation, shouldBlockLeave]);

  return {
    handleBackPress,
    confirmLeave,
    confirmSave,
    markAsSaved,
    allowNextLeave,
    resetGuard,
    shouldBlockLeave,
  };
}
