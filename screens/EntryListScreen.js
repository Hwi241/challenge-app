// screens/EntryListScreen.js

const KILL_UI_AND_SHOW_RAW = false; // 필요 시 true로 전환(데이터 디버그용)

import React, {
  useState, useEffect, useRef, useMemo, useCallback, memo,
} from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions, ScrollView, Share, Modal, TouchableWithoutFeedback, Alert, Platform, PanResponder, Animated } from 'react-native';
import { SafeAreaView,  useSafeAreaInsets  } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import Svg, {
  Circle, Line, Rect, Text as SvgText, Path, Defs, LinearGradient, Stop,
} from 'react-native-svg';

import WidgetDonutCapture1x1 from '../components/WidgetDonutCapture1x1';
import { useFocusEffect } from '@react-navigation/native';


const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const CAL_HEADER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const ICON = require('../assets/icon.png');

const AdBannerPlaceholder = () => (
  <View style={{
    height: 50,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  }}>
    <Text style={{ color: '#9CA3AF', fontSize: 12 }}>광고 영역</Text>
  </View>
);

const baseBlack = '#111111';
const progressGrey = '#D1D5DB';
const textGrey = '#666666';
const EDGE = 8;
// ⬇️ 원하는 만큼 숫자만 바꾸면 됨
const NARROW_PLUS = 20;        // 보상박스/인증목록 좌우를 화면에서 더 띄우는 여유(픽셀)
// (값이 클수록 더 "좁아짐", 0이면 그래프와 동일 폭)

const LABEL_GAP = 10;
const LABEL_END_GAP = 16;
const GRAPH_SIDE_PAD     = 12; // 그래프 좌우 추가 여백(px) — 값 ↑ → 그래프 더 좁아짐
const CARD_BOTTOM_GAP    = 0;  // 헤더 카드(그래프 포함) 아래 간격
const REWARD_TOP_GAP    = 0;
const GRAPH_REWARD_GAP   = 0;  // 그래프 ↔ 보상박스 간격
const REWARD_BOTTOM_GAP = 30;  // 보상박스 아래 ~ 누적시간/횟수/목록 (클수록 더 멀어짐)
const REWARD_SUMMARY_GAP = 10; // 보상박스 ↔ 누적시간/횟수(및 목록) 간격

const DEBUG_ON = false; // 느리면 false 권장 (필요할 때만 true)

/* ───────── 유틸 ───────── */
const pad2 = (n)=>String(n).padStart(2,'0');
const keyOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const clamp = (v, a, b)=>Math.max(a, Math.min(b, v));

/* ───────── (신규) 스토리지 전수 스캔 백업 로더 ───────── */
const scoreAsEntries = (arr=[], {rawCID, numCID, chCID})=>{
  if (!Array.isArray(arr) || arr.length === 0) return -1;
  let tsLike = 0, hasText = 0, idLike = 0, cidHit = 0;
  for (const it of arr) {
    if (it && (typeof it.timestamp === 'number' || typeof it.timestamp === 'string')) tsLike++;
    if (it && typeof it.text === 'string') hasText++;
    if (it && (typeof it.id === 'string' || typeof it.id === 'number')) idLike++;
    const inItemCID = String(it?.challengeId ?? it?.cid ?? '').toLowerCase();
    if (inItemCID && (
      inItemCID.includes(String(rawCID).toLowerCase()) ||
      inItemCID.includes(String(numCID).toLowerCase()) ||
      inItemCID.includes(String(chCID).toLowerCase())
    )) cidHit++;
  }
  const n = arr.length || 1;
  return (tsLike/n)*4 + (hasText/n)*1.5 + (idLike/n)*1 + (cidHit>0?2:0) + Math.min(n,50)/50;
};

const deepPickArray = (v)=>{
  if (Array.isArray(v)) return [v];
  if (v && typeof v === 'object') {
    const out = [];
    ['entries','items','data','list','logs','records'].forEach(k=>{
      if (Array.isArray(v[k])) out.push(v[k]);
    });
    Object.values(v).forEach(val=>{
      if (Array.isArray(val)) out.push(val);
    });
    return out;
  }
  return [];
};

const scanAllStorageForEntries = async ({rawCID, numCID, chCID})=>{
  try{
    const keys = await AsyncStorage.getAllKeys();
    if (!Array.isArray(keys) || !keys.length) return null;
    const CHUNK = 20;
    let best = { score: -1, arr: [] };

    for (let i=0;i<keys.length;i+=CHUNK){
      const slice = keys.slice(i, i+CHUNK);
      const pairs = await AsyncStorage.multiGet(slice);
      for (const [, raw] of pairs){
        if (!raw || typeof raw !== 'string') continue;
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch { parsed = null; }
        if (!parsed) continue;

        const cands = deepPickArray(parsed);
        for (const arr of cands){
          const s = scoreAsEntries(arr, {rawCID, numCID, chCID});
          if (s > best.score) best = { score: s, arr };
        }
      }
    }
    return best.score >= 3.5 ? best.arr : null;
  }catch(e){
    console.warn('[scanAllStorageForEntries] fail:', e);
    return null;
  }
};

/* ───────── DEBUG 패널 ───────── */
const DebugPanel = memo(function DebugPanel({ visible, cid, hitKey, allTriedKeys=[], count, onRefresh }) {
  if (!visible) return null;
  const uniq = Array.from(new Set(allTriedKeys));
  return (
    <View style={{
      backgroundColor: '#fff4f4', borderColor:'#ffbdbd', borderWidth:1,
      marginHorizontal: EDGE, marginTop: 10, borderRadius: 8, padding: 10,
      position:'relative', zIndex: 1
    }}>
      <Text style={{ fontWeight:'800', color:'#c00', marginBottom: 6 }}>스토리지 진단</Text>
      <Text style={{ color:'#c00', marginBottom: 2 }}>CID: <Text style={{fontWeight:'700'}}>{cid || '(빈값)'}</Text></Text>
      <Text style={{ color:'#c00', marginBottom: 2 }}>적중 키: <Text style={{fontWeight:'700'}}>{hitKey || '(없음)'}</Text></Text>
      <Text style={{ color:'#c00', marginBottom: 6 }}>읽은 개수: <Text style={{fontWeight:'700'}}>{count}</Text></Text>
      <Text style={{ color:'#c00', marginBottom: 4 }}>시도 키:</Text>
      {uniq.map((k, idx)=>(
        <Text key={`try-${cid}-${idx}-${k}`} style={{ color:'#c00', fontSize:12 }}>
          - {k}
        </Text>
      ))}

      <TouchableOpacity onPress={onRefresh} style={{ alignSelf:'flex-end', paddingTop:8 }}>
        <Text style={{ color:'#c00', fontWeight:'800' }}>다시 로드</Text>
      </TouchableOpacity>
    </View>
  );
});

const StickyDebugPeek = ({ visible, count, onPress }) => {
  if (!visible) return null;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{
        position:'absolute', top: 8, right: 12, zIndex: 9999,
        backgroundColor: '#e53935', paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: 12, shadowColor:'#000', shadowOpacity:0.2, shadowRadius:6, elevation:6
      }}
    >
      <Text style={{ color:'#fff', fontWeight: '800' }}>
        디버그: {count}개 • 새로고침
      </Text>
    </TouchableOpacity>
  );
};

/* ───────── 도넛 ───────── */
const Donut = memo(function Donut({ targetPercent = 0, progress = 1, size = 110, stroke = 12 }) {
  const radius = (size - stroke) / 2;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedTarget = Math.max(0, Math.min(100, targetPercent));
  const k = Math.max(0, Math.min(1, progress));
  const display = Math.round(clampedTarget * k);
  const dash = (display / 100) * circumference;
  const innerRadius = Math.max(2, radius - stroke * 1.25);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={radius} stroke={progressGrey} strokeWidth={stroke} fill="none" />
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke={baseBlack} strokeWidth={stroke} fill="none"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          rotation="-90" origin={`${cx}, ${cy}`}
        />
        <Circle cx={cx} cy={cy} r={innerRadius} fill="#111" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff' }}>{display}%</Text>
      </View>
    </View>
  );
});

/* ───────── 제목 2줄 ───────── */
const TitleTwoLine = memo(function TitleTwoLine({ text, style, containerWidth=SCREEN_WIDTH-120 }) {
  return (
    <Text
      style={[style, { maxWidth: containerWidth, textAlign:'center' }]}
      numberOfLines={2}
      ellipsizeMode="tail"
    >
      {text}
    </Text>
  );
});

/* ───────── 알림 미리보기들 ───────── */
const WEEK_DAYS_KO = ['월','화','수','목','금','토','일'];
const sortTimesAsc = (arr=[]) => [...arr].sort((a,b)=>a.localeCompare(b));

const SimplePreviewMini = ({ days=[], times=[], time }) => {
  const toShow = (Array.isArray(times) && times.length) ? sortTimesAsc(times) : (time ? [time] : []);
  return (
    <View>
      <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:6 }}>
        {WEEK_DAYS_KO.map(d=>{
          const on = days.includes(d);
          return (
            <View key={d} style={{
              width:22, height:22, borderRadius:11, alignItems:'center', justifyContent:'center',
              borderWidth:1, borderColor: on? '#111':'#ddd', backgroundColor:on? '#111':'#fff'
            }}>
              <Text style={{ fontSize:11, fontWeight:'800', color:on?'#fff':'#333' }}>{d}</Text>
            </View>
          );
        })}
      </View>
      <Text style={{ fontSize:12, color:textGrey, textAlign:'left' }}>{toShow.length? toShow.join('  ') : '시간 미설정'}</Text>
    </View>
  );
};

const WeeklyPreviewMini = ({ byWeekDays=[] })=>{
  const map = useMemo(()=>{ const m=new Map(); for(const {day, times=[]} of byWeekDays) m.set(day, sortTimesAsc(times)); return m; },[byWeekDays]);
  return (
    <View style={{ flexDirection:'row' }}>
      {WEEK_DAYS_KO.map((d,i)=>(
        <View key={d} style={{ flex:1, paddingHorizontal:4, borderRightWidth:i<6?1:0, borderRightColor:'#eee' }}>
          <Text style={{ fontSize:12, fontWeight:'800', color:textGrey, textAlign:'center', marginBottom:2 }}>{d}</Text>
          {(map.get(d)||[]).map((t,idx)=><Text key={`${d}-${t}-${idx}`} style={{ fontSize:11, textAlign:'center', color:textGrey }}>{t}</Text>)}
        </View>
      ))}
    </View>
  );
};

const MonthlyPreviewMini = ({ byDates=[] })=>{
  const map = useMemo(()=>{
    const m=new Map();
    for(const {date, times=[]} of byDates){
      const n=Number(date);
      if(n>=1&&n<=31){ m.set(n, sortTimesAsc([...(m.get(n)||[]), ...times])); }
    }
    return m;
  },[byDates]);
  const cells=[]; for(let d=1; d<=31; d++) cells.push(d); while(cells.length<35) cells.push(null);
  return (
    <View style={{ borderTopWidth:1, borderTopColor:'#eee' }}>
      {Array.from({length:5}).map((_,r)=>(
        <View key={`r${r}`} style={{ flexDirection:'row', borderBottomWidth:r<4?1:0, borderBottomColor:'#eee' }}>
          {cells.slice(r*7, r*7+7).map((d,c)=>(
            <View key={`c${r}-${c}`} style={{ flex:1, padding:4, borderRightWidth:c<6?1:0, borderRightColor:'#eee' }}>
              {d && <>
                <Text style={{ fontSize:11, fontWeight:'800', color:textGrey, textAlign:'right' }}>{d}</Text>
                {(map.get(d)||[]).map((t,idx)=><Text key={`${d}-${t}-${idx}`} style={{ fontSize:11, color:textGrey }}>{t}</Text>)}
              </>}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

const FullRangePreviewMini = ({ payload={}, startDate, endDate }) => {
  if(!startDate || !endDate) return <Text style={{fontSize:12, textAlign:'center', color:textGrey}}>기간이 설정되지 않았습니다.</Text>;
  const byDate = payload.byDate || {};
  const months=[]; const cur=new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while(cur<=end){ months.push({y:cur.getFullYear(), mi:cur.getMonth()}); cur.setMonth(cur.getMonth()+1,1); }
  const inRange=(y,mi,d)=>{
    const dt=new Date(y,mi,d); return dt>=new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
      && dt<=new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  };
  return (
    <View style={{ maxHeight:260 }}>
      <ScrollView nestedScrollEnabled>
        {months.map(({y,mi})=>{
          const firstDow=new Date(y,mi,1).getDay();
          const dim=new Date(y,mi+1,0).getDate();
          const cells=[]; for(let i=0;i<firstDow;i++) cells.push(null); for(let d=1; d<=dim; d++) cells.push(d);
          while(cells.length%7!==0) cells.push(null);
          return (
            <View key={`${y}-${mi}`} style={{ marginBottom:8 }}>
              <Text style={{ fontSize:12, fontWeight:'800', color:textGrey, textAlign:'center' }}>{y}.{pad2(mi+1)}</Text>
              <View style={{ flexDirection:'row', marginBottom:4 }}>
                {['일','월','화','수','목','금','토'].map((w,i)=><View key={w} style={{ flex:1, alignItems:'center', borderRightWidth:i<6?1:0, borderRightColor:'#eee' }}><Text style={{fontSize:11, fontWeight:'800', color:textGrey}}>{w}</Text></View>)}
              </View>
              <View style={{ borderTopWidth:1, borderTopColor:'#eee' }}>
                {Array.from({length: Math.ceil(cells.length/7)}).map((__,r)=>(
                  <View key={`r${r}`} style={{ flexDirection:'row', borderBottomWidth:1, borderBottomColor:'#eee' }}>
                    {cells.slice(r*7, r*7+7).map((d,c)=>{
                      const show = d && inRange(y,mi,d);
                      const key = d? `${y}-${pad2(mi+1)}-${pad2(d)}` : '';
                      const t = show? (Array.isArray(byDate[key])? sortTimesAsc(byDate[key]):[]) : [];
                      return (
                        <View key={`c${r}-${c}`} style={{ flex:1, padding:4, borderRightWidth:c<6?1:0, borderRightColor:'#eee' }}>
                          {d && <>
                            <Text style={{ fontSize:11, fontWeight:'800', color: textGrey, textAlign:'right' }}>{d}</Text>
                            {show && t.map((x,idx)=><Text key={`${d}-${x}-${idx}`} style={{ fontSize:11, color:textGrey }}>{x}</Text>)}
                          </>}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const NotiPreviewSwitch = ({ notification, startDate, endDate })=>{
  if(!notification?.mode) return <Text style={{ fontSize:12, color:textGrey, textAlign:'center' }}>알림 없음</Text>;
  const { mode, payload={} } = notification;
  if (mode==='simple') return <SimplePreviewMini days={payload.days||[]} times={payload.times||[]} time={payload.time} />;
  if (mode==='weekly' && Array.isArray(payload.byWeekDays)) return <WeeklyPreviewMini byWeekDays={payload.byWeekDays} />;
  if (mode==='monthly' && Array.isArray(payload.byDates)) return <MonthlyPreviewMini byDates={payload.byDates} />;
  if (mode==='fullrange') return <FullRangePreviewMini payload={payload} startDate={startDate?new Date(startDate):null} endDate={endDate?new Date(endDate):null} />;
  return <Text style={{ fontSize:12, color:textGrey, textAlign:'center' }}>알림 없음</Text>;
};

/* ───────── 달력 ───────── */
const MonthCalendar = memo(function MonthCalendar({
  startDate, endDate, entriesByDaySet, onPrev, onNext, monthDate, canPrev, canNext, highlightDate = null,
}) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const firstDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const inRange = (d) => {
    const ds = new Date(startDate); ds.setHours(0,0,0,0);
    const de = new Date(endDate); de.setHours(23,59,59,999);
    const x = new Date(d); x.setHours(12,0,0,0);
    return x >= ds && x <= de;
  };
  const isCert = (d) => {
    const y = d.getFullYear();
    const m = `${d.getMonth()+1}`.padStart(2,'0');
    const dd = `${d.getDate()}`.padStart(2,'0');
    return entriesByDaySet.has(`${y}-${m}-${dd}`);
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 10,
    onPanResponderRelease: (_, gs) => {
      if (gs.dx < -40 && canNext) onNext();
      else if (gs.dx > 40 && canPrev) onPrev();
    },
  });

  return (
    <View style={styles.calWrap} {...panResponder.panHandlers}>
      <View style={styles.calHeaderRow}>
        <TouchableOpacity 
          onPress={canPrev ? onPrev : undefined} 
          disabled={!canPrev} 
          style={[styles.calNavBtn, !canPrev && {opacity:0.3}]}
          hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
        >
          <Text style={styles.calNavText}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.calTitle}>{`${month + 1}월`}</Text>
        <TouchableOpacity 
          onPress={canNext ? onNext : undefined} 
          disabled={!canNext} 
          style={[styles.calNavBtn, !canNext && {opacity:0.3}]}
          hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
        >
          <Text style={styles.calNavText}>{'›'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.calDowRow}>
        {CAL_HEADER.map((ch, i)=><Text key={`dow-${i}`} style={styles.calDow}>{ch}</Text>)}
      </View>

      <View style={styles.calGrid}>
        {(() => {
          const today = new Date(); today.setHours(0,0,0,0);
          return cells.map((d, idx) => {
            if (!d) return <View key={`e${idx}`} style={styles.calCell}/>;
            const ranged = inRange(d);
            const isThisMonth = d.getMonth()===month;
            if (!isThisMonth) return <View key={`o${idx}`} style={styles.calCell} />;

                        const isFuture = d > today;
            const cert = isCert(d);
            const isHighlight = highlightDate === keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
            const isToday = d.toDateString() === today.toDateString();
            let cellColor = '#D1D5DB';
            if (ranged) {
              if (isFuture) cellColor = '#777777';
              else cellColor = '#111111';
            }

            if (cert) {
              return (
                <View key={`d${idx}`} style={styles.calCell}>
                  <View style={[styles.calBadge, isHighlight && { borderWidth: 2, borderColor: '#FFD700' }]}>
                    <Text style={styles.calBadgeText}>{d.getDate()}</Text>
                  </View>
                </View>
              );
            }

            return (
              <View key={`d${idx}`} style={styles.calCell}>
                <Text style={[styles.calCellText, { color: cellColor }, isToday && !cert && { fontWeight: '900' }, isHighlight && { fontWeight: '900', textDecorationLine: 'underline' }]}>
                  {d.getDate()}
                </Text>
              </View>
            );
          });
        })()}
      </View>
    </View>
  );
});

/* ───────── 일자 집계 ───────── */
function aggregateByDate(entries){
  const map = new Map();
  for(const e of entries){
    const d = new Date(e.timestamp); d.setHours(0,0,0,0);
    const k = keyOf(d);
    const prev = map.get(k) || { minutes:0, count:0, date:new Date(d) };
    prev.count += 1;
    if (typeof e.duration === 'number' && e.duration > 0) prev.minutes += e.duration;
    map.set(k, prev);
  }
  return Array.from(map.values()).sort((a,b)=>a.date-b.date);
}

/* ───────── 라인차트(횟수는 누적 그래프) ───────── */
const LineGradientChart = memo(function LineGradientChart({
  startDate,
  entries,
  metric='count',
  width=SCREEN_WIDTH - EDGE*2 - 8,
  height=185,
  introProgress=1,
  interactive=true,
  pagerIndex=0,
  onSelectPagerIndex=()=>{},
}){
  const left = 12, right = 12, top = 16, bottom = 42;
  const cw = width - left - right;
  const ch = height - top - bottom;

  const today = useMemo(()=>{ const t=new Date(); t.setHours(0,0,0,0); return t; },[]);
  const raw = useMemo(()=>aggregateByDate(entries),[entries]);

  const baseSeries = useMemo(()=>{
    if (metric === 'count') {
      // 횟수는 인증한 날만 (series useMemo에서 전체 날짜 채움)
      return raw.map(r=>({d:r.date, v: r.count})).filter(p=>p.v>0);
    }
    // 분 그래프: 시작일부터 오늘까지 모든 날짜 채우고 인증 없는 날은 0
    if (raw.length === 0) return [];
    const minuteMap = new Map();
    for (const r of raw) minuteMap.set(keyOf(r.date), r.minutes);
    const startD = raw[0].date;
    const endD = new Date(); endD.setHours(0,0,0,0);
    const result = [];
    const cur = new Date(startD);
    while (cur <= endD) {
      const k = keyOf(new Date(cur));
      result.push({ d: new Date(cur), v: minuteMap.get(k) || 0 });
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }, [raw, metric]);

  const series = useMemo(()=>{
    if (metric !== 'count') return baseSeries;
    if (baseSeries.length === 0) return [];

    // 시작일부터 오늘까지 모든 날짜를 채워서 누적값 유지
    const startD = baseSeries[0].d;
    const endD = new Date(); endD.setHours(0,0,0,0);

    // 인증한 날짜별 횟수 맵
    const countMap = new Map();
    for (const p of baseSeries) countMap.set(keyOf(p.d), p.v);

    // 시작일 하루 전을 0값 시작점으로 추가(분 그래프 0값 위치와 일치)
    const result = [];
    const dayBefore = new Date(startD);
    dayBefore.setDate(dayBefore.getDate() - 1);
    result.push({ d: dayBefore, v: 0 });

    // 시작일~오늘 모든 날짜 순회하며 누적
    let cum = 0;
    const cur = new Date(startD);
    while (cur <= endD) {
      const k = keyOf(new Date(cur));
      cum += (countMap.get(k) || 0);
      result.push({ d: new Date(cur), v: cum });
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }, [baseSeries, metric]);

  const start = useMemo(()=>startDate? new Date(new Date(startDate).setHours(0,0,0,0))
                                     : (series[0]?.d || today), [startDate, series, today]);

  const nodePts = useMemo(()=>{
    const n = series.length;
    if (n===0) return [];
    const BOTTOM_PADDING_RATIO = 0.15;
    const usableCh = ch * (1 - BOTTOM_PADDING_RATIO);

    if (n===1) {
      const vmax = Math.max(1, series[0].v);
      const y = top + (1 - (series[0].v / vmax)) * usableCh * introProgress;
      const x = left; // 단일점은 왼쪽 끝
      return [{x, y, v: series[0].v, d: series[0].d}];
    }
    const vmax = Math.max(1, ...series.map(p=>p.v));
    return series.map((p, i)=>{
      const x = left + (i/(n-1))*cw;
      const y = top + (1 - (p.v/vmax)) * usableCh * introProgress;
      return { x, y, v: p.v, d: p.d };
    });
  }, [series, left, cw, top, ch, introProgress]);

  const yScale = useCallback((v, vmax)=> {
    const BOTTOM_PADDING_RATIO = 0.15;
    const usableCh = ch * (1 - BOTTOM_PADDING_RATIO);
    // 0값이 x축에 딱 붙지 않도록 가상의 최솟값(-vmax*0.08)을 기준으로 스케일
    const vmin = -vmax * 0.08;
    const range = vmax - vmin;
    return top + (1 - (v - vmin) / range) * usableCh * introProgress;
  }, [top, ch, introProgress]);

  const pts = useMemo(()=>{
    const n = series.length;
    if(n===0) return [];
    if (n===1) {
      const vmax = Math.max(1, series[0].v);
      const y = yScale(series[0].v, vmax);
      const xleft = left;
      return [
        {x:xleft-0.001, y, v:series[0].v, d:series[0].d},
        {x:xleft+0.001, y, v:series[0].v, d:series[0].d}
      ];
    }
    return nodePts;
  }, [series, yScale, left, nodePts]);

  const pathD = useMemo(()=>{
    if(!pts.length) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for(let i=1;i<pts.length;i++) d += ` L ${pts[i].x} ${pts[i].y}`;
    return d;
  }, [pts]);

  const baselineY = top + ch + 0.5;
  const areaGap = 6;
  const areaD = useMemo(()=>{
    if(!pts.length) return '';
    const bottomY = baselineY - areaGap;
    let d = `M ${pts[0].x} ${bottomY} L ${pts[0].x} ${pts[0].y}`;
    for(let i=1;i<pts.length;i++) d += ` L ${pts[i].x} ${pts[i].y}`;
    d += ` L ${pts[pts.length-1].x} ${bottomY} Z`;
    return d;
  }, [pts, baselineY]);

  const defaultLabel = useMemo(()=>{
    if(series.length===0) return null;
    const base = series[series.length-1];
    const v = base.v;
    const d = base.d;
    return `${metric==='count'? `${v}회(누적)` : `${v}분`} ${String(d.getFullYear()).slice(2)}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }, [series, metric]);

  const [selectedIdx, setSelectedIdx] = useState(null);
  useEffect(()=>{ setSelectedIdx(null); }, [entries, metric]);

  const labelDims = (txt='')=>{
    const w = Math.max(84, Math.min(140, 12 + txt.length * 6));
    return { w, h:18 };
  };

  const placeLabel = (p, text, isEnd=false)=>{
    const { w, h } = labelDims(text);
    const vGap = isEnd ? LABEL_END_GAP : LABEL_GAP;
    const above = p.y - h - vGap;
    const below = p.y + vGap;

    let ly;
    if (above >= top + 4)           ly = above;
    else if (below <= baselineY-16) ly = below;
    else                            ly = Math.min(Math.max(above, top+4), baselineY - h - 4);

    const lx = Math.min(Math.max(p.x - w/2, left + 2), left + cw - w - 2);
    return { lx, ly, w, h };
  };

  const dotCy = baselineY + 14;
  const dotCx1 = left + cw/2 - 10;
  const dotCx2 = left + cw/2 + 10;

  
 const shouldCaptureTouch = useCallback((evt) => {
  if (!interactive) return false;
  const { locationX: x, locationY: y } = evt.nativeEvent;
  const near = (cx, cy, r = 16) => Math.hypot(x - cx, y - cy) <= r;

  // 페이저 점(그래프 내부의 ●●) 근처만 터치 캡처
  if (near(dotCx1, dotCy) || near(dotCx2, dotCy)) return true;

  // 데이터 노드 근처만 터치 캡처
  for (let i = 0; i < nodePts.length; i++) {
    if (near(nodePts[i].x, nodePts[i].y, 16)) return true;
  }
  // 나머지는 부모(세로 스크롤)로 넘김
  return false;
}, [interactive, nodePts, dotCx1, dotCx2, dotCy]);

  const handleRelease = useCallback((evt)=>{
    if(!interactive) return;
    const { locationX:x } = evt.nativeEvent;
    const near = (cx, r=16) => Math.abs(x - cx) <= r;
    if (near(dotCx1)) { onSelectPagerIndex(0); return; }
    if (near(dotCx2)) { onSelectPagerIndex(1); return; }
    if (!pts.length) return;
    let best = 0, bestDx = Infinity;
    for (let i=0;i<pts.length;i++){
      const dx = Math.abs(pts[i].x - x);
      if (dx < bestDx) { bestDx = dx; best = i; }
    }
    setSelectedIdx(best);
  }, [interactive, pts, dotCx1, dotCx2, onSelectPagerIndex]);

  const selectedLabel = useMemo(()=>{
    if (selectedIdx==null || !series[selectedIdx]) return null;
    const v = series[selectedIdx].v;
    const d = series[selectedIdx].d;
    return `${metric==='count'? `${v}회(누적)` : `${v}분`} ${String(d.getFullYear()).slice(2)}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }, [selectedIdx, series, metric]);

  const selPoint = useMemo(()=>{
    if (selectedIdx==null) return null;
    return pts[selectedIdx] || null;
  }, [selectedIdx, pts]);

  const endNode = pts[pts.length-1] || null;

  return (
    <View pointerEvents="box-none">
      <Svg
  width={width}
  height={height}
  onStartShouldSetResponder={shouldCaptureTouch}
  onMoveShouldSetResponder={() => false}
  onStartShouldSetResponderCapture={() => false}
  onMoveShouldSetResponderCapture={() => false}
  onResponderRelease={handleRelease}
  onResponderEnd={handleRelease}
>

        <Defs>
          <LinearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={progressGrey} stopOpacity="0.85"/>
            <Stop offset="100%" stopColor={progressGrey} stopOpacity="0"/>
          </LinearGradient>
        </Defs>

        {!!pts.length && <Path d={areaD} fill={`url(#grad-${metric})`} />}
        {!!pts.length && <Path d={pathD} fill="none" stroke={baseBlack} strokeWidth={1.6} />}

        {/* X축 */}
        <Line x1={left} y1={top + ch + 0.5} x2={left+cw} y2={top + ch + 0.5} stroke={progressGrey} strokeWidth={1} />

        {/* 좌/우 라벨 */}
        <SvgText x={left+2} y={top + ch + 16} fill={textGrey} fontSize={10} fontWeight="700" textAnchor="start">
          {`${String(new Date(start).getFullYear()).slice(2)}-${pad2(new Date(start).getMonth()+1)}-${pad2(new Date(start).getDate())}`}
        </SvgText>
        <SvgText x={left+cw-2} y={top + ch + 16} fill={textGrey} fontSize={10} fontWeight="700" textAnchor="end">
          {`Today ${String((new Date()).getFullYear()).slice(2)}-${pad2((new Date()).getMonth()+1)}-${pad2((new Date()).getDate())}`}
        </SvgText>

        {/* 마커/라벨 */}
        {!selPoint && endNode && (
          <Circle cx={endNode.x} cy={endNode.y} r={3.2} fill="#fff" stroke={baseBlack} strokeWidth={2}/>
        )}
        {selPoint && (
          <Circle cx={selPoint.x} cy={selPoint.y} r={3.8} fill="#fff" stroke={baseBlack} strokeWidth={2.1}/>
        )}
        {selPoint && selectedLabel && (() => {
          const pos = placeLabel(selPoint, selectedLabel, selectedIdx === series.length - 1);
          return (
            <>
              <Rect x={pos.lx} y={pos.ly} width={pos.w} height={pos.h} rx={6} fill="#111"/>
              <SvgText x={pos.lx + pos.w/2} y={pos.ly + pos.h - 6} fill="#fff" fontSize={10} fontWeight="700" textAnchor="middle">
                {selectedLabel}
              </SvgText>
            </>
          );
        })()}
        {!selPoint && defaultLabel && endNode && (() => {
          const pos = placeLabel(endNode, defaultLabel, true);
          return (
            <>
              <Rect x={pos.lx} y={pos.ly} width={pos.w} height={pos.h} rx={6} fill="#111"/>
              <SvgText x={pos.lx + pos.w/2} y={pos.ly + pos.h - 6} fill="#fff" fontSize={10} fontWeight="700" textAnchor="middle">
                {defaultLabel}
              </SvgText>
            </>
          );
        })()}

        {/* 내장 페이저 점 */}
        <Circle cx={left + cw/2 - 10} cy={top + ch + 14} r={4} fill={pagerIndex===0 ? '#111' : '#D1D5DB'} />
        <Circle cx={left + cw/2 + 10} cy={top + ch + 14} r={4} fill={pagerIndex===1 ? '#111' : '#D1D5DB'} />
      </Svg>
    </View>
  );
});

const LineChartsPager = memo(function LineChartsPager({ startDate, entries, introProgress=1, interactive=true }) {
  const pageW = SCREEN_WIDTH - (EDGE + GRAPH_SIDE_PAD) * 2;
  const scrollRef = useRef(null);
  const [page, setPage] = useState(0);

  const goPage = useCallback((i)=>{
    const idx = clamp(i,0,1);
    scrollRef.current?.scrollTo({ x: idx*pageW, y: 0, animated: true });
    setPage(idx);
  }, [pageW]);

  return (
    <View style={{ width: pageW, alignSelf:'center' }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        directionalLockEnabled
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e)=>{
          const i = Math.round((e.nativeEvent.contentOffset.x || 0)/pageW);
          setPage(clamp(i,0,1));
        }}
        snapToInterval={pageW}
        snapToAlignment="start"
        style={{ width: pageW }}
        onStartShouldSetResponderCapture={() => false}
        contentContainerStyle={{}}
        scrollEventThrottle={16}
      >
        <View style={{ width: pageW, alignItems:'center' }}>
          <LineGradientChart
            startDate={startDate}
            entries={entries}
            metric="count"         // 누적 그래프
            width={pageW-4}
            height={185}
            introProgress={introProgress}
            interactive={interactive}
            pagerIndex={page}
            onSelectPagerIndex={goPage}
          />
        </View>
        <View style={{ width: pageW, alignItems:'center' }}>
          <LineGradientChart
            startDate={startDate}
            entries={entries}
            metric="minutes"
            width={pageW-4}
            height={185}
            introProgress={introProgress}
            interactive={interactive}
            pagerIndex={page}
            onSelectPagerIndex={goPage}
          />
        </View>
      </ScrollView>

      {/* ⛔️ 외부 점(아래쪽 ●●)은 제거했습니다 — 그래프 내부 점만 남김 */}
    </View>
  );
});



/* ───────── 주간 뷰 ───────── */
const WeekView = memo(function WeekView({ weeksData, currentIndex=0, onIndexChange, introProgress=1, onPressDay }) {
  const scrollRef = useRef(null);
  const [pageW, setPageW] = useState(SCREEN_WIDTH);

  const onLayout = useCallback((e) => {
    const w = Math.floor(e.nativeEvent.layout.width || SCREEN_WIDTH);
    if (w && w !== pageW) setPageW(w);
  }, [pageW]);

  const PADDING_H = EDGE;
  const INNER_W = Math.floor(pageW - PADDING_H * 2);
  const COL_W   = Math.floor(INNER_W / 7);
  const ROW_W   = COL_W * 7;

  const initialOffsetX = useMemo(
    () => Math.max(0, Math.min(currentIndex, Math.max(weeksData.length - 1, 0))) * pageW,
    [currentIndex, weeksData.length, pageW]
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try { scrollRef.current?.scrollTo({ x: initialOffsetX, y: 0, animated: false }); } catch {}
    });
    return () => cancelAnimationFrame(id);
  }, [initialOffsetX]);

  const renderWeek = useCallback(({ dailyStats }, idx) => {
    const maxTime = Math.max(...dailyStats.map(s => s.duration || 0), 1);
    const maxCount = Math.max(...dailyStats.map(s => s.totalCount || 0), 1);

    return (
      <View key={idx} style={{ width: pageW, paddingHorizontal: PADDING_H, marginBottom: 10 }}>
        <View style={{ flexDirection:'row', width: ROW_W, alignSelf:'center' }}>
          {dailyStats.map((stat, i) => (
            <TouchableOpacity 
              key={i} 
              style={{ width: COL_W, alignItems:'center' }}
              onPress={() => onPressDay?.(stat.date, weeksData[idx]?.ws, i)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dateLabel, { marginBottom: 2 }]}>{stat.date}</Text>
              <Text style={styles.dayLabel}>{DAY_LABELS[i]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flexDirection:'row', width: ROW_W, alignSelf:'center', alignItems:'flex-end', height: 120, marginTop: 10 }}>
          {dailyStats.map((stat, i) => {
            const hasTime = (stat.duration || 0) > 0;
            const hasCount = (stat.totalCount || 0) > 0;

            if (!hasTime && !hasCount) {
              return (
                <View key={i} style={{ width: COL_W, alignItems:'center', justifyContent:'flex-end' }}>
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', marginBottom: 2 }} />
                </View>
              );
            }

            const hTime = hasTime
              ? Math.min((stat.duration / maxTime) * 80 + 10, 90) * introProgress
              : 0;
            const hCount = (!hasTime && hasCount)
              ? Math.min((stat.totalCount / maxCount) * 80 + 10, 90) * introProgress
              : 0;

            if (hasTime) {
              const segDurations = Array.isArray(stat.durations) ? stat.durations : [];
              const totalSegDur = segDurations.reduce((a, b) => a + b, 0);

              return (
                <View key={i} style={{ width: COL_W, alignItems:'center', justifyContent:'flex-end' }}>
                  <Text style={styles.barText}>{`${stat.duration}분`}</Text>
                  <View style={{ marginVertical: 2, height: hTime, justifyContent:'flex-end', alignItems:'center' }}>
                    {(() => {
                      if (segDurations.length <= 1) {
                        return <View style={[styles.bar, { height: hTime, backgroundColor: baseBlack }]} />;
                      }
                      const segGap = 2;
                      const available = Math.max(hTime - segGap * (segDurations.length - 1), 2 * segDurations.length);
                      return segDurations.map((dur, s) => {
                        const ratio = totalSegDur > 0 ? (dur / totalSegDur) : (1 / segDurations.length);
                        const segH = Math.max(4, ratio * available);
                        return (
                          <View key={s} style={{
                            width: 16, height: segH, borderRadius: 4,
                            marginBottom: s === segDurations.length - 1 ? 0 : 2,
                            backgroundColor: baseBlack,
                          }}/>
                        );
                      });
                    })()}
                  </View>
                  <Text style={styles.countLabel}>{(stat.totalCount || 0) > 0 ? `${stat.totalCount}회` : '—'}</Text>
                </View>
              );
            }

            const segCount = stat.totalCount || 0;
            return (
              <View key={i} style={{ width: COL_W, alignItems:'center', justifyContent:'flex-end' }}>
                <Text style={styles.barText}>{' '}</Text>
                <View style={{ marginVertical: 2, height: hCount, justifyContent:'flex-end', alignItems:'center' }}>
                  {(() => {
                    const segGap = 2;
                    const available = Math.max(hCount - segGap * (segCount - 1), 2 * segCount);
                    const segH = Math.max(4, available / segCount);
                    return Array.from({ length: segCount }).map((_, s) => (
                      <View key={s} style={{
                        width: 16, height: segH, borderRadius: 4,
                        marginBottom: s === segCount - 1 ? 0 : segGap,
                        backgroundColor: progressGrey,
                      }}/>
                    ));
                  })()}
                </View>
                <Text style={styles.countLabel}>{`${stat.totalCount}회`}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  }, [pageW, PADDING_H, ROW_W, COL_W, introProgress]);

  return (
    <View style={{ height: 180 }} onLayout={onLayout}>
      <ScrollView
        key={`week-${weeksData.length}-${pageW}`}
        ref={scrollRef}
        horizontal
        pagingEnabled
        snapToInterval={pageW}
        snapToAlignment="start"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        onMomentumScrollEnd={(e) => {
          const i = Math.round((e?.nativeEvent?.contentOffset?.x || 0) / pageW);
          if (typeof onIndexChange === 'function') onIndexChange(Math.max(0, Math.min(i, weeksData.length - 1)));
        }}
        directionalLockEnabled
        nestedScrollEnabled
        scrollEventThrottle={16}
        onStartShouldSetResponderCapture={() => false}
      >
        {weeksData.map((w, idx) => (
          <View key={`wk-${idx}`} style={{ width: pageW }}>
            {renderWeek(w, idx)}
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

const GRASS_ROWS = 7;
const DOW_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DOW_SHOW = [1, 3, 5]; // Mon, Wed, Fri

const GrassGraph = memo(function GrassGraph({ entries, startDate, endDate, introProgress = 1, onTap }) {
  const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH - EDGE * 2);
    // 파도 강도: 각 col의 0~1 값 (그레이 오버레이 강도)
  const [waveIntensity, setWaveIntensity] = useState(() => new Array(60).fill(0));
  const sparkTimersRef = React.useRef([]);
  const waveRafRef = React.useRef(null);


  const onLayout = useCallback((e) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setContainerWidth(w);
  }, []);

  const [waveTrigger, setWaveTrigger] = useState(0);
  useEffect(() => { if (onTap) onTap(() => setWaveTrigger(t => t + 1)); }, [onTap]);

  // RAF 기반 파도 useEffect - JS 스레드 분리로 다른 애니메이션과 충돌 없음
  useEffect(() => {
    sparkTimersRef.current.forEach(t => clearTimeout(t));
    sparkTimersRef.current = [];
    if (waveRafRef.current) cancelAnimationFrame(waveRafRef.current);

    const TOTAL_COLS = 60;
    const TOTAL_ROWS = 7;
    const WAVE_WIDTH = 4; // 파도 너비 (col 단위)
    const WAVE_SPEED = 0.02; // 파도 속도 줄임 (느리게)
    const DIAGONAL = 0.6; // 사선 기울기 (row당 col 오프셋)

    const startTime = performance.now();

    const tick = (now) => {
      const elapsed = now - startTime;
      const wavePos = elapsed * WAVE_SPEED;

      if (wavePos > TOTAL_COLS + WAVE_WIDTH + TOTAL_ROWS * DIAGONAL) {
        setWaveIntensity(new Array(TOTAL_COLS * TOTAL_ROWS).fill(0));
        return;
      }

      // col x row 2D 배열로 확장 (사선 효과)
      const intensities = new Array(TOTAL_COLS * TOTAL_ROWS).fill(0);
      for (let col = 0; col < TOTAL_COLS; col++) {
        for (let row = 0; row < TOTAL_ROWS; row++) {
          // row가 증가할수록 파도가 오른쪽으로 밀림 -> 사선
          const diagOffset = row * DIAGONAL;
          const dist = Math.abs((col + diagOffset) - wavePos);
          if (dist < WAVE_WIDTH) {
            intensities[col * TOTAL_ROWS + row] = 
              Math.sin((1 - dist / WAVE_WIDTH) * Math.PI * 0.5);
          }
        }
      }
      setWaveIntensity(intensities);
      waveRafRef.current = requestAnimationFrame(tick);
    };

    waveRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (waveRafRef.current) cancelAnimationFrame(waveRafRef.current);
      sparkTimersRef.current.forEach(t => clearTimeout(t));
      sparkTimersRef.current = [];
    };
  }, [waveTrigger]);

  const LEFT_LABEL_W = 0;
  const CELL_GAP = 3;
  const availableW = containerWidth;

  const { cellData, weekStarts, monthLabels } = useMemo(() => {
    if (!startDate || !endDate) return { cellData: [], weekStarts: [], monthLabels: [] };

    const certSet = new Set();
    for (const e of entries) {
      const d = new Date(e.timestamp);
      certSet.add(keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate())));
    }

    const start = new Date(startDate); start.setHours(0,0,0,0);
    const end = new Date(endDate); end.setHours(0,0,0,0);
    const today = new Date(); today.setHours(0,0,0,0);

    const gridStart = new Date(start);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());

    const cells = [];
    const weekStartCols = [];
    const monthLabelMap = {};

    const cur = new Date(gridStart);
    let col = 0;

    while (cur <= end || (cur.getDay() !== 0 && cells.length > 0)) {
      if (cur.getDay() === 0) {
        weekStartCols.push({ col, date: new Date(cur) });
        const monthKey = `${cur.getFullYear()}-${cur.getMonth()}`;
        if (!monthLabelMap[monthKey]) {
          monthLabelMap[monthKey] = { col, label: cur.toLocaleString('en-US', { month: 'short' }) };
        }
      }
      for (let row = 0; row < GRASS_ROWS; row++) {
        const cellDate = new Date(cur);
        cellDate.setDate(cur.getDate() + row);
        const k = keyOf(cellDate);
        const inRange = cellDate >= start && cellDate <= end;
        const certified = certSet.has(k);
        const isFuture = cellDate > today;

        let level = 0;
        if (!inRange) {
          level = 0; // 일정 밖 빈칸 (아주 연한 회색)
        } else if (isFuture) {
          level = 1; // 일정이지만 미래(미인증)
        } else if (!certified) {
          level = 1; // 일정이지만 미인증
        } else {
          // 인증됨 - 연속 일수 계산
          let streak = 1;
          for (let s = 1; s <= 2; s++) {
            const prevDate = new Date(cellDate);
            prevDate.setDate(prevDate.getDate() - s);
            const prevKey = keyOf(prevDate);
            if (certSet.has(prevKey)) streak++;
            else break;
          }
          if (streak >= 3) level = 4; // 3일+ 연속: 가장 진함
          else if (streak === 2) level = 3; // 2일 연속
          else level = 2; // 1일 인증
        }

        cells.push({ col, row, date: new Date(cellDate), level });
      }
      cur.setDate(cur.getDate() + GRASS_ROWS);
      col++;
      if (col > 60) break;
    }

    const monthLabelsArr = Object.values(monthLabelMap);
    return { cellData: cells, weekStarts: weekStartCols, monthLabels: monthLabelsArr };
  }, [entries, startDate, endDate]);
  


  const cellSize = 12;
  const minCols = Math.ceil((containerWidth - LEFT_LABEL_W) / (cellSize + 4 /* CELL_GAP */));
  const totalCols = Math.max(weekStarts.length, minCols);
  const graphWidth = totalCols * (cellSize + CELL_GAP) - CELL_GAP;

  const LEVEL_COLORS = ['#F3F4F6', '#E5E7EB', '#A0A0A0', '#555555', '#111111'];
  const TOP_LABEL_H = 18;

            const GridContent = (
    <View style={{ flexDirection: 'row', width: graphWidth }}>
      {Array.from({ length: totalCols }).map((_, col) => {
        // col x row 2D 인덱스로 intensity 읽기
        return (
          <View key={col} style={{ marginRight: col < totalCols - 1 ? CELL_GAP : 0 }}>
            {Array.from({ length: GRASS_ROWS }).map((__, row) => {
              const cell = cellData.find(c => c.col === col && c.row === row);
              const baseLevel = cell?.level ?? 0;
              const intensity2D = waveIntensity[col * GRASS_ROWS + row] ?? 0;
              const wave = intensity2D;
              const baseColor = LEVEL_COLORS[baseLevel] ?? '#F3F4F6';
              // LEVEL_COLORS 기반 파도 + 중심부 검은색 라인
              let waveColor = baseColor;
              if (wave > 0.85) waveColor = '#111111'; // 중심부 검은색
              else if (wave > 0.6) waveColor = '#555555'; // level 3
              else if (wave > 0.25) waveColor = '#A0A0A0'; // level 2
              else if (wave > 0.05) waveColor = '#E5E7EB'; // level 1
              return (
                <View key={row} style={{
                  width: cellSize, height: cellSize,
                  borderRadius: 2,
                  backgroundColor: wave > 0.05 ? waveColor : baseColor,
                  marginBottom: row < GRASS_ROWS - 1 ? CELL_GAP : 0,
                }} />
              );
            })}
          </View>
        );
      })}
    </View>);

  return (
    <View style={{ marginTop: 10 }} onLayout={onLayout}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        scrollEnabled={graphWidth > containerWidth}
        contentContainerStyle={{}}
        style={{ overflow: 'hidden' }}
      >
        <View>
          <View style={{ height: TOP_LABEL_H, width: graphWidth, position: 'relative', marginBottom: 4 }}>
            {monthLabels.map((ml, i) => (
              <Text key={i} style={{
                position: 'absolute',
                left: ml.col * (cellSize + CELL_GAP),
                fontSize: 10, color: '#6B7280', fontWeight: '700',
              }}>{ml.label}</Text>
            ))}
          </View>
          {GridContent}
        </View>
      </ScrollView>
    </View>
  );
});

/* ───────── 리스트 행 ───────── */
const EntryRow = memo(function EntryRow({ item, indexFromEnd, readOnly, onPress }) {
  const body = (
    <>
      <Text style={styles.number}>{indexFromEnd}</Text>
      {!!item?.imageUri && typeof item.imageUri === 'string' && item.imageUri.length > 0 && (
        <Image 
          source={{ uri: item.imageUri }} 
          style={styles.thumbnail} 
          onError={() => {}} 
        />
      )}
      <View style={styles.textContainer}>
        <Text style={styles.text}>{item?.text ?? ''}</Text>
        <Text style={styles.time}>인증 시간: {new Date(item.timestamp).toLocaleString()}</Text>
        {(typeof item.duration === 'number' && item.duration > 0) && (
          <Text style={styles.duration}>소요 시간: {item.duration}분</Text>
        )}
      </View>
    </>
  );
  if (readOnly) return <View style={styles.entry}>{body}</View>;
  return (
    <TouchableOpacity style={styles.entry} onPress={onPress} activeOpacity={0.85}>
      {body}
    </TouchableOpacity>
  );
});

/* ───────── 공유 아이콘 ───────── */
const ShadowIcon = ({ forShare=false }) => {
  if (!forShare) {
    return (
      <View style={styles.iconWrapAbs}>
        <Image source={ICON} style={styles.iconSquare} />
      </View>
    );
  }
  return (
    <View style={styles.iconWrapShare}>
      <Svg width={46} height={46} style={{ position:'absolute' }}>
        <Rect x={3} y={4} width={40} height={40} rx={8} fill="#000" opacity={0.28} />
        <Rect x={2} y={3} width={42} height={42} rx={9} fill="#000" opacity={0.18} />
      </Svg>
      <Image source={ICON} style={styles.iconSquare} />
    </View>
  );
};

/* ───────── 헤더 아래: 카운트 행 최소화 ───────── */
const HeaderWithCountMemo = memo(function HeaderWithCountMemo({ HeaderCard }) {
  return <View collapsable={false}>{HeaderCard}</View>;
});

/* ───────── RAW 디버그 리스트 ───────── */
const RawDebugList = ({
  entries, sortedEntries, insets, readOnly, navigation, challengeId,
  HeaderWithCountMemo, HeaderCard, totalMinutes, hours, minutes, currentScore, targetScore, styles
}) => {
  return (
    <React.Fragment>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 12, paddingBottom: (insets?.bottom ?? 0) + 96 }}
        keyboardShouldPersistTaps="always"
      >
        <HeaderWithCountMemo HeaderCard={HeaderCard} />

        <View style={{ padding: 10, borderBottomWidth: 1, borderColor: '#eee', marginBottom: 8 }}>
          <Text style={{ fontWeight: '800', fontSize: 16 }}>RAW 디버그 리스트</Text>
          <Text style={{ marginTop: 4, color: '#555' }}>
            entries: {entries.length} · sorted: {sortedEntries.length}
          </Text>
        </View>

        {sortedEntries.length === 0 && (
          <Text style={{ color: '#999', textAlign: 'center', marginTop: 24 }}>
            (빈 목록) — AsyncStorage에서 아무 것도 못 읽었습니다.
          </Text>
        )}

        {sortedEntries[0] && (
          <View style={{ padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 10 }}>
            <Text style={{ fontWeight: '700', marginBottom: 6 }}>첫 아이템 원본</Text>
            <Text selectable style={{ fontSize: 12, color: '#333' }}>
              {JSON.stringify(sortedEntries[0], null, 2)}
            </Text>
          </View>
        )}

        {sortedEntries.map((it, idx) => {
          const indexFromEnd = sortedEntries.length - idx;
          const onPress = readOnly ? undefined : () =>
            navigation.navigate('EntryDetail', { challengeId, entryId: it?.id });

          return (
            <View
              key={it?.id ?? `${it?.timestamp ?? 0}-${idx}`}
              style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: '#eee' }}
            >
              <Text style={{ fontWeight: '700' }}>
                #{indexFromEnd} {new Date(it.timestamp).toLocaleString()}
              </Text>
              <Text style={{ marginTop: 4, color: '#111' }}>
                {typeof it?.text === 'string' ? it.text : '(text 없음)'}
              </Text>
              {(typeof it?.duration === 'number' && it.duration > 0) && (
                <Text style={{ marginTop: 2, color: '#444' }}>소요 시간: {it.duration}분</Text>
              )}
              {!!onPress && <Text style={{ color:'#0a84ff', marginTop:6 }} onPress={onPress}>열기</Text>}
            </View>
          );
        })}

        <View style={{ height: (insets?.bottom ?? 0) + 24 }} />
      </ScrollView>
    </React.Fragment>
  );
};

/* ───────── 본문 ───────── */
export default function EntryListScreen({ route, navigation }) {
  const params = route?.params || {};
  const {
    challengeId,
    title: titleFromRoute,
    startDate: startDateFromRoute,
    targetScore = 7,
    endDate: endDateFromRoute,
    rewardTitle: rewardTitleFromRoute,
    reward: rewardFromRoute,
    readOnly = false,
  } = params;

  const title = titleFromRoute || '도전 기록';

  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  // 뒤로가기 항상 ChallengeList로
  React.useEffect(() => {
    const sub = require('react-native').BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        navigation.navigate('ChallengeList');
        return true;
      }
    );
    return () => sub.remove();
  }, [navigation]);

  const [entries, setEntries] = useState([]);
  const [weeksData, setWeeksData] = useState([]);
  const [weekIndex, setWeekIndex] = useState(0);
  const [currentScore, setCurrentScore] = useState(0);

  const [meta, setMeta] = useState({
    startDate: startDateFromRoute ?? null,
    endDate: endDateFromRoute ?? null,
    rewardTitle: rewardTitleFromRoute ?? null,
    reward: rewardFromRoute ?? null,
    description: null,
    notification: { mode: null, payload: null },
  });

  const [monthDate, setMonthDate] = useState(()=> {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [highlightDate, setHighlightDate] = useState(null); // 'YYYY-MM-DD'
  const [showInfo, setShowInfo] = useState(false);

  const handlePressDay = useCallback((statDate, ws, dayIndex) => {
    if (!ws) return;
    const actual = new Date(ws);
    actual.setDate(actual.getDate() + dayIndex);
    // 달력 월 이동
    setMonthDate(new Date(actual.getFullYear(), actual.getMonth(), 1));
    // 강조 날짜 설정
    const key = keyOf(new Date(actual.getFullYear(), actual.getMonth(), actual.getDate()));
    setHighlightDate(key);
    // 1.2초 후 강조 해제
    setTimeout(() => setHighlightDate(null), 1200);
  }, []);

  const [showDebug] = useState(true);
  const shareRef = useRef(null);
  const grassTapRef = useRef(null);

  /* ── 인트로 애니메이션 ── */
  const [introK, setIntroK] = useState(0);
  const rafRef = useRef(null);
  const lastKRef = useRef(0);

  const runIntro = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const ease = (t)=> 1 - Math.pow(1 - t, 5);
    const DUR = 2400;
    const t0 = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - t0) / DUR);
      const k = ease(t);
      if (k - lastKRef.current >= 0.02 || t >= 1) {
        lastKRef.current = k;
        setIntroK(k);
      }
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  /* ── 디버그/리로드 ── */
  const [debug, setDebug] = useState({ hitKey:null, tried:[], count:0 });
  const [reloadTick, setReloadTick] = useState(0);
  const reload = useCallback(()=> setReloadTick(t=>t+1), []);

  /* ── 안전 파서 & 정규화 ── */
  const normalizeEntries = useCallback((arr=[]) => {
    return arr.map((e, i) => {
      const id = e?.id ?? `${e?.timestamp ?? 'ts'}-${i}`;
      let ts = e?.timestamp;
      if (ts instanceof Date) ts = ts.getTime();
      if (typeof ts === 'string') {
        const parsed = Date.parse(ts);
        ts = Number.isNaN(parsed) ? null : parsed;
      }
      if (typeof ts !== 'number' || Number.isNaN(ts)) ts = Date.now() - i * 1000;

      let dur = e?.duration;
      if (typeof dur === 'string') {
        const n = Number(dur);
        dur = Number.isFinite(n) ? n : 0;
      }
      if (typeof dur !== 'number' || !Number.isFinite(dur)) dur = 0;

      return { ...e, id: String(id), timestamp: ts, duration: dur };
    });
  }, []);

  /* ── 주간 데이터 빌더 ── */
  const buildWeeks = useCallback((list, startDateStr) => {
    if (!startDateStr) { setWeeksData([]); return; }
    const start = new Date(startDateStr); start.setHours(0,0,0,0);
    const sd = start.getDay(); start.setDate(start.getDate() - sd); start.setHours(0,0,0,0);

    const now = new Date(); const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const td = todayMid.getDay();
    const thisSaturday = new Date(todayMid); thisSaturday.setDate(todayMid.getDate() + (6 - td));

    const weeks = [];
    let cursor = new Date(start);
    while (cursor <= thisSaturday) {
      const wsMid = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      const dailyStats = Array(7).fill(null).map((_, i) => {
        const dayStart = new Date(wsMid); dayStart.setDate(wsMid.getDate() + i);
        const dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1);
        const dailyEntries = list.filter(e => {
          const d = new Date(e.timestamp);
          return d >= dayStart && d < dayEnd;
        });
        const timedEntries = dailyEntries.filter(e => typeof e.duration === 'number' && e.duration > 0);
        const durations = timedEntries.map(e => e.duration);
        const durationSum = durations.reduce((sum, v) => sum + v, 0);

        return {
          date: `${dayStart.getMonth() + 1}/${dayStart.getDate()}`,
          duration: durationSum,
          countTimed: durations.length,
          totalCount: dailyEntries.length,
          durations,
        };
      });
      weeks.push({ ws: wsMid, dailyStats });
      cursor.setDate(cursor.getDate() + 7);
    }
    setWeeksData(weeks);

    const t0 = new Date(todayMid.getFullYear(), todayMid.getMonth(), todayMid.getDate());
    let initIdx = Math.max(weeks.length - 1, 0);
    for (let i = 0; i < weeks.length; i++) {
      const ws = new Date(weeks[i].ws);
      const we = new Date(ws); we.setDate(we.getDate() + 7);
      if (t0 >= ws && t0 < we) { initIdx = i; break; }
    }
    setWeekIndex(initIdx);
  }, []);

  /* ── 인증목록 + 메타 로더 ── */
  const loadingRef = useRef(false);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    if (!isFocused || loadingRef.current) return;

    if (isFocused && Math.random() < 0.3) {
      console.log('[AD_INTERSTITIAL_PLACEHOLDER] 전면광고 표시 위치');
    }

    loadingRef.current = true;
    (async () => {
      const rawCID = String(route?.params?.challengeId ?? route?.params?.id ?? challengeId ?? '');
      const numCID = (rawCID.match(/\d+/g) || []).join('');
      const chCID  = rawCID.startsWith('ch_') ? rawCID : (numCID ? `ch_${numCID}` : rawCID);

      const tried = [];
      const pickArray = (val) => {
        if (Array.isArray(val)) return val;
        if (val && typeof val === 'object') {
          if (Array.isArray(val.entries)) return val.entries;
          if (Array.isArray(val.items)) return val.items;
          if (Array.isArray(val.data)) return val.data;
          if (Array.isArray(val.list)) return val.list;
        }
        return [];
      };
      const tryGetJSON = async (key) => {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return null; }
      };

      const entryKeys = [
        `entries_${chCID}`,
        `entries_${rawCID}`,
        `entries_${numCID}`,
        `challenge_${chCID}_entries`,
        `challenge_${rawCID}_entries`,
        `challenge_${numCID}_entries`,
      ];

      let list = [];
      let hitKey = null;

      for (const k of entryKeys) {
        tried.push(k);
        const parsed = await tryGetJSON(k);
        const arr = pickArray(parsed);
        if (arr.length) { list = arr; hitKey = k; break; }
      }

      if (!list.length) {
        tried.push('challenges');
        const arr = await tryGetJSON('challenges');
        if (Array.isArray(arr)) {
          const found = arr.find(c => String(c.id) === rawCID || String(c.id) === numCID || String(c.id) === chCID);
          const cand = pickArray(
            found?.entries?.length ? found :
            (found?.logs?.length ? {entries: found.logs} : null)
          );
          if (cand.length) {
            list = cand;
            hitKey = 'challenges[*].entries|logs';
          }
        }
      }

      const normalized = normalizeEntries(Array.isArray(list) ? list : []);
      if (!aliveRef.current) return;
      setEntries(normalized);
      setCurrentScore(normalized.length);
      if (DEBUG_ON) setDebug({ hitKey, tried, count: normalized.length });

          // ✅ 최후 수단: 전수 스캔 (키가 없거나 빈 배열이면 실행)
    const primaryKey = `entries_${chCID}`;
    const primaryRaw = await AsyncStorage.getItem(primaryKey);
    const primaryIsEmpty = primaryRaw === null || (()=>{ try { const p=JSON.parse(primaryRaw); return Array.isArray(p) && p.length === 0; } catch { return false; }})();
    if (normalized.length === 0 && primaryIsEmpty) {
      const fallback = await scanAllStorageForEntries({ rawCID, numCID, chCID });
        if (fallback && Array.isArray(fallback) && fallback.length) {
          const norm2 = normalizeEntries(fallback);
          if (aliveRef.current) {
            setEntries(norm2);
            setCurrentScore(norm2.length);
            if (DEBUG_ON) setDebug(d => ({ ...d, hitKey: d.hitKey ?? 'FALLBACK_SCAN', count: norm2.length }));
          }
        }
      }

      // 메타
      const metaKeys = [
        `challenge_${chCID}`,
        `challenge_${numCID}`,
        `challenge_${rawCID}`,
      ];

      let loadedMeta = {
        startDate: meta.startDate ?? null,
        endDate: meta.endDate ?? null,
        rewardTitle: meta.rewardTitle ?? null,
        reward: meta.reward ?? null,
        description: null,
        notification: { mode: null, payload: null },
      };
      for (const k of metaKeys) {
        tried.push(k);
        const one = await tryGetJSON(k);
        if (one) {
          loadedMeta = {
            startDate: loadedMeta.startDate ?? one.startDate ?? null,
            endDate:   loadedMeta.endDate   ?? one.endDate   ?? null,
            rewardTitle: loadedMeta.rewardTitle ?? one.rewardTitle ?? null,
            reward:      loadedMeta.reward      ?? one.reward      ?? null,
            description: one.description ?? loadedMeta.description ?? null,
            notification: one.notification ?? loadedMeta.notification ?? { mode:null, payload:null },
          };
          break;
        }
      }
      if (!loadedMeta.startDate || !loadedMeta.endDate || !loadedMeta.rewardTitle || !loadedMeta.reward) {
        const arr = await tryGetJSON('challenges');
        if (Array.isArray(arr)) {
          const found = arr.find(c =>
            String(c.id) === rawCID || String(c.id) === numCID || String(c.id) === chCID
          );
          if (found) {
            loadedMeta = {
              startDate: loadedMeta.startDate ?? found.startDate ?? null,
              endDate:   loadedMeta.endDate   ?? found.endDate   ?? null,
              rewardTitle: loadedMeta.rewardTitle ?? found.rewardTitle ?? null,
              reward:      loadedMeta.reward      ?? found.reward      ?? null,
              description: found.description ?? loadedMeta.description ?? null,
              notification: found.notification ?? loadedMeta.notification ?? { mode:null, payload:null },
            };
          }
        }
      }
      if (!aliveRef.current) return;
      setMeta(loadedMeta);

      buildWeeks(normalized, loadedMeta.startDate ?? startDateFromRoute);

      if (loadedMeta.startDate && loadedMeta.endDate) {
        const s = new Date(loadedMeta.startDate);
        const e = new Date(loadedMeta.endDate);
        const t = new Date();
        const clampMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
        let md = clampMonth(t);
        if (md < clampMonth(s)) md = clampMonth(s);
        if (md > clampMonth(e)) md = clampMonth(e);
        setMonthDate(md);
      }
    })()
      .catch(console.error)
      .finally(()=>{ loadingRef.current = false; });

    runIntro();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, challengeId, reloadTick, buildWeeks]);

  useEffect(()=>()=>{
    aliveRef.current = false;
    loadingRef.current = false;
  },[]);

  const overallPct = useMemo(
    () => Math.min(Math.round((currentScore / targetScore) * 100), 100),
    [currentScore, targetScore]
  );

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    [entries]
  );

  const fmtDate = useCallback((dStr)=>{
    if (!dStr) return '-';
    const d = new Date(dStr);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }, []);

  const canPrevMonth = useMemo(()=>{
    if (!meta.startDate) return false;
    const s = new Date(meta.startDate);
    const m0 = new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1);
    return m0 >= new Date(s.getFullYear(), s.getMonth(), 1);
  }, [meta.startDate, monthDate]);

  const canNextMonth = useMemo(()=>{
    if (!meta.endDate) return false;
    const e = new Date(meta.endDate);
    const m1 = new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1);
    return m1 <= new Date(e.getFullYear(), e.getMonth(), 1);
  }, [meta.endDate, monthDate]);

  const prevMonth = useCallback(()=> { if (canPrevMonth) setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1)); }, [canPrevMonth, monthDate]);
  const nextMonth = useCallback(()=> { if (canNextMonth) setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1)); }, [canNextMonth, monthDate]);

  const entriesByDaySet = useMemo(()=>{
    const set = new Set();
    for (const e of entries) {
      const d = new Date(e.timestamp);
      set.add(keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate())));
    }
    return set;
  }, [entries]);

  // 누적 시간
  const totalMinutes = useMemo(
    () => entries.reduce((sum, e) => sum + (typeof e.duration === 'number' && e.duration > 0 ? e.duration : 0), 0),
    [entries]
  );
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  /* ===== 헤더 카드(화면용) : 보상 블록은 여기서 제거 ===== */
  const HeaderCard = useMemo(()=>(<View style={styles.card}>
            <View style={styles.headerTop}>
        <TouchableOpacity
          onPress={() => navigation.navigate('ChallengeList')}
          style={styles.headerBackBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Text style={styles.headerBackArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <TitleTwoLine text={title} style={styles.title} containerWidth={SCREEN_WIDTH - 120} />
          <Text style={[styles.period, { textAlign:'center' }]}>{`${fmtDate(meta.startDate)} ~ ${fmtDate(meta.endDate)}`}</Text>
        </View>
        <TouchableOpacity
          onPress={()=>setShowInfo(true)}
          activeOpacity={0.9}
          style={styles.headerInfoBtn}
        >
          <ShadowIcon forShare={false} />
        </TouchableOpacity>
      </View>

      <View style={[styles.row, { marginTop: 16 }]}>
        <TouchableOpacity style={styles.donutArea} onPress={() => { setIntroK(0); runIntro(); }} activeOpacity={0.8}>
          <Text style={[styles.sectionLabel, styles.progressLabel, { textAlign:'center', marginBottom: 8 }]}>전체 진행률</Text>
          <View style={{ marginTop: 24 }}>
            <Donut targetPercent={overallPct} progress={introK} />
          </View>
        </View>

        <View style={styles.calendarArea}>
          <MonthCalendar
            startDate={meta.startDate || new Date()}
            endDate={meta.endDate || new Date()}
            entriesByDaySet={entriesByDaySet}
            monthDate={monthDate}
            onPrev={prevMonth}
            onNext={nextMonth}
            canPrev={canPrevMonth}
            canNext={canNextMonth}
            highlightDate={highlightDate}
          />
        </View>
      </View>

      <TouchableOpacity style={styles.sectionBox} onPress={() => { setIntroK(0); runIntro(); }} activeOpacity={0.85}>
        <WeekView 
          weeksData={weeksData} 
          currentIndex={weekIndex} 
          onIndexChange={setWeekIndex} 
          introProgress={introK} 
          onPressDay={handlePressDay}
        />
      </TouchableOpacity>

      <TouchableOpacity style={styles.sectionBox} onPress={() => grassTapRef.current && grassTapRef.current()} activeOpacity={0.85}>
        <GrassGraph
          entries={entries}
          startDate={meta.startDate}
          endDate={meta.endDate}
          onTap={(fn) => { grassTapRef.current = fn; }}
        />
      </TouchableOpacity>

      {/* 전체일정 라인 그래프 */}
      <TouchableOpacity style={[styles.sectionBox, { paddingHorizontal: EDGE, alignItems:'center' }]} onPress={() => { setIntroK(0); runIntro(); }} activeOpacity={0.85}>
        {meta.startDate ? (
          <LineChartsPager startDate={meta.startDate} entries={entries} introProgress={introK} interactive />
        ) : (
          <Text style={{ textAlign:'center', color:textGrey }}>시작일이 없습니다.</Text>
        )}
      </TouchableOpacity>
    </View>
  ), [
    title, meta.startDate, meta.endDate,
    weeksData, monthDate, canPrevMonth, canNextMonth, entriesByDaySet,
    weekIndex, introK, entries, overallPct, highlightDate
  ]);

  /* ===== 헤더 카드(공유 캡처용) ===== */
  const HeaderCardForShare = useMemo(()=>(<View style={styles.card}>
            <View style={styles.headerTop}>
        <View style={styles.headerInfoBtn}>
           <ShadowIcon forShare={true} />
        </View>
        <View style={styles.headerTitleWrap}>
          <TitleTwoLine text={title} style={styles.title} containerWidth={SCREEN_WIDTH - 120} />
          <Text style={[styles.period, { textAlign:'center' }]}>{`${fmtDate(meta.startDate)} ~ ${fmtDate(meta.endDate)}`}</Text>
        </View>
        <View style={styles.headerInfoBtn} />
      </View>

      <View style={[styles.row, { marginTop: 16 }]}>
        <TouchableOpacity style={styles.donutArea} onPress={() => { setIntroK(0); runIntro(); }} activeOpacity={0.8}>
          <Text style={[styles.sectionLabel, styles.progressLabel, { textAlign:'center', marginBottom: 8 }]}>전체 진행률</Text>
          <View style={{ marginTop: 24 }}>
            <Donut targetPercent={overallPct} progress={1} />
          </View>
        </View>

        <View style={styles.calendarArea}>
          <MonthCalendar
            startDate={meta.startDate || new Date()}
            endDate={meta.endDate || new Date()}
            entriesByDaySet={entriesByDaySet}
            monthDate={monthDate}
            onPrev={prevMonth}
            onNext={nextMonth}
            canPrev={canPrevMonth}
            canNext={canNextMonth}
          />
        </View>
      </View>

      <View style={styles.sectionBox}>
        <WeekView weeksData={weeksData} currentIndex={weekIndex} onIndexChange={setWeekIndex} introProgress={1} />
      </View>

      <TouchableOpacity style={styles.sectionBox} onPress={() => grassTapRef.current && grassTapRef.current()} activeOpacity={0.85}>
        <GrassGraph
          entries={entries}
          startDate={meta.startDate}
          endDate={meta.endDate}
          onTap={(fn) => { grassTapRef.current = fn; }}
        />
      </TouchableOpacity>

      <TouchableOpacity style={[styles.sectionBox, { paddingHorizontal: EDGE, alignItems:'center' }]} onPress={() => { setIntroK(0); runIntro(); }} activeOpacity={0.85}>
        {meta.startDate ? (
          <LineChartsPager startDate={meta.startDate} entries={entries} introProgress={1} interactive={false} />
        ) : (
          <Text style={{ textAlign:'center', color:textGrey }}>시작일이 없습니다.</Text>
        )}
      </TouchableOpacity>
    </View>
  ), [
    title, meta.startDate, meta.endDate,
    weeksData, monthDate, canPrevMonth, canNextMonth, entriesByDaySet,
    weekIndex, entries, overallPct
  ]);

  const cidForDebug = String(route?.params?.challengeId ?? route?.params?.id ?? challengeId ?? '');

  const handleShare = useCallback(async ()=>{
    try {
      await new Promise(r => setTimeout(r, 80));
      const node = shareRef.current;
      if (!node) throw new Error('공유 뷰를 찾지 못했습니다.');
      const uri = await captureRef(node, { format: 'png', quality: 1, result: 'tmpfile' });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: '공유' });
      } else {
        await Share.share({ url: uri, message: title || '공유', title: '공유' });
      }
      try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
    } catch (e) {
      console.warn(e);
      Alert.alert('공유 실패', '이미지 생성/공유 중 문제가 발생했어요. 다시 시도해 주세요.');
    }
  }, [title]);

  /* ── RAW 모드 ── */
  if (KILL_UI_AND_SHOW_RAW) {
    return (
      <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom }]}>
        <StickyDebugPeek visible={DEBUG_ON} count={debug?.count ?? 0} onPress={reload} />
        <DebugPanel
          visible={DEBUG_ON && showDebug}
          cid={cidForDebug}
          hitKey={debug.hitKey}
          allTriedKeys={debug.tried}
          count={debug.count}
          onRefresh={reload}
        />
        <RawDebugList
          entries={entries}
          sortedEntries={sortedEntries}
          insets={insets}
          readOnly={readOnly}
          navigation={navigation}
          challengeId={challengeId}
          HeaderWithCountMemo={HeaderWithCountMemo}
          HeaderCard={HeaderCard}
          totalMinutes={totalMinutes}
          hours={hours}
          minutes={minutes}
          currentScore={currentScore}
          targetScore={targetScore}
          styles={styles}
        />
      </SafeAreaView>
    );
  }

  /* ── 일반 화면 ── */
  return (
    <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StickyDebugPeek visible={DEBUG_ON} count={debug?.count ?? 0} onPress={reload} />

      {/* 공유 캡처용: 화면 밖 — 헤더 + 보상 + 요약 + 전체 목록 포함 */}
<View pointerEvents="none" style={{ position:'absolute', left:-9999, top:-9999, width:SCREEN_WIDTH, opacity:0 }}>
<ViewShot ref={shareRef} options={{ format: 'png', quality: 1 }}>
  <View style={[styles.container, { backgroundColor: '#fff' }]} collapsable={false}>
    {HeaderCardForShare}

   <View style={[styles.sectionPadNarrow, styles.rewardBlockSpacing]}>
  <View style={styles.rewardBlackBox}>
    <Text style={styles.rewardBlackText}>{meta.rewardTitle ?? meta.reward ?? '—'}</Text>
  </View>
</View>

    <View style={[styles.postSummaryRow, styles.sectionPadNarrow]}>
      <Text style={styles.accumText}>누적시간 : {hours}시간 {minutes}분</Text>
      <Text style={styles.countBelowText}>{`${currentScore}/${targetScore}`}</Text>
    </View>

    {sortedEntries.map((item, index) => {
      const indexFromEnd = sortedEntries.length - index;
      return (
        <React.Fragment key={item?.id ?? `${item?.timestamp ?? 0}-${index}`}>
          <EntryRow item={item} indexFromEnd={indexFromEnd} readOnly />
          <View style={[styles.separator, styles.sectionPadNarrow]} />
        </React.Fragment>
      );
    })}
    <View style={{ height: EDGE }} />
  </View>
</ViewShot>

</View>


      <DebugPanel
        visible={DEBUG_ON && showDebug}
        cid={cidForDebug}
        hitKey={debug.hitKey}
        allTriedKeys={debug.tried}
        count={debug.count}
        onRefresh={reload}
      />

      {/* 정보 모달: 바깥 터치로 닫힘 */}
      <Modal visible={showInfo} transparent animationType="fade" onRequestClose={()=>setShowInfo(false)}>
        <TouchableWithoutFeedback onPress={()=>setShowInfo(false)}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>

        <TouchableWithoutFeedback>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitleCenter}>{title}</Text>

            <View style={styles.modalField}>
              <Text style={styles.modalFieldTitle}>기간</Text>
              <View style={styles.modalFieldBox}>
                <Text style={styles.modalFieldValue}>
                  {`${fmtDate(meta.startDate)} ~ ${fmtDate(meta.endDate)}`}
                </Text>
              </View>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalFieldTitle}>도전내용</Text>
              <View style={styles.modalFieldBox}>
                <Text style={styles.modalFieldValueMultiline}>{meta.description ?? '—'}</Text>
              </View>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalFieldTitle}>보상</Text>
              <View style={styles.modalFieldBox}>
                <Text style={styles.modalFieldValue}>
                  {meta.rewardTitle ?? meta.reward ?? '—'}
                </Text>
              </View>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalFieldTitle}>알림 미리보기</Text>
              <View style={[styles.modalFieldBox, { paddingVertical: 10 }]}>
                <NotiPreviewSwitch
                  notification={meta?.notification}
                  startDate={meta.startDate ? new Date(meta.startDate) : null}
                  endDate={meta.endDate ? new Date(meta.endDate) : null}
                />
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 스크롤 콘텐츠 */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <HeaderWithCountMemo HeaderCard={HeaderCard} />

        {/* 보상 박스 (위/아래 간격을 상수로 제어) */}
<View style={[styles.sectionPadNarrow, styles.rewardBlockSpacing]}>
  <View style={styles.rewardBlackBox}>
    <Text style={styles.rewardBlackText}>{meta.rewardTitle ?? meta.reward ?? '—'}</Text>
  </View>
</View>

{/* 누적시간 / 전체·남은 횟수 (postSummaryRow는 marginTop:0) */}
<View style={[styles.postSummaryRow, styles.sectionPadNarrow]}>
  <Text style={styles.accumText}>누적시간 : {hours}시간 {minutes}분</Text>
  <Text style={styles.countBelowText}>{`${currentScore}/${targetScore}`}</Text>
</View>


{/* 인증목록 */}
{sortedEntries.length === 0 ? (
  <Text style={[styles.empty, styles.sectionPadNarrow]}>등록된 인증이 없습니다.</Text>
) : (
  sortedEntries.map((item, index) => {
    const indexFromEnd = sortedEntries.length - index;
    const onPress = readOnly ? undefined : () =>
      navigation.navigate('EntryDetail', { challengeId, entryId: item.id });
    return (
      <React.Fragment key={item?.id ?? `${item?.timestamp ?? 0}-${index}`}>
        {/* entry 스타일이 이미 NARROW_PLUS 반영됨 */}
        <EntryRow item={item} indexFromEnd={indexFromEnd} readOnly={readOnly} onPress={onPress}/>
        <View style={[styles.separator, styles.sectionPadNarrow]} />
      </React.Fragment>
    );
  })
)}

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>

            {!readOnly && (
        <TouchableOpacity
          style={[styles.uploadFloatingBtn, {bottom: Math.max(insets.bottom, 16) + EDGE}]}
          onPress={() => navigation.navigate('Upload', { challengeId })}
          activeOpacity={0.9}
        >
          <Text style={styles.uploadFloatingText}>인증</Text>
        </TouchableOpacity>
      )}

<TouchableOpacity style={[styles.shareBtn, {bottom: Math.max(insets.bottom, 16) + EDGE}]} onPress={handleShare} activeOpacity={0.9}>
        <Text style={styles.shareBtnText}>공유</Text>
      </TouchableOpacity>
     {/* 위젯 1×1 캡처(오프스크린) */}
<WidgetDonutCapture1x1
  challengeId={challengeId}
  deps={[overallPct /* 또는 progressPct 등 진행률 변수 */]}
  renderDonut={(size) => (
   <Donut targetPercent={overallPct} progress={1} size={size} />
  )}
/>






    </SafeAreaView>
  );
}

/* ───────── 스타일 ───────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  barText: { fontSize: 9, color: textGrey, textAlign:'center' },

  card: { marginHorizontal: EDGE, marginTop: EDGE, marginBottom: CARD_BOTTOM_GAP, padding: 14, borderRadius: 12, borderWidth: 0, backgroundColor: '#fff' },
// 동일 좌우 여백 유틸
sectionPad: { paddingHorizontal: EDGE },

// ⬇️ 좁게 만들 때 쓰는 패딩 (그래프폭보다 더 좁아짐)
sectionPadNarrow: { paddingHorizontal: EDGE + NARROW_PLUS },

 // 요약 행(누적시간/횟수)은 크기/색을 이미 그래프 축과 맞춰둠(10px, textGrey)
postSummaryRow: {
  flexDirection:'row',
  justifyContent:'space-between',
  alignItems:'center',
  marginTop: 0,     // ← 중요: 간격은 rewardBlockSpacing이 담당
  marginBottom: 2,
},
  accumText: { fontSize: 12, color: textGrey, fontWeight: '600' },
  countBelowText: { fontSize: 12, color: textGrey, fontWeight: '700' },

  headerTop: { flexDirection: 'row', alignItems: 'center', height: 52, marginBottom: 6 },
  headerBackBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerBackArrow: { fontSize: 32, fontWeight: '300', color: '#111', lineHeight: 32, includeFontPadding: false, marginTop: -8 },
  headerTitleWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerInfoBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },

  iconWrapAbs: {
    width: 42, height: 42, borderRadius: 8, backgroundColor:'#fff',
    shadowColor: '#000', shadowOpacity: 0.38, shadowOffset: {width:0, height:5}, shadowRadius: 12,
    elevation: 14, alignItems:'center', justifyContent:'center',
  },
  iconWrapShare: {
    width: 42, height: 42, borderRadius: 8, backgroundColor:'#fff',
    alignItems:'center', justifyContent:'center',
  },
  iconSquare: { width: 42, height: 42, borderRadius: 8 },

  title: { fontSize: 20, fontWeight: '800', color: '#111', lineHeight: 26 },
  period: { fontSize: 12, color: textGrey, marginTop: 4 },

  progressLabel: { marginTop: 10, color: textGrey },
  row: { flexDirection: 'row', marginTop: 16 },
  donutArea: { width: SCREEN_WIDTH * 0.4 - 24, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 10 },
  calendarArea: { flex: 1, paddingLeft: 8 },

  sectionBox: { marginTop: 10 },
  sectionLabel: { fontSize: 12, color: textGrey, marginBottom: 6 },

  // 누적시간/횟수 — 그래프 축 날짜 텍스트와 동일 톤/크기
accumText:      { fontSize: 10, color: textGrey, fontWeight: '700' },
countBelowText: { fontSize: 10, color: textGrey, fontWeight: '700' },

// 보상박스는 그대로 두고(배경/모서리/폰트), 높이만 살짝 키우고 싶다면 여기만 조절
rewardBlackBox: {
  backgroundColor: '#111',
  borderRadius: 12,
  paddingVertical: 16,  // ← 필요하면 18~20 정도로 더 키워도 OK
  paddingHorizontal: 16,
  alignItems: 'center',
  justifyContent: 'center',
},
rewardBlackText: { fontSize: 18, fontWeight: '900', color: '#fff' },

  hr: { height: 1, backgroundColor: '#C7C7C7', marginHorizontal: 8, marginBottom: 8 },

  calWrap: { padding: 10, borderWidth: 0 },
  calHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calNavBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  calNavText: { fontSize: 18, fontWeight: '800', color: '#111' },
  calTitle: { fontSize: 14, fontWeight: '700', color: '#111' },

  calDowRow: { flexDirection: 'row', justifyContent: 'flex-start', marginTop: 6 },
  calDow: { width: '14.2857%', textAlign: 'center', fontSize: 10, color: textGrey },

  calGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  calCell: { width: '14.2857%', height: 26, alignItems: 'center', justifyContent: 'center', marginVertical: 2, borderRadius: 4 },
  calBadge: { minWidth: 24, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#111', borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginHorizontal: 0.4, marginVertical: 3.5 },
  calBadgeText: { color: '#fff', fontWeight: '800', fontSize: 10.5 },
  calCellText: { fontSize: 10.5, color: '#111' },
  calCellTextDim: { color: textGrey },

  
  

  dateLabel: { fontSize: 10, color: textGrey },
  dayLabel: { fontSize: 9, color: '#333' },
  bar: { width: 16, borderRadius: 4, alignSelf:'center' },
  countLabel: { fontSize: 10, color: '#333', marginTop: 2, textAlign:'center' },

  entry: { 
  flexDirection: 'row',
  paddingHorizontal: EDGE + NARROW_PLUS,  // ⬅️ 여기만 바뀜
  paddingVertical: 12
},
rewardBlockSpacing: {
  marginTop: REWARD_TOP_GAP,
  marginBottom: REWARD_BOTTOM_GAP,
},

  number: { width: 28, fontWeight: 'bold' },
  thumbnail: { width: 50, height: 50, borderRadius: 6 },
  textContainer: { flex: 1, paddingHorizontal: 10 },
  text: { fontSize: 12, color:'#111' },
  time: { fontSize: 12, color: textGrey, marginTop: 2 },
  duration: { fontSize: 12, color: '#000', marginTop: 4 },

  empty: { fontSize: 12,textAlign: 'center', marginTop: 50, color: textGrey },

  separator: { height: 1, backgroundColor: '#F3F4F6' },

  shareBtn: {
    position: 'absolute', right: 12, 
    backgroundColor: '#111', borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 14, elevation: 3,
  },
  shareBtnText: { color: '#fff', fontWeight: '800' },

  uploadFloatingBtn: {
    position: 'absolute', left: 12,
    backgroundColor: '#111', borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 14, elevation: 3,
  },
  uploadFloatingText: { color: '#fff', fontWeight: '800' },

  /* ───────── 정보 모달 스타일 ───────── */
  modalBackdrop: {
    position:'absolute', left:0, right:0, top:0, bottom:0,
    backgroundColor:'rgba(0,0,0,0.35)'
  },
  modalCard: {
    position:'absolute',
    left: EDGE, right: EDGE, top: 90,
    backgroundColor:'#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor:'#000', shadowOpacity:0.2, shadowRadius:12, elevation:6
  },
  modalTitleCenter: { fontSize: 18, fontWeight:'900', color:'#111', textAlign:'center', marginBottom: 10 },
  modalField: { marginTop: 10 },
  modalFieldTitle: { fontSize: 12, color: '#777', fontWeight: '700', marginBottom: 6 },
  modalFieldBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  modalFieldValue: { fontSize: 13, color: '#111' },
  modalFieldValueMultiline: { fontSize: 13, color: '#111', lineHeight: 18 },
});
