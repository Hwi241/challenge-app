import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BackButton from '../components/BackButton';
import { colors, radius, spacing } from '../styles/common';
import { getAppSettings, setDataIntegrationSettings } from '../utils/appSettings';

const HEALTH_CONNECT_PROVIDER = 'healthConnect';

const STEP_PERMISSION_REQUEST = [
  { accessType: 'read', recordType: 'Steps' },
];

function loadHealthConnectModule() {
  try {
    return require('react-native-health-connect');
  } catch (e) {
    return null;
  }
}

function normalizePermissionList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.permissions)) return value.permissions;
  if (Array.isArray(value.grantedPermissions)) return value.grantedPermissions;
  return [value];
}

function hasReadStepsPermission(permissionResult) {
  const list = normalizePermissionList(permissionResult);
  return list.some(function(p) {
    var text = '';
    if (typeof p === 'string') text = p;
    else {
      var pieces = [p.accessType, p.access, p.recordType, p.record, p.dataType, p.permission, p.recordClassName];
      text = pieces.filter(Boolean).map(String).join(' ').toLowerCase();
    }
    return text.includes('read') && text.includes('step');
  });
}

function describeSdkStatus(sdkStatus) {
  if (sdkStatus === null || sdkStatus === undefined) return '확인 전';
  var s = String(sdkStatus);
  if (sdkStatus === 3 || s.toLowerCase().includes('available')) return '사용 가능';
  if (sdkStatus === 2 || s.toLowerCase().includes('update')) return '업데이트 필요';
  if (sdkStatus === 1 || s.toLowerCase().includes('unavail')) return '사용 불가';
  return '상태 ' + s;
}

function getStatusMeta(hc) {
  var s = (hc && hc.status) || 'notConnected';
  if (s === 'connected') return { label: '걸음 수 권한 연결됨', tone: 'success', desc: 'Health Connect에서 걸음 수 읽기 권한이 허용된 상태입니다.' };
  if (s === 'permissionDenied') return { label: '걸음 수 권한 필요', tone: 'warning', desc: 'Health Connect에서 걸음 수 읽기 권한이 아직 허용되지 않았습니다.' };
  if (s === 'unavailable') return { label: '사용 불가', tone: 'danger', desc: '이 기기에서 Health Connect를 사용할 수 없습니다.' };
  if (s === 'error') return { label: '오류', tone: 'danger', desc: (hc && hc.lastError) || 'Health Connect 확인 중 오류가 발생했습니다.' };
  return { label: '권한 미연결', tone: 'neutral', desc: '걸음 수 읽기 권한을 연결해 주세요.' };
}

export default function DataIntegrationsScreen({ navigation }) {
  var _a = useState(null), appSettings = _a[0], setAppSettings = _a[1];
  var _b = useState(true), loading = _b[0], setLoading = _b[1];
  var _c = useState(false), connecting = _c[0], setConnecting = _c[1];
  var _d = useState(false), openingSettings = _d[0], setOpeningSettings = _d[1];

  var hc = (appSettings && appSettings.dataIntegrations && appSettings.dataIntegrations.healthConnect) || {};
  var statusMeta = useMemo(function() { return getStatusMeta(hc); }, [hc.status, hc.lastError]);

  var loadSettings = useCallback(function() {
    setLoading(true);
    getAppSettings().then(function(s) { setAppSettings(s); }).catch(function() {
      Alert.alert('설정 불러오기 실패', '데이터 연동 설정을 불러오지 못했습니다.');
    }).finally(function() { setLoading(false); });
  }, []);

  useEffect(function() { loadSettings(); }, [loadSettings]);

  var saveHC = useCallback(function(next) {
    return setDataIntegrationSettings(HEALTH_CONNECT_PROVIDER, Object.assign({}, next, { updatedAt: new Date().toISOString() })).then(function(saved) {
      setAppSettings(saved);
      return saved;
    });
  }, []);

  var handleConnect = useCallback(function() {
    if (connecting) return;
    setConnecting(true);
    var mod = loadHealthConnectModule();
    if (!mod) {
      saveHC({ enabled: false, status: 'error', sdkStatus: null, permissions: { readSteps: false }, lastError: 'Expo Go에서는 Health Connect를 사용할 수 없습니다.' }).then(function() {
        Alert.alert('APK/개발 빌드 필요', 'Health Connect 권한 요청은 Expo Go가 아닌 APK 또는 개발 빌드에서만 동작합니다.');
      });
      setConnecting(false);
      return;
    }
    (async function() {
      try {
        var getSdkStatus = mod.getSdkStatus, initialize = mod.initialize, requestPermission = mod.requestPermission, getGrantedPermissions = mod.getGrantedPermissions;
        var sdkStatus = null;
        if (typeof getSdkStatus === 'function') sdkStatus = await getSdkStatus();
        if (typeof initialize === 'function') await initialize();
        var requestResult = null;
        if (typeof requestPermission === 'function') requestResult = await requestPermission(STEP_PERMISSION_REQUEST);
        var grantedResult = null;
        if (typeof getGrantedPermissions === 'function') grantedResult = await getGrantedPermissions();
        var readSteps = hasReadStepsPermission(requestResult) || hasReadStepsPermission(grantedResult);
        await saveHC({ enabled: readSteps, status: readSteps ? 'connected' : 'permissionDenied', sdkStatus: sdkStatus, permissions: { readSteps: readSteps }, lastError: readSteps ? null : '걸음 수 읽기 권한이 허용되지 않았습니다.' });
        Alert.alert(readSteps ? '걸음 수 권한 연결됨' : '걸음 수 권한 필요', readSteps ? 'Health Connect 걸음 수 읽기 권한이 허용되었습니다.' : '권한 화면이 열리지 않았거나 권한이 거부되었습니다. "Health Connect 권한 설정 열기"를 눌러 직접 확인하세요.');
      } catch (err) {
        var msg = (err && err.message) || 'Health Connect 권한 요청 중 오류가 발생했습니다.';
        await saveHC({ enabled: false, status: 'error', permissions: { readSteps: false }, lastError: msg });
        Alert.alert('Health Connect 오류', msg);
      } finally { setConnecting(false); }
    })();
  }, [connecting, saveHC]);

  var handleOpenSettings = useCallback(function() {
    setOpeningSettings(true);
    var mod = loadHealthConnectModule();
    if (!mod || typeof mod.openHealthConnectSettings !== 'function') {
      Alert.alert('설정 열기 실패', 'Health Connect 설정을 직접 열 수 없습니다. Android 설정에서 Health Connect 권한을 확인해 주세요.');
      setOpeningSettings(false);
      return;
    }
    mod.openHealthConnectSettings().catch(function() {
      Alert.alert('설정 열기 실패', 'Health Connect 설정을 여는 중 오류가 발생했습니다.');
    }).finally(function() { setOpeningSettings(false); });
  }, []);

  var handleRefresh = useCallback(function() {
    setConnecting(true);
    var mod = loadHealthConnectModule();
    if (!mod || typeof mod.getGrantedPermissions !== 'function') {
      Alert.alert('권한 재확인 불가', '현재 빌드에서 권한 재확인 기능을 사용할 수 없습니다.');
      setConnecting(false);
      return;
    }
    mod.getGrantedPermissions().then(function(granted) {
      var readSteps = hasReadStepsPermission(granted);
      return saveHC({ enabled: readSteps, status: readSteps ? 'connected' : 'permissionDenied', permissions: { readSteps: readSteps }, lastError: readSteps ? null : '걸음 수 읽기 권한이 아직 허용되지 않았습니다.' });
    }).then(function() {
      Alert.alert('권한 재확인 완료', '가장 최근 권한 상태로 업데이트했습니다.');
    }).catch(function(err) {
      var msg = (err && err.message) || '권한 재확인 중 오류가 발생했습니다.';
      Alert.alert('권한 재확인 오류', msg);
    }).finally(function() { setConnecting(false); });
  }, [saveHC]);

  var handleReset = useCallback(function() {
    Alert.alert('연결 상태 초기화', '앱에 저장된 연결 상태만 초기화합니다.', [
      { text: '취소', style: 'cancel' },
      { text: '초기화', style: 'destructive', onPress: function() {
        saveHC({ enabled: false, status: 'notConnected', sdkStatus: null, permissions: { readSteps: false }, lastError: null });
      }},
    ]);
  }, [saveHC]);

  if (loading) {
    return (
      <SafeAreaView style={ss.safeArea}>
        <View style={ss.center}><ActivityIndicator /><Text style={ss.loadText}>설정 불러오는 중...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={ss.safeArea}>
      <ScrollView contentContainerStyle={ss.content}>
        <BackButton title="데이터 출처 관리" />
        <Text style={ss.desc}>외부 데이터는 인증을 자동 완료하는 기능이 아니라, 기록을 증명하는 근거로 사용됩니다.</Text>

        {/* Health Connect */}
        <View style={ss.card}>
          <View style={ss.cardHdr}>
            <View style={{ flex: 1 }}>
              <Text style={ss.cardTitle}>Health Connect</Text>
              <Text style={ss.cardSub}>삼성헬스·Google Fit 등 건강 데이터 허브</Text>
            </View>
            <Pill label={statusMeta.label} tone={statusMeta.tone} />
          </View>
          <Text style={ss.descSmall}>{statusMeta.desc}</Text>

          <View style={ss.notice}>
            <Text style={ss.noticeTitle}>현재 테스트 지원 범위</Text>
            <Text style={ss.noticeText}>지금은 Health Connect 전체 연결이 아니라 "걸음 수 읽기" 권한만 먼저 연결합니다.</Text>
          </View>

          <View style={ss.infoList}>
            <Text style={ss.infoItem}>• 요청 권한: 걸음 수 읽기 (READ_STEPS)</Text>
            <Text style={ss.infoItem}>• 저장 내용: 연결 여부와 권한 상태</Text>
            <Text style={ss.infoItem}>• 아직 실제 걸음 수 데이터는 읽지 않음</Text>
            <Text style={ss.infoItem}>• SDK 상태: {describeSdkStatus(hc.sdkStatus)}</Text>
          </View>

          <TouchableOpacity style={[ss.btnPrimary, connecting && ss.btnDisabled]} onPress={handleConnect} disabled={connecting} activeOpacity={0.85}>
            <Text style={ss.btnPrimaryText}>{connecting ? '걸음 수 권한 확인 중...' : '걸음 수 권한 연결하기'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[ss.btnSecondary, openingSettings && ss.btnDisabled]} onPress={handleOpenSettings} disabled={openingSettings} activeOpacity={0.85}>
            <Text style={ss.btnSecondaryText}>{openingSettings ? '설정 여는 중...' : 'Health Connect 권한 설정 열기'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[ss.btnSecondary, connecting && ss.btnDisabled]} onPress={handleRefresh} disabled={connecting} activeOpacity={0.85}>
            <Text style={ss.btnSecondaryText}>걸음 수 권한 다시 확인</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ss.btnText} onPress={handleReset} activeOpacity={0.75}>
            <Text style={ss.btnTextLabel}>앱 연결 상태 초기화</Text>
          </TouchableOpacity>
        </View>

        {/* Future */}
        <View style={ss.card}>
          <Text style={ss.cardTitle}>이후 확장 예정</Text>
          <View style={ss.futureGrid}>
            {['운동 기록','이동 거리','칼로리','수면','심박','체중'].map(function(m) {
              return <View key={m} style={ss.chip}><Text style={ss.chipText}>{m}</Text></View>;
            })}
          </View>
        </View>

        {/* Strava */}
        <View style={ss.card}>
          <View style={ss.cardHdr}>
            <View style={{ flex: 1 }}>
              <Text style={ss.cardTitle}>Strava</Text>
              <Text style={ss.cardSub}>러닝·라이딩 기록 연동</Text>
            </View>
            <Pill label="준비 예정" tone="neutral" />
          </View>
          <Text style={ss.descSmall}>OAuth 로그인과 운동 기록 선택 첨부 방식으로 확장할 예정입니다.</Text>
        </View>

        {/* Garmin */}
        <View style={ss.card}>
          <View style={ss.cardHdr}>
            <View style={{ flex: 1 }}>
              <Text style={ss.cardTitle}>Garmin</Text>
              <Text style={ss.cardSub}>웨어러블 운동 기록 연동</Text>
            </View>
            <Pill label="준비 예정" tone="neutral" />
          </View>
          <Text style={ss.descSmall}>API 제공 범위와 개인 계정 연동 가능성을 확인한 뒤 추가합니다.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Pill(props) {
  var bg, tx;
  if (props.tone === 'success') { bg = '#DCFCE7'; tx = '#166534'; }
  else if (props.tone === 'warning') { bg = '#FEF3C7'; tx = '#92400E'; }
  else if (props.tone === 'danger') { bg = '#FEE2E2'; tx = '#991B1B'; }
  else { bg = colors.gray400 || '#F1F5F9'; tx = colors.gray600 || '#475569'; }
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: bg }}>
      <Text style={{ fontSize: 11, fontWeight: '800', color: tx }}>{props.label}</Text>
    </View>
  );
}

var ss = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background || '#F8FAFC' },
  content: { padding: spacing.lg || 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadText: { marginTop: 8, fontSize: 14, color: colors.gray600 || '#525252' },
  desc: { marginTop: 8, marginBottom: spacing.lg || 20, fontSize: 14, lineHeight: 20, color: colors.gray600 || '#525252' },
  descSmall: { marginTop: spacing.md || 12, fontSize: 14, lineHeight: 20, color: colors.gray600 || '#525252' },
  card: { padding: spacing.lg || 20, borderRadius: radius.lg || 16, backgroundColor: colors.surface || '#FFF', marginBottom: spacing.md || 12, borderWidth: 1, borderColor: colors.borderSoft || '#E2E8F0' },
  cardHdr: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.gray800 || '#111' },
  cardSub: { marginTop: 3, fontSize: 13, color: colors.gray600 || '#525252' },
  notice: { marginTop: spacing.md || 12, padding: spacing.md || 12, borderRadius: radius.md || 12, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  noticeTitle: { fontSize: 13, fontWeight: '800', color: '#1D4ED8', marginBottom: 4 },
  noticeText: { fontSize: 13, lineHeight: 19, color: '#1E40AF' },
  infoList: { marginTop: spacing.md || 12 },
  infoItem: { fontSize: 13, lineHeight: 20, color: colors.gray600 || '#525252' },
  btnPrimary: { marginTop: spacing.lg || 20, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md || 12, backgroundColor: colors.black || '#111' },
  btnPrimaryText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  btnSecondary: { marginTop: 8, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md || 12, backgroundColor: colors.gray400 || '#F1F5F9', borderWidth: 1, borderColor: colors.borderSoft || '#E2E8F0' },
  btnSecondaryText: { fontSize: 14, fontWeight: '800', color: colors.gray800 || '#111' },
  btnDisabled: { opacity: 0.55 },
  btnText: { alignSelf: 'center', marginTop: spacing.md || 12, paddingVertical: 8 },
  btnTextLabel: { fontSize: 13, fontWeight: '700', color: colors.gray600 || '#525252' },
  futureGrid: { marginTop: spacing.md || 12, flexDirection: 'row', flexWrap: 'wrap' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.gray400 || '#F1F5F9', borderWidth: 1, borderColor: colors.borderSoft || '#E2E8F0', marginRight: 8, marginBottom: 8 },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.gray600 || '#525252' },
});
