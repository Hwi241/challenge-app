// screens/SettingsScreen.js
import React, { useCallback, useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Application from 'expo-application';
import * as MailComposer from 'expo-mail-composer';
import * as StoreReview from 'expo-store-review';
import { useNavigation } from '@react-navigation/native';

import { colors, spacing, radius, buttonStyles } from '../styles/common';

const STORAGE_KEY = 'settings.notificationsEnabled';
// 출시 후 App Store ID가 생기면 여기에 숫자만 입력
const IOS_APP_ID = null;

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

  const sendFeedback = useCallback(async () => {
    try {
      const available = await MailComposer.isAvailableAsync();
      const subject = 'THE - PUSH 피드백';
      const body = '아래에 개선 의견을 적어주세요.\n\n— 기기/OS 정보도 적어주시면 큰 도움이 됩니다.';
      if (available) {
        await MailComposer.composeAsync({
          recipients: ['feedback@the-push.app'],
          subject, body,
        });
        return;
      }
      const mailto = `mailto:feedback@the-push.app?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      const can = await Linking.canOpenURL(mailto);
      if (can) return Linking.openURL(mailto);
      Alert.alert('안내', '이 기기에서 메일 앱을 열 수 없습니다.');
    } catch {
      Alert.alert('안내', '메일 작성 화면을 열 수 없습니다.');
    }
  }, []);

  const getStoreUrl = useCallback(() => {
    if (Platform.OS === 'android') {
      if (!androidPackage) return null;
      return `https://play.google.com/store/apps/details?id=${androidPackage}`;
    }
    if (!IOS_APP_ID) return null;
    return `itms-apps://itunes.apple.com/app/id${IOS_APP_ID}?action=write-review`;
  }, [androidPackage]);

  const requestStoreReview = useCallback(async () => {
    try {
      const available = await StoreReview.isAvailableAsync();
      if (available) {
        await StoreReview.requestReview();
        return;
      }
      const url = getStoreUrl();
      if (url) {
        const can = await Linking.canOpenURL(url);
        if (can) return Linking.openURL(url);
      }
      Alert.alert('안내', '리뷰 기능을 사용할 수 없습니다.');
    } catch {
      Alert.alert('안내', '리뷰 요청에 실패했습니다.');
    }
  }, [getStoreUrl]);

  return (
    <SafeAreaView style={styles.container}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },

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

  kvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  kKey: { fontSize: 14, color: colors.gray600 },
  kVal: { fontSize: 14, fontWeight: '700', color: colors.gray800 },
});
