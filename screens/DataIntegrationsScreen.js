import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BackButton from '../components/BackButton';
import { colors, radius, spacing } from '../styles/common';
import { getAppSettings, setDataIntegrationSettings } from '../utils/appSettings';

const HEALTH_CONNECT_PROVIDER = 'healthConnect';

const HEALTH_CONNECT_DATA_TYPES = [
  { key: 'steps',       title: '걸음 수',     permissionKey: 'readSteps',           unit: 'steps',   recordType: 'Steps',            status: 'apkReady',  summary: '일별 걸음 수를 인증 근거와 그래프에 사용할 수 있습니다.',       proofUse: '걷기·산책·출퇴근 챌린지',                     graphUse: '일간/주간 걸음 리듬 그래프' },
  { key: 'exercise',    title: '운동 기록',   permissionKey: 'readExerciseSessions', unit: 'sessions',recordType: 'ExerciseSession',    status: 'planned',  summary: '러닝, 사이클, 헬스 등 운동 세션을 인증 근거로 사용할 예정입니다.', proofUse: '운동 완료 인증',                          graphUse: '운동 시간/횟수 그래프' },
  { key: 'distance',    title: '이동 거리',   permissionKey: 'readDistance',          unit: 'm',       recordType: 'Distance',          status: 'planned',  summary: '걷기·러닝·라이딩 거리 데이터를 인증 근거로 사용할 예정입니다.',   proofUse: '거리 목표 인증',                          graphUse: '일간/주간 거리 그래프' },
  { key: 'calories',    title: '칼로리',     permissionKey: 'readTotalCaloriesBurned',unit: 'kcal',    recordType: 'TotalCaloriesBurned',status: 'planned',  summary: '활동 칼로리 데이터를 운동 기록의 보조 근거로 사용할 예정입니다.',   proofUse: '운동 강도 보조 근거',                      graphUse: '칼로리 소모 그래프' },
  { key: 'sleep',       title: '수면',       permissionKey: 'readSleep',              unit: 'hours',   recordType: 'SleepSession',      status: 'planned',  summary: '수면 시간과 수면 세션을 생활 루틴 인증에 사용할 예정입니다.',       proofUse: '수면 루틴 인증',                          graphUse: '수면 시간 그래프' },
  { key: 'heartRate',   title: '심박',       permissionKey: 'readHeartRate',          unit: 'bpm',     recordType: 'HeartRate',         status: 'planned',  summary: '운동 중 심박 변화와 평균 심박을 보조 지표로 사용할 예정입니다.',     proofUse: '운동 강도 보조 근거',                      graphUse: '심박 변화 그래프' },
  { key: 'weight',      title: '체중',       permissionKey: 'readWeight',             unit: 'kg',      recordType: 'Weight',            status: 'planned',  summary: '체중 변화를 장기 목표 관리 그래프로 사용할 예정입니다.',           proofUse: '체중 관리 기록',                          graphUse: '체중 변화 그래프' },
];

function loadHealthConnectModule() {
  try { return require('react-native-health-connect'); } catch (e) { return null; }
}

function normalizePermissionList(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (Array.isArray(v.permissions)) return v.permissions;
  if (Array.isArray(v.grantedPermissions)) return v.grantedPermissions;
  return [v];
}

function permText(p) {
  if (!p) return '';
  if (typeof p === 'string') return p;
  return [p.accessType, p.access, p.recordType, p.record, p.dataType, p.permission, p.recordClassName].filter(Boolean).map(String).join(' ').toLowerCase();
}

function hasReadStepsPermission(r) {
  return normalizePermissionList(r).some(function(p) {
    var t = permText(p);
    return t.includes('read') && t.includes('step');
  });
}

function describeSdkStatus(s) {
  if (s == null) return '확인 전';
  var t = String(s).toLowerCase();
  if (s === 3 || t.includes('available')) return '사용 가능';
  if (s === 2 || t.includes('update')) return '업데이트 필요';
  if (s === 1 || t.includes('unavail')) return '사용 불가';
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

function getMetricStatusMeta(m, perms) {
  if (m.key === 'steps') {
    if (perms && perms.readSteps) return { label: '권한 연결됨', tone: 'success', desc: 'APK에서 Health Connect 걸음 수 읽기 권한이 연결된 상태입니다.' };
    return { label: 'APK 연결 가능', tone: 'warning', desc: 'APK에서 Health Connect 걸음 수 읽기 권한을 요청할 수 있습니다.' };
  }
  return { label: 'UI 준비 중', tone: 'neutral', desc: 'Expo Go에서는 선택/저장 구조만 확인합니다.' };
}

function getSelectedMetricTypes(hc) {
  var sel = hc && hc.selectedMetricTypes;
  if (Array.isArray(sel) && sel.length > 0) return sel.filter(function(k) { return HEALTH_CONNECT_DATA_TYPES.some(function(t) { return t.key === k; }); });
  return ['steps'];
}

export default function DataIntegrationsScreen({ navigation }) {
  var _a = useState(null), appSettings = _a[0], setAppSettings = _a[1];
  var _b = useState(true), loading = _b[0], setLoading = _b[1];
  var _c = useState(false), connecting = _c[0], setConnecting = _c[1];
  var _d = useState(false), openingSettings = _d[0], setOpeningSettings = _d[1];

  var hc = (appSettings && appSettings.dataIntegrations && appSettings.dataIntegrations.healthConnect) || {};
  var statusMeta = useMemo(function() { return getStatusMeta(hc); }, [hc.status, hc.lastError]);
  var selectedMetricTypes = useMemo(function() { return getSelectedMetricTypes(hc); }, [hc.selectedMetricTypes]);
  var metricEnabledMap = useMemo(function() {
    var s = new Set(selectedMetricTypes);
    var m = {};
    HEALTH_CONNECT_DATA_TYPES.forEach(function(t) { m[t.key] = s.has(t.key); });
    return m;
  }, [selectedMetricTypes]);

  var loadSettings = useCallback(function() {
    setLoading(true);
    getAppSettings().then(function(s) { setAppSettings(s); }).catch(function() {
      Alert.alert('설정 불러오기 실패', '데이터 연동 설정을 불러오지 못했습니다.');
    }).finally(function() { setLoading(false); });
  }, []);

  useEffect(function() { loadSettings(); }, [loadSettings]);

  var saveHC = useCallback(function(next) {
    return setDataIntegrationSettings(HEALTH_CONNECT_PROVIDER, Object.assign({}, next, { updatedAt: new Date().toISOString() })).then(function(saved) {
      setAppSettings(saved); return saved;
    });
  }, []);

  var toggleMetric = useCallback(function(key) {
    var s = new Set(selectedMetricTypes);
    if (s.has(key)) s.delete(key); else s.add(key);
    var next = HEALTH_CONNECT_DATA_TYPES.map(function(t) { return t.key; }).filter(function(k) { return s.has(k); });
    if (next.length === 0) { Alert.alert('최소 1개 필요', '기록 화면에서 사용할 항목을 최소 1개 이상 선택해주세요.'); return; }
    saveHC(Object.assign({}, hc, { selectedMetricTypes: next, metricSettings: HEALTH_CONNECT_DATA_TYPES.reduce(function(acc, t) {
      acc[t.key] = { enabled: next.includes(t.key), permissionKey: t.permissionKey, recordType: t.recordType, unit: t.unit, apkPermissionReady: t.key === 'steps' };
      return acc;
    }, {}) }));
  }, [hc, saveHC, selectedMetricTypes]);

  var handleConnect = useCallback(function() {
    if (connecting) return; setConnecting(true);
    var mod = loadHealthConnectModule();
    if (!mod) {
      saveHC(Object.assign({}, hc, { enabled: false, status: 'error', permissions: Object.assign({}, (hc.permissions||{}), { readSteps: false }), lastError: 'Expo Go에서는 Health Connect 네이티브 모듈을 사용할 수 없습니다.' }));
      Alert.alert('APK/개발 빌드 필요', 'Health Connect 권한 요청은 APK 또는 개발 빌드에서만 동작합니다.');
      setConnecting(false); return;
    }
    (async function() {
      try {
        var gs = mod.getSdkStatus, init = mod.initialize, rp = mod.requestPermission, gpp = mod.getGrantedPermissions;
        var sdk = typeof gs === 'function' ? await gs() : null;
        if (typeof init === 'function') await init();
        var reqR = typeof rp === 'function' ? await rp([{ accessType: 'read', recordType: 'Steps' }]) : null;
        var grR = typeof gpp === 'function' ? await gpp() : null;
        var rs = hasReadStepsPermission(reqR) || hasReadStepsPermission(grR);
        await saveHC(Object.assign({}, hc, { enabled: rs, status: rs ? 'connected' : 'permissionDenied', sdkStatus: sdk, permissions: Object.assign({}, (hc.permissions||{}), { readSteps: rs }), lastError: rs ? null : '걸음 수 읽기 권한이 허용되지 않았습니다.' }));
        Alert.alert(rs ? '연결됨' : '권한 필요', rs ? '걸음 수 읽기 권한이 허용되었습니다.' : '권한이 거부되었습니다.');
      } catch(err) {
        var msg = (err && err.message) || 'Health Connect 오류';
        await saveHC(Object.assign({}, hc, { enabled: false, status: 'error', permissions: Object.assign({}, (hc.permissions||{}), { readSteps: false }), lastError: msg }));
        Alert.alert('오류', msg);
      } finally { setConnecting(false); }
    })();
  }, [connecting, hc, saveHC]);

  var handleOpenSettings = useCallback(function() {
    setOpeningSettings(true);
    var mod = loadHealthConnectModule();
    (async function() {
      try {
        if (mod && typeof mod.openHealthConnectSettings === 'function') { await mod.openHealthConnectSettings(); return; }
        var Linking = require('react-native').Linking;
        await Linking.openSettings();
      } catch(e) { Alert.alert('설정 열기 실패'); }
      finally { setOpeningSettings(false); }
    })();
  }, []);

  var handleRefresh = useCallback(function() {
    setConnecting(true);
    var mod = loadHealthConnectModule();
    if (!mod || typeof mod.getGrantedPermissions !== 'function') {
      Alert.alert('권한 재확인 불가'); setConnecting(false); return;
    }
    mod.getGrantedPermissions().then(function(r) {
      var rs = hasReadStepsPermission(r);
      return saveHC(Object.assign({}, hc, { enabled: rs, status: rs ? 'connected' : 'permissionDenied', permissions: Object.assign({}, (hc.permissions||{}), { readSteps: rs }), lastError: rs ? null : '권한이 아직 허용되지 않았습니다.' }));
    }).then(function() { Alert.alert('권한 재확인 완료'); }).catch(function(err) { Alert.alert('오류', (err&&err.message)||'권한 재확인 오류'); }).finally(function() { setConnecting(false); });
  }, [hc, saveHC]);

  var handleReset = useCallback(function() {
    Alert.alert('초기화', '앱 저장 상태만 초기화합니다.', [
      { text: '취소', style: 'cancel' },
      { text: '초기화', style: 'destructive', onPress: function() {
        saveHC({ enabled: false, status: 'notConnected', sdkStatus: null, selectedMetricTypes: ['steps'], permissions: { readSteps: false }, lastError: null });
      }},
    ]);
  }, [saveHC]);

  if (loading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.center}><ActivityIndicator /><Text style={s.loadText}>불러오는 중...</Text></View>
      </SafeAreaView>
    );
  }

  var perms = hc.permissions || {};

  return (
    <SafeAreaView style={s.safeArea}>
      <ScrollView contentContainerStyle={s.content}>
        <BackButton title="데이터 출처 관리" />

        <View style={s.card}>
          <View style={s.cardHdr}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Health Connect</Text>
              <Text style={s.cardSub}>삼성헬스·Google Fit 등 건강 데이터 허브</Text>
            </View>
            <Pill label={statusMeta.label} tone={statusMeta.tone} />
          </View>
          <Text style={s.desc}>{statusMeta.desc}</Text>
          <View style={s.notice}>
            <Text style={s.noticeTitle}>중간 단계 작업 기준</Text>
            <Text style={s.noticeText}>Expo Go에서 화면과 저장 구조만 확인합니다. 실제 권한 요청은 APK 통합 테스트에서 확인합니다.</Text>
          </View>
          <View style={s.infoList}>
            <Text style={s.infoItem}>• APK 확인 완료: 걸음 수 권한 연결</Text>
            <Text style={s.infoItem}>• Expo Go 확인 범위: 데이터 타입 UI, 토글, 저장 구조</Text>
            <Text style={s.infoItem}>• SDK: {describeSdkStatus(hc.sdkStatus)}</Text>
            <Text style={s.infoItem}>• 기록 화면 사용 항목: {selectedMetricTypes.length}개</Text>
          </View>
          <TouchableOpacity style={[s.btnPri, connecting && s.btnDis]} onPress={handleConnect} disabled={connecting} activeOpacity={0.85}>
            <Text style={s.btnPriTxt}>{connecting ? '확인 중...' : '걸음 수 권한 연결하기'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnSec, openingSettings && s.btnDis]} onPress={handleOpenSettings} disabled={openingSettings} activeOpacity={0.85}>
            <Text style={s.btnSecTxt}>Health Connect 권한 설정 열기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnSec, connecting && s.btnDis]} onPress={handleRefresh} disabled={connecting} activeOpacity={0.85}>
            <Text style={s.btnSecTxt}>걸음 수 권한 다시 확인</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnTxt} onPress={handleReset} activeOpacity={0.75}>
            <Text style={s.btnTxtLabel}>앱 연결 상태 초기화</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.secTitle}>연동 데이터 타입</Text>
        <Text style={s.secDesc}>인증/기록하기 화면과 그래프에서 사용할 Health Connect 항목을 미리 선택합니다.</Text>

        {HEALTH_CONNECT_DATA_TYPES.map(function(m) {
          var ms = getMetricStatusMeta(m, perms);
          return (
            <View key={m.key} style={s.mCard}>
              <View style={s.mHdr}>
                <View style={{ flex: 1 }}>
                  <Text style={s.mTitle}>{m.title}</Text>
                  <Text style={s.mType}>{m.recordType}</Text>
                </View>
                <Pill label={ms.label} tone={ms.tone} />
              </View>
              <Text style={s.mDesc}>{m.summary}</Text>
              <Text style={s.mSub}>{ms.desc}</Text>
              <View style={s.mMeta}>
                <Text style={s.mMetaLbl}>인증 근거</Text><Text style={s.mMetaVal}>{m.proofUse}</Text>
                <Text style={s.mMetaLbl}>그래프</Text><Text style={s.mMetaVal}>{m.graphUse}</Text>
                <Text style={s.mMetaLbl}>단위</Text><Text style={s.mMetaVal}>{m.unit}</Text>
              </View>
              <View style={s.tglRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.tglTitle}>기록 화면에서 사용</Text>
                  <Text style={s.tglDesc}>인증/기록하기 화면에서 이 연동 데이터 항목을 선택지로 보여줍니다.</Text>
                </View>
                <Switch value={metricEnabledMap[m.key]} onValueChange={function() { toggleMetric(m.key); }} />
              </View>
            </View>
          );
        })}

        <View style={s.card}>
          <View style={s.cardHdr}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Strava</Text>
              <Text style={s.cardSub}>러닝·라이딩 기록 연동</Text>
            </View>
            <Pill label="준비 예정" tone="neutral" />
          </View>
          <Text style={s.desc}>OAuth 로그인과 운동 기록 선택 첨부 방식으로 확장할 예정입니다.</Text>
        </View>

        <View style={s.card}>
          <View style={s.cardHdr}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Garmin</Text>
              <Text style={s.cardSub}>웨어러블 운동 기록 연동</Text>
            </View>
            <Pill label="준비 예정" tone="neutral" />
          </View>
          <Text style={s.desc}>API 제공 범위와 개인 계정 연동 가능성을 확인한 뒤 추가합니다.</Text>
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
  else { bg = '#F1F5F9'; tx = '#475569'; }
  return (<View style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: bg }}><Text style={{ fontSize: 11, fontWeight: '800', color: tx }}>{props.label}</Text></View>);
}

var s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background || '#F8FAFC' },
  content: { padding: spacing.lg || 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadText: { marginTop: 8, fontSize: 14, color: colors.gray600 || '#475569' },
  desc: { marginTop: spacing.md || 12, fontSize: 14, lineHeight: 20, color: colors.gray600 || '#475569' },
  card: { padding: spacing.lg || 20, borderRadius: radius.lg || 16, backgroundColor: colors.surface || '#FFF', marginBottom: spacing.md || 12, borderWidth: 1, borderColor: colors.borderSoft || '#E2E8F0' },
  cardHdr: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.gray800 || '#0F172A' },
  cardSub: { marginTop: 3, fontSize: 13, color: colors.gray600 || '#475569' },
  notice: { marginTop: spacing.md || 12, padding: spacing.md || 12, borderRadius: radius.md || 12, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  noticeTitle: { fontSize: 13, fontWeight: '800', color: '#1D4ED8', marginBottom: 4 },
  noticeText: { fontSize: 13, lineHeight: 19, color: '#1E40AF' },
  infoList: { marginTop: spacing.md || 12 },
  infoItem: { fontSize: 13, lineHeight: 20, color: colors.gray600 || '#475569' },
  btnPri: { marginTop: spacing.lg || 20, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md || 12, backgroundColor: colors.black || '#2563EB' },
  btnPriTxt: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  btnSec: { marginTop: 8, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md || 12, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: colors.borderSoft || '#E2E8F0' },
  btnSecTxt: { fontSize: 14, fontWeight: '800', color: colors.gray800 || '#1E293B' },
  btnDis: { opacity: 0.55 },
  btnTxt: { alignSelf: 'center', marginTop: spacing.md || 12, paddingVertical: 8 },
  btnTxtLabel: { fontSize: 13, fontWeight: '700', color: colors.gray600 || '#64748B' },
  secTitle: { fontSize: 19, fontWeight: '800', color: colors.gray800 || '#0F172A', marginTop: spacing.sm || 8, marginBottom: 4 },
  secDesc: { fontSize: 13, lineHeight: 19, color: colors.gray600 || '#475569', marginBottom: spacing.md || 12 },
  mCard: { padding: spacing.md || 12, borderRadius: radius.lg || 16, backgroundColor: colors.surface || '#FFF', marginBottom: spacing.md || 12, borderWidth: 1, borderColor: colors.borderSoft || '#E2E8F0' },
  mHdr: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  mTitle: { fontSize: 16, fontWeight: '800', color: colors.gray800 || '#0F172A' },
  mType: { marginTop: 2, fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  mDesc: { marginTop: spacing.sm || 8, fontSize: 13, lineHeight: 19, color: colors.gray600 || '#334155' },
  mSub: { marginTop: 4, fontSize: 12, lineHeight: 18, color: '#64748B' },
  mMeta: { marginTop: spacing.md || 12, padding: spacing.sm || 8, borderRadius: radius.md || 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' },
  mMetaLbl: { fontSize: 11, fontWeight: '800', color: '#94A3B8', marginBottom: 2 },
  mMetaVal: { fontSize: 12, lineHeight: 17, color: '#334155', marginBottom: 6 },
  tglRow: { marginTop: spacing.md || 12, paddingTop: spacing.md || 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tglTitle: { fontSize: 13, fontWeight: '800', color: colors.gray800 || '#1E293B' },
  tglDesc: { marginTop: 2, fontSize: 12, lineHeight: 17, color: '#64748B' },
});
