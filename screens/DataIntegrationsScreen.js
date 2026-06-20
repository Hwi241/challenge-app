import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BackButton from '../components/BackButton';
import { colors, radius, spacing } from '../styles/common';
import { getAppSettings, setDataIntegrationSettings } from '../utils/appSettings';

const HEALTH_CONNECT_PROVIDER = 'healthConnect';
const ALL_METRICS = ['steps','exercise','distance','calories','sleep','heartRate','weight'];

function loadHC() { try { return require('react-native-health-connect'); } catch(e) { return null; } }

function normPerm(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (Array.isArray(v.permissions)) return v.permissions;
  if (Array.isArray(v.grantedPermissions)) return v.grantedPermissions;
  return [v];
}

function permText(p) {
  if (!p) return '';
  if (typeof p === 'string') return p;
  return [p.accessType,p.access,p.recordType,p.record,p.dataType,p.permission,p.recordClassName].filter(Boolean).map(String).join(' ').toLowerCase();
}

function hasReadSteps(r) { return normPerm(r).some(function(p){var t=permText(p);return t.includes('read')&&t.includes('step');}); }

function descSdk(s) {
  if (s==null) return '확인 전';
  var t=String(s).toLowerCase();
  if (s===3||t.includes('available')) return '사용 가능';
  if (s===2||t.includes('update')) return '업데이트 필요';
  if (s===1||t.includes('unavail')) return '사용 불가';
  return '상태 '+s;
}

function getMeta(hc) {
  var s=(hc&&hc.status)||'notConnected';
  if (s==='connected') return {label:'연결됨',tone:'success',desc:'Health Connect 권한이 연결되었습니다.'};
  if (s==='permissionDenied') return {label:'권한 필요',tone:'warning',desc:'Health Connect 권한이 아직 허용되지 않았습니다.'};
  if (s==='unavailable') return {label:'사용 불가',tone:'danger',desc:'이 기기에서 Health Connect를 사용할 수 없습니다.'};
  if (s==='error') return {label:'확인 필요',tone:'danger',desc:(hc&&hc.lastError)||'Health Connect 확인 중 오류가 발생했습니다.'};
  return {label:'미연결',tone:'neutral',desc:'Health Connect를 연결하면 건강 데이터를 인증 근거로 사용할 수 있습니다.'};
}

function Pill(p) {
  var bg,tx;
  if (p.tone==='success') {bg='#DCFCE7';tx='#166534';}
  else if (p.tone==='warning') {bg='#FEF3C7';tx='#92400E';}
  else if (p.tone==='danger') {bg='#FEE2E2';tx='#991B1B';}
  else {bg='#F1F5F9';tx='#475569';}
  return <View style={{paddingHorizontal:8,paddingVertical:5,borderRadius:999,backgroundColor:bg}}><Text style={{fontSize:11,fontWeight:'800',color:tx}}>{p.label}</Text></View>;
}

export default function DataIntegrationsScreen({navigation}) {
  var a=useState(null),appSettings=a[0],setAppSettings=a[1];
  var b=useState(true),loading=b[0],setLoading=b[1];
  var c=useState(false),connecting=c[0],setConnecting=c[1];
  var hc=(appSettings&&appSettings.dataIntegrations&&appSettings.dataIntegrations.healthConnect)||{};
  var meta=useMemo(function(){return getMeta(hc);},[hc.status,hc.lastError]);

  var load=useCallback(function(){
    setLoading(true);
    getAppSettings().then(function(s){setAppSettings(s);}).catch(function(){Alert.alert('실패','설정을 불러오지 못했습니다.');}).finally(function(){setLoading(false);});
  },[]);
  useEffect(function(){load();},[load]);

  var save=useCallback(function(n){
    return setDataIntegrationSettings(HEALTH_CONNECT_PROVIDER,Object.assign({selectedMetricTypes:ALL_METRICS},n,{updatedAt:new Date().toISOString()})).then(function(s){setAppSettings(s);return s;});
  },[]);

  var connect=useCallback(function(){
    if(connecting)return;setConnecting(true);
    var m=loadHC();
    if(!m){
      save(Object.assign({},hc,{enabled:false,status:'error',lastError:'Expo Go에서는 Health Connect를 사용할 수 없습니다.'}));
      Alert.alert('APK 테스트 필요','Health Connect는 APK에서 확인합니다.');setConnecting(false);return;
    }
    (async function(){
      try{
        var gs=m.getSdkStatus,init=m.initialize,rp=m.requestPermission,gpp=m.getGrantedPermissions;
        var sdk=typeof gs==='function'?await gs():null;
        if(typeof init==='function')await init();
        var rr=typeof rp==='function'?await rp([{accessType:'read',recordType:'Steps'}]):null;
        var gr=typeof gpp==='function'?await gpp():null;
        var rs=hasReadSteps(rr)||hasReadSteps(gr);
        await save(Object.assign({},hc,{enabled:rs,status:rs?'connected':'permissionDenied',sdkStatus:sdk,permissions:Object.assign({},(hc.permissions||{}),{readSteps:rs}),lastError:rs?null:'권한이 거부되었습니다.'}));
        Alert.alert(rs?'연결됨':'권한 필요',rs?'Health Connect 권한이 연결되었습니다.':'Health Connect 권한이 허용되지 않았습니다.');
      }catch(e){var msg=(e&&e.message)||'Health Connect 오류';await save(Object.assign({},hc,{enabled:false,status:'error',lastError:msg}));Alert.alert('오류',msg);}
      finally{setConnecting(false);}
    })();
  },[connecting,hc,save]);

  if(loading) return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator/><Text style={s.lt}>불러오는 중...</Text></View></SafeAreaView>;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.cnt}>
        <BackButton title="데이터 출처 관리" />
        <Text style={s.topDesc}>건강 데이터를 인증의 근거로 사용할 수 있도록 외부 데이터 출처를 관리합니다.</Text>
        <View style={s.card}>
          <View style={{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between'}}>
            <View style={{flex:1}}><Text style={s.cardTtl}>Health Connect</Text><Text style={s.cardSub}>건강 데이터를 인증 근거로 연결합니다.</Text></View>
            <Pill label={meta.label} tone={meta.tone}/>
          </View>
          <Text style={s.desc}>{meta.desc}</Text>
          <View style={s.info}><Text style={s.infoTxt}>SDK: {descSdk(hc.sdkStatus)}</Text></View>
          <TouchableOpacity style={[s.btn,connecting&&s.btnDis]} onPress={connect} disabled={connecting} activeOpacity={0.85}>
            <Text style={s.btnTxt}>{connecting?'연결 중...':'권한 연결하기'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

var s=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background||'#F8FAFC'},
  cnt:{padding:spacing.lg||20,paddingBottom:40},
  center:{flex:1,alignItems:'center',justifyContent:'center'},
  lt:{marginTop:8,fontSize:14,color:colors.gray600||'#475569'},
  topDesc:{marginBottom:spacing.lg||20,fontSize:14,lineHeight:20,color:colors.gray600||'#475569'},
  card:{padding:spacing.lg||20,borderRadius:radius.lg||18,backgroundColor:colors.surface||'#FFF',marginBottom:spacing.md||12,borderWidth:1,borderColor:colors.borderSoft||'#E2E8F0'},
  cardTtl:{fontSize:18,fontWeight:'800',color:colors.gray800||'#0F172A'},
  cardSub:{marginTop:3,fontSize:13,color:colors.gray600||'#475569'},
  desc:{marginTop:spacing.md||12,fontSize:14,lineHeight:20,color:colors.gray600||'#334155'},
  info:{marginTop:spacing.md||12,padding:spacing.md||12,borderRadius:radius.md||12,backgroundColor:'#F8FAFC',borderWidth:1,borderColor:'#F1F5F9'},
  infoTxt:{fontSize:13,color:colors.gray600||'#475569'},
  btn:{marginTop:spacing.lg||20,height:48,alignItems:'center',justifyContent:'center',borderRadius:radius.md||12,backgroundColor:colors.black||'#2563EB'},
  btnTxt:{fontSize:15,fontWeight:'800',color:'#FFF'},
  btnDis:{opacity:0.55},
});
