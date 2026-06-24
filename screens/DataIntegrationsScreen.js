import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BackButton from '../components/BackButton';
import { colors, radius, spacing } from '../styles/common';
import { getAppSettings, setDataIntegrationSettings } from '../utils/appSettings';
import {
  CALENDAR_RECORD_PROVIDER,
  getCalendarDisplayTitle,
  getWritableCalendarOptions,
} from '../utils/calendarRecord';
import * as IntentLauncher from 'expo-intent-launcher';

var HC = 'healthConnect';

var PERMS = [
  {key:'steps',type:'Steps'},{key:'stepsCadence',type:'StepsCadence'},{key:'exercise',type:'ExerciseSession'},
  {key:'distance',type:'Distance'},{key:'totalCalories',type:'TotalCaloriesBurned'},{key:'activeCalories',type:'ActiveCaloriesBurned'},
  {key:'bmr',type:'BasalMetabolicRate'},{key:'sleep',type:'SleepSession'},{key:'heartRate',type:'HeartRate'},
  {key:'restingHr',type:'RestingHeartRate'},{key:'hrv',type:'HeartRateVariabilityRmssd'},{key:'bloodPressure',type:'BloodPressure'},
  {key:'bloodGlucose',type:'BloodGlucose'},{key:'oxygen',type:'OxygenSaturation'},{key:'bodyTemp',type:'BodyTemperature'},
  {key:'basalTemp',type:'BasalBodyTemperature'},{key:'respiratory',type:'RespiratoryRate'},{key:'vo2max',type:'Vo2Max'},
  {key:'weight',type:'Weight'},{key:'height',type:'Height'},{key:'bodyFat',type:'BodyFat'},{key:'bodyWater',type:'BodyWaterMass'},
  {key:'boneMass',type:'BoneMass'},{key:'leanMass',type:'LeanBodyMass'},{key:'hydration',type:'Hydration'},{key:'nutrition',type:'Nutrition'},
  {key:'floors',type:'FloorsClimbed'},{key:'elevation',type:'ElevationGained'},{key:'power',type:'Power'},{key:'speed',type:'Speed'},
  {key:'wheelchair',type:'WheelchairPushes'},{key:'cervical',type:'CervicalMucus'},{key:'menstruation',type:'MenstruationFlow'},
  {key:'period',type:'MenstruationPeriod'},{key:'intermenstrual',type:'IntermenstrualBleeding'},{key:'ovulation',type:'OvulationTest'},
  {key:'sexual',type:'SexualActivity'},
];

var ALL_METRICS = PERMS.map(function(p){return p.key;});

function mod(){try{return require('react-native-health-connect');}catch(e){return null;}}
function norm(v){if(!v)return[];if(Array.isArray(v))return v;if(Array.isArray(v.permissions))return v.permissions;if(Array.isArray(v.grantedPermissions))return v.grantedPermissions;return[v];}
function pt(p){if(!p)return'';if(typeof p==='string')return p;return[p.accessType,p.access,p.recordType,p.record,p.dataType,p.permission].filter(Boolean).map(String).join(' ').toLowerCase();}
function hasPerm(r,t){return norm(r).some(function(p){var x=pt(p);return x.includes('read')&&x.includes((t||'').toLowerCase());});}
function buildMap(r){var m={};PERMS.forEach(function(p){m[p.key]=hasPerm(r,p.type);});return m;}
function anyPerm(m){return Object.values(m||{}).some(Boolean);}

async function requestAll(rp){
  try{
    return {r:await rp(PERMS.map(function(p){return{accessType:'read',recordType:p.type};})),u:[]};
  }catch(e){
    var part=[],u=[];
    for(var i=0;i<PERMS.length;i++){
      try{var rr=await rp([{accessType:'read',recordType:PERMS[i].type}]);part.push.apply(part,norm(rr));}
      catch(e2){u.push(PERMS[i].type);}
    }
    return {r:part,u:u};
  }
}


function waitBeforeHealthConnectPermissionRequest(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

async function safeRevokeHealthConnectPermissions(){
  try{
    var m=mod();
    if(!m)return false;
    if(typeof m.revokeAllPermissions==='function'){await m.revokeAllPermissions();return true;}
    if(typeof m.revokePermissions==='function'){await m.revokePermissions(PERMS.map(function(p){return{accessType:'read',recordType:p.type};}));return true;}
  }catch(e){/* revoke 실패해도 계속 진행 */}
  return false;
}



function normalizeHealthConnectPermissionKey(permission) {
  if (!permission) return '';
  if (typeof permission === 'string') return permission.toLowerCase();
  var accessType = String(permission.accessType || permission.permissionType || permission.access || '').toLowerCase();
  var recordType = String(permission.recordType || permission.record || permission.dataType || permission.type || '').toLowerCase();
  return accessType + ':' + recordType;
}

function hasRequiredHealthConnectPermissions(grantedPermissions) {
  if (!Array.isArray(grantedPermissions) || grantedPermissions.length === 0) {
    return false;
  }
  return grantedPermissions.some(function(permission) {
    var key = normalizeHealthConnectPermissionKey(permission);
    return key.indexOf('read') !== -1 && key.indexOf('steps') !== -1;
  });
}

async function syncHealthConnectPermissionState(hcSettings, saveFn, getSettingsFn, setSettingsFn) {
  try {
    var m = mod();
    if (!m) return;
    if (typeof m.getGrantedPermissions !== 'function') return;

    var granted = await m.getGrantedPermissions();
    var hasReadStep = false;
    if (Array.isArray(granted)) {
      for (var i = 0; i < granted.length; i++) {
        var p = granted[i];
        var key = (typeof p === 'string' ? p : (p.recordType || p.permission || '')).toLowerCase();
        if (key.includes('steps') && (key.includes('read') || p.accessType === 'read')) {
          hasReadStep = true;
          break;
        }
      }
    }

    if (!hasReadStep && hcSettings && hcSettings.status === 'connected') {
      await saveFn(Object.assign({}, hcSettings, {
        enabled: false,
        status: 'notConnected',
        permissions: {},
        lastError: null,
        updatedAt: new Date().toISOString(),
      }));
      if (typeof getSettingsFn === 'function' && typeof setSettingsFn === 'function') {
        var next = await getSettingsFn();
        setSettingsFn(next);
      }
    }
  } catch (e) {
    // sync 실패해도 앱이 죽지 않도록 무시
  }
}

export default function Screen({navigation}){
  var a=useState(null),s=a[0],ss=a[1],b=useState(true),ld=b[0],sld=b[1],c=useState(false),cn=c[0],scn=c[1],d=useState(false),dc=d[0],sdc=d[1],e=useState(false),calBusy=e[0],setCalBusy=e[1],f=useState(false),calPickerVisible=f[0],setCalPickerVisible=f[1],g=useState([]),calOptions=g[0],setCalOptions=g[1];
  var hc=(s&&s.dataIntegrations&&s.dataIntegrations.healthConnect)||{};
  var calendarRecord=(s&&s.dataIntegrations&&s.dataIntegrations.calendarRecord)||{};
  var ok=useMemo(function(){return hc.status==='connected';},[hc.status]);
  var calendarOk=useMemo(function(){return calendarRecord.status==='connected'&&calendarRecord.enabled===true;},[calendarRecord.status,calendarRecord.enabled]);

  var load=useCallback(function(){sld(true);getAppSettings().then(function(x){ss(x);syncHealthConnectPermissionState(x&&x.dataIntegrations&&x.dataIntegrations.healthConnect,save,getAppSettings,ss);return x;}).catch(function(){Alert.alert('실패');}).finally(function(){sld(false);});},[save]);
  useEffect(function(){
    load();
    var appStateSub = AppState.addEventListener('change', function(nextAppState){
      if(nextAppState === 'active'){
        getAppSettings().then(function(x){
          ss(x);
          syncHealthConnectPermissionState(x&&x.dataIntegrations&&x.dataIntegrations.healthConnect,save,getAppSettings,ss);
        }).catch(function(){});
      }
    });
    return function(){appStateSub.remove();};
  },[load,save]);

  var save=useCallback(function(n){return setDataIntegrationSettings(HC,Object.assign({selectedMetricTypes:ALL_METRICS},n,{updatedAt:new Date().toISOString()})).then(function(x){ss(x);return x;});},[]);

  var saveCalendar=useCallback(function(n){return setDataIntegrationSettings(CALENDAR_RECORD_PROVIDER,Object.assign({},n,{updatedAt:new Date().toISOString()})).then(function(x){ss(x);return x;});},[]);

  var doReq=useCallback(async function(){
    scn(true);
    try{
      // 이미 연결된 상태면 권한을 먼저 회수하여 다시 권한 선택창이 뜨도록 함
      if(ok){
        await safeRevokeHealthConnectPermissions();
        // 내부 설정을 끊김으로 저장하고 화면 갱신 후 대기
        try{
          await save(Object.assign({},hc,{enabled:false,status:'notConnected',permissions:{},lastError:null}));
          var afterHCRevoke=await getAppSettings();
          ss(afterHCRevoke);
        }catch(e){/* 무시 */}
        await waitBeforeHealthConnectPermissionRequest(700);
      }
      var m=mod();
      if(!m){
        await save(Object.assign({},hc,{enabled:false,status:'error',permissions:{},lastError:'Expo Go에서는 HC 모듈을 사용할 수 없습니다.'}));
        Alert.alert('APK 테스트 필요');return;
      }
      var gs=m.getSdkStatus,init=m.initialize,rp=m.requestPermission,gpp=m.getGrantedPermissions;
      var sdk=typeof gs==='function'?await gs():null;
      if(typeof init==='function')await init();
      var rr=null,ur=[];
      if(typeof rp==='function'){var resp=await requestAll(rp);rr=resp.r;ur=resp.u;}
      var gr=typeof gpp==='function'?await gpp():null;
      var rm=buildMap(rr),gm=buildMap(gr);
      var perms={};PERMS.forEach(function(p){perms[p.key]=!!(rm[p.key]||gm[p.key]);});
      var connected=anyPerm(perms);
      await save(Object.assign({},hc,{enabled:connected,status:connected?'connected':'permissionDenied',sdkStatus:sdk,permissions:perms,unsupported:ur,lastError:connected?null:'권한 거부됨'}));
      Alert.alert(connected?'연결됨':'권한 필요',connected?'허용한 항목이 연결되었습니다.':'권한이 허용되지 않았습니다.');
    }catch(e){await save(Object.assign({},hc,{enabled:false,status:'error',permissions:{},lastError:(e&&e.message)}));Alert.alert('오류');}
    finally{scn(false);}
  },[hc,save,ok]);


async function openHealthConnectSettings() {
  var actionCandidates = [
    'androidx.health.ACTION_HEALTH_CONNECT_SETTINGS',
    'android.health.connect.action.HEALTH_CONNECT_SETTINGS',
    'android.settings.HEALTH_CONNECT_SETTINGS',
  ];

  for (var i = 0; i < actionCandidates.length; i += 1) {
    try {
      await IntentLauncher.startActivityAsync(actionCandidates[i]);
      return;
    } catch (error) {
      console.warn('[HealthConnect] open settings action failed', actionCandidates[i], error);
    }
  }

  try {
    await Linking.openSettings();
  } catch (error) {
    console.warn('[HealthConnect] open fallback app settings failed', error);
  }
}

async function checkHealthConnectPermissionForManagement() {
  try {
    var m = mod();
    if (!m || typeof m.getGrantedPermissions !== 'function') {
      return 'unknown';
    }
    if (typeof m.initialize === 'function') {
      await m.initialize();
    }
    var grantedPermissions = await m.getGrantedPermissions();
    return hasRequiredHealthConnectPermissions(grantedPermissions) ? 'granted' : 'missing';
  } catch (error) {
    console.warn('[HealthConnect] permission management check failed', error);
    return 'unknown';
  }
}

async function markHealthConnectNotConnectedFromManagement() {
  try {
    if (typeof save === 'function') {
      await save({
        enabled: false,
        status: 'notConnected',
        updatedAt: new Date().toISOString(),
        lastError: null,
      });
    }
    if (typeof getAppSettings === 'function' && typeof ss === 'function') {
      var latestAfterHealthConnectManagementSync = await getAppSettings();
      ss(latestAfterHealthConnectManagementSync);
    }
  } catch (error) {
    console.warn('[HealthConnect] permission management state update failed', error);
  }
}

async function handleHealthConnectPermissionManagement() {
  var permissionState = await checkHealthConnectPermissionForManagement();

  if (permissionState === 'missing') {
    await markHealthConnectNotConnectedFromManagement();
    Alert.alert(
      '권한 해제 확인',
      'Health Connect 권한이 해제되어 더푸시 연결 상태를 초기화했습니다. 다시 연결하면 권한을 새로 선택할 수 있습니다.',
      [{text:'확인'}]
    );
    return;
  }

  showHealthConnectReconnectGuide();
}

function showHealthConnectReconnectGuide() {
  Alert.alert(
    'Health Connect 권한 관리',
    'Health Connect 권한은 더푸시에서 직접 끊는 것이 아니라 Health Connect 설정에서 관리합니다.\n\n설정에서 THE PUSH 권한을 직접 해제한 뒤 더푸시로 돌아와 [Health Connect 권한 관리]를 다시 누르면, 실제 권한 상태를 확인해 연결 해제로 반영합니다.\n\n권한을 해제하지 않고 돌아오면 연결 상태는 유지됩니다.',
    [
      {text:'취소',style:'cancel'},
      {
        text:'Health Connect 권한 관리',
        onPress:function(){openHealthConnectSettings();},
      },
    ]
  );
}

  var connect=useCallback(function(){
    if(ok){
      handleHealthConnectPermissionManagement();
      return;
    }
    Alert.alert('권한 선택','Health Connect 화면에서 필요한 항목만 선택해서 허용해주세요.',[{text:'취소',style:'cancel'},{text:'계속',onPress:doReq}]);
  },[ok,doReq,disconnect]);

  var disconnect=useCallback(async function(){
    sdc(true);
    try{
      var m=mod(),nat=false;
      if(m&&typeof m.revokeAllPermissions==='function'){await m.revokeAllPermissions();nat=true;}
      else if(m&&typeof m.revokePermissions==='function'){await m.revokePermissions(PERMS.map(function(p){return{accessType:'read',recordType:p.type};}));nat=true;}
      await save(Object.assign({},hc,{enabled:false,status:'notConnected',permissions:{},lastError:null}));
      if(nat)Alert.alert('연결 끊김','Health Connect 연결을 해제했습니다.');
      else Alert.alert('앱 연결 해제','앱 상태를 해제했습니다. 권한이 남아있으면 Android 설정에서 직접 해제해주세요.',[{text:'확인',style:'cancel'},{text:'설정 열기',onPress:function(){Linking.openSettings();}}]);
    }catch(e){Alert.alert('연결 끊기 실패',(e&&e.message)||'오류');}
    finally{sdc(false);}
  },[hc,save]);

  var loadCalendarOptions=useCallback(async function(){
    if(calBusy)return;
    setCalBusy(true);
    try{
      var result=await getWritableCalendarOptions();
      if(!result.ok){
        Alert.alert('캘린더 오류',result.message||'캘린더 목록을 불러오지 못했습니다.');
        return;
      }
      setCalOptions(result.calendars);
      setCalPickerVisible(true);
    }catch(err){
      Alert.alert('캘린더 오류',(err&&err.message)||'캘린더 목록을 불러오는 중 오류가 발생했습니다.');
    }finally{
      setCalBusy(false);
    }
  },[]);

  var connectCalendarRecord=useCallback(async function(){
    loadCalendarOptions();
  },[]);

  var disconnectCalendarRecord=useCallback(async function(){
    if(calBusy)return;
    Alert.alert('캘린더 기록 끄기','더푸시에서 캘린더 기록 설정을 끕니다. 이미 허용한 캘린더 권한은 Android 설정에서 직접 관리할 수 있습니다.',[
      {text:'취소',style:'cancel'},
      {text:'끄기',style:'destructive',onPress:async function(){
        setCalBusy(true);
        try{
          await setDataIntegrationSettings(CALENDAR_RECORD_PROVIDER,{
            enabled:false,
            status:'notConnected',
            selectedCalendarId:null,
            selectedCalendarTitle:null,
            writeMode:'manual',
            updatedAt:new Date().toISOString(),
            lastError:null,
          });
          var next=await getAppSettings();
          ss(next);
          Alert.alert('캘린더 기록 꺼짐','인증 완료 후 캘린더에 기록하지 않습니다.');
        }catch(err){
          Alert.alert('오류',(err&&err.message)||'캘린더 기록 설정을 변경하지 못했습니다.');
        }finally{
          setCalBusy(false);
        }
      }},
    ]);
  },[calBusy]);

  var selectCalendar=useCallback(async function(cal){
    if(!cal||!cal.id)return;
    setCalPickerVisible(false);
    try{
      await setDataIntegrationSettings(CALENDAR_RECORD_PROVIDER,{
        enabled:true,
        status:'connected',
        selectedCalendarId:cal.id,
        selectedCalendarTitle:getCalendarDisplayTitle(cal),
        writeMode:'manual',
        updatedAt:new Date().toISOString(),
        lastError:null,
      });
      var next=await getAppSettings();
      ss(next);
      Alert.alert('캘린더 변경됨','저장 대상을 "'+(getCalendarDisplayTitle(cal)||'선택된 캘린더')+'"으로 변경했습니다.');
    }catch(err){
      Alert.alert('오류',(err&&err.message)||'캘린더 변경 중 오류가 발생했습니다.');
    }
  },[]);

    if(ld)return <SafeAreaView style={st.safe}><View style={st.c}><ActivityIndicator/><Text style={st.lt}>불러오는 중...</Text></View></SafeAreaView>;

  return (
    <SafeAreaView style={st.safe}>
      <ScrollView contentContainerStyle={st.ct}>
        <BackButton title="데이터 출처 관리"/>
        <View style={st.card}>
          <Text style={st.ttl}>Health Connect</Text>
          <Text style={st.dsc}>Health Connect 권한을 연결하면 Samsung Health, Strava 등에서 공유한 걸음, 운동, 수면, 심박 데이터를 인증 근거로 사용할 수 있습니다.</Text>
          <TouchableOpacity style={[st.btn,cn&&st.bd]} onPress={connect} disabled={cn||dc} activeOpacity={0.85}>
            <Text style={st.bt}>{cn?'연결 중...':ok?'Health Connect 권한 관리':'권한 연결하기'}</Text>
          </TouchableOpacity>
        </View>
        <View style={[st.card,st.calendarCardSpacing]}>
          <Text style={st.ttl}>캘린더 기록</Text>
          <Text style={st.dsc}>인증 완료 후 휴대폰 캘린더에 기록을 남길 수 있습니다. Google Calendar, Samsung Calendar 등 동기화된 캘린더에서 확인할 수 있습니다.</Text>
          {!!calendarOk&&(
            <Text style={st.info}>저장 대상: {calendarRecord.selectedCalendarTitle||'선택된 캘린더'}</Text>
          )}
          {!!calendarRecord.lastError&&!calendarOk&&(
            <Text style={st.err}>{calendarRecord.lastError}</Text>
          )}
          <TouchableOpacity style={[st.btn,calBusy&&st.bd]} onPress={loadCalendarOptions} disabled={calBusy} activeOpacity={0.85}>
            <Text style={st.bt}>{calBusy?'연결 중...':calendarOk?'캘린더 다시 선택':'캘린더 기록 켜기'}</Text>
          </TouchableOpacity>
          {!!calendarOk&&(
            <TouchableOpacity style={[st.db,calBusy&&st.bd]} onPress={disconnectCalendarRecord} disabled={calBusy} activeOpacity={0.85}>
              <Text style={st.dbt}>캘린더 기록 끄기</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
        {/* 캘린더 선택 Modal */}
        <Modal
          visible={calPickerVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={function(){setCalPickerVisible(false);}}
        >
          <View style={st.overlay}>
            <View style={st.modalCard}>
              <Text style={st.modalTitle}>저장 대상 캘린더 선택</Text>
              <Text style={st.modalDesc}>인증 기록을 저장할 캘린더를 선택하세요.</Text>
              <Text style={st.modalGuide}>캘린더 이름이 헷갈리면 삼성 캘린더나 Google Calendar 앱에서 같은 캘린더로 테스트 일정을 만들어 실제 동기화 계정을 확인하세요.</Text>
              <ScrollView style={st.modalList}>
                {calOptions.length===0?(
                  <Text style={st.modalEmpty}>쓰기 가능한 캘린더가 없습니다.</Text>
                ):calOptions.map(function(cal,i){
                  var isSelected=cal.id===calendarRecord.selectedCalendarId;
                  var sourceInfo=[];
                  if(cal.source&&cal.source.name)sourceInfo.push(cal.source.name);
                  if(cal.ownerAccount)sourceInfo.push(cal.ownerAccount);
                  var sub=sourceInfo.join(' / ');
                  return(
                    <TouchableOpacity key={cal.id||i} style={[st.modalItem,isSelected&&st.modalItemSelected]} onPress={function(){selectCalendar(cal);}} activeOpacity={0.75}>
                      <View style={st.modalItemContent}>
                        <Text style={[st.modalItemTitle,isSelected&&st.modalItemTitleSelected]}>{getCalendarDisplayTitle(cal)||'이름 없음'}</Text>
                        {!!sub&&<Text style={st.modalItemSub}>{sub}</Text>}
                      </View>
                      {!!isSelected&&<Text style={st.modalBadge}>현재 선택됨</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity style={st.modalClose} onPress={function(){setCalPickerVisible(false);}} activeOpacity={0.85}>
                <Text style={st.modalCloseText}>닫기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
    </SafeAreaView>
  );
}

var st=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background||'#F8FAFC'},ct:{padding:spacing.lg||20,paddingBottom:40},
  c:{flex:1,alignItems:'center',justifyContent:'center'},lt:{marginTop:8,fontSize:14,color:colors.gray600||'#475569'},
  card:{padding:spacing.lg||20,borderRadius:radius.lg||18,backgroundColor:colors.surface||'#FFF',borderWidth:1,borderColor:colors.borderSoft||'#E2E8F0'},
  ttl:{fontSize:18,fontWeight:'800',color:colors.gray800||'#0F172A'},dsc:{marginTop:4,fontSize:14,lineHeight:20,color:colors.gray600||'#475569'},
  btn:{marginTop:spacing.lg||20,height:48,alignItems:'center',justifyContent:'center',borderRadius:radius.md||12,backgroundColor:colors.black||'#2563EB'},
  bt:{fontSize:15,fontWeight:'800',color:'#FFF'},bd:{opacity:0.55},
  db:{marginTop:8,height:46,alignItems:'center',justifyContent:'center',borderRadius:radius.md||12,backgroundColor:'#FEE2E2',borderWidth:1,borderColor:'#FECACA'},
  dbt:{fontSize:14,fontWeight:'800',color:'#991B1B'},
  overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.5)',justifyContent:'center',alignItems:'center',padding:20},
  modalCard:{width:'100%',maxHeight:'80%',backgroundColor:'#FFF',borderRadius:18,padding:20,paddingTop:24},
  modalTitle:{fontSize:18,fontWeight:'800',color:'#0F172A',textAlign:'center',marginBottom:16},
  modalList:{maxHeight:400},
  modalEmpty:{textAlign:'center',fontSize:14,color:'#64748B',paddingVertical:30},
  modalItem:{flexDirection:'row',alignItems:'center',paddingVertical:14,paddingHorizontal:12,borderBottomWidth:1,borderBottomColor:'#F1F5F9'},
  modalItemSelected:{backgroundColor:'#EFF6FF'},
  modalItemContent:{flex:1},
  modalItemTitle:{fontSize:15,fontWeight:'600',color:'#1E293B'},
  modalItemTitleSelected:{color:'#2563EB'},
  modalItemSub:{fontSize:12,color:'#64748B',marginTop:3},
  modalBadge:{fontSize:12,fontWeight:'700',color:'#2563EB',backgroundColor:'#DBEAFE',paddingHorizontal:8,paddingVertical:3,borderRadius:8,overflow:'hidden'},
  modalClose:{marginTop:16,height:46,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:'#F1F5F9'},
  modalCloseText:{fontSize:15,fontWeight:'600',color:'#475569'},
  modalDesc:{fontSize:13,lineHeight:19,color:'#6B7280',marginTop:6},
  modalGuide:{fontSize:12,lineHeight:17,color:'#9CA3AF',marginTop:8,marginBottom:4,fontStyle:'italic'},
  calendarCardSpacing:{marginTop:28},
});