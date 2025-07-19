// utils/notifications.js
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// 알림 권한 요청
export async function requestNotificationPermission() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    return newStatus === 'granted';
  }
  return true;
}

// 알림 등록 함수
export async function registerNotifications(challengeId, challengeTitle, setting) {
  const granted = await requestNotificationPermission();
  if (!granted) {
    console.log('알림 권한 거부됨');
    return;
  }

  // 기존 알림 취소 (중복 방지)
  await Notifications.cancelAllScheduledNotificationsAsync();

  const messages = [
    '오늘도 화이팅!',
    '한 걸음 더 나아가요!',
    '작은 도전이 큰 변화를 만듭니다!',
  ];
  const randomMsg = messages[Math.floor(Math.random() * messages.length)];
  const content = {
    title: `✊ [${challengeTitle}] 도전하세요!`,
    body: randomMsg,
    data: { challengeId },
  };

  const triggers = [];

  if (setting.type === 'simple') {
    const { hour, minute, repeatType, weekdays, day, weekNumber, weekday } = setting;

    if (repeatType === 'everyday') {
      triggers.push({ hour, minute, repeats: true });
    } else if (repeatType === 'weekdays') {
      weekdays.forEach((dayNum) => {
        triggers.push({ weekday: dayNum, hour, minute, repeats: true });
      });
    } else if (repeatType === 'monthly-date') {
      triggers.push({ day, hour, minute, repeats: true });
    } else if (repeatType === 'monthly-nth-week') {
      // expo-notifications는 nth week 지원하지 않음 -> 추후 로직 커스터마이징 필요
      console.warn('monthly-nth-week는 기본 지원되지 않음 (직접 구현 필요)');
    }
  } else if (setting.type === 'weekly-detail') {
    Object.entries(setting.detail).forEach(([dayStr, times]) => {
      const dayNum = parseInt(dayStr); // '1' ~ '7'
      times.forEach(({ hour, minute }) => {
        triggers.push({ weekday: dayNum, hour, minute, repeats: true });
      });
    });
  } else if (setting.type === 'monthly-detail') {
    Object.entries(setting.detail).forEach(([dayStr, times]) => {
      const dayNum = parseInt(dayStr);
      times.forEach(({ hour, minute }) => {
        triggers.push({ day: dayNum, hour, minute, repeats: true });
      });
    });
  }

  for (const trigger of triggers) {
    await Notifications.scheduleNotificationAsync({ content, trigger });
  }
}
