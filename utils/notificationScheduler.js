// utils/notificationScheduler.js
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ===== 권한 =====
export async function ensureNotificationPermissionAsync() {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.status !== 'granted') {
    const ask = await Notifications.requestPermissionsAsync();
    return ask.status === 'granted';
  }
  return true;
}

// ===== 취소 =====
export async function cancelAllForChallenge(challenge) {
  if (!challenge?.id) return;
  const idsRaw = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = (idsRaw || []).filter(n => n.content?.data?.challengeId === challenge.id);
  await Promise.all(toCancel.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

// ===== 등록(간단화) =====
export async function registerNotificationsForChallenge(challenge) {
  if (!challenge?.id || !challenge?.notification?.mode) return;
  const ok = await ensureNotificationPermissionAsync();
  if (!ok) return;

  const { mode, payload } = challenge.notification;

  // 도전별 기존 예약 제거 후 재등록
  await cancelAllForChallenge(challenge);

  if (mode === 'simple' && payload?.time && Array.isArray(payload.days)) {
    // 예: 매주 선택 요일들 특정 시각
    const [hStr, mStr='0'] = String(payload.time).split(':');
    const hour = Number(hStr), minute = Number(mStr);
    for (const d of payload.days) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '도전 알림',
          body: `${challenge.title} — 인증할 시간이에요!`,
          data: { challengeId: challenge.id },
        },
        trigger: {
          weekday: mapKoWeekdayToExpo(d), // 1=Sun ... 7=Sat (Expo 기준)
          hour, minute, repeats: true,
        },
      });
    }
  }

  // TODO: weekly/monthly 모드 상세 스케줄은 기존 화면 구조에 맞춰 확장
}

// 한글 요일 → Expo weekday
function mapKoWeekdayToExpo(label) {
  // Expo weekday: 1=Sun,2=Mon,3=Tue,4=Wed,5=Thu,6=Fri,7=Sat
  switch (label) {
    case '월': return 2;
    case '화': return 3;
    case '수': return 4;
    case '목': return 5;
    case '금': return 6;
    case '토': return 7;
    case '일': return 1;
    default: return 2;
  }
}

// 앱 시작시 권장: 채널/핸들러 기본 설정
export async function initializeNotificationsAsync() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '일반 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false,
    }),
  });
}
