import { SafeAreaView } from 'react-native-safe-area-context';
// screens/SettingsScreen.js
// - 앱 리뷰 버튼: 인앱 리뷰 요청 후에도 항상 안내창을 띄워서 반응 보이게 하고,
//   "스토어 열기"로 마켓/앱스토어 페이지를 여는 확실한 fallback 추가
// - 개선의견 메일: FEEDBACK_EMAIL을 설정(Expo extra → 상수)하고, 미설정/플레이스홀더면 안내

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert, Platform, Linking, ScrollView  } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Application from 'expo-application';
import * as MailComposer from 'expo-mail-composer';
import * as StoreReview from 'expo-store-review';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';

import { colors, spacing, radius, buttonStyles } from '../styles/common';
import BackButton from '../components/BackButton';

const STORAGE_KEY = 'settings.notificationsEnabled';

// ▶︎ 설정 방법
// 1) app.json/app.config.ts의 expo.extra에 값을 넣으면 자동으로 사용됩니다.
//    {
//      "expo": {
//        "extra": { "FEEDBACK_EMAIL": "your@email.com", "IOS_APP_ID": "1234567890" }
//      }
//    }
const FEEDBACK_EMAIL =
  Constants?.expoConfig?.extra?.FEEDBACK_EMAIL || 'feedback@the-push.app'; // 기본값(임시)
const IOS_APP_ID =
  Constants?.expoConfig?.extra?.IOS_APP_ID || null; // iOS 실제 배포 후 App Store ID 필수

export default function SettingsScreen() {
  const navigation = useNavigation();

  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  const version = Application.nativeApplicationVersion ?? '-';
  const build = Application.nativeBuildVersion ?? '-';
  const androidPackage = Application.applicationId ?? null;

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw != null) setEnabled(raw === 'true');
      } catch {}
      setLoading(false);
    })();
  }, []);

  const persist = useCallback(async (value) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
    } catch {}
  }, []);

  const toggleNotifications = useCallback(async () => {
    const next = !enabled;
    if (next) {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const ask = await Notifications.requestPermissionsAsync();
        if (ask.status !== 'granted') {
          Alert.alert('알림 권한 필요', '설정 > 알림에서 허용해 주세요.');
          return;
        }
      }
    }
    setEnabled(next);
    persist(next);
  }, [enabled, persist]);

  // ── 개선의견 메일
  const sendFeedback = useCallback(async () => {
    const to = FEEDBACK_EMAIL;
    if (!to || to === 'feedback@the-push.app') {
      Alert.alert(
        '개발자 설정 필요',
        '피드백 수신 이메일이 설정되지 않았습니다.\napp.config의 expo.extra.FEEDBACK_EMAIL 또는 SettingsScreen의 FEEDBACK_EMAIL을 설정해 주세요.'
      );
      return;
    }

    try {
      const available = await MailComposer.isAvailableAsync();
      const subject = `THE - PUSH 피드백 v${version} (${build})`;
      const body =
        '아래에 개선 의견을 적어주세요.\n\n— 기기/OS 정보도 적어주시면 큰 도움이 됩니다.';

      if (available) {
        await MailComposer.composeAsync({
          recipients: [to],
          subject,
          body,
        });
        return;
      }
      const mailto = `mailto:${to}?subject=${encodeURIComponent(
        subject
      )}&body=${encodeURIComponent(body)}`;
      const can = await Linking.canOpenURL(mailto);
      if (can) return Linking.openURL(mailto);
      Alert.alert('안내', '이 기기에서 메일 앱을 열 수 없습니다.');
    } catch {
      Alert.alert('안내', '메일 작성 화면을 열 수 없습니다.');
    }
  }, [version, build]);

  // ── 스토어 URL 열기 (확실한 fallback)
  const openStorePage = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        if (!androidPackage) return false;
        const marketUrl = `market://details?id=${androidPackage}`;
        const httpsUrl = `https://play.google.com/store/apps/details?id=${androidPackage}`;
        if (await Linking.canOpenURL(marketUrl)) {
          await Linking.openURL(marketUrl);
          return true;
        }
        if (await Linking.canOpenURL(httpsUrl)) {
          await Linking.openURL(httpsUrl);
          return true;
        }
        return false;
      } else {
        if (!IOS_APP_ID) return false;
        const url = `itms-apps://itunes.apple.com/app/id${IOS_APP_ID}?action=write-review`;
        if (await Linking.canOpenURL(url)) {
          await Linking.openURL(url);
          return true;
        }
        return false;
      }
    } catch {
      return false;
    }
  }, [androidPackage]);

  // ── 앱 리뷰
  const requestStoreReview = useCallback(async () => {
    try {
      const available = await StoreReview.isAvailableAsync();

      // 1) 인앱 리뷰 요청 (OS 정책상 표시되지 않더라도 호출은 성공으로 끝남)
      if (available) {
        await StoreReview.requestReview();
      }

      // 2) 사용자가 즉시 반응을 느끼도록 안내창 + 스토어 열기 옵션 제공
      Alert.alert(
        '리뷰 남기기',
        '리뷰 창이 보이지 않으면 스토어에서 리뷰를 남길 수 있어요.',
        [
          { text: '닫기', style: 'cancel' },
          {
            text: '스토어 열기',
            onPress: async () => {
              const ok = await openStorePage();
              if (!ok) {
                if (Platform.OS === 'ios' && !IOS_APP_ID) {
                  Alert.alert(
                    '앱 ID 필요',
                    'iOS App Store ID가 설정되지 않아 리뷰 페이지를 열 수 없습니다.\nexpo.extra.IOS_APP_ID를 설정하세요.'
                  );
                } else {
                  Alert.alert('안내', '리뷰 페이지를 열 수 없습니다.');
                }
              }
            },
          },
        ]
      );
    } catch {
      Alert.alert('안내', '리뷰 요청에 실패했습니다.');
    }
  }, [openStorePage]);

    return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <BackButton title="설정" />
      <ScrollView contentContainerStyle={styles.container}>
      {/* 알림 토글 */}
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>알림</Text>
          <Switch
            value={enabled}
            onValueChange={toggleNotifications}
            disabled={loading}
            thumbColor={colors.black}
            trackColor={{ false: colors.gray400, true: colors.gray600 }}
            ios_backgroundColor={colors.gray400}
          />
        </View>
        <Text style={styles.hint}>
          앱 전체 알림을 켜거나 끕니다. 상세 스케줄은 각 도전에서 설정하세요.
        </Text>
      </View>

      {/* 개선의견 */}
      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <Text style={[styles.label, { marginBottom: spacing.sm }]}>피드백</Text>
        <TouchableOpacity
          style={buttonStyles.primary.container}
          onPress={sendFeedback}
          activeOpacity={0.9}
        >
          <Text style={buttonStyles.primary.label}>개선의견 남기기</Text>
        </TouchableOpacity>
      </View>

      {/* 앱 리뷰 */}
      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <Text style={[styles.label, { marginBottom: spacing.sm }]}>리뷰</Text>
        <TouchableOpacity
          style={buttonStyles.primary.container}
          onPress={requestStoreReview}
          activeOpacity={0.9}
        >
          <Text style={buttonStyles.primary.label}>앱 리뷰 남기기</Text>
        </TouchableOpacity>
      </View>

      {/* 데이터 백업/복원 */}
      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <Text style={[styles.label, { marginBottom: spacing.sm }]}>데이터</Text>
        <TouchableOpacity
          style={buttonStyles.outlineSoft.container}
          onPress={() => navigation.navigate('Backup')}
          activeOpacity={0.9}
        >
          <Text style={buttonStyles.outlineSoft.label}>데이터 백업/복원</Text>
        </TouchableOpacity>
      </View>

      {/* 버전 정보 */}
      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <Text style={[styles.label, { marginBottom: spacing.sm }]}>버전 정보</Text>
        <View style={styles.kvRow}>
          <Text style={styles.kKey}>앱 버전</Text>
          <Text style={styles.kVal}>{version}</Text>
        </View>
        <View style={styles.kvRow}>
          <Text style={styles.kKey}>빌드 번호</Text>
          <Text style={styles.kVal}>{build}</Text>
        </View>
      </View>
          </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },

  card: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  label: { fontSize: 16, fontWeight: '700', color: colors.gray800 },
  hint: { marginTop: spacing.sm, fontSize: 13, color: colors.gray600 },

  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  kKey: { fontSize: 14, color: colors.gray600 },
  kVal: { fontSize: 14, fontWeight: '700', color: colors.gray800 },
});
