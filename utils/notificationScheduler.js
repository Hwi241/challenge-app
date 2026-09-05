// utils/notificationScheduler.js
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import { getNotificationsEnabled } from './appSettings';

let notificationsModulePromise = null;
let notificationResponseSubscription = null;

async function getNotificationsModuleAsync() {
  if (Platform.OS === 'android' && isRunningInExpoGo()) {
    return null;
  }

  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications');
  }

  const Notifications = await notificationsModulePromise;

  if (!notificationResponseSubscription) {
    notificationResponseSubscription =
      Notifications.addNotificationResponseReceivedListener(response => {
        Notifications.dismissNotificationAsync(
          response.notification.request.identifier
        );
      });
  }

  return Notifications;
}

// ===== 권한 =====
export async function ensureNotificationPermissionAsync() {
  const Notifications = await getNotificationsModuleAsync();
  if (!Notifications) return false;

  const settings = await Notifications.getPermissionsAsync();
  if (settings.status !== 'granted') {
    const ask = await Notifications.requestPermissionsAsync();
    return ask.status === 'granted';
  }
  return true;
}

// ===== 취소 =====
export async function cancelAllForChallenge(challenge) {
  const challengeId =
    typeof challenge === 'string' || typeof challenge === 'number'
      ? String(challenge)
      : String(challenge?.id ?? '');

  if (!challengeId) return;

  const Notifications = await getNotificationsModuleAsync();
  if (!Notifications) return;

  const idsRaw = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = (idsRaw || []).filter(
    n => String(n.content?.data?.challengeId ?? '') === challengeId
  );

  await Promise.all(
    toCancel.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

// ===== 등록(간단화) =====
export async function registerNotificationsForChallenge(challenge) {
  if (!challenge?.id || !challenge?.notification?.mode) return;

  const Notifications = await getNotificationsModuleAsync();
  if (!Notifications) return;

  const notificationsEnabled = await getNotificationsEnabled();
  if (!notificationsEnabled) {
    await cancelAllForChallenge(challenge);
    return;
  }

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
          categoryIdentifier: 'challenge', // 카테고리 식별자 추가
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
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
  const Notifications = await getNotificationsModuleAsync();
  if (!Notifications) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '일반 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // 알림 액션 카테고리 추가
  await Notifications.setNotificationCategoryAsync('challenge', [
    { identifier: 'dashboard', buttonTitle: '도전으로' },
    { identifier: 'upload', buttonTitle: '인증하기' },
  ]);

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false,
    }),
  });
}
