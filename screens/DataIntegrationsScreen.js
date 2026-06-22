import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BackButton from '../components/BackButton';
import { colors, radius, spacing } from '../styles/common';
import { getAppSettings, setDataIntegrationSettings } from '../utils/appSettings';

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

export default function Screen({navigation}){
  var a=useState(null),s=a[0],ss=a[1],b=useState(true),ld=b[0],sld=b[1],c=useState(false),cn=c[0],scn=c[1],d=useState(false),dc=d[0],sdc=d[1];
  var hc=(s&&s.dataIntegrations&&s.dataIntegrations.healthConnect)||{};
  var ok=useMemo(function(){return hc.status==='connected';},[hc.status]);

  var load=useCallback(function(){sld(true);getAppSettings().then(ss).catch(function(){Alert.alert('실패');}).finally(function(){sld(false);});},[]);
  useEffect(function(){load();},[load]);

  var save=useCallback(function(n){return setDataIntegrationSettings(HC,Object.assign({selectedMetricTypes:ALL_METRICS},n,{updatedAt:new Date().toISOString()})).then(function(x){ss(x);return x;});},[]);

  var doReq=useCallback(async function(){
    scn(true);
    try{
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
  },[hc,save]);

  var connect=useCallback(function(){Alert.alert('권한 선택','Health Connect 화면에서 필요한 항목만 선택해서 허용해주세요.',[{text:'취소',style:'cancel'},{text:'계속',onPress:doReq}]);},[doReq]);

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

  if(ld)return <SafeAreaView style={st.safe}><View style={st.c}><ActivityIndicator/><Text style={st.lt}>불러오는 중...</Text></View></SafeAreaView>;

  return (
    <SafeAreaView style={st.safe}>
      <ScrollView contentContainerStyle={st.ct}>
        <BackButton title="데이터 출처 관리"/>
        <View style={st.card}>
          <Text style={st.ttl}>Health Connect</Text>
          <Text style={st.dsc}>Health Connect 권한을 연결하면 Samsung Health, Strava 등에서 공유한 걸음, 운동, 수면, 심박 데이터를 인증 근거로 사용할 수 있습니다.</Text>
          <TouchableOpacity style={[st.btn,cn&&st.bd]} onPress={connect} disabled={cn||dc} activeOpacity={0.85}>
            <Text style={st.bt}>{cn?'연결 중...':ok?'권한 다시 연결하기':'권한 연결하기'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[st.db,dc&&st.bd]} onPress={disconnect} disabled={cn||dc} activeOpacity={0.85}>
            <Text style={st.dbt}>{dc?'연결 끊는 중...':'연결 끊기'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
});
