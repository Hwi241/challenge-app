// screens/EntryListScreen.js

const KILL_UI_AND_SHOW_RAW = false; // 필요 시 true로 전환(데이터 디버그용)

import React, {
  useState, useEffect, useRef, useMemo, useCallback, memo,
} from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Share,
  Modal,
  TouchableWithoutFeedback,
  Alert,
  Platform,
  PanResponder,
  Animated,
  useWindowDimensions,
  } from 'react-native';
import { SafeAreaView,
  useSafeAreaInsets  } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ViewShot,
  { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import Svg,
  {
  Circle,
  Line,
  Rect,
  Text as SvgText,
  Path,
  Defs,
  LinearGradient,
  Stop,
  } from 'react-native-svg';

import WidgetDonutCapture1x1 from '../components/WidgetDonutCapture1x1';
import { useFocusEffect } from '@react-navigation/native';
import {
  getDashboardLayoutStateForChallenge,
  resolveDashboardTarget,
  } from '../utils/dashboardLayout';
import {
 DASHBOARD_TARGETS,
  GRID_COLUMNS,
  getDefaultDashboardLayout,
  getWidgetById,
  supportsWidgetTarget,
  DEFAULT_WIDGET_IDS,
  getShopWidgets
} from '../constants/widgetCatalog';
import { getOwnedWidgets } from '../utils/widgetOwnership';


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
const PROGRESS_DONUT_SIZE = 104;
const PROGRESS_DONUT_STROKE = 11;

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
    console.log('[scanAllStorageForEntries] fail:', e);
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
  const display = isNaN(clampedTarget) ? 0 : Math.round(clampedTarget * k);
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

const DashboardWidgetHeader = memo(function DashboardWidgetHeader({
  title,
  leftLabel = '‹',
  rightLabel = '›',
  onLeft,
  onRight,
  canLeft = true,
  canRight = true,
  hideSides = false,
}) {
  return (
    <View style={styles.dashboardWidgetHeaderRow}>
      <TouchableOpacity
        onPress={canLeft && !hideSides ? onLeft : undefined}
        disabled={hideSides || !canLeft}
        style={[
          styles.dashboardWidgetHeaderSideSlot,
          !canLeft && !hideSides && styles.dashboardWidgetHeaderSideDisabled,
          hideSides && styles.dashboardWidgetHeaderSideInvisible,
        ]}
        hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
        activeOpacity={0.7}
      >
        <Text style={styles.dashboardWidgetHeaderNavText}>{leftLabel}</Text>
      </TouchableOpacity>

      <Text style={styles.dashboardWidgetHeaderTitle}>{title}</Text>

      <TouchableOpacity
        onPress={canRight && !hideSides ? onRight : undefined}
        disabled={hideSides || !canRight}
        style={[
          styles.dashboardWidgetHeaderSideSlot,
          !canRight && !hideSides && styles.dashboardWidgetHeaderSideDisabled,
          hideSides && styles.dashboardWidgetHeaderSideInvisible,
        ]}
        hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
        activeOpacity={0.7}
      >
        <Text style={styles.dashboardWidgetHeaderNavText}>{rightLabel}</Text>
      </TouchableOpacity>
    </View>
  );
});

const CalendarHeaderGrid = memo(function CalendarHeaderGrid({
  title,
  leftText = '‹',
  rightText = '›',
  onLeft,
  onRight,
  canLeft = true,
  canRight = true,
}) {
  return (
    <View style={styles.calendarHeaderGridRow}>
      <TouchableOpacity
        style={[styles.calendarHeaderGridEdgeCell, styles.calendarHeaderGridLeftCell]}
        onPress={canLeft ? onLeft : undefined}
        disabled={!canLeft}
        activeOpacity={0.7}
      >
        <Text style={[styles.dashboardWidgetHeaderNavText, !canLeft && styles.dashboardWidgetHeaderNavDisabled]}>
          {leftText}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.calendarHeaderGridEdgeCell, styles.calendarHeaderGridRightCell]}
        onPress={canRight ? onRight : undefined}
        disabled={!canRight}
        activeOpacity={0.7}
      >
        <Text style={[styles.dashboardWidgetHeaderNavText, !canRight && styles.dashboardWidgetHeaderNavDisabled]}>
          {rightText}
        </Text>
      </TouchableOpacity>

      <View pointerEvents="none" style={styles.calendarHeaderGridTitleLayer}>
        <Text style={styles.dashboardWidgetHeaderTitle}>{title}</Text>
      </View>
    </View>
  );
});

const DashboardWidgetShell = memo(function DashboardWidgetShell({
  header,
  children,
}) {
  return (
    <View style={styles.dashboardWidgetShell}>
      {header ? (
        <View style={styles.dashboardWidgetHeaderSlot}>
          {header}
        </View>
      ) : null}
      <View style={styles.dashboardWidgetBodySlot}>
        {children}
      </View>
    </View>
  );
});

/* ───────── 달력 ───────── */
const MonthCalendar = memo(function MonthCalendar({
  startDate, endDate, entriesByDaySet, onPrev, onNext, monthDate, canPrev, canNext, highlightDate = null,
}) {
  const [calendarBox, setCalendarBox] = useState({ width: 0, height: 0 });

  const onCalendarLayout = useCallback((event) => {
    const width = Math.floor(event?.nativeEvent?.layout?.width || 0);
    const height = Math.floor(event?.nativeEvent?.layout?.height || 0);
    if (width > 0 && height > 0) {
      setCalendarBox((prev) => (
        prev.width === width && prev.height === height
          ? prev
          : { width, height }
      ));
    }
  }, []);

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const firstDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const calendarRows = Math.max(1, Math.ceil(cells.length / 7));
  const CAL_DOW_H = 14;
  const CAL_GRID_TOP_GAP = 3;
  const CAL_BOTTOM_PAD = 4;
  const CAL_CELL_MARGIN_V = 1;

  const availableCalendarH = Math.max(
    1,
    (calendarBox.height || 0) - CAL_DOW_H - CAL_GRID_TOP_GAP - CAL_BOTTOM_PAD
  );
  const calCellOuterH = Math.max(
    8,
    Math.floor(availableCalendarH / calendarRows)
  );
  const calCellH = Math.max(
    8,
    calCellOuterH - CAL_CELL_MARGIN_V * 2
  );
  const calCellFontSize = Math.max(7, Math.min(9.5, Math.floor(calCellH * 0.62)));
  const calBadgeFontSize = Math.max(7, Math.min(9.5, Math.floor(calCellH * 0.6)));
  const calBadgeMinWidth = Math.max(13, Math.min(17, Math.round(calCellH * 0.95)));
  const calBadgePaddingV = calCellH <= 12 ? 0 : 1;

  const calCellDynamicStyle = {
    height: calCellH,
    marginVertical: CAL_CELL_MARGIN_V,
  };

  const calCellTextDynamicStyle = {
    fontSize: calCellFontSize,
    lineHeight: calCellFontSize + 2,
    includeFontPadding: false,
  };

  const calBadgeDynamicStyle = {
    minWidth: calBadgeMinWidth,
    paddingVertical: calBadgePaddingV,
  };

  const calBadgeTextDynamicStyle = {
    fontSize: calBadgeFontSize,
    lineHeight: calBadgeFontSize + 2,
    includeFontPadding: false,
  };

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
    <View style={styles.calWrap} onLayout={onCalendarLayout} {...panResponder.panHandlers}>
      <View style={styles.calDowRow}>
        {CAL_HEADER.map((ch, i)=>(
          <Text
            key={`dow-${i}`}
            style={[
              styles.calDow,
              { height: CAL_DOW_H, lineHeight: CAL_DOW_H, includeFontPadding: false },
            ]}
          >
            {ch}
          </Text>
        ))}
      </View>

      <View style={styles.calGrid}>
        {(() => {
          const today = new Date(); today.setHours(0,0,0,0);
          return cells.map((d, idx) => {
            if (!d) return <View key={`e${idx}`} style={[styles.calCell, calCellDynamicStyle]}/>;
            const ranged = inRange(d);
            const isThisMonth = d.getMonth()===month;
            if (!isThisMonth) return <View key={`o${idx}`} style={[styles.calCell, calCellDynamicStyle]} />;

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
                <View key={`d${idx}`} style={[styles.calCell, calCellDynamicStyle]}>
                  <View style={[styles.calBadge, calBadgeDynamicStyle, isHighlight && { borderWidth: 2, borderColor: '#FFD700' }]}>
                    <Text style={[styles.calBadgeText, calBadgeTextDynamicStyle]}>{d.getDate()}</Text>
                  </View>
                </View>
              );
            }

            return (
              <View key={`d${idx}`} style={[styles.calCell, calCellDynamicStyle]}>
                <Text style={[styles.calCellText, calCellTextDynamicStyle, { color: cellColor }, isToday && !cert && { fontWeight: '900' }, isHighlight && { fontWeight: '900', textDecorationLine: 'underline' }]}>
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
  width=SCREEN_WIDTH - EDGE*2 - GRAPH_SIDE_PAD*2 - 8,
  height=185,
  introProgress=1,
  interactive=true,
  pagerIndex=0,
  onSelectPagerIndex=()=>{},
  showPager=true,
  plotInset=12,
  edgePointInset=null,
}){
  const axisInset = Math.max(0, Number(plotInset) || 0);
  const EDGE_DEFAULT_MARKER_R = 3.2;
  const EDGE_DEFAULT_MARKER_STROKE_W = 2;
  const autoPointSafeInset = EDGE_DEFAULT_MARKER_R + EDGE_DEFAULT_MARKER_STROKE_W / 2;
  const pointSafeInset = Math.max(
    0,
    Number(edgePointInset ?? (axisInset === 0 ? autoPointSafeInset : axisInset)) || 0
  );
  const left = axisInset, right = axisInset, top = 16, bottom = 42;
  const cw = width - left - right;
  const ch = height - top - bottom;
  const introBaselineY = top + ch + 0.5;

  const today = useMemo(()=>{ const t=new Date(); t.setHours(0,0,0,0); return t; },[]);
  const raw = useMemo(()=>aggregateByDate(entries),[entries]);

  const series = useMemo(()=>{
    const chartStart = startDate ? new Date(startDate) : (raw[0]?.date || today);
    chartStart.setHours(0,0,0,0);

    const endD = new Date();
    endD.setHours(0,0,0,0);

    if (chartStart > endD) return [];

    const countMap = new Map();
    const minuteMap = new Map();

    for (const r of raw) {
      const k = keyOf(r.date);
      countMap.set(k, r.count || 0);
      minuteMap.set(k, r.minutes || 0);
    }

    const result = [];
    const cur = new Date(chartStart);
    let cumulativeCount = 0;

    while (cur <= endD) {
      const k = keyOf(cur);

      if (metric === 'count') {
        cumulativeCount += countMap.get(k) || 0;
        result.push({ d: new Date(cur), v: cumulativeCount });
      } else {
        result.push({ d: new Date(cur), v: minuteMap.get(k) || 0 });
      }

      cur.setDate(cur.getDate() + 1);
    }

    return result;
  }, [raw, metric, startDate, today]);

  const start = useMemo(()=>startDate? new Date(new Date(startDate).setHours(0,0,0,0)) : (series[0]?.d || today), [startDate, series, today]);
  const end = useMemo(()=> new Date(new Date().setHours(0,0,0,0)), []);

  const nodePts = useMemo(()=>{
    const n = series.length;
    if (n===0) return [];
    const BOTTOM_PADDING_RATIO = 0.15;
    const usableCh = ch * (1 - BOTTOM_PADDING_RATIO);

    // 기간 계산
    const firstDate = start;
    const lastDate = end > today ? end : today;
    const totalDays = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));

    if (n===1) {
      const dayDiff = (series[0].d - firstDate) / (1000 * 60 * 60 * 24);
      const xRatio = clamp(totalDays > 0 ? dayDiff / totalDays : 0, 0, 1);
      const x = left + xRatio * cw;
      const vmax = Math.max(1, series[0].v);
      const yMax = metric === 'count' ? Math.max(2, vmax + 1) : Math.max(10, vmax * 1.25);
      const yRatio = clamp(series[0].v / yMax, 0, 1);
      const finalY = top + (1 - yRatio) * usableCh;
      const y = introBaselineY - (introBaselineY - finalY) * introProgress;
      return [{ x, y, v: series[0].v, d: series[0].d, sourceIdx: 0 }];
    }
    const vmax = Math.max(1, ...series.map(p=>p.v));
    const yMax = metric === 'count' ? Math.max(2, vmax + 1) : Math.max(10, vmax * 1.25);
    return series.map((p, idx)=>{
      const dayDiff = (p.d - firstDate) / (1000 * 60 * 60 * 24);
      const xRatio = clamp(totalDays > 0 ? dayDiff / totalDays : 0, 0, 1);
      const x = left + xRatio * cw;
      const yRatio = clamp(p.v / yMax, 0, 1);
      const finalY = top + (1 - yRatio) * usableCh;
      const y = introBaselineY - (introBaselineY - finalY) * introProgress;
      return { x, y, v: p.v, d: p.d, sourceIdx: idx };
    });
  }, [series, start, end, today, left, cw, top, ch, metric, introProgress, introBaselineY]);

const safeNodePts = useMemo(() => {
 if (!Array.isArray(nodePts) || nodePts.length === 0) return [];
 return nodePts.map((point) => ({
   ...point,
   x: Math.min(Math.max(point.x, pointSafeInset), width - pointSafeInset),
 }));
}, [nodePts, pointSafeInset, width]);

  const yScale = useCallback((v, vmax)=> {
    const BOTTOM_PADDING_RATIO = 0.15;
    const usableCh = ch * (1 - BOTTOM_PADDING_RATIO);
    // 0값이 x축에 딱 붙지 않도록 가상의 최솟값(-vmax*0.08)을 기준으로 스케일
    const vmin = -vmax * 0.08;
    const range = vmax - vmin;
    const finalY = top + (1 - (v - vmin) / range) * usableCh;
    return introBaselineY - (introBaselineY - finalY) * introProgress;
  }, [top, ch, introProgress, introBaselineY]);

  const pts = useMemo(()=>{
    const n = series.length;
    if(n===0) return [];
    if (n===1) {
      const vmax = Math.max(1, series[0].v);
      const yMax = metric === 'count' ? Math.max(2, vmax + 1) : Math.max(10, vmax * 1.25);
      const yRatio = clamp(series[0].v / yMax, 0, 1);
      const finalY = top + (1 - yRatio) * ch * 0.85;
      const y = introBaselineY - (introBaselineY - finalY) * introProgress;
      const xleft = left;
      return [
        {x:xleft-0.001, y, v:series[0].v, d:series[0].d, sourceIdx: 0},
        {x:xleft+0.001, y, v:series[0].v, d:series[0].d, sourceIdx: 0}
      ];
    }
    return nodePts;
  }, [series, metric, top, ch, left, nodePts, introProgress, introBaselineY]);

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
    const w = Math.max(70, Math.min(130, 10 + txt.length * 5.5));
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

    const lx = Math.min(Math.max(p.x - w/2, left + 4), left + cw - w - 4);
    return { lx, ly, w, h };
  };

  const dotCy = baselineY + 14;
  const dotCx1 = left + cw/2 - 10;
  const dotCx2 = left + cw/2 + 10;


 const shouldCaptureTouch = useCallback((evt) => {
  if (!interactive) return false;
  const { locationX: x, locationY: y } = evt.nativeEvent;
  const nearX = (cx, r = 16) => Math.abs(x - cx) <= r;

  // 페이저 점(●●) 터치 캡처 - Y 범위도 체크
  if (showPager && y >= dotCy - 16 && y <= dotCy + 16) {
    if (nearX(dotCx1) || nearX(dotCx2)) return true;
  }

  // 데이터 노드 - X좌표 기준 세로 직선 방식 (그래프 영역 내에서만)
  if (y >= top && y <= top + ch + bottom && nodePts.length > 0) {
    return true;
  }
  return false;
}, [interactive, nodePts, dotCx1, dotCx2, dotCy, top, ch, bottom, showPager]);

  const handleRelease = useCallback((evt)=>{
    if(!interactive) return;
    const { locationX:x, locationY:y } = evt.nativeEvent;
    const nearX = (cx, r=16) => Math.abs(x - cx) <= r;

    // 페이저 점 터치 - Y 범위 체크
    if (showPager && y >= dotCy - 16 && y <= dotCy + 16) {
      if (nearX(dotCx1)) { onSelectPagerIndex(0); return; }
      if (nearX(dotCx2)) { onSelectPagerIndex(1); return; }
    }

    // 그래프 영역 내 X좌표 기준으로 가장 가까운 노드 선택
    if (!safeNodePts.length) return;
    let best = 0, bestDx = Infinity;
    for (let i=0;i<safeNodePts.length;i++){
      const dx = Math.abs(safeNodePts[i].x - x);
      if (dx < bestDx) { bestDx = dx; best = i; }
    }
    setSelectedIdx(best);
  }, [interactive, safeNodePts, dotCx1, dotCx2, dotCy, onSelectPagerIndex, showPager]);

  const selectedLabel = useMemo(()=>{
    if (selectedIdx==null || !series[selectedIdx]) return null;
    const v = series[selectedIdx].v;
    const d = series[selectedIdx].d;
    return `${metric==='count'? `${v}회(누적)` : `${v}분`} ${String(d.getFullYear()).slice(2)}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }, [selectedIdx, series, metric]);

  const selPoint = useMemo(()=>{
    if (selectedIdx==null) return null;
    return safeNodePts[selectedIdx] || null;
  }, [selectedIdx, safeNodePts]);

  const safeEndNode = safeNodePts[safeNodePts.length-1] || null;

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
        <SvgText x={left+4} y={top + ch + 16} fill={textGrey} fontSize={10} fontWeight="700" textAnchor="start">
          {`${String(new Date(start).getFullYear()).slice(2)}-${pad2(new Date(start).getMonth()+1)}-${pad2(new Date(start).getDate())}`}
        </SvgText>
        <SvgText x={left+cw-4} y={top + ch + 16} fill={textGrey} fontSize={10} fontWeight="700" textAnchor="end">
          {`Today ${String((new Date()).getFullYear()).slice(2)}-${pad2((new Date()).getMonth()+1)}-${pad2((new Date()).getDate())}`}
        </SvgText>

        {/* 마커/라벨 */}
        {!selPoint && safeEndNode && (
          <Circle cx={safeEndNode.x} cy={safeEndNode.y} r={3.2} fill="#fff" stroke={baseBlack} strokeWidth={2}/>
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
        {!selPoint && defaultLabel && safeEndNode && (() => {
          const pos = placeLabel(safeEndNode, defaultLabel, true);
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
        {showPager && (
        <>
        <Circle cx={left + cw/2 - 10} cy={top + ch + 14} r={4} fill={pagerIndex===0 ? '#111' : '#D1D5DB'} />
        <Circle cx={left + cw/2 + 10} cy={top + ch + 14} r={4} fill={pagerIndex===1 ? '#111' : '#D1D5DB'} />
        </>
        )}
      </Svg>
    </View>
  );
});

const LineChartsPager = memo(function LineChartsPager({ startDate, entries, introProgress=1, interactive=true, onPageChange }) {
    useEffect(() => {
      return () => {};
    }, []);
  const { width } = useWindowDimensions();
  const pageW = width - (EDGE) * 2;
  const scrollRef = useRef(null);
  const [page, setPage] = useState(0);

  const goPage = useCallback((i)=>{
    const idx = clamp(i,0,1);
    scrollRef.current?.scrollTo({ x: idx*pageW, y: 0, animated: true });
    setPage(idx);
    if (typeof onPageChange === 'function') onPageChange(idx);
  }, [pageW, onPageChange]);

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
          const idx = clamp(i,0,1);
          setPage(idx);
          if (typeof onPageChange === 'function') onPageChange(idx);
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

const DashboardLineChart = memo(function DashboardLineChart({
  startDate,
  entries,
  metric,
  introProgress=1,
  interactive=true,
}) {
  const [chartBox, setChartBox] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((event) => {
    const width = Math.floor(event?.nativeEvent?.layout?.width || 0);
    const height = Math.floor(event?.nativeEvent?.layout?.height || 0);
    if (width > 0 && height > 0) {
      setChartBox((prev) => (
        prev.width === width && prev.height === height
          ? prev
          : { width, height }
      ));
    }
  }, []);

  const chartWidth = Math.max(1, chartBox.width);
  const chartHeight = Math.max(1, chartBox.height);

  return (
    <View style={styles.lineWidgetArea} onLayout={onLayout}>
      {chartBox.width > 0 && chartBox.height > 0 ? (
        <LineGradientChart
          startDate={startDate}
          entries={entries}
          metric={metric}
          width={chartWidth}
          height={chartHeight}
          introProgress={introProgress}
          interactive={interactive}
          pagerIndex={metric === 'minutes' ? 1 : 0}
          showPager={false}
          plotInset={0}
        />
      ) : (
        <View style={{ flex: 1, width: '100%' }} />
      )}
    </View>
  );
});

const DashboardProgressWidget = memo(function DashboardProgressWidget({
  overallPct,
  progress,
  onPress,
  disabled = false,
}) {
  const [box, setBox] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((event) => {
    const width = Math.floor(event?.nativeEvent?.layout?.width || 0);
    const height = Math.floor(event?.nativeEvent?.layout?.height || 0);
    if (width > 0 && height > 0) {
      setBox((prev) => (
        prev.width === width && prev.height === height
          ? prev
          : { width, height }
      ));
    }
  }, []);

  const SAFE_PAD = 4;

  const availableW = Math.max(1, box.width - SAFE_PAD * 2);
  const availableH = Math.max(1, box.height - SAFE_PAD * 2);
  const donutSize = box.width > 0 && box.height > 0
    ? Math.floor(Math.min(availableW, availableH))
    : 0;
  const donutStroke = donutSize > 0
    ? Math.max(3, Math.round(donutSize * (PROGRESS_DONUT_STROKE / PROGRESS_DONUT_SIZE)))
    : PROGRESS_DONUT_STROKE;

  return (
    <TouchableOpacity
      style={[styles.donutArea, styles.progressWidgetRoot]}
      onLayout={onLayout}
      onPress={disabled ? undefined : onPress}
      activeOpacity={0.8}
      disabled={disabled}
    >
      <View style={styles.progressDonutBody}>
        {donutSize > 0 ? (
          <Donut
            targetPercent={overallPct}
            progress={progress}
            size={donutSize}
            stroke={donutStroke}
          />
        ) : null}
      </View>
    </TouchableOpacity>
  );
});


/* ───────── 주간 뷰 ───────── */
const WeekView = memo(function WeekView({
  weeksData,
  currentIndex = 0,
  onIndexChange,
  introProgress = 1,
  onPressDay,
  onTapBar,
  challengeStartDate,
  challengeEndDate,
}) {
  const scrollRef = useRef(null);
  const [pageW, setPageW] = useState(0);
  const [viewH, setViewH] = useState(0);
  const [weekDateTextWidth, setWeekDateTextWidth] = useState(0);

  const recordWeekDateTextWidth = useCallback((event) => {
    const width = Math.ceil(event?.nativeEvent?.layout?.width || 0);
    if (width <= 0) return;
    setWeekDateTextWidth((prev) => (width > prev ? width : prev));
  }, []);

  const onLayout = useCallback((e) => {
    const w = Math.floor(e.nativeEvent.layout.width || SCREEN_WIDTH);
    const h = Math.floor(e.nativeEvent.layout.height || 0);
    if (w && w !== pageW) setPageW(w);
    if (h && h !== viewH) setViewH(h);
  }, [pageW, viewH]);

  const PADDING_H = 0;
  const WEEK_BAR_W = 16;
  const WEEK_DATE_TEXT_SAFE_PAD = 2;
  const WEEK_EDGE_TARGET_W = Math.max(WEEK_BAR_W, weekDateTextWidth + WEEK_DATE_TEXT_SAFE_PAD);
  const EDGE_COLUMN_BLEED = pageW > 0 && weekDateTextWidth > 0
    ? Math.max(0, (pageW - WEEK_EDGE_TARGET_W * 7) / 12)
    : 0;
  const ROW_W = Math.max(1, pageW + EDGE_COLUMN_BLEED * 2);
  const COL_W = ROW_W / 7;
  const ROW_OFFSET_X = -EDGE_COLUMN_BLEED;

  const initialOffsetX = useMemo(
    () => Math.max(0, Math.min(currentIndex, Math.max(weeksData.length - 1, 0))) * pageW,
    [currentIndex, weeksData.length, pageW]
  );

  const goWeek = useCallback((targetIndex) => {
    if (!pageW || !Array.isArray(weeksData) || weeksData.length === 0) return;
    const nextIndex = Math.max(0, Math.min(Number(targetIndex) || 0, weeksData.length - 1));
    scrollRef.current?.scrollTo({ x: nextIndex * pageW, animated: true });
    if (typeof onIndexChange === 'function') onIndexChange(nextIndex);
  }, [pageW, weeksData, onIndexChange]);

  const monthPagerWeeks = useMemo(() => {
    if (!Array.isArray(weeksData) || weeksData.length === 0) return [];

    const currentWeek = weeksData[Math.max(0, Math.min(currentIndex, weeksData.length - 1))] || weeksData[0];
    if (!currentWeek?.ws) return [];

    const base = new Date(currentWeek.ws);
    base.setHours(0, 0, 0, 0);

    const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEnd = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    const firstWeekStart = new Date(monthStart);
    firstWeekStart.setDate(monthStart.getDate() - monthStart.getDay());
    firstWeekStart.setHours(0, 0, 0, 0);

    const challengeStart = challengeStartDate ? new Date(challengeStartDate) : null;
    const challengeEnd = challengeEndDate ? new Date(challengeEndDate) : null;
    if (challengeStart) challengeStart.setHours(0, 0, 0, 0);
    if (challengeEnd) challengeEnd.setHours(23, 59, 59, 999);

    const result = [];
    const cursor = new Date(firstWeekStart);

    while (cursor <= monthEnd) {
      const weekStart = new Date(cursor);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const dataIndex = weeksData.findIndex((week) => {
        if (!week?.ws) return false;
        const ws = new Date(week.ws);
        ws.setHours(0, 0, 0, 0);
        return keyOf(ws) === keyOf(weekStart);
      });

      const inChallengeRange = !!(
        challengeStart &&
        challengeEnd &&
        weekStart <= challengeEnd &&
        weekEnd >= challengeStart
      );

      result.push({
        key: keyOf(weekStart),
        dataIndex,
        inChallengeRange,
        isCurrent: dataIndex === currentIndex,
      });

      cursor.setDate(cursor.getDate() + 7);
    }

    return result;
  }, [weeksData, currentIndex, challengeStartDate, challengeEndDate]);

  const WEEK_FALLBACK_VIEW_HEIGHT = 184;
  const WEEK_CONTROL_HEIGHT = 20;
  const WEEK_DATE_ROW_HEIGHT = 24;
  const WEEK_BAR_TOP_GAP = 10;
  const WEEK_GRAPH_BOTTOM_GAP = 10;

  const WEEK_VIEW_HEIGHT = viewH > 0 ? viewH : WEEK_FALLBACK_VIEW_HEIGHT;
  const WEEK_GRAPH_HEIGHT = Math.max(1, WEEK_VIEW_HEIGHT - WEEK_CONTROL_HEIGHT);
  const WEEK_BAR_ROW_HEIGHT = Math.max(
    48,
    WEEK_GRAPH_HEIGHT - WEEK_DATE_ROW_HEIGHT - WEEK_BAR_TOP_GAP - WEEK_GRAPH_BOTTOM_GAP
  );
  const WEEK_BAR_VALUE_MAX_H = Math.max(16, WEEK_BAR_ROW_HEIGHT - 30);
  const WEEK_BAR_VALUE_BASE_H = Math.min(10, Math.max(4, WEEK_BAR_VALUE_MAX_H * 0.25));
  const WEEK_BAR_VALUE_RANGE_H = Math.max(1, WEEK_BAR_VALUE_MAX_H - WEEK_BAR_VALUE_BASE_H);

  const renderWeek = useCallback(({ dailyStats }, idx) => {
    const maxTime = Math.max(...dailyStats.map(s => s.duration || 0), 1);
    const maxCount = Math.max(...dailyStats.map(s => s.totalCount || 0), 1);

    return (
      <View key={idx} style={{ width: pageW, paddingHorizontal: PADDING_H, marginBottom: WEEK_GRAPH_BOTTOM_GAP }}>
        <View style={{ flexDirection:'row', width: ROW_W, marginLeft: ROW_OFFSET_X }}>
          {dailyStats.map((stat, i) => (
            <TouchableOpacity
              key={i}
              style={{ width: COL_W, alignItems:'center' }}
              onPress={() => onPressDay?.(stat.date, weeksData[idx]?.ws, i)}
              activeOpacity={0.7}
            >
              <Text
                onLayout={recordWeekDateTextWidth}
                style={[styles.dateLabel, { marginBottom: 2 }]}
              >
                {stat.date}
              </Text>
              <Text style={styles.dayLabel}>{DAY_LABELS[i]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={onTapBar} activeOpacity={0.85} style={{ flexDirection:'row', width: ROW_W, marginLeft: ROW_OFFSET_X, alignItems:'flex-end', height: WEEK_BAR_ROW_HEIGHT, marginTop: WEEK_BAR_TOP_GAP }}>
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
              ? Math.min(
                (stat.duration / maxTime) * WEEK_BAR_VALUE_RANGE_H + WEEK_BAR_VALUE_BASE_H,
                WEEK_BAR_VALUE_MAX_H
              ) * introProgress
              : 0;
            const hCount = (!hasTime && hasCount)
              ? Math.min(
                (stat.totalCount / maxCount) * WEEK_BAR_VALUE_RANGE_H + WEEK_BAR_VALUE_BASE_H,
                WEEK_BAR_VALUE_MAX_H
              ) * introProgress
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
        </TouchableOpacity>
      </View>
    );
  }, [pageW, PADDING_H, ROW_W, COL_W, ROW_OFFSET_X, WEEK_GRAPH_BOTTOM_GAP, WEEK_BAR_TOP_GAP, WEEK_BAR_ROW_HEIGHT, WEEK_BAR_VALUE_BASE_H, WEEK_BAR_VALUE_RANGE_H, WEEK_BAR_VALUE_MAX_H, recordWeekDateTextWidth, introProgress, weeksData, onPressDay, onTapBar]);

  const canPrevWeek = currentIndex > 0;
  const canNextWeek = currentIndex < weeksData.length - 1;
  const isWeekLayoutReady = pageW > 0;

  return (
    <View style={{ flex: 1, width: '100%' }} onLayout={onLayout}>
      {!isWeekLayoutReady ? (
        <View style={{ height: WEEK_GRAPH_HEIGHT }} />
      ) : (
      <ScrollView
        key={`week-${weeksData.length}`}
        ref={scrollRef}
        horizontal
        pagingEnabled
        snapToInterval={pageW}
        snapToAlignment="start"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        style={{ height: WEEK_GRAPH_HEIGHT }}
        contentOffset={{ x: initialOffsetX, y: 0 }}
        onMomentumScrollEnd={(e) => {
          const i = Math.round((e?.nativeEvent?.contentOffset?.x || 0) / pageW);
          if (typeof onIndexChange === 'function') onIndexChange(Math.max(0, Math.min(i, weeksData.length - 1)));
        }}
        onScrollEndDrag={(e) => {
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
      )}

      <View style={styles.weekPagerControl}>
        <TouchableOpacity
          style={styles.weekPagerArrowHit}
          onPress={() => goWeek(currentIndex - 1)}
          disabled={!canPrevWeek}
          activeOpacity={0.7}
        >
          <Text style={[styles.weekPagerArrow, !canPrevWeek && styles.weekPagerArrowDisabled]}>{'‹'}</Text>
        </TouchableOpacity>

        <View style={styles.weekPagerDots}>
          {monthPagerWeeks.map((week) => {
            const dotStyle = week.isCurrent
              ? styles.weekPagerDotActive
              : week.inChallengeRange
              ? styles.weekPagerDotInRange
              : styles.weekPagerDotOutRange;

            return (
              <TouchableOpacity
                key={week.key}
                style={styles.weekPagerDotHit}
                onPress={() => {
                  if (week.dataIndex >= 0) goWeek(week.dataIndex);
                }}
                disabled={week.dataIndex < 0}
                activeOpacity={0.75}
              >
                <View style={[styles.weekPagerDot, dotStyle]} />
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.weekPagerArrowHit}
          onPress={() => goWeek(currentIndex + 1)}
          disabled={!canNextWeek}
          activeOpacity={0.7}
        >
          <Text style={[styles.weekPagerArrow, !canNextWeek && styles.weekPagerArrowDisabled]}>{'›'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const GRASS_ROWS = 7;
const DOW_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DOW_SHOW = [1, 3, 5]; // Mon, Wed, Fri

const GrassGraph = memo(function GrassGraph({ entries, startDate, endDate, introProgress = 1, onTap, onTapGrass, dashboardReturnTrigger = 0 }) {
    useEffect(() => {
      return () => {};
    }, []);
  const [containerSize, setContainerSize] = useState({
    width: SCREEN_WIDTH - EDGE * 2,
    height: 124,
  });
  const [waveIntensity, setWaveIntensity] = useState(() => new Array(60 * 7).fill(0));
  const sparkTimersRef = React.useRef([]);
  const grassScrollRef = useRef(null);
  const waveRafRef = React.useRef(null);
  const [waveTrigger, setWaveTrigger] = useState(0);
  const [scrollPos, setScrollPos] = useState({ x: 0, w: 0 });

  const onLayout = useCallback((e) => {
    const w = Math.floor(e?.nativeEvent?.layout?.width || 0);
    const h = Math.floor(e?.nativeEvent?.layout?.height || 0);
    if (w > 0 && h > 0) {
      setContainerSize((prev) => (
        prev.width === w && prev.height === h
          ? prev
          : { width: w, height: h }
      ));
    }
  }, []);

  useEffect(() => { if (onTap) onTap(() => setWaveTrigger(t => t + 1)); }, [onTap]);
  useEffect(() => {
    if (!dashboardReturnTrigger) return;
    setWaveTrigger((t) => t + 1);
  }, [dashboardReturnTrigger]);

  useEffect(() => {
    sparkTimersRef.current.forEach(t => clearTimeout(t));
    sparkTimersRef.current = [];
    if (waveRafRef.current) cancelAnimationFrame(waveRafRef.current);

    const TOTAL_COLS = 60;
    const TOTAL_ROWS = 7;
    const WAVE_WIDTH = 4;
    const WAVE_SPEED = 0.02;
    const DIAGONAL = 0.6;
    const startTime = performance.now();

    const tick = (now) => {
      const elapsed = now - startTime;
      const wavePos = elapsed * WAVE_SPEED;
      if (wavePos > TOTAL_COLS + WAVE_WIDTH + TOTAL_ROWS * DIAGONAL) {
        setWaveIntensity(new Array(TOTAL_COLS * TOTAL_ROWS).fill(0));
        return;
      }
      const intensities = new Array(TOTAL_COLS * TOTAL_ROWS).fill(0);
      for (let col = 0; col < TOTAL_COLS; col++) {
        for (let row = 0; row < TOTAL_ROWS; row++) {
          const diagOffset = row * DIAGONAL;
          const dist = Math.abs((col + diagOffset) - wavePos);
          if (dist < WAVE_WIDTH) {
            intensities[col * TOTAL_ROWS + row] = Math.sin((1 - dist / WAVE_WIDTH) * Math.PI * 0.5);
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
    };
  }, [waveTrigger]);

  const containerWidth = Math.max(1, containerSize.width);
  const containerHeight = Math.max(1, containerSize.height);

  const LEFT_LABEL_W = 0;
  const TOP_LABEL_H = 18;
  const TOP_LABEL_GAP = 4;

  const MIN_CELL_SIZE = 8;
  const MAX_CELL_SIZE = 18;
  const MIN_CELL_GAP = 2;
  const MAX_CELL_GAP = 4;

  const CELL_GAP = Math.max(
    MIN_CELL_GAP,
    Math.min(MAX_CELL_GAP, Math.round(containerHeight / 44))
  );
  const availableGridHeight = Math.max(
    1,
    containerHeight - TOP_LABEL_H - TOP_LABEL_GAP
  );
  const cellSize = Math.max(
    MIN_CELL_SIZE,
    Math.min(
      MAX_CELL_SIZE,
      Math.floor((availableGridHeight - (GRASS_ROWS - 1) * CELL_GAP) / GRASS_ROWS)
    )
  );
  const graphBoxHeight = TOP_LABEL_H + TOP_LABEL_GAP + GRASS_ROWS * cellSize + (GRASS_ROWS - 1) * CELL_GAP;

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
        if (!inRange) level = 0;
        else if (isFuture) level = 1;
        else if (!certified) level = 1;
        else {
          let streak = 1;
          for (let s = 1; s <= 2; s++) {
            const prevDate = new Date(cellDate);
            prevDate.setDate(prevDate.getDate() - s);
            const prevKey = keyOf(prevDate);
            if (certSet.has(prevKey)) streak++;
            else break;
          }
          if (streak >= 3) level = 4;
          else if (streak === 2) level = 3;
          else level = 2;
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

    const colUnit = cellSize + CELL_GAP;
    const contentCols = Math.max(weekStarts.length + 1, 1);
    const minCols = Math.max(1, Math.floor((containerWidth + CELL_GAP) / colUnit));
    const totalCols = Math.max(contentCols, minCols);
    const graphWidth = totalCols * colUnit - CELL_GAP;
    const contentWidth = contentCols * colUnit - CELL_GAP;
    const canScrollGrass = contentWidth > containerWidth + 1;
  const LEVEL_COLORS = ['#F3F4F6', '#E5E7EB', '#A0A0A0', '#555555', '#111111'];
  const handlePressGrass = useCallback(() => {
    setWaveTrigger((t) => t + 1);
    if (typeof onTapGrass === 'function') {
      onTapGrass();
    }
  }, [onTapGrass]);

  const GridContent = (
    <View style={{ flexDirection: 'row', width: graphWidth }}>
      {Array.from({ length: totalCols }).map((_, col) => {
        return (
          <View key={col} style={{ marginRight: col < totalCols - 1 ? CELL_GAP : 0 }}>
            {Array.from({ length: GRASS_ROWS }).map((__, row) => {
              const cell = cellData.find(c => c.col === col && c.row === row);
              const baseLevel = cell?.level ?? 0;
              const wave = waveIntensity[col * GRASS_ROWS + row] ?? 0;
              const baseColor = LEVEL_COLORS[baseLevel] ?? '#F3F4F6';
              let waveColor = baseColor;
              if (wave > 0.85) waveColor = '#111111';
              else if (wave > 0.6) waveColor = '#555555';
              else if (wave > 0.25) waveColor = '#A0A0A0';
              else if (wave > 0.05) waveColor = '#E5E7EB';
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
    </View>
);

  return (
    <View style={{ flex: 1, width: '100%', justifyContent: 'center' }} onLayout={onLayout}>
      <View style={{ width: containerWidth, height: graphBoxHeight }}>
        <ScrollView
          ref={grassScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
        nestedScrollEnabled={canScrollGrass}
        directionalLockEnabled
        scrollEnabled={canScrollGrass}
        bounces={false}
        alwaysBounceHorizontal={false}
        overScrollMode="never"
        scrollEventThrottle={16}
          onScroll={(e) => setScrollPos({ x: e.nativeEvent.contentOffset.x, w: e.nativeEvent.contentSize.width })}
        >
          <View>
            {/* 월 라벨 영역 */}
            <View style={{ height: TOP_LABEL_H, width: graphWidth, position: "relative", marginBottom: TOP_LABEL_GAP }}>
              {monthLabels.map((ml, i) => (
                <Text
                  key={i}
                  style={[
                    styles.grassMonthLabel,
                    { left: ml.col * (cellSize + CELL_GAP) },
                  ]}
                >
                  {ml.label}
                </Text>
              ))}
            </View>
            {/* 잔디 블록 영역 */}
            <TouchableOpacity onPress={handlePressGrass} activeOpacity={1} style={{ flexDirection: 'row' }}>
              {GridContent}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* 좌측 화살표 (Absolute) - 월 글씨 위치에 맞춤 */}
          {canScrollGrass && scrollPos.x > 5 && (
          <View style={styles.grassArrowLeft}>
            <TouchableOpacity onPress={() => grassScrollRef.current?.scrollTo({x: 0, animated: true})} hitSlop={{top:12, bottom:12, left:12, right:12}}>
              <Text style={styles.grassArrowText}>{"‹"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 우측 화살표 (Absolute) */}
          {canScrollGrass && scrollPos.x + containerWidth < graphWidth - 5 && (
          <View style={styles.grassArrowRight}>
            <TouchableOpacity onPress={() => grassScrollRef.current?.scrollToEnd({animated: true})} hitSlop={{top:12, bottom:12, left:12, right:12}}>
              <Text style={styles.grassArrowText}>{"›"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
  const dashboardEditReturnMode = params.dashboardEditReturnMode;
  const dashboardEditReturnedAt = params.dashboardEditReturnedAt || params.dashboardEditSavedAt;
  const insets = useSafeAreaInsets();
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

    const [hasStoredDashboardLayout, setHasStoredDashboardLayout] = useState(false);



  const dashboardTarget = (
    params.type === 'habit' ||
    params.challengeType === 'habit' ||
    params.cardType === 'habit' ||
    params.item?.type === 'habit' ||
    params.challenge?.type === 'habit' ||
    params.habit
  )
    ? DASHBOARD_TARGETS.HABIT
    : DASHBOARD_TARGETS.CHALLENGE;
  const [dashboardLayout, setDashboardLayout] = useState(() =>
    getDefaultDashboardLayout(dashboardTarget).map((item) => ({ ...item })),
  );
  const [dashboardLayoutHasStored, setDashboardLayoutHasStored] = useState(false);

  useFocusEffect(
  useCallback(() => {
    let mounted = true;
    const loadDashboardLayout = async () => {
      try {
        const result = await getDashboardLayoutStateForChallenge(challengeId, dashboardTarget);
        console.log('[DASHBOARD_DEBUG_LOAD_RESULT]', {
          challengeId,
          dashboardTarget,
          hasStoredLayout: result?.hasStoredLayout,
          loadedCount: Array.isArray(result?.layout) ? result.layout.length : 'not-array',
          loadedIds: Array.isArray(result?.layout) ? result.layout.map((item) => item.id || item.widgetId || item.i) : [],
        });
        console.log('[DASHBOARD_DEBUG_INITIAL_LOAD]', {
          challengeId,
          dashboardTarget,
          hasStored: result?.hasStoredLayout,
          count: Array.isArray(result?.layout) ? result.layout.length : 'not-array',
          ids: Array.isArray(result?.layout) ? result.layout.map(i => i.id || i.widgetId || i.i) : [],
        });
        if (!mounted) return;
        const nextLayout = Array.isArray(result?.layout) ? result.layout : getDefaultDashboardLayout(dashboardTarget);
        setDashboardLayoutHasStored(Boolean(result?.hasStoredLayout));
        setDashboardLayout(nextLayout.map((item) => ({ ...item })));
      } catch (error) {
        console.log('Failed to load dashboard layout', error);
        if (!mounted) return;
        const fallbackLayout = getDefaultDashboardLayout(dashboardTarget);
        setDashboardLayoutHasStored(false);
        setDashboardLayout(fallbackLayout.map((item) => ({ ...item })));
      }
    };
    loadDashboardLayout();
    return () => { mounted = false; };
    }, [challengeId, dashboardTarget])
)

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

  const renderDashboardWidget = (item, isShare = false) => {
        // DASHBOARD_RENDER_NORMALIZED_WIDGET_META
    const widgetId = item?.widgetId || item?.id || item?.i;
    const catalogWidget = widgetId ? (getWidgetById(widgetId) || {}) : {};
    const rawKind = item?.kind || item?.type || catalogWidget.kind || catalogWidget.type || widgetId;
    const normalizedKindMap = {
      overall_progress: 'progress',
      overallProgress: 'progress',
      progress: 'progress',
      donut: 'progress',
      calendar: 'calendar',
      month_calendar: 'calendar',
      monthCalendar: 'calendar',
      weekly_bar: 'weeklyBar',
      weeklyBar: 'weeklyBar',
      week: 'weeklyBar',
      grass_graph: 'grass',
      grassGraph: 'grass',
      grass: 'grass',
      line_count: 'lineCount',
      lineCount: 'lineCount',
      line_graph: 'lineCount',
      line_minutes: 'lineMinutes',
      lineMinutes: 'lineMinutes',
      goal_black_box: 'goal',
      goal: 'goal',
    };
    const widgetKind = normalizedKindMap[rawKind] || rawKind;

    // Removed duplicate ID
    const catalogMeta = getWidgetById(widgetId);
    const kind = item?.kind || catalogMeta?.kind || item?.type || catalogMeta?.type;

    if (!kind) return <View style={{flex:1, backgroundColor:'#eee', borderRadius:8, justifyContent:'center', alignItems:'center'}}><Text>준비중</Text></View>;

    if (widgetKind === 'progress' || kind === 'overallProgress') {
      return (
        <DashboardWidgetShell
          header={
            <DashboardWidgetHeader
              title="전체 진행률"
              hideSides
            />
          }
        >
          <DashboardProgressWidget
            overallPct={overallPct}
            progress={isShare ? undefined : donutK}
            onPress={isShare ? undefined : runDonut}
            disabled={isShare}
          />
        </DashboardWidgetShell>
      );
    }
    if (widgetKind === 'calendar') {
      return (
        <View style={styles.calendarArea}>
          <DashboardWidgetShell
            header={
              <CalendarHeaderGrid
                title={`${monthDate.getMonth() + 1}월`}
                onLeft={isShare ? undefined : prevMonth}
                onRight={isShare ? undefined : nextMonth}
                canLeft={isShare ? false : canPrevMonth}
                canRight={isShare ? false : canNextMonth}
              />
            }
          >
            <MonthCalendar
              startDate={meta.startDate || new Date()}
              endDate={meta.endDate || new Date()}
              entriesByDaySet={entriesByDaySet}
              monthDate={monthDate}
              onPrev={isShare ? undefined : prevMonth}
              onNext={isShare ? undefined : nextMonth}
              canPrev={isShare ? false : canPrevMonth}
              canNext={isShare ? false : canNextMonth}
              highlightDate={highlightDate}
            />
          </DashboardWidgetShell>
        </View>
      );
    }
    if (widgetKind === 'goal') {
      if (dashboardTarget === DASHBOARD_TARGETS.HABIT) return null;
      return (
        <View style={styles.goalWidgetArea}>
          <View style={styles.rewardBlackBox}>
            <Text style={styles.rewardBlackText}>{meta.rewardTitle ?? meta.reward ?? '—'}</Text>
          </View>
        </View>
      );
    }
    if (widgetKind === 'weeklyBar') {
      return (
        <View style={styles.weeklyWidgetArea}>
          <WeekView
            weeksData={weeksData}
            currentIndex={weekIndex}
            onIndexChange={isShare ? undefined : setWeekIndex}
            introProgress={isShare ? undefined : weekK}
            onPressDay={isShare ? undefined : handlePressDay}
            onTapBar={isShare ? undefined : runWeek}
            challengeStartDate={meta.startDate}
            challengeEndDate={meta.endDate}
          />
        </View>
      );
    }
    if (widgetKind === 'grass') {
      return (
        <View style={styles.grassWidgetArea}>
          <GrassGraph
            entries={entries}
            startDate={meta.startDate}
            endDate={meta.endDate}
            dashboardReturnTrigger={isShare ? 0 : grassDashboardReturnTick}
          />
        </View>
      );
    }
    if (widgetKind === 'lineCount') {
      return (
        <DashboardLineChart
          startDate={meta.startDate}
          entries={entries}
          metric="count"
          interactive={!isShare}
          introProgress={isShare ? undefined : lineK}
        />
      );
    }

    if (widgetKind === 'lineMinutes') {
      return (
        <DashboardLineChart
          startDate={meta.startDate}
          entries={entries}
          metric="minutes"
          interactive={!isShare}
          introProgress={isShare ? undefined : lineK}
        />
      );
    }
    return <View style={{flex:1, backgroundColor:'#eee', borderRadius:8, justifyContent:'center', alignItems:'center'}}><Text>준비중 ({kind})</Text></View>;
  };

  const [meta, setMeta] = useState({
    startDate: startDateFromRoute ?? null,
    endDate: endDateFromRoute ?? null,
    rewardTitle: rewardTitleFromRoute ?? null,
    reward: rewardFromRoute ?? null,
    description: null,
    notification: { mode: null, payload: null },
  });
  const routeTitle = params.title || params.challengeTitle || params.challengeName || params.name || params.cardTitle || params.item?.title || params.item?.name || params.challenge?.title || params.challenge?.name || params.habit?.title || params.habit?.name || '';
  const displayTitle = (typeof meta?.title === 'string' && meta.title.trim().length > 0) ? meta.title : (routeTitle || '기록');

  const enterDashboardEdit = useCallback(() => {
    navigation.navigate('DashboardEdit', {
      challengeId,
      type: params.type || params.challengeType || params.item?.type || params.challenge?.type,
      title: displayTitle || meta?.title || params.title || params.challengeTitle || params.item?.title || params.challenge?.title,
      item: params.item,
      challenge: params.challenge,
      returnRouteKey: route?.key,
    });
  }, [navigation, challengeId, params, displayTitle, meta, route?.key]);

  const totalCount = Array.isArray(entries) ? entries.length : 0;

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
  const isDonutAnimatingRef = useRef(false);
  const isWeekAnimatingRef = useRef(false);
  const isGrassAnimatingRef = useRef(false);
  const skipDashboardReturnIntroRef = useRef(false);
  const skipDashboardReturnReloadRef = useRef(false);
  const dashboardReturnSuppressUntilRef = useRef(0);
  const dashboardReturnSuppressTimerRef = useRef(null);
  const dashboardReturnModeRef = useRef(null);
  const dashboardReturnIntroHandledRef = useRef(false);

  /* ── 인트로 애니메이션 ── */
  const [donutK, setDonutK] = useState(0);
 const [weekK, setWeekK] = useState(0);
 const [lineK, setLineK] = useState(0);
  const [grassDashboardReturnTick, setGrassDashboardReturnTick] = useState(0);
 const [introReadyTick, setIntroReadyTick] = useState(0);
 const [reloadNonce, setReloadNonce] = useState(0);

  const animateK = useCallback((setter, onDone) => {
    const ease = (t) => 1 - Math.pow(1 - t, 5);
    const DUR = 2400;
    const t0 = Date.now();
    let raf;
    const tick = () => {
      const t = Math.min(1, (Date.now() - t0) / DUR);
      const k = ease(t);
      setter(k);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        if (typeof onDone === 'function') onDone();
      }
    };
    raf = requestAnimationFrame(tick);
    return raf;
  }, []);

  const runDonut = useCallback(() => {
    if (isDonutAnimatingRef.current) return;
    isDonutAnimatingRef.current = true;
    setDonutK(0);
    animateK(setDonutK, () => { isDonutAnimatingRef.current = false; });
  }, [animateK]);
  const runWeek = useCallback(() => {
    if (isWeekAnimatingRef.current) return;
    isWeekAnimatingRef.current = true;
    setWeekK(0);
    animateK(setWeekK, () => { isWeekAnimatingRef.current = false; });
  }, [animateK]);
 const runLine = useCallback(() => {  animateK(setLineK); }, [animateK]);
  const runAllIntro = useCallback(() => {
    if (!isDonutAnimatingRef.current) {
      isDonutAnimatingRef.current = true;
      setDonutK(0);
      animateK(setDonutK, () => { isDonutAnimatingRef.current = false; });
    }
    if (!isWeekAnimatingRef.current) {
      isWeekAnimatingRef.current = true;
      setWeekK(0);
      animateK(setWeekK, () => { isWeekAnimatingRef.current = false; });
    }
    setLineK(0);
    animateK(setLineK);
  }, [animateK]);

  /* ── 디버그/리로드 ── */
  const [debug, setDebug] = useState({ hitKey:null, tried:[], count:0 });
  const [reloadTick, setReloadTick] = useState(0);
  const reload = useCallback(()=> { setReloadTick(t=>t+1); setReloadNonce(n=>n+1); }, []);

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
    if (!isFocused) return;

    const suppressDashboardReturn = dashboardReturnSuppressUntilRef.current > Date.now();

    if (skipDashboardReturnReloadRef.current || suppressDashboardReturn) {
            skipDashboardReturnReloadRef.current = false;
      return;
    }

    if (loadingRef.current) return;

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
    // 키 자체가 없을 때만 폴백 스캔 (빈 배열로 초기화된 경우는 스캔 안 함)
    const primaryIsEmpty = primaryRaw === null;
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

      if (!aliveRef.current) return;
      // 인트로 애니메이션 준비 완료 신호
      setIntroReadyTick((t) => t + 1);
    })()
      .catch(console.error)
      .finally(()=>{ loadingRef.current = false; });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, challengeId, reloadTick, buildWeeks, reloadNonce]);

  // dashboardEditReturnedAt 감지 — 저장 복귀 시 intro 스킵
  useEffect(() => {
        if (!dashboardEditReturnedAt) return;

    const normalizedMode = dashboardEditReturnMode === 'save' ? 'save' : 'cancel';
    const suppressUntil = Date.now() + 2500;

    dashboardReturnModeRef.current = normalizedMode;
    dashboardReturnIntroHandledRef.current = false;
    dashboardReturnSuppressUntilRef.current = suppressUntil;

    if (dashboardReturnSuppressTimerRef.current) {
      clearTimeout(dashboardReturnSuppressTimerRef.current);
    }

    dashboardReturnSuppressTimerRef.current = setTimeout(() => {
      if (dashboardReturnSuppressUntilRef.current === suppressUntil) {
        skipDashboardReturnIntroRef.current = false;
        skipDashboardReturnReloadRef.current = false;
        dashboardReturnModeRef.current = null;
        dashboardReturnIntroHandledRef.current = false;
        dashboardReturnSuppressUntilRef.current = 0;
        dashboardReturnSuppressTimerRef.current = null;
      }
    }, 2600);

    skipDashboardReturnIntroRef.current = true;
    skipDashboardReturnReloadRef.current = true;

    setDonutK(0);
    setWeekK(0);
    setLineK(0);
    setGrassDashboardReturnTick((tick) => tick + 1);
  }, [dashboardEditReturnMode, dashboardEditReturnedAt]);

  // focus 해제 시 저장 복귀 skip ref 초기화
  useEffect(() => {
    if (isFocused) return;
    if (dashboardReturnSuppressUntilRef.current > Date.now()) return;
    skipDashboardReturnIntroRef.current = false;
    skipDashboardReturnReloadRef.current = false;
    dashboardReturnModeRef.current = null;
    dashboardReturnIntroHandledRef.current = false;
  }, [isFocused]);

  // 인트로 애니메이션 — 데이터·레이아웃 준비 완료 후 requestAnimationFrame으로 실행
  useEffect(() => {
    if (!isFocused || introReadyTick === 0) return;
    if (!Array.isArray(dashboardLayout) || dashboardLayout.length === 0) return;
    const raf = requestAnimationFrame(() => {
            const suppressDashboardReturn = dashboardReturnSuppressUntilRef.current > Date.now();
      const dashboardReturnMode = dashboardReturnModeRef.current;

      if (skipDashboardReturnIntroRef.current || suppressDashboardReturn) {
        
        if (dashboardReturnMode === 'save' || dashboardReturnMode === 'cancel') {
          if (!dashboardReturnIntroHandledRef.current) {
            dashboardReturnIntroHandledRef.current = true;
            runAllIntro();
          }
          return;
        }

        setDonutK(1);
        setWeekK(1);
        setLineK(1);
        return;
      }
      runAllIntro();
    });
    return () => cancelAnimationFrame(raf);
  }, [isFocused, introReadyTick, dashboardLayout.length, runAllIntro, navigation]);

  useEffect(()=>()=>{
    aliveRef.current = false;
    loadingRef.current = false;
    if (dashboardReturnSuppressTimerRef.current) {
      clearTimeout(dashboardReturnSuppressTimerRef.current);
      dashboardReturnSuppressTimerRef.current = null;
    }
    dashboardReturnModeRef.current = null;
    dashboardReturnIntroHandledRef.current = false;
  },[]);

  const overallPct = useMemo(
    () => { if (!targetScore) return 0; const pct = Math.round((currentScore / targetScore) * 100); return isNaN(pct) ? 0 : Math.min(Math.max(0, pct), 100); },
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
    const DashboardGraphArea = ({ isShare = false } = {}) => {
    const sourceLayout = dashboardLayout;
    const baseLayout = Array.isArray(sourceLayout) && sourceLayout.length
      ? sourceLayout
      : getDefaultDashboardLayout(dashboardTarget);

    const GRID_ROW_HEIGHT_VIEW = 90;
    const GRID_ROW_GAP_VIEW = 8;
    const GRID_CELL_PADDING_VIEW = 4;
    const DASHBOARD_BOARD_SIDE_BLEED = 4;

    const safeLayout = baseLayout
      .map((item, index) => {
        const widgetId = item.widgetId || item.id || item.i || `dashboard_graph_${index}`;

        const rawW = item.w;
        const rawH = item.h;

        const safeW = Math.max(1, Math.min(GRID_COLUMNS, Number(rawW) || GRID_COLUMNS));
        const safeH = Math.max(1, Number(rawH) || 1);
        const safeX = Math.max(0, Math.min(GRID_COLUMNS - safeW, Number(item.x) || 0));
        const safeY = Number.isFinite(Number(item.y)) ? Math.max(0, Number(item.y)) : index;

        return {
          ...item,
          id: widgetId,
          widgetId,
          x: safeX,
          y: safeY,
          w: safeW,
          h: safeH,
        };
      })
      .sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
      });

    const maxRow = safeLayout.reduce((max, item) => {
      const y = Math.max(0, Number(item.y) || 0);
      const h = Math.max(1, Number(item.h) || 1);
      return Math.max(max, y + h);
    }, 0);

    const boardHeight = maxRow > 0
      ? maxRow * GRID_ROW_HEIGHT_VIEW + Math.max(0, maxRow - 1) * GRID_ROW_GAP_VIEW
      : GRID_ROW_HEIGHT_VIEW;

    const renderAbsoluteSlot = (item, index) => {
      const widgetId = item.widgetId || item.id || `graph_${index}`;
      const safeX = Math.max(0, Math.min(GRID_COLUMNS - item.w, Number(item.x) || 0));
      const safeY = Math.max(0, Number(item.y) || 0);
      const safeW = Math.max(1, Math.min(GRID_COLUMNS, Number(item.w) || GRID_COLUMNS));
      const safeH = Math.max(1, Number(item.h) || 1);

      const leftPct = `${(safeX / GRID_COLUMNS) * 100}%`;
      const widthPct = `${(safeW / GRID_COLUMNS) * 100}%`;
      const top = safeY * (GRID_ROW_HEIGHT_VIEW + GRID_ROW_GAP_VIEW);
      const height = safeH * GRID_ROW_HEIGHT_VIEW + Math.max(0, safeH - 1) * GRID_ROW_GAP_VIEW;

      return (
        <View
          key={widgetId}
          style={{
            position: 'absolute',
            left: leftPct,
            top,
            width: widthPct,
            height,
            paddingHorizontal: GRID_CELL_PADDING_VIEW,
          }}
        >
          <View style={styles.dashboardGuideBox}>
            <View style={styles.dashboardWidgetCard}>
              {renderDashboardWidget(item, isShare)}
            </View>
          </View>
        </View>
      );
    };

    return (
      <View style={{ marginTop: isShare ? 10 : 20 }}>
        {!isShare && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#111' }}>대시보드</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  if (typeof enterDashboardEdit === 'function') enterDashboardEdit();
                }}
                style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#111' }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>대시보드 수정</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ marginHorizontal: -DASHBOARD_BOARD_SIDE_BLEED }}>
          <View style={{ position: 'relative', width: '100%', height: boardHeight }}>
            {safeLayout.map((item, index) => renderAbsoluteSlot(item, index))}
          </View>
        </View>
      </View>
    );
  };const HeaderCard = useMemo(()=>(<View style={styles.card}>
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
          <TitleTwoLine text={displayTitle} style={styles.title} containerWidth={SCREEN_WIDTH - 120} />
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

            {DashboardGraphArea({ isShare: false })}
    </View>
  ), [meta.title, meta.startDate, meta.endDate,
    weeksData, monthDate, canPrevMonth, canNextMonth, entriesByDaySet,
    weekIndex, donutK, weekK, lineK, entries, overallPct, highlightDate
  , dashboardLayout,
    displayTitle
  ]);

  /* ===== 헤더 카드(공유 캡처용) ===== */
  const HeaderCardForShare = useMemo(()=>(<View style={styles.card}>
            <View style={styles.headerTop}>
        <View style={styles.headerInfoBtn}>
           <ShadowIcon forShare={true} />
        </View>
        <View style={styles.headerTitleWrap}>
          <TitleTwoLine text={displayTitle} style={styles.title} containerWidth={SCREEN_WIDTH - 120} />
          <Text style={[styles.period, { textAlign:'center' }]}>{`${fmtDate(meta.startDate)} ~ ${fmtDate(meta.endDate)}`}</Text>
        </View>
        <View style={styles.headerInfoBtn} />
      </View>

            {DashboardGraphArea({ isShare: true })}
    </View>
  ), [meta.title, meta.startDate, meta.endDate,
    weeksData, monthDate, canPrevMonth, canNextMonth, entriesByDaySet,
    weekIndex, entries, overallPct
  ,
    displayTitle
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
      console.log(e);
      console.log('공유 실패', '이미지 생성/공유 중 문제가 발생했어요. 다시 시도해 주세요.');
    }
  }, [ meta.title ]);

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

</View>

    <View style={[styles.postSummaryRow, styles.sectionPadNarrow]}>
      <Text style={styles.accumText}>누적시간 : {hours}시간 {minutes}분</Text>
      <Text style={styles.countBelowText}>{`${currentScore}/${targetScore}`}</Text>
    </View>

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
            <Text style={styles.modalTitleCenter}>{displayTitle}</Text>

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
      navigation.navigate('EntryDetail', { challengeId, entryId: item.id, title: displayTitle });
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
     {/* 그래프 1×1 캡처(오프스크린) */}
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
  donutArea: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 0,
  },
  progressWidgetRoot: {
    justifyContent: 'flex-start',
  },
  progressHeaderRow: {
    width: '100%',
    minHeight: 22,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTitleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },
  progressHeaderSideSlot: {
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  progressHeaderInvisibleText: {
    opacity: 0,
  },
  progressDonutBody: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 4,
  },
  calendarArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },

  sectionBox: { marginTop: 10 },
  sectionLabel: { fontSize: 12, color: textGrey, marginBottom: 6 },

  // 누적시간/횟수 — 그래프 축 날짜 텍스트와 동일 톤/크기
accumText:      { fontSize: 10, color: textGrey, fontWeight: '700' },
countBelowText: { fontSize: 10, color: textGrey, fontWeight: '700' },

goalWidgetArea: {
  flex: 1,
  width: '100%',
  justifyContent: 'center',
},
grassWidgetArea: {
  flex: 1,
  width: '100%',
  justifyContent: 'center',
},
lineWidgetArea: {
  flex: 1,
  width: '100%',
  justifyContent: 'center',
  overflow: 'hidden',
},
weeklyWidgetArea: {
  flex: 1,
  width: '100%',
  justifyContent: 'center',
},
weekPagerControl: {
  height: 20,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
},
weekPagerArrowHit: {
  width: 22,
  height: 20,
  alignItems: 'center',
  justifyContent: 'center',
},
weekPagerArrow: {
  fontSize: 15,
  fontWeight: '800',
  color: '#111',
  lineHeight: 16,
},
weekPagerArrowDisabled: {
  color: '#E5E7EB',
},
weekPagerDots: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 4,
},
weekPagerDotHit: {
  width: 12,
  height: 20,
  alignItems: 'center',
  justifyContent: 'center',
},
weekPagerDot: {
  width: 5,
  height: 5,
  borderRadius: 2.5,
  backgroundColor: '#E5E7EB',
},
weekPagerDotActive: {
  width: 6,
  height: 6,
  borderRadius: 3,
  backgroundColor: '#111',
},
weekPagerDotInRange: {
  backgroundColor: '#9CA3AF',
},
weekPagerDotOutRange: {
  backgroundColor: '#E5E7EB',
},
grassMonthLabel: {
  position: 'absolute',
  top: 3,
  fontSize: 10,
  lineHeight: 12,
  fontWeight: '700',
  color: '#6B7280',
  includeFontPadding: false,
},
grassArrowLeft: {
  position: 'absolute',
  left: 0,
  top: 3,
  height: 12,
  alignItems: 'center',
  justifyContent: 'flex-start',
  backgroundColor: 'rgba(255,255,255,0.72)',
  borderRadius: 6,
  paddingHorizontal: 2,
},
grassArrowRight: {
  position: 'absolute',
  right: 0,
  top: 3,
  height: 12,
  alignItems: 'center',
  justifyContent: 'flex-start',
  backgroundColor: 'rgba(255,255,255,0.72)',
  borderRadius: 6,
  paddingHorizontal: 2,
},
grassArrowText: {
  fontSize: 12,
  fontWeight: '800',
  color: '#6B7280',
  lineHeight: 12,
  includeFontPadding: false,
},
dashboardGuideBox: {
  width: '100%',
  height: '100%',
},
dashboardWidgetCard: {
  flex: 1,
  width: '100%',
  height: '100%',
  overflow: 'hidden',
},
dashboardContentFrame: {
  flex: 1,
  width: '100%',
  height: '100%',
  justifyContent: 'center',
  overflow: 'hidden',
},
dashboardGraphGuide: {
  flex: 1,
  width: '100%',
  height: '100%',
  justifyContent: 'center',
  paddingHorizontal: 6,
},
rewardBlackBox: {
  flex: 1,
  width: '100%',
  height: '100%',
  minHeight: 56,
  borderRadius: 12,
  backgroundColor: '#111',
  paddingVertical: 10,
  paddingHorizontal: 16,
  alignItems: 'center',
  justifyContent: 'center',
},
rewardBlackText: { fontSize: 17, fontWeight: '900', color: '#fff' },

  hr: { height: 1, backgroundColor: '#C7C7C7', marginHorizontal: 8, marginBottom: 8 },

  calWrap: {
    flex: 1,
    width: '100%',
    height: '100%',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 4,
    borderWidth: 0,
    justifyContent: 'center',
  },
  calHeaderRow: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calNavBtn: { paddingHorizontal: 6, paddingVertical: 1 },
  calNavText: { fontSize: 15, fontWeight: '800', color: '#111' },
  calTitle: { fontSize: 12, fontWeight: '700', color: '#111' },
  dashboardWidgetShell: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  dashboardWidgetHeaderSlot: {
    width: '100%',
    height: 22,
    minHeight: 22,
    marginTop: 4,
    paddingHorizontal: 0,
  },
  dashboardWidgetBodySlot: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    overflow: 'hidden',
  },
  dashboardWidgetHeaderRow: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dashboardWidgetHeaderSideSlot: {
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  dashboardWidgetHeaderSideDisabled: {
    opacity: 0.3,
  },
  dashboardWidgetHeaderSideInvisible: {
    opacity: 0,
  },
  dashboardWidgetHeaderNavText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111',
  },
  dashboardWidgetHeaderNavDisabled: {
    opacity: 0.3,
  },
  calendarHeaderGridRow: {
    width: '100%',
    height: 22,
    minHeight: 22,
    alignItems: 'center',
    position: 'relative',
  },
  calendarHeaderGridEdgeCell: {
    position: 'absolute',
    top: 0,
    width: '14.2857%',
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarHeaderGridLeftCell: {
    left: 0,
  },
  calendarHeaderGridRightCell: {
    right: 0,
  },
  calendarHeaderGridTitleLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashboardWidgetHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },

  calDowRow: { flexDirection: 'row', justifyContent: 'flex-start', marginTop: 3 },
  calDow: { width: '14.2857%', textAlign: 'center', fontSize: 9, color: textGrey },

  calGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 3 },
  calCell: {
    width: '14.2857%',
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1,
    borderRadius: 4,
  },
  calBadge: {
    minWidth: 17,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: '#111',
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 1,
    marginVertical: 1,
  },
  calBadgeText: { color: '#fff', fontWeight: '800', fontSize: 9.5 },
  calCellText: { fontSize: 9.5, color: '#111' },
  calCellTextDim: { color: textGrey },


  dateLabel: { fontSize: 10, color: textGrey },
  dayLabel: { fontSize: 9, color: '#333' },
  bar: { width: 16, borderRadius: 4, alignSelf:'center' },
  countLabel: { fontSize: 10, color: '#333', marginTop: 2, textAlign:'center' },

  entry: {
    flexDirection: 'row',
    paddingHorizontal: EDGE + NARROW_PLUS,
    paddingVertical: 12,
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
    width: 52, height: 42,
    alignItems: 'center', justifyContent: 'center',
    elevation: 3,
  },
  shareBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  uploadFloatingBtn: {
    position: 'absolute', left: 12,
    backgroundColor: '#111', borderRadius: 14,
    width: 52, height: 42,
    alignItems: 'center', justifyContent: 'center',
    elevation: 3,
  },
  uploadFloatingText: { color: '#fff', fontWeight: '800', fontSize: 13 },

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
