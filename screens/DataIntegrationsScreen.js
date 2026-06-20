import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import BackButton from '../components/BackButton';
import { colors, radius, spacing } from '../styles/common';
import { getAppSettings, setDataIntegrationSettings } from '../utils/appSettings';

const HEALTH_CONNECT_PROVIDER = 'healthConnect';

function getHealthConnectModule() {
  try {
    return require('react-native-health-connect');
  } catch (error) {
    console.log('[DataIntegrations] Health Connect module load failed:', error?.message);
    return null;
  }
}

function describeSdkStatus(healthConnect, sdkStatus) {
  const statusMap = healthConnect?.SdkAvailabilityStatus;
  if (statusMap && typeof statusMap === 'object') {
    const matched = Object.entries(statusMap).find(([, value]) => value === sdkStatus);
    if (matched?.[0]) return matched[0];
  }
  if (sdkStatus === null || sdkStatus === undefined) return null;
  return String(sdkStatus);
}

function hasReadStepsPermission(permissions) {
  const list = Array.isArray(permissions) ? permissions
    : Array.isArray(permissions?.permissions) ? permissions.permissions
    : [];
  return list.some((permission) => {
    const recordType = String(permission?.recordType || '').toLowerCase();
    const accessType = String(permission?.accessType || '').toLowerCase();
    return recordType === 'steps' && accessType === 'read';
  });
}

export default function DataIntegrationsScreen() {
  const [healthConnect, setHealthConnect] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const readSteps = !!healthConnect?.permissions?.readSteps;
  const healthStatus = healthConnect?.status || 'notConnected';

  const statusLabel = useMemo(() => {
    if (readSteps || healthStatus === 'connected') return '연결됨';
    if (healthStatus === 'permissionDenied') return '권한 필요';
    if (healthStatus === 'unavailable') return '사용 불가';
    if (healthStatus === 'error') return '오류';
    return '연결 안 됨';
  }, [healthStatus, readSteps]);

  const statusTone = useMemo(() => {
    if (readSteps || healthStatus === 'connected') return 'connected';
    if (healthStatus === 'permissionDenied') return 'warning';
    if (healthStatus === 'unavailable' || healthStatus === 'error') return 'error';
    return 'idle';
  }, [healthStatus, readSteps]);

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const settings = await getAppSettings();
      setHealthConnect(settings?.dataIntegrations?.healthConnect || null);
    } catch (error) {
      console.log('[DataIntegrations] load failed:', error?.message);
      setHealthConnect(null);
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const persistHealthConnect = useCallback(async (next) => {
    const saved = await setDataIntegrationSettings(HEALTH_CONNECT_PROVIDER, {
      ...next,
      updatedAt: new Date().toISOString(),
    });
    setHealthConnect(saved?.dataIntegrations?.healthConnect || null);
    return saved;
  }, []);

  const handleConnect = useCallback(async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      const healthModule = getHealthConnectModule();
      if (!healthModule) {
        await persistHealthConnect({
          enabled: false, status: 'unavailable', sdkStatus: null,
          permissions: { readSteps: false },
          lastError: 'Health Connect 모듈을 불러올 수 없습니다. APK 또는 개발 빌드에서 확인해 주세요.',
        });
        Alert.alert('APK/개발 빌드 필요',
          'Health Connect 연결은 Expo Go가 아니라 APK 또는 개발 빌드에서 확인할 수 있어요.');
        return;
      }
      const { getSdkStatus, initialize, requestPermission } = healthModule;
      if (typeof initialize !== 'function' || typeof requestPermission !== 'function') {
        await persistHealthConnect({
          enabled: false, status: 'error', sdkStatus: null,
          permissions: { readSteps: false },
          lastError: 'Health Connect API를 확인할 수 없습니다.',
        });
        Alert.alert('연동 확인 필요', 'Health Connect 모듈 API를 확인할 수 없습니다.');
        return;
      }
      let sdkStatus = null;
      let sdkStatusLabel = null;
      if (typeof getSdkStatus === 'function') {
        sdkStatus = await getSdkStatus();
        sdkStatusLabel = describeSdkStatus(healthModule, sdkStatus);
      }
      const initialized = await initialize();
      if (!initialized) {
        await persistHealthConnect({
          enabled: false, status: 'unavailable', sdkStatus: sdkStatusLabel,
          permissions: { readSteps: false },
          lastError: 'Health Connect 초기화에 실패했습니다.',
        });
        Alert.alert('연결 실패', 'Health Connect를 초기화할 수 없습니다.');
        return;
      }
      const grantedPermissions = await requestPermission([
        { accessType: 'read', recordType: 'Steps' },
      ]);
      const grantedReadSteps = hasReadStepsPermission(grantedPermissions);
      await persistHealthConnect({
        enabled: grantedReadSteps,
        status: grantedReadSteps ? 'connected' : 'permissionDenied',
        sdkStatus: sdkStatusLabel,
        permissions: { readSteps: grantedReadSteps },
        lastError: grantedReadSteps ? null : '걸음 수 읽기 권한이 허용되지 않았습니다.',
      });
      Alert.alert(grantedReadSteps ? '연결 완료' : '권한 필요',
        grantedReadSteps ? '걸음 수 읽기 권한이 허용되었습니다.' : '걸음 수 읽기 권한이 허용되지 않았습니다.');
    } catch (error) {
      const message = error?.message || 'Health Connect 연결 중 오류가 발생했습니다.';
      console.log('[DataIntegrations] connect failed:', message);
      await persistHealthConnect({
        enabled: false, status: 'error',
        permissions: { readSteps: false },
        lastError: message,
      });
      Alert.alert('연결 실패', message);
    } finally {
      setConnecting(false);
    }
  }, [connecting, persistHealthConnect]);

  const handleReset = useCallback(() => {
    Alert.alert('연결 상태 초기화',
      '더푸시에 저장된 Health Connect 연결 상태만 초기화합니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '초기화', style: 'destructive',
          onPress: async () => {
            try {
              await persistHealthConnect({
                enabled: false, status: 'notConnected',
                sdkStatus: null, permissions: { readSteps: false },
                lastError: null,
              });
            } catch (error) {
              Alert.alert('안내', error?.message || '연결 상태를 초기화할 수 없습니다.');
            }
          },
        },
      ]);
  }, [persistHealthConnect]);

  const healthConnectItems = useMemo(() => {
    const items = [
      'Samsung Health, Google Fit 등 Health Connect에 연결된 건강 데이터를 사용할 수 있어요.',
      '현재 1차 대상 데이터는 걸음 수입니다.',
      readSteps ? '걸음 수 읽기 권한이 허용되었습니다.' : '연결 버튼을 눌러 걸음 수 읽기 권한을 허용해 주세요.',
    ];
    if (healthConnect?.sdkStatus) items.push('SDK: ' + healthConnect.sdkStatus);
    if (healthConnect?.lastError) items.push('상태: ' + healthConnect.lastError);
    return items;
  }, [healthConnect?.lastError, healthConnect?.sdkStatus, readSteps]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <BackButton title="데이터 출처 관리" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>데이터 연동</Text>
          <Text style={styles.title}>데이터 출처 관리</Text>
          <Text style={styles.description}>
            인증/기록하기에서 사용할 외부 데이터 출처를 관리합니다. 연결된 출처의 데이터만 인증에 첨부할 수 있습니다.
          </Text>
        </View>

        <View style={styles.providerCard}>
          <View style={styles.providerHeader}>
            <View style={styles.providerTitleWrap}>
              <Text style={styles.providerName}>Health Connect</Text>
              <Text style={styles.providerDescription}>Android 건강 데이터 연결</Text>
            </View>
            <View style={[styles.statusPill, styles['statusPill_' + statusTone]]}>
              <View style={[styles.statusDot, styles['statusDot_' + statusTone]]} />
              <Text style={[styles.statusText, styles['statusText_' + statusTone]]}>
                {loadingSettings ? '확인 중' : statusLabel}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />
          {healthConnectItems.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}

          <TouchableOpacity
            activeOpacity={0.9}
            disabled={connecting || loadingSettings}
            onPress={handleConnect}
            style={[styles.primaryButton, (connecting || loadingSettings) && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>
              {connecting ? '연결 확인 중...' : readSteps ? '권한 다시 확인' : 'Health Connect 연결하기'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            disabled={connecting || loadingSettings}
            onPress={handleReset}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>연결 상태 초기화</Text>
          </TouchableOpacity>

          <View style={styles.nextBox}>
            <Text style={styles.nextTitle}>다음 단계 예정</Text>
            <Text style={styles.nextText}>
              다음 단계에서 선택한 날짜의 걸음 수 데이터를 불러와 인증/기록하기 화면에 첨부하는 흐름을 연결합니다.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  heroCard: { backgroundColor: colors.surface, borderColor: colors.borderSoft, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  eyebrow: { color: colors.gray600, fontSize: 12, fontWeight: '800', marginBottom: 6 },
  title: { color: colors.gray800, fontSize: 24, fontWeight: '900', marginBottom: spacing.sm },
  description: { color: colors.gray600, fontSize: 14, lineHeight: 21 },
  providerCard: { marginTop: spacing.lg, backgroundColor: colors.surface, borderColor: colors.borderSoft, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  providerHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  providerTitleWrap: { flex: 1, paddingRight: spacing.md },
  providerName: { color: colors.gray800, fontSize: 18, fontWeight: '900' },
  providerDescription: { color: colors.gray600, fontSize: 13, lineHeight: 19, marginTop: 5 },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F3F4F6' },
  statusPill_connected: { backgroundColor: '#ECFDF3' },
  statusPill_warning: { backgroundColor: '#FFF7ED' },
  statusPill_error: { backgroundColor: '#FEF2F2' },
  statusPill_idle: { backgroundColor: '#F3F4F6' },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 7, backgroundColor: colors.black },
  statusDot_connected: { backgroundColor: '#16A34A' },
  statusDot_warning: { backgroundColor: '#F97316' },
  statusDot_error: { backgroundColor: '#EF4444' },
  statusDot_idle: { backgroundColor: colors.black },
  statusText: { color: colors.gray800, fontSize: 12, fontWeight: '800' },
  statusText_connected: { color: '#166534' },
  statusText_warning: { color: '#9A3412' },
  statusText_error: { color: '#991B1B' },
  statusText_idle: { color: colors.gray800 },
  divider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: spacing.md },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
  bulletDot: { width: 5, height: 5, borderRadius: 3, marginTop: 7, marginRight: 8, backgroundColor: colors.black },
  bulletText: { flex: 1, color: colors.gray600, fontSize: 14, lineHeight: 20 },
  primaryButton: { marginTop: spacing.lg, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.black },
  disabledButton: { opacity: 0.55 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  secondaryButton: { marginTop: spacing.sm, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderColor: colors.borderSoft, borderWidth: 1, backgroundColor: colors.surface },
  secondaryButtonText: { color: colors.gray600, fontSize: 14, fontWeight: '800' },
  nextBox: { marginTop: spacing.lg, backgroundColor: '#F9FAFB', borderColor: colors.borderSoft, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  nextTitle: { color: colors.gray800, fontSize: 14, fontWeight: '800', marginBottom: 5 },
  nextText: { color: colors.gray600, fontSize: 13, lineHeight: 19 },
});
