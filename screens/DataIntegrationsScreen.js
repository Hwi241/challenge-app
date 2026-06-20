import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BackButton from '../components/BackButton';
import { colors, radius, spacing } from '../styles/common';
import { getAppSettings, setDataIntegrationSettings } from '../utils/appSettings';

var HC = 'healthConnect';
var ALL = ['steps','exercise','distance','calories','sleep','heartRate','weight'];

function loadModule() { try { return require('react-native-health-connect'); } catch(e) { return null; } }

function norm(v){if(!v)return[];if(Array.isArray(v))return v;if(Array.isArray(v.permissions))return v.permissions;if(Array.isArray(v.grantedPermissions))return v.grantedPermissions;return[v];}
function pt(p){if(!p)return'';if(typeof p==='string')return p;return[p.accessType,p.access,p.recordType,p.record,p.dataType,p.permission,p.recordClassName].filter(Boolean).map(String).join(' ').toLowerCase();}
function hasSteps(r){return norm(r).some(function(p){var t=pt(p);return t.includes('read')&&t.includes('step');});}

export default function Screen({navigation}){
  var a=useState(null),s=a[0],ss=a[1],b=useState(true),ld=b[0],sld=b[1],c=useState(false),cn=c[0],scn=c[1];
  var hc=(s&&s.dataIntegrations&&s.dataIntegrations.healthConnect)||{};
  var ok=useMemo(function(){return hc.status==='connected';},[hc.status]);

  var load=useCallback(function(){sld(true);getAppSettings().then(ss).catch(function(){Alert.alert('실패');}).finally(function(){sld(false);});},[]);
  useEffect(function(){load();},[load]);

  var save=useCallback(function(n){return setDataIntegrationSettings(HC,Object.assign({selectedMetricTypes:ALL},n,{updatedAt:new Date().toISOString()})).then(function(x){ss(x);return x;});},[]);

  var connect=useCallback(function(){
    if(cn)return;scn(true);
    var m=loadModule();
    if(!m){save(Object.assign({},hc,{enabled:false,status:'error'}));Alert.alert('APK 테스트 필요');scn(false);return;}
    (async function(){
      try{
        var gs=m.getSdkStatus,init=m.initialize,rp=m.requestPermission,gpp=m.getGrantedPermissions;
        var sdk=typeof gs==='function'?await gs():null;
        if(typeof init==='function')await init();
        var rr=typeof rp==='function'?await rp([{accessType:'read',recordType:'Steps'}]):null;
        var gr=typeof gpp==='function'?await gpp():null;
        var rs=hasSteps(rr)||hasSteps(gr);
        await save(Object.assign({},hc,{enabled:rs,status:rs?'connected':'permissionDenied',sdkStatus:sdk,permissions:Object.assign({},(hc.permissions||{}),{readSteps:rs}),lastError:rs?null:'권한 거부됨'}));
        Alert.alert(rs?'연결됨':'권한 필요',rs?'Health Connect 연결됨':'Health Connect 권한이 허용되지 않았습니다.');
      }catch(e){await save(Object.assign({},hc,{enabled:false,status:'error',lastError:(e&&e.message)}));Alert.alert('오류');}
      finally{scn(false);}
    })();
  },[cn,hc,save]);

  if(ld)return <SafeAreaView style={st.safe}><View style={st.c}><ActivityIndicator/><Text style={st.lt}>불러오는 중...</Text></View></SafeAreaView>;

  return(
    <SafeAreaView style={st.safe}>
      <ScrollView contentContainerStyle={st.ct}>
        <BackButton title="데이터 출처 관리"/>
        <View style={st.card}>
          <Text style={st.ttl}>Health Connect</Text>
          <Text style={st.dsc}>건강 데이터를 인증 근거로 연결합니다.</Text>
          <TouchableOpacity style={[st.btn,cn&&st.bd]} onPress={connect} disabled={cn} activeOpacity={0.85}>
            <Text style={st.bt}>{cn?'연결 중...':ok?'연결됨':'권한 연결하기'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

var st=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background||'#F8FAFC'},
  ct:{padding:spacing.lg||20,paddingBottom:40},
  c:{flex:1,alignItems:'center',justifyContent:'center'},
  lt:{marginTop:8,fontSize:14,color:colors.gray600||'#475569'},
  card:{padding:spacing.lg||20,borderRadius:radius.lg||18,backgroundColor:colors.surface||'#FFF',borderWidth:1,borderColor:colors.borderSoft||'#E2E8F0'},
  ttl:{fontSize:18,fontWeight:'800',color:colors.gray800||'#0F172A'},
  dsc:{marginTop:4,fontSize:14,lineHeight:20,color:colors.gray600||'#475569'},
  btn:{marginTop:spacing.lg||20,height:48,alignItems:'center',justifyContent:'center',borderRadius:radius.md||12,backgroundColor:colors.black||'#2563EB'},
  bt:{fontSize:15,fontWeight:'800',color:'#FFF'},
  bd:{opacity:0.55},
});
