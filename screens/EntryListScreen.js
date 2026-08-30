// screens/EntryListScreen.js

const KILL_UI_AND_SHOW_RAW = false; // 필요 시 true로 전환(데이터 디버그용)

import React, {
  useState, useEffect, useRef, useMemo, useCallback, memo,
} from 'react';
import {
  AppState,
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  FlatList,
  Share,
  Modal,
  TouchableWithoutFeedback,
  Alert,
  Platform,
  PanResponder,
  Animated,
  Easing,
  InteractionManager,
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
  G,
  LinearGradient,
  Mask,
  Pattern,
  Stop,
  } from 'react-native-svg';
import Reanimated, {
  Easing as ReanimatedEasing,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import WidgetDonutCapture1x1 from '../components/WidgetDonutCapture1x1';
import { useFocusEffect } from '@react-navigation/native';
import {
 DASHBOARD_ROW_GAP_DEFAULT,
 getDashboardLayoutStateForChallenge,
 getDashboardRowGapForChallenge,
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
import { useFoldableLayoutState } from '../utils/foldableLayout';
import { buildResponsiveDashboardLayout } from '../utils/dashboardAutoLayout';
import { color as canonicalColor, radius } from '../styles/common';
import {
  GRAPH_RENDER_GRAPH_IDS,
  resolveGraphRenderRule,
  resolveGraphFamilyStandardRule,
 resolveGraphFamilyVariantStandardRule,
} from '../constants/graphRenderRules';


const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ReanimatedSvgPath = Reanimated.createAnimatedComponent(Path);
const ReanimatedSvgCircle = Reanimated.createAnimatedComponent(Circle);
const ReanimatedSvgRect = Reanimated.createAnimatedComponent(Rect);
const ReanimatedSvgText = Reanimated.createAnimatedComponent(SvgText);
const DASHBOARD_WIDGET_HEADER_HEIGHT = 28;
const DASHBOARD_WIDGET_HEADER_TOP_OFFSET = 0;
const DASHBOARD_WIDGET_HEADER_TITLE_TOP_ADJUST = -6;
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const CAL_HEADER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const ICON = require('../assets/icon.png');

const AdBannerPlaceholder = () => (
  <View style={{
    height: 50,
    backgroundColor: canonicalColor.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: canonicalColor.border,
  }}>
    <Text style={{ color: canonicalColor.textDisabled, fontSize: 12 }}>광고 영역</Text>
  </View>
);

const DashboardEditIcon = () => (
  <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
    <Rect x={2} y={2} width={28} height={28} rx={8} fill="#111" />
    <Path
      d="M11.9 20.4L12.55 17.3L19.65 10.2C20.16 9.69 20.98 9.69 21.49 10.2L21.8 10.51C22.31 11.02 22.31 11.84 21.8 12.35L14.7 19.45L11.9 20.4Z"
      stroke="#FFFFFF"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M18.7 11.3L20.7 13.3"
      stroke="#FFFFFF"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
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
const Donut = memo(function Donut({
  targetPercent = 0,
  progress = 1,
  size = 110,
  stroke = 12,
  labelFontSize = 20,
  graphId = GRAPH_RENDER_GRAPH_IDS.OVERALL_PROGRESS,
}) {
  const overallRenderRule = useMemo(
    () => resolveGraphFamilyStandardRule({ graphId }),
    [graphId]
  );
  const overallRenderColors = overallRenderRule.colors;
  const overallRenderLayout = overallRenderRule.layout;
  const effectiveStroke = Number(stroke) > 0 ? Number(stroke) : overallRenderLayout.baseStroke;
  const radius = (size - effectiveStroke) / 2;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedTarget = Math.max(0, Math.min(100, targetPercent));
  const k = Math.max(0, Math.min(1, progress));
  const display = isNaN(clampedTarget) ? 0 : Math.round(clampedTarget * k);
  const dash = (display / 100) * circumference;
  const innerRadius = Math.max(
    overallRenderLayout.minInnerRadius,
    radius - effectiveStroke * overallRenderLayout.innerRadiusFactor
  );
  const effectiveLabelFontSize = Number(labelFontSize) > 0
    ? Number(labelFontSize)
    : overallRenderLayout.labelBaseFontSize;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={radius} stroke={overallRenderColors.trackFill} strokeWidth={effectiveStroke} fill="none" />
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke={overallRenderColors.progressFill} strokeWidth={effectiveStroke} fill="none"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          rotation="-90" origin={`${cx}, ${cy}`}
        />
        <Circle cx={cx} cy={cy} r={innerRadius} fill={overallRenderColors.centerFill} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: effectiveLabelFontSize, lineHeight: effectiveLabelFontSize + overallRenderLayout.labelLineGap, fontWeight: '900', color: overallRenderColors.labelText, includeFontPadding: false }}>{display}%</Text>
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

const DashboardArrow = memo(function DashboardArrow({
  direction = 'left',
  size = 15,
  boxHeight = 20,
  disabled = false,
  style = null,
  color = '#111',
}) {
  const chevronSize = Math.max(9, (Number(size) || 15) * 0.86);
  const strokeWidth = Math.max(1.7, Math.min(2.7, chevronSize * 0.16));
  const isRight = direction === 'right';
  const pathD = isRight
    ? 'M8.5 5.5 L13 10 L8.5 14.5'
    : 'M11.5 5.5 L7 10 L11.5 14.5';

  return (
    <View
      style={[
        styles.dashboardArrowBox,
        {
          height: boxHeight,
        },
        style,
      ]}
      pointerEvents="none"
    >
      <Svg
        width={chevronSize}
        height={boxHeight}
        viewBox="0 0 20 20"
      >
        <Path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={disabled ? 0.3 : 1}
        />
      </Svg>
    </View>
  );
});

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

      <Text
 style={styles.dashboardWidgetHeaderTitle}
 numberOfLines={1}
 ellipsizeMode="tail"
>
 {title}
</Text>

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
  const CALENDAR_ARROW_BOX_H = 22;
  const CALENDAR_ARROW_SIZE = 16;

  return (
    <View style={styles.calendarHeaderGridRow}>
      <TouchableOpacity
        style={[styles.calendarHeaderGridEdgeCell, styles.calendarHeaderGridLeftCell]}
        onPress={canLeft ? onLeft : undefined}
        disabled={!canLeft}
        activeOpacity={0.7}
      >
        <DashboardArrow direction="left" size={CALENDAR_ARROW_SIZE} boxHeight={CALENDAR_ARROW_BOX_H} disabled={!canLeft} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.calendarHeaderGridEdgeCell, styles.calendarHeaderGridRightCell]}
        onPress={canRight ? onRight : undefined}
        disabled={!canRight}
        activeOpacity={0.7}
      >
        <DashboardArrow direction="right" size={CALENDAR_ARROW_SIZE} boxHeight={CALENDAR_ARROW_BOX_H} disabled={!canRight} />
      </TouchableOpacity>

      <View pointerEvents="none" style={styles.calendarHeaderGridTitleLayer}>
        <Text
 style={styles.dashboardWidgetHeaderTitle}
 numberOfLines={1}
 ellipsizeMode="tail"
>
 {title}
</Text>
      </View>
    </View>
  );
});


class HealthDashboardWidgetErrorBoundary extends React.PureComponent {
  constructor(props) { super(props); this.state = { hasError: false, message: '' }; }
  static getDerivedStateFromError(error) { return { hasError: true, message: error?.message ? String(error.message) : '카드 렌더링 오류' }; }
  componentDidCatch(error, info) { console.warn('[HealthWidgetError]', this.props?.widgetId || this.props?.title || 'unknown', error?.message || error, info?.componentStack || ''); }
  render() {
    if (this.state.hasError) {
      return React.createElement(DashboardWidgetShell, { header: React.createElement(DashboardWidgetHeader, { title: this.props?.title || 'Health 카드', hideSides: true }) },
        React.createElement(View, { style: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 10 } },
          React.createElement(Text, { numberOfLines: 1, style: { color: '#111111', fontSize: 12, fontWeight: '900', textAlign: 'center' } }, '카드 오류'),
          React.createElement(Text, { numberOfLines: 3, style: { marginTop: 5, color: '#9CA3AF', fontSize: 10, fontWeight: '700', textAlign: 'center' } }, '이 Health 그래프를 표시하지 못했습니다. 앱은 계속 사용할 수 있습니다.')
        )
      );
    }
    return this.props.children;
  }
}

const DashboardWidgetShell = memo(function DashboardWidgetShell({
  header,
  children,
  headerSlotStyle = null,
}) {
  return (
    <View style={styles.dashboardWidgetShell}>
      {header ? (
        <View style={[styles.dashboardWidgetHeaderSlot, headerSlotStyle]}>
          {header}
        </View>
      ) : null}
      <View style={styles.dashboardWidgetBodySlot}>
        {children}
      </View>
    </View>
  );
});


/* ───────── 건강 실제 걸음수 주간 리듬 (HealthSteps) ───────── */
const HEALTH_STEPS_WEEKLY_GOAL = 8000;
const HEALTH_STEPS_WEEKLY_LABELS = Object.freeze(['일', '월', '화', '수', '목', '금', '토']);

const formatStepCountCompact = (value) => {
 const numeric = Math.max(0, Math.round(Number(value) || 0));
 if (numeric >= 10000) {
  return `${(numeric / 10000).toFixed(numeric >= 100000 ? 0 : 1).replace(/\.0$/, '')}만`;
 }
 if (numeric >= 1000) {
  return `${Math.round(numeric / 1000)}천`;
 }
 return numeric.toLocaleString('ko-KR');
};

const HealthStepsWeeklyWidget = memo(function HealthStepsWeeklyWidget({
 entries = [],
 disabled = false,
 graphId = GRAPH_RENDER_GRAPH_IDS.HEALTH_STEPS_WEEKLY,
}) {
 const todayIndex = useMemo(() => new Date().getDay(), []);

 const healthWeeksData = useMemo(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - todayIndex);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const aggregated = aggregateHealthLinkedRecordsByDate(entries, 'steps');
  const stepMap = new Map();

  aggregated.forEach((item) => {
   stepMap.set(item.key, Number(item.value) || 0);
  });

  const dailyStats = HEALTH_STEPS_WEEKLY_LABELS.map((dayLabel, index) => {
   const date = new Date(weekStart);
   date.setDate(weekStart.getDate() + index);
   date.setHours(0, 0, 0, 0);

   const key = keyOf(date);
   const steps = stepMap.get(key) || 0;

   return {
    date: `${date.getMonth() + 1}/${date.getDate()}`,
    dayLabel,
    duration: steps,
    countTimed: steps > 0 ? 1 : 0,
    totalCount: 0,
    durations: steps > 0 ? [steps] : [],
    steps,
    isToday: index === todayIndex,
   };
  });

  return [{
   ws: weekStart,
   we: weekEnd,
   dailyStats,
  }];
 }, [entries, todayIndex]);

 const formatHealthStepPrimaryValue = useCallback((value) => {
  const numeric = Math.max(0, Math.round(Number(value) || 0));
  if (numeric <= 0) return ' ';
  return `${formatStepCountCompact(numeric)}보`;
 }, []);

 const formatHealthStepSecondaryValue = useCallback((stat) => {
  return stat?.isToday ? '오늘' : ' ';
 }, []);

 return (
  <WeekView
   weeksData={healthWeeksData}
   currentIndex={0}
   introProgress={1}
   onIndexChange={undefined}
   onPressDay={undefined}
   onTapBar={undefined}
   challengeStartDate={healthWeeksData[0]?.ws}
   challengeEndDate={healthWeeksData[0]?.we}
   graphId={graphId}
   title="걸음 리듬"
   goalValue={HEALTH_STEPS_WEEKLY_GOAL}
   goalLabel="8,000보"
   valueMode="steps"
   formatPrimaryValue={formatHealthStepPrimaryValue}
   formatSecondaryValue={formatHealthStepSecondaryValue}
  />
 );
});

/* ───────── 달력 ───────── */
const MonthCalendar = memo(function MonthCalendar({
  startDate, endDate, entriesByDaySet, onPrev, onNext, monthDate, canPrev, canNext, highlightDate = null, graphId = GRAPH_RENDER_GRAPH_IDS.MONTH_CALENDAR,
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

  const calendarRenderRule = useMemo(
    () => resolveGraphFamilyStandardRule({ graphId }),
    [graphId]
  );
  const calendarRenderColors = calendarRenderRule.colors;
  const calendarRenderLayout = calendarRenderRule.layout;

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const firstDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const calendarRows = Math.max(1, Math.ceil(cells.length / 7));

  const CALENDAR_BODY_BASE_HEIGHT = calendarRenderLayout.bodyBaseHeight;
  const calendarBodyHeight = Math.max(1, calendarBox.height || CALENDAR_BODY_BASE_HEIGHT);
  const CALENDAR_SCALE_RAW = calendarBodyHeight / CALENDAR_BODY_BASE_HEIGHT;
  const CALENDAR_SCALE = Math.max(0.75, Math.min(1.45, CALENDAR_SCALE_RAW));
  const scaleCal = (value, min, max) => {
    const scaled = value * CALENDAR_SCALE;
    return Math.max(min, Math.min(max, scaled));
  };

  const CAL_DOW_H = Math.round(scaleCal(calendarRenderLayout.dowHeight, 11, 20));
  const CAL_GRID_TOP_GAP = Math.round(scaleCal(calendarRenderLayout.gridTopGap, 2, 7));
  const CAL_BOTTOM_PAD = Math.round(scaleCal(calendarRenderLayout.bottomPad, 3, 8));
  const CAL_CELL_MARGIN_V = scaleCal(calendarRenderLayout.cellMarginV, 0.5, 2);

  const availableCalendarH = Math.max(
    1,
    calendarBodyHeight - CAL_DOW_H - CAL_GRID_TOP_GAP - CAL_BOTTOM_PAD
  );
  const calCellOuterH = Math.max(
    calendarRenderLayout.cellOuterMinHeight,
    Math.floor(availableCalendarH / calendarRows)
  );
  const calCellH = Math.max(
    calendarRenderLayout.cellHeightMin,
    calCellOuterH - CAL_CELL_MARGIN_V * 2
  );
  const calCellFontSize = Math.max(
    scaleCal(calendarRenderLayout.cellFontBase, calendarRenderLayout.cellFontMin, calendarRenderLayout.cellFontMax),
    Math.min(scaleCal(calendarRenderLayout.cellFontUpperBase, calendarRenderLayout.cellFontUpperMin, calendarRenderLayout.cellFontUpperMax), calCellH * 0.72)
  );
  const calBadgeFontSize = Math.max(
    scaleCal(calendarRenderLayout.badgeFontBase, calendarRenderLayout.badgeFontMin, calendarRenderLayout.badgeFontMax),
    Math.min(scaleCal(calendarRenderLayout.badgeFontUpperBase, calendarRenderLayout.badgeFontUpperMin, calendarRenderLayout.badgeFontUpperMax), calCellH * 0.68)
  );
  const calTodayFontSize = Math.min(
    scaleCal(calendarRenderLayout.todayFontBase || 12.2, 10.8, 11.8),
    calCellFontSize + scaleCal(0.6, 0.4, 0.6)
  );
  const calBadgeMinWidth = Math.max(
    scaleCal(calendarRenderLayout.badgeMinWidthBase, calendarRenderLayout.badgeMinWidthMin, calendarRenderLayout.badgeMinWidthMax),
    Math.min(scaleCal(calendarRenderLayout.badgeMinWidthUpperBase, calendarRenderLayout.badgeMinWidthUpperMin, calendarRenderLayout.badgeMinWidthUpperMax), calCellH * 1.02)
  );
  const calBadgePaddingV = calCellH <= scaleCal(12, 10, 16)
    ? 0
    : Math.round(scaleCal(calendarRenderLayout.badgePaddingVBase, calendarRenderLayout.badgePaddingVMin, calendarRenderLayout.badgePaddingVMax));

  const calCellDynamicStyle = {
    height: calCellH,
    marginVertical: CAL_CELL_MARGIN_V,
  };

  const calCellTextDynamicStyle = {
    fontSize: calCellFontSize,
    lineHeight: calCellFontSize + scaleCal(calendarRenderLayout.cellLineGap, 1.5, 4),
    includeFontPadding: false,
  };

  const calBadgeDynamicStyle = {
    minWidth: calBadgeMinWidth,
    paddingVertical: calBadgePaddingV,
    borderRadius: scaleCal(calendarRenderLayout.badgeRadius, 6, 12),
  };

  const calBadgeTextDynamicStyle = {
    fontSize: calBadgeFontSize,
    lineHeight: calBadgeFontSize + scaleCal(calendarRenderLayout.badgeLineGap, 1.5, 4),
    includeFontPadding: false,
  };

  const isCompactCalendar = CALENDAR_SCALE <= calendarRenderLayout.compactScaleThreshold;
  const compactCertBadgeHeight = Math.max(
    calBadgeFontSize + scaleCal(5.2, 4.6, 6.2),
    Math.min(calCellH - scaleCal(1.2, 0.8, 1.6), scaleCal(calendarRenderLayout.compactBadgeHeightBase || 18, 16, 20))
  );

  const compactCertBadgeAdjustStyle = isCompactCalendar
    ? {
        minWidth: calBadgeMinWidth + scaleCal(1.4, 1.2, 2.2),
        height: compactCertBadgeHeight,
        paddingVertical: 0,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ translateY: scaleCal(1.2, 0.8, 1.6) }],
      }
    : null;

  const compactCertBadgeTextCenterStyle = isCompactCalendar
    ? {
        lineHeight: compactCertBadgeHeight,
        textAlignVertical: 'center',
        transform: [{ translateY: scaleCal(calendarRenderLayout.compactBadgeTextTranslateY, 0.5, 1) }],
      }
    : null;

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
              {
                height: CAL_DOW_H,
                lineHeight: CAL_DOW_H,
                fontSize: scaleCal(calendarRenderLayout.dowFontSize, 9.5, 13),
                includeFontPadding: false,
              },
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
            let cellColor = calendarRenderColors.emptyDay;
            if (ranged) {
              if (isFuture) cellColor = calendarRenderColors.futureDay;
              else cellColor = calendarRenderColors.activeDateText;
            }

            if (cert || isToday) {
              const todayUncertifiedBadgeStyle = isToday && !cert
                ? {
                    backgroundColor: calendarRenderColors.todayFill,
                  }
                : null;

              const todayBadgeTextStyle = isToday
                ? {
                    color: cert ? calendarRenderColors.certifiedText : calendarRenderColors.todayText,
                    fontWeight: '900',
                    fontSize: calTodayFontSize,
                    lineHeight: calTodayFontSize + scaleCal(2, 1.5, 4),
                  }
                : null;

              return (
                <View key={`d${idx}`} style={[styles.calCell, calCellDynamicStyle]}>
                  <View style={[styles.calBadge, { backgroundColor: calendarRenderColors.certifiedFill }, calBadgeDynamicStyle, compactCertBadgeAdjustStyle, todayUncertifiedBadgeStyle, isHighlight && { borderWidth: calendarRenderLayout.highlightBorderWidth, borderColor: calendarRenderColors.highlightBorder }]}>
                    <Text style={[styles.calBadgeText, { color: calendarRenderColors.certifiedText }, calBadgeTextDynamicStyle, compactCertBadgeTextCenterStyle, todayBadgeTextStyle]}>{d.getDate()}</Text>
                  </View>
                </View>
              );
            }

            return (
              <View key={`d${idx}`} style={[styles.calCell, calCellDynamicStyle]}>
                <Text style={[styles.calCellText, calCellTextDynamicStyle, { color: cellColor }, isHighlight && { fontWeight: '900', textDecorationLine: 'underline', textDecorationColor: calendarRenderColors.highlightBorder }]}>
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


/* ───────── Health Connect linkedRecords 그래프 ───────── */
const HEALTH_LINKED_TREND_CONFIG = Object.freeze({
 steps: Object.freeze({ title: '걸음 수 추세', unit: '보' }),
 minutes: Object.freeze({ title: '운동 시간 추세', unit: '분' }),
 distance: Object.freeze({ title: '운동 거리 추세', unit: 'km' }),
 calories: Object.freeze({ title: '운동 칼로리', unit: 'kcal' }),
 sleepHours: Object.freeze({ title: '수면 시간 추세', unit: '시간' }),
 heartRate: Object.freeze({ title: '평균 심박 추세', unit: 'bpm' }),
 weight: Object.freeze({ title: '체중 추세', unit: 'kg' }),
 bodyFat: Object.freeze({ title: '체지방률 추세', unit: '%' }),
 bmi: Object.freeze({ title: 'BMI 추세', unit: 'BMI' }),
});

function getHealthLinkedRecordDateKey(entry) {
  var d = new Date(entry && entry.timestamp);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return keyOf(d);
}

function toHV(v) { var n=Number(v); return isFinite(n)?n:0; }

function getHealthLinkedRecordMetricValue(record, metricType) {
  if (!record || typeof record !== 'object') return 0;
  var t = String(record.metricType||'').toLowerCase();
  var u = String(record.unit||'').toLowerCase();
  var l = String(record.label||'').toLowerCase();
  if (metricType === 'steps') {
    if (t==='steps'||u==='steps'||u==='보'||l.includes('걸음')) return toHV(record.value);
    return 0;
  }
  if (metricType === 'minutes') {
    if (u==='minutes'||u==='분'||t==='duration'||t==='exercise'||l.includes('운동')||l.includes('걷기')||l.includes('달리기')) return toHV(record.value);
    if (u==='seconds'||u==='초') return toHV(record.value)/60;
    return 0;
  }
  if (metricType === 'distance') {
    if (record.distanceValue != null) {
      var du = String(record.distanceUnit||record.unit||'').toLowerCase();
      var d = toHV(record.distanceValue);
      return (du==='m'||du==='meter'||du==='meters') ? d/1000 : d;
    }
    if (u==='km'||t==='distance'||l.includes('거리')) return toHV(record.value);
    if (u==='m') return toHV(record.value)/1000;
    return 0;
  }
  if (metricType === 'calories') {
    if (t==='calories'||u==='kcal'||l.includes('칼로리')) return toHV(record.value);
    if (u==='cal'||u==='calories') return toHV(record.value)/1000;
    return 0;
  }
  if (metricType === 'sleepHours') {
    if (t==='sleephours'||t==='sleep'||u==='hours'||u==='시간'||l.includes('수면')) return toHV(record.value);
    return 0;
  }
  if (metricType === 'heartRate') {
    if (t==='heartrate'||u==='bpm'||l.includes('심박')) return toHV(record.value);
    return 0;
  }
  if (metricType === 'weight') {
    if (t==='weight'||u==='kg'||l.includes('체중')) return toHV(record.value);
    return 0;
  }
  if (metricType === 'bodyFat') {
    if (t==='bodyfat'||t==='body_fat'||t==='body fat'||u==='%'||l.includes('체지방')) return toHV(record.value);
    return 0;
  }
  if (metricType === 'bmi') {
    if (t==='bmi'||l.toLowerCase().includes('bmi')) return toHV(record.value);
    return 0;
  }
  return 0;
}

function aggregateHealthLinkedRecordsByDate(entries, metricType) {
  var map = {};
  var list = entries || [];
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    var dayKey = getHealthLinkedRecordDateKey(e);
    if (!dayKey) continue;
    var linked = Array.isArray(e && e.linkedRecords) ? e.linkedRecords : [];
    if (!linked.length) continue;
    var dayValue = 0;
    for (var j = 0; j < linked.length; j++) { dayValue += getHealthLinkedRecordMetricValue(linked[j], metricType); }
    if (dayValue <= 0) continue;
    var d = new Date(e.timestamp); d.setHours(0,0,0,0);
    var prev = map[dayKey] || { key: dayKey, date: d, value: 0 };
    prev.value += dayValue;
    map[dayKey] = prev;
  }
  return Object.values(map).sort(function(a,b){return a.date-b.date;});
}

function fmtHV(metricType, value) {
  var n = Number(value) || 0;
  if (metricType === 'steps') return Math.round(n).toLocaleString('ko-KR') + '보';
  if (metricType === 'minutes') return Math.round(n).toLocaleString('ko-KR') + '분';
  if (metricType === 'distance') return (n >= 10 ? n.toFixed(1) : n.toFixed(2)) + 'km';
  if (metricType === 'calories') return Math.round(n).toLocaleString('ko-KR') + 'kcal';
  if (metricType === 'sleepHours') return (n >= 10 ? n.toFixed(0) : n.toFixed(1)) + '시간';
  if (metricType === 'heartRate') return Math.round(n) + 'bpm';
  if (metricType === 'weight') return n.toFixed(1) + 'kg';
  if (metricType === 'bodyFat') return n.toFixed(1) + '%';
  if (metricType === 'bmi') return n.toFixed(1);
  return String(value ?? 0);
}


function getLatestSleepStageRecord(entries) {
  var records = [];
  (entries || []).forEach(function(entry) {
    (entry?.linkedRecords || []).forEach(function(record) {
      if (record?.metricType === 'sleepStage' && Array.isArray(record.stages) && record.stages.length) {
        records.push({ entry: entry, record: record, timestamp: new Date(entry?.timestamp || record?.startTime || 0).getTime() });
      }
    });
  });
  records.sort(function(a, b) { return a.timestamp - b.timestamp; });
  return records.length ? records[records.length - 1].record : null;
}

var HealthSleepRhythmWidget = memo(function HealthSleepRhythmWidget(_ref) {
 var entries = _ref.entries, disabled = _ref.disabled;
 var graphId = _ref.graphId || GRAPH_RENDER_GRAPH_IDS.HEALTH_SLEEP_RHYTHM;

 var stackedSegmentRenderRule = useMemo(function() {
 return resolveGraphFamilyVariantStandardRule({ graphId });
 }, [graphId]);
 var stackedSegmentColors = stackedSegmentRenderRule.colors;
 var stackedSegmentLayout = stackedSegmentRenderRule.layout;

 var latest = useMemo(function() { return getLatestSleepStageRecord(entries); }, [entries]);
 var stages = Array.isArray(latest?.stages) ? latest.stages : [];
 var total = stages.reduce(function(sum, stage) { return sum + (Number(stage?.value) || 0); }, 0);

 var getSegmentColor = useCallback(function(label) {
 if (label === '깸' || label === '이탈') return stackedSegmentColors.segmentMuted;
 if (label === '얕은') return stackedSegmentColors.segmentTertiary;
 if (label === 'REM') return stackedSegmentColors.segmentSecondary;
 return stackedSegmentColors.segmentPrimary;
 }, [stackedSegmentColors]);

 return (
 React.createElement(DashboardWidgetShell, { header: React.createElement(DashboardWidgetHeader, { title: '수면 리듬', hideSides: true }) },
 React.createElement(View, {
 style: {
 flex: 1,
 width: '100%',
 paddingHorizontal: 10,
 paddingTop: 8,
 paddingBottom: 8,
 opacity: disabled ? 0.92 : 1,
 justifyContent: 'center'
 }
 },
 !stages.length ?
 React.createElement(View, {
 style: {
 flex: 1,
 alignItems: 'center',
 justifyContent: 'center',
 paddingHorizontal: 8
 }
 },
 React.createElement(Text, {
 numberOfLines: 2,
 style: {
 color: stackedSegmentColors.emptyText,
 fontSize: stackedSegmentLayout.captionFontSize,
 lineHeight: stackedSegmentLayout.captionFontSize + 4,
 fontWeight: '700',
 textAlign: 'center'
 }
 }, '수면 단계 데이터가 없습니다.'),
 React.createElement(Text, {
 numberOfLines: 2,
 style: {
 marginTop: 4,
 color: stackedSegmentColors.captionText,
 fontSize: stackedSegmentLayout.legendFontSize,
 lineHeight: stackedSegmentLayout.legendFontSize + 5,
 fontWeight: '700',
 textAlign: 'center'
 }
 }, 'Health Connect 수면 데이터로 인증하면 표시됩니다.')
 )
 :
 React.createElement(React.Fragment, null,
 React.createElement(View, {
 style: {
 flexDirection: 'row',
 height: stackedSegmentLayout.segmentHeight,
 borderRadius: stackedSegmentLayout.segmentRadius,
 overflow: 'hidden',
 backgroundColor: stackedSegmentColors.trackFill
 }
 },
 stages.map(function(stage, index) {
 var value = Number(stage?.value) || 0;
 var flexV = total > 0 ? Math.max(0.2, value / total) : 1;
 var label = getSleepStageLabel(stage?.stageType);
 return React.createElement(View, {
 key: String(index),
 style: {
 flex: flexV,
 backgroundColor: getSegmentColor(label)
 }
 });
 })
 ),
 React.createElement(View, {
 style: {
 marginTop: stackedSegmentLayout.labelGap,
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between'
 }
 },
 React.createElement(Text, {
 numberOfLines: 1,
 style: {
 color: stackedSegmentColors.captionText,
 fontSize: stackedSegmentLayout.captionFontSize,
 fontWeight: '700'
 }
 }, '최근 수면'),
 React.createElement(Text, {
 numberOfLines: 1,
 style: {
 color: stackedSegmentColors.valueText,
 fontSize: stackedSegmentLayout.valueFontSize,
 fontWeight: '900'
 }
 }, fmtHV('sleepHours', latest?.value || total))
 ),
 React.createElement(View, {
 style: {
 marginTop: stackedSegmentLayout.legendGap,
 flexDirection: 'row',
 flexWrap: 'wrap'
 }
 },
 stages.slice(0, 4).map(function(stage, index) {
 var label = getSleepStageLabel(stage?.stageType);
 return React.createElement(Text, {
 key: String(index),
 numberOfLines: 1,
 style: {
 marginRight: 8,
 marginBottom: 3,
 color: getSegmentColor(label),
 fontSize: stackedSegmentLayout.legendFontSize,
 fontWeight: '700'
 }
 }, label + ' ' + fmtHV('sleepHours', stage?.value));})
 )
 )
 ))
 );
});


const formatLineAxisDate = (value) => {
  const d = value instanceof Date ? new Date(value) : new Date(value);
  if (isNaN(d.getTime())) return '';
  d.setHours(0, 0, 0, 0);
  return (
   String(d.getFullYear()).slice(2) +
   '-' +
   pad2(d.getMonth() + 1) +
   '-' +
   pad2(d.getDate())
  );
};

var HealthLinkedRecordsLineWidget = memo(function HealthLinkedRecordsLineWidget(_ref) {
 var entries = _ref.entries;
 var metricType = _ref.metricType;
 var startDate = _ref.startDate;
 var disabled = _ref.disabled;
 var graphId = _ref.graphId || GRAPH_RENDER_GRAPH_IDS.HEALTH_STEPS_TREND;

 var config = HEALTH_LINKED_TREND_CONFIG[metricType] || {};
 var displayTitle = config.title || '건강 데이터 추세';

 var series = useMemo(function() {
 return aggregateHealthLinkedRecordsByDate(entries, metricType).map(function(item) {
 return {
 d: item.date,
 v: Number(item.value) || 0,
 key: item.key
 };
 });
 }, [entries, metricType]);

 var today = new Date();
 today.setHours(0, 0, 0, 0);

 var chartStartDate = startDate
 ? new Date(startDate)
 : (series.length ? new Date(series[0].d) : new Date(today));

 if (isNaN(chartStartDate.getTime())) {
 chartStartDate = new Date(today);
 }

 chartStartDate.setHours(0, 0, 0, 0);

 var healthAxisStartLabel = formatLineAxisDate(chartStartDate);
 var healthAxisEndLabel = 'Today ' + formatLineAxisDate(today);

 var formatHealthLineLabel = useCallback(function(payload) {
 var value = payload?.value ?? 0;
 var d = payload?.date ? new Date(payload.date) : new Date();

 return (
 fmtHV(metricType, value) +
 ' ' +
 formatLineAxisDate(d)
 );
 }, [metricType]);

 return React.createElement(LineFamilyCard, {
 title: displayTitle,
 startDate: chartStartDate,
 rangeEndDate: today,
 entries: [],
 metric: 'health-' + String(metricType || 'value'),
 graphId: graphId,
 seriesOverride: series,
 labelFormatter: formatHealthLineLabel,
 axisStartLabel: healthAxisStartLabel,
 axisEndLabel: healthAxisEndLabel,
 isEmpty: series.length === 0,
 emptyText: '데이터 없음',
 disabled: disabled,
 introProgress: 1,
 interactive: !disabled,
 pagerIndex: 0,
 onSelectPagerIndex: function() {},
 showPager: false
 });
});

/* ───────── 라인차트(횟수는 누적 그래프) ───────── */
const LineGradientChart = memo(function LineGradientChart({
  startDate,
  rangeEndDate=null,
  entries,
  metric='count',
  width=SCREEN_WIDTH - EDGE*2 - GRAPH_SIDE_PAD*2 - 8,
  height=185,
  introProgress=1,
  lineIntroRunId=null,
  lineIntroPhase=null,
  interactive=true,
  pagerIndex=0,
  onSelectPagerIndex=()=>{},
  showPager=true,
  plotInset=12,
  edgePointInset=null,
  plotTopInset=16,
  plotBottomInset=42,
  scaleLayout=false,
  layoutBaseHeight=185,
  graphId=null,
  seriesOverride=null,
  labelFormatter=null,
  axisStartLabel=undefined,
  axisEndLabel=undefined,
}){
  const lineBaseHeight = Math.max(1, Number(layoutBaseHeight) || 185);
  const lineScaleRaw = (Math.max(1, Number(height) || 185)) / lineBaseHeight;
  const LINE_SCALE = scaleLayout ? Math.max(0.75, Math.min(1.45, lineScaleRaw)) : 1;
  const scaleLine = (value, min, max) => {
    const scaled = value * LINE_SCALE;
    return Math.max(min, Math.min(max, scaled));
  };

  const resolvedLineGraphId = graphId || (
    metric === 'minutes'
      ? GRAPH_RENDER_GRAPH_IDS.LINE_MINUTES
      : GRAPH_RENDER_GRAPH_IDS.LINE_COUNT_CUMULATIVE
  );
  const lineRenderRule = useMemo(
    () => resolveGraphFamilyStandardRule({ graphId: resolvedLineGraphId }),
    [resolvedLineGraphId]
  );
  const lineRenderColors = lineRenderRule.colors;
  const lineRenderLayout = lineRenderRule.layout;

  const axisInset = Math.max(0, Number(plotInset) || 0);

  const EDGE_DEFAULT_MARKER_R = scaleLine(lineRenderLayout.markerRadius, 2.6, 4.8);
  const EDGE_DEFAULT_MARKER_STROKE_W = scaleLine(lineRenderLayout.markerStrokeWidth, 1.6, 3);
  const SELECTED_MARKER_R = scaleLine(lineRenderLayout.selectedMarkerRadius, 3, 5.4);
  const SELECTED_MARKER_STROKE_W = scaleLine(lineRenderLayout.selectedMarkerStrokeWidth, 1.7, 3.2);
  const LINE_STROKE_W = scaleLine(lineRenderLayout.strokeWidth, 1.2, 2.4);
  const LINE_AXIS_STROKE_W = scaleLine(lineRenderLayout.axisStrokeWidth, 0.8, 1.5);
  const LINE_AREA_GAP = scaleLine(lineRenderLayout.areaGap, 4, 10);

  const LINE_AXIS_LABEL_FONT_SIZE = scaleLine(lineRenderLayout.axisLabelFontSize, 8, 10.8);
  const LINE_AXIS_LABEL_Y_OFFSET = scaleLine(lineRenderLayout.axisLabelYOffset, 12, 22);

  const LINE_LABEL_FONT_SIZE = scaleLine(lineRenderLayout.tooltipFontSize, 8, 10.8);
  const LINE_LABEL_H = Math.round(scaleLine(lineRenderLayout.tooltipHeight, 15, 20));
  const LINE_LABEL_RX = scaleLine(lineRenderLayout.tooltipRadius, 4, 8);
  const LINE_LABEL_BOTTOM_PAD = scaleLine(lineRenderLayout.tooltipBottomPad, 5, 8);

  const LINE_LABEL_CHAR_W = scaleLine(lineRenderLayout.tooltipCharWidth, 4.6, 7.2);
  const LINE_LABEL_W_PAD = scaleLine(lineRenderLayout.tooltipWidthPad, 8, 16);
  const LINE_LABEL_MIN_W = scaleLine(lineRenderLayout.tooltipMinWidth, 58, 96);
  const LINE_LABEL_MAX_W = scaleLine(lineRenderLayout.tooltipMaxWidth, 110, 170);
  const LINE_LABEL_GAP = Math.round(scaleLine(lineRenderLayout.tooltipGap, 4, 12));
  const LINE_LABEL_END_GAP = Math.round(scaleLine(lineRenderLayout.tooltipEndGap, 4, 14));

  const LINE_PAGER_DOT_R = scaleLine(lineRenderLayout.pagerDotRadius, 3, 6);
  const LINE_PAGER_DOT_Y_OFFSET = scaleLine(lineRenderLayout.pagerDotYOffset, 10, 22);
  const LINE_PAGER_DOT_X_GAP = scaleLine(lineRenderLayout.pagerDotXGap, 8, 16);
  const LINE_TOUCH_RADIUS = scaleLine(lineRenderLayout.touchRadius, 12, 22);

  const autoPointSafeInset = EDGE_DEFAULT_MARKER_R + EDGE_DEFAULT_MARKER_STROKE_W / 2;
  const pointSafeInset = Math.max(
    0,
    Number(edgePointInset ?? (axisInset === 0 ? autoPointSafeInset : axisInset)) || 0
  );
  const rawTopInset = Math.max(0, Number(plotTopInset) || 0);
  const rawBottomInset = Math.max(0, Number(plotBottomInset) || 0);
  const top = scaleLayout ? Math.round(scaleLine(rawTopInset, 6, 24)) : rawTopInset;
  const bottom = scaleLayout ? Math.round(scaleLine(rawBottomInset, 22, 54)) : rawBottomInset;
  const left = axisInset, right = axisInset;
  const cw = Math.max(1, width - left - right);
  const ch = Math.max(1, height - top - bottom);
  const introBaselineY = top + ch + 0.5;
  const usesSharedLineIntro = Number.isFinite(lineIntroRunId) && (
    lineIntroPhase === 'pending' ||
    lineIntroPhase === 'animate' ||
    lineIntroPhase === 'complete'
  );
  const lineIntroProgress = useSharedValue(
    usesSharedLineIntro && lineIntroPhase !== 'complete' ? 0 : 1,
  );

  useEffect(() => {
    if (!usesSharedLineIntro) {
      lineIntroProgress.value = 1;
      return;
    }

    if (lineIntroPhase === 'animate') {
      lineIntroProgress.value = 0;
      lineIntroProgress.value = withTiming(1, {
        duration: 900,
        easing: ReanimatedEasing.inOut(ReanimatedEasing.cubic),
      });
      return;
    }

    lineIntroProgress.value = lineIntroPhase === 'complete' ? 1 : 0;
  }, [lineIntroPhase, lineIntroProgress, lineIntroRunId, usesSharedLineIntro]);

  const today = useMemo(()=>{ const t=new Date(); t.setHours(0,0,0,0); return t; },[]);
  const raw = useMemo(()=>aggregateByDate(entries),[entries]);

  const normalizedSeriesOverride = useMemo(() => {
    if (!Array.isArray(seriesOverride)) return null;
    return seriesOverride
      .map((item) => {
        const rawDate = item?.d || item?.date || item?.timestamp;
        const d = new Date(rawDate);
        if (isNaN(d.getTime())) return null;
        d.setHours(0, 0, 0, 0);
        const rawValue = item?.v ?? item?.value ?? 0;
        return { d, v: Number(rawValue) || 0 };
      })
      .filter(Boolean)
      .sort((a, b) => a.d - b.d);
  }, [seriesOverride]);

  const hasSeriesOverride = Array.isArray(normalizedSeriesOverride);

  const series = useMemo(()=>{
    if (hasSeriesOverride) return normalizedSeriesOverride;

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
  }, [hasSeriesOverride, normalizedSeriesOverride, raw, metric, startDate, today]);

  const start = useMemo(()=>startDate? new Date(new Date(startDate).setHours(0,0,0,0)) : (series[0]?.d || today), [startDate, series, today]);
  const end = useMemo(() => {
    const fallbackToday = new Date(today);
    fallbackToday.setHours(0, 0, 0, 0);

    if (!rangeEndDate) {
      return fallbackToday;
    }

    const d = new Date(rangeEndDate);

    if (isNaN(d.getTime())) {
      return fallbackToday;
    }

    d.setHours(0, 0, 0, 0);

    return d;
  }, [rangeEndDate, today]);

  const resolvedAxisStartLabel = useMemo(() => {
    if (axisStartLabel !== undefined && axisStartLabel !== null) {
      return String(axisStartLabel);
    }
    const d = new Date(start);
    if (isNaN(d.getTime())) return '';
    return (
     String(d.getFullYear()).slice(2) +
     '-' +
     pad2(d.getMonth() + 1) +
     '-' +
     pad2(d.getDate())
    );
  }, [axisStartLabel, start]);

  const resolvedAxisEndLabel = useMemo(() => {
    if (axisEndLabel !== undefined && axisEndLabel !== null) {
      return String(axisEndLabel);
    }
    const d = new Date(today);
    if (isNaN(d.getTime())) return '';
    return (
     'Today ' +
     String(d.getFullYear()).slice(2) +
     '-' +
     pad2(d.getMonth() + 1) +
     '-' +
     pad2(d.getDate())
    );
  }, [axisEndLabel, today]);

  const finalNodePts = useMemo(()=>{
    const n = series.length;
    if (n===0) return [];
    const BOTTOM_PADDING_RATIO = 0.15;
    const usableCh = ch * (1 - BOTTOM_PADDING_RATIO);

    // 기간 계산: 전체 기간은 도전 시작일~오늘 (데이터 유무와 관계없이 고정)
    const firstDate = start;
    const lastDate = end;
    const totalDays = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));

    if (n===1) {
      const dayDiff = (series[0].d - firstDate) / (1000 * 60 * 60 * 24);
      const xRatio = clamp(totalDays > 0 ? dayDiff / totalDays : 0, 0, 1);
      const x = left + xRatio * cw;
      const vmax = Math.max(1, series[0].v);
      const yMax = metric === 'count' ? Math.max(2, vmax + 1) : Math.max(10, vmax * 1.25);
      const yRatio = clamp(series[0].v / yMax, 0, 1);
      const finalY = top + (1 - yRatio) * usableCh;
      return [{ x, y: finalY, v: series[0].v, d: series[0].d, sourceIdx: 0 }];
    }
    const vmax = Math.max(1, ...series.map(p=>p.v));
    const yMax = metric === 'count' ? Math.max(2, vmax + 1) : Math.max(10, vmax * 1.25);
    return series.map((p, idx)=>{
      const dayDiff = (p.d - firstDate) / (1000 * 60 * 60 * 24);
      const xRatio = clamp(totalDays > 0 ? dayDiff / totalDays : 0, 0, 1);
      const x = left + xRatio * cw;
      const yRatio = clamp(p.v / yMax, 0, 1);
      const finalY = top + (1 - yRatio) * usableCh;
      return { x, y: finalY, v: p.v, d: p.d, sourceIdx: idx };
    });
  }, [series, start, end, left, cw, top, ch, metric]);

const finalSafeNodePts = useMemo(() => {
 if (!Array.isArray(finalNodePts) || finalNodePts.length === 0) return [];

 const minX = pointSafeInset;
 const maxX = width - pointSafeInset;

 const interpolateYOnSegment = (a, b, targetX, fallbackY) => {
   if (!a || !b) return fallbackY;
   const dx = b.x - a.x;
   if (Math.abs(dx) < 0.001) return fallbackY;
   const t = Math.max(0, Math.min(1, (targetX - a.x) / dx));
   return a.y + (b.y - a.y) * t;
 };

 return finalNodePts.map((point, index) => {
   const safeX = Math.min(Math.max(point.x, minX), maxX);

   if (Math.abs(safeX - point.x) < 0.001) {
     return point;
   }

   const prev = finalNodePts[index - 1] || null;
   const next = finalNodePts[index + 1] || null;

   const yOnLine = safeX < point.x
     ? interpolateYOnSegment(prev, point, safeX, point.y)
     : interpolateYOnSegment(point, next, safeX, point.y);

   return {
     ...point,
     x: safeX,
     y: yOnLine,
   };
 });
}, [finalNodePts, pointSafeInset, width]);

  const animatePointY = useCallback((point) => ({
    ...point,
    y: introBaselineY - (introBaselineY - point.y) * introProgress,
  }), [introBaselineY, introProgress]);

  const nodePts = useMemo(
    () => finalNodePts.map(animatePointY),
    [finalNodePts, animatePointY],
  );

  const safeNodePts = useMemo(
    () => finalSafeNodePts.map(animatePointY),
    [finalSafeNodePts, animatePointY],
  );

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
      const y = nodePts[0]?.y ?? introBaselineY;
      const xleft = left;
      return [
        {x:xleft-0.001, y, v:series[0].v, d:series[0].d, sourceIdx: 0},
        {x:xleft+0.001, y, v:series[0].v, d:series[0].d, sourceIdx: 0}
      ];
    }
    return nodePts;
  }, [series, left, nodePts, introBaselineY]);

  const linePts = useMemo(() => {
    return safeNodePts.length >= 2 ? safeNodePts : pts;
  }, [safeNodePts, pts]);

  const pathD = useMemo(()=>{
    if(!linePts.length) return '';
    let d = `M ${linePts[0].x} ${linePts[0].y}`;
    for(let i=1;i<linePts.length;i++) d += ` L ${linePts[i].x} ${linePts[i].y}`;
    return d;
  }, [linePts]);

  const baselineY = top + ch + 0.5;
  const areaGap = LINE_AREA_GAP;
  const areaD = useMemo(()=>{
    if(!pts.length) return '';
    const bottomY = baselineY - areaGap;
    let d = `M ${pts[0].x} ${bottomY} L ${pts[0].x} ${pts[0].y}`;
    for(let i=1;i<pts.length;i++) d += ` L ${pts[i].x} ${pts[i].y}`;
    d += ` L ${pts[pts.length-1].x} ${bottomY} Z`;
    return d;
  }, [pts, baselineY]);

  const linePathCoordinates = useMemo(
    () => linePts.map((point) => ({ x: point.x, y: point.y })),
    [linePts],
  );
  const areaPathCoordinates = useMemo(
    () => pts.map((point) => ({ x: point.x, y: point.y })),
    [pts],
  );

  const animatedLinePathProps = useAnimatedProps(() => {
    if (!usesSharedLineIntro || linePathCoordinates.length === 0) return { d: '' };
    const progress = lineIntroProgress.value;
    const first = linePathCoordinates[0];
    const firstY = introBaselineY - (introBaselineY - first.y) * progress;
    let d = `M ${first.x} ${firstY}`;
    for (let index = 1; index < linePathCoordinates.length; index += 1) {
      const point = linePathCoordinates[index];
      const y = introBaselineY - (introBaselineY - point.y) * progress;
      d += ` L ${point.x} ${y}`;
    }
    return { d };
  }, [introBaselineY, linePathCoordinates, usesSharedLineIntro]);

  const animatedAreaPathProps = useAnimatedProps(() => {
    if (!usesSharedLineIntro || areaPathCoordinates.length === 0) return { d: '' };
    const progress = lineIntroProgress.value;
    const bottomY = baselineY - areaGap;
    const first = areaPathCoordinates[0];
    const firstY = introBaselineY - (introBaselineY - first.y) * progress;
    let d = `M ${first.x} ${bottomY} L ${first.x} ${firstY}`;
    for (let index = 1; index < areaPathCoordinates.length; index += 1) {
      const point = areaPathCoordinates[index];
      const y = introBaselineY - (introBaselineY - point.y) * progress;
      d += ` L ${point.x} ${y}`;
    }
    d += ` L ${areaPathCoordinates[areaPathCoordinates.length - 1].x} ${bottomY} Z`;
    return { d };
  }, [areaGap, areaPathCoordinates, baselineY, introBaselineY, usesSharedLineIntro]);

  const formatLineLabel = useCallback((point, index) => {
    if (!point) return null;
    if (typeof labelFormatter === 'function') {
      return labelFormatter({
        value: point.v,
        date: point.d,
        point,
        metric,
        index,
      });
    }
    const v = point.v;
    const d = point.d;
    return `${metric==='count'? `${v}회(누적)` : `${v}분`} ${String(d.getFullYear()).slice(2)}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }, [labelFormatter, metric]);

  const defaultLabel = useMemo(()=>{
    if(series.length===0) return null;
    const base = series[series.length-1];
    return formatLineLabel(base, series.length - 1);
  }, [series, formatLineLabel]);

  const [selectedIdx, setSelectedIdx] = useState(null);
  useEffect(()=>{ setSelectedIdx(null); }, [entries, metric, seriesOverride]);

  const labelDims = (txt='')=>{
    const w = Math.max(
      LINE_LABEL_MIN_W,
      Math.min(LINE_LABEL_MAX_W, LINE_LABEL_W_PAD + txt.length * LINE_LABEL_CHAR_W)
    );
    return { w, h: LINE_LABEL_H };
  };

  const placeLabel = (p, text, isEnd=false)=>{
    const { w, h } = labelDims(text);
    const vGap = isEnd ? LINE_LABEL_END_GAP : LINE_LABEL_GAP;
    const above = p.y - h - vGap;
    const below = p.y + vGap;

    let ly;
    if (above >= top + 4)           ly = above;
    else if (below <= baselineY-16) ly = below;
    else                            ly = Math.min(Math.max(above, top+4), baselineY - h - 4);

    const lx = Math.min(Math.max(p.x - w/2, left + 4), left + cw - w - 4);
    return { lx, ly, w, h };
  };

  const dotCy = baselineY + LINE_PAGER_DOT_Y_OFFSET;
  const dotCx1 = left + cw/2 - LINE_PAGER_DOT_X_GAP;
  const dotCx2 = left + cw/2 + LINE_PAGER_DOT_X_GAP;


 const shouldCaptureTouch = useCallback((evt) => {
  if (!interactive) return false;
  const { locationX: x, locationY: y } = evt.nativeEvent;
  const nearX = (cx, r = LINE_TOUCH_RADIUS) => Math.abs(x - cx) <= r;

  // 페이저 점(●●) 터치 캡처 - Y 범위도 체크
  if (showPager && y >= dotCy - LINE_TOUCH_RADIUS && y <= dotCy + LINE_TOUCH_RADIUS) {
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
    const nearX = (cx, r = LINE_TOUCH_RADIUS) => Math.abs(x - cx) <= r;

    // 페이저 점 터치 - Y 범위 체크
    if (showPager && y >= dotCy - LINE_TOUCH_RADIUS && y <= dotCy + LINE_TOUCH_RADIUS) {
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
    return formatLineLabel(series[selectedIdx], selectedIdx);
  }, [selectedIdx, series, formatLineLabel]);

  const selPoint = useMemo(()=>{
    if (selectedIdx==null) return null;
    return safeNodePts[selectedIdx] || null;
  }, [selectedIdx, safeNodePts]);

  const safeEndNode = safeNodePts[safeNodePts.length-1] || null;

  const selectedPointX = selPoint?.x ?? 0;
  const selectedPointFinalY = selPoint?.y ?? introBaselineY;
  const endPointX = safeEndNode?.x ?? 0;
  const endPointFinalY = safeEndNode?.y ?? introBaselineY;

  const selectedLabelSize = labelDims(selectedLabel || '');
  const selectedLabelX = Math.min(
    Math.max(selectedPointX - selectedLabelSize.w / 2, left + 4),
    left + cw - selectedLabelSize.w - 4,
  );
  const selectedLabelIsEnd = selectedIdx === series.length - 1;
  const defaultLabelSize = labelDims(defaultLabel || '');
  const defaultLabelX = Math.min(
    Math.max(endPointX - defaultLabelSize.w / 2, left + 4),
    left + cw - defaultLabelSize.w - 4,
  );

  const animatedSelectedPointProps = useAnimatedProps(() => ({
    cy: introBaselineY - (introBaselineY - selectedPointFinalY) * lineIntroProgress.value,
  }), [introBaselineY, selectedPointFinalY]);
  const animatedEndPointProps = useAnimatedProps(() => ({
    cy: introBaselineY - (introBaselineY - endPointFinalY) * lineIntroProgress.value,
  }), [endPointFinalY, introBaselineY]);

  const animatedSelectedLabelY = useDerivedValue(() => {
    const pointY = introBaselineY - (
      introBaselineY - selectedPointFinalY
    ) * lineIntroProgress.value;
    const gap = selectedLabelIsEnd ? LINE_LABEL_END_GAP : LINE_LABEL_GAP;
    const above = pointY - selectedLabelSize.h - gap;
    const below = pointY + gap;
    if (above >= top + 4) return above;
    if (below <= baselineY - 16) return below;
    return Math.min(
      Math.max(above, top + 4),
      baselineY - selectedLabelSize.h - 4,
    );
  }, [
    baselineY,
    introBaselineY,
    selectedLabelIsEnd,
    selectedLabelSize.h,
    selectedPointFinalY,
    top,
  ]);

  const animatedDefaultLabelY = useDerivedValue(() => {
    const pointY = introBaselineY - (
      introBaselineY - endPointFinalY
    ) * lineIntroProgress.value;
    const above = pointY - defaultLabelSize.h - LINE_LABEL_END_GAP;
    const below = pointY + LINE_LABEL_END_GAP;
    if (above >= top + 4) return above;
    if (below <= baselineY - 16) return below;
    return Math.min(
      Math.max(above, top + 4),
      baselineY - defaultLabelSize.h - 4,
    );
  }, [
    baselineY,
    defaultLabelSize.h,
    endPointFinalY,
    introBaselineY,
    top,
  ]);

  const animatedSelectedRectProps = useAnimatedProps(() => ({
    y: animatedSelectedLabelY.value,
  }));
  const animatedSelectedTextProps = useAnimatedProps(() => ({
    y: animatedSelectedLabelY.value + selectedLabelSize.h - 6,
  }), [selectedLabelSize.h]);
  const animatedDefaultRectProps = useAnimatedProps(() => ({
    y: animatedDefaultLabelY.value,
  }));
  const animatedDefaultTextProps = useAnimatedProps(() => ({
    y: animatedDefaultLabelY.value + defaultLabelSize.h - 6,
  }), [defaultLabelSize.h]);

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
            <Stop offset="0%" stopColor={lineRenderColors.axisStroke} stopOpacity="0.85"/>
            <Stop offset="100%" stopColor={lineRenderColors.axisStroke} stopOpacity="0"/>
          </LinearGradient>
        </Defs>

        {!!pts.length && (usesSharedLineIntro ? (
          <ReanimatedSvgPath animatedProps={animatedAreaPathProps} fill={`url(#grad-${metric})`} />
        ) : (
          <Path d={areaD} fill={`url(#grad-${metric})`} />
        ))}
        {!!pts.length && (usesSharedLineIntro ? (
          <ReanimatedSvgPath animatedProps={animatedLinePathProps} fill="none" stroke={lineRenderColors.lineStroke} strokeWidth={LINE_STROKE_W} />
        ) : (
          <Path d={pathD} fill="none" stroke={lineRenderColors.lineStroke} strokeWidth={LINE_STROKE_W} />
        ))}

        {/* X축 */}
        <Line x1={left} y1={top + ch + 0.5} x2={left+cw} y2={top + ch + 0.5} stroke={lineRenderColors.axisStroke} strokeWidth={LINE_AXIS_STROKE_W} />

        {/* 좌/우 축 정보 슬롯 */}
        {resolvedAxisStartLabel ? (
         <SvgText
          x={left + 4}
          y={top + ch + LINE_AXIS_LABEL_Y_OFFSET}
          fill={lineRenderColors.labelText}
          fontSize={LINE_AXIS_LABEL_FONT_SIZE}
          fontWeight="700"
          textAnchor="start"
         >
          {resolvedAxisStartLabel}
         </SvgText>
        ) : null}

        {resolvedAxisEndLabel ? (
         <SvgText
          x={left + cw - 4}
          y={top + ch + LINE_AXIS_LABEL_Y_OFFSET}
          fill={lineRenderColors.labelText}
          fontSize={LINE_AXIS_LABEL_FONT_SIZE}
          fontWeight="700"
          textAnchor="end"
         >
          {resolvedAxisEndLabel}
         </SvgText>
        ) : null}

        {/* 마커/라벨 */}
        {!selPoint && safeEndNode && (usesSharedLineIntro ? (
          <ReanimatedSvgCircle cx={endPointX} animatedProps={animatedEndPointProps} r={EDGE_DEFAULT_MARKER_R} fill={lineRenderColors.markerFill} stroke={lineRenderColors.markerStroke} strokeWidth={EDGE_DEFAULT_MARKER_STROKE_W}/>
        ) : (
          <Circle cx={safeEndNode.x} cy={safeEndNode.y} r={EDGE_DEFAULT_MARKER_R} fill={lineRenderColors.markerFill} stroke={lineRenderColors.markerStroke} strokeWidth={EDGE_DEFAULT_MARKER_STROKE_W}/>
        ))}
        {selPoint && (usesSharedLineIntro ? (
          <ReanimatedSvgCircle cx={selectedPointX} animatedProps={animatedSelectedPointProps} r={SELECTED_MARKER_R} fill={lineRenderColors.markerFill} stroke={lineRenderColors.markerStroke} strokeWidth={SELECTED_MARKER_STROKE_W}/>
        ) : (
          <Circle cx={selPoint.x} cy={selPoint.y} r={SELECTED_MARKER_R} fill={lineRenderColors.markerFill} stroke={lineRenderColors.markerStroke} strokeWidth={SELECTED_MARKER_STROKE_W}/>
        ))}
        {selPoint && selectedLabel && (usesSharedLineIntro ? (
          <>
            <ReanimatedSvgRect
              x={selectedLabelX}
              animatedProps={animatedSelectedRectProps}
              width={selectedLabelSize.w}
              height={selectedLabelSize.h}
              rx={LINE_LABEL_RX}
              fill={lineRenderColors.tooltipFill}
            />
            <ReanimatedSvgText
              x={selectedLabelX + selectedLabelSize.w / 2}
              animatedProps={animatedSelectedTextProps}
              fill={lineRenderColors.tooltipText}
              fontSize={LINE_LABEL_FONT_SIZE}
              fontWeight="700"
              textAnchor="middle"
            >
              {selectedLabel}
            </ReanimatedSvgText>
          </>
        ) : (() => {
          const pos = placeLabel(selPoint, selectedLabel, selectedIdx === series.length - 1);
          return (
            <>
              <Rect x={pos.lx} y={pos.ly} width={pos.w} height={pos.h} rx={LINE_LABEL_RX} fill={lineRenderColors.tooltipFill}/>
              <SvgText x={pos.lx + pos.w/2} y={pos.ly + pos.h - 6} fill={lineRenderColors.tooltipText} fontSize={LINE_LABEL_FONT_SIZE} fontWeight="700" textAnchor="middle">
                {selectedLabel}
              </SvgText>
            </>
          );
        })())}
        {!selPoint && defaultLabel && safeEndNode && (usesSharedLineIntro ? (
          <>
            <ReanimatedSvgRect
              x={defaultLabelX}
              animatedProps={animatedDefaultRectProps}
              width={defaultLabelSize.w}
              height={defaultLabelSize.h}
              rx={LINE_LABEL_RX}
              fill={lineRenderColors.tooltipFill}
            />
            <ReanimatedSvgText
              x={defaultLabelX + defaultLabelSize.w / 2}
              animatedProps={animatedDefaultTextProps}
              fill={lineRenderColors.tooltipText}
              fontSize={LINE_LABEL_FONT_SIZE}
              fontWeight="700"
              textAnchor="middle"
            >
              {defaultLabel}
            </ReanimatedSvgText>
          </>
        ) : (() => {
          const pos = placeLabel(safeEndNode, defaultLabel, true);
          return (
            <>
              <Rect x={pos.lx} y={pos.ly} width={pos.w} height={pos.h} rx={LINE_LABEL_RX} fill={lineRenderColors.tooltipFill}/>
              <SvgText x={pos.lx + pos.w/2} y={pos.ly + pos.h - 6} fill={lineRenderColors.tooltipText} fontSize={LINE_LABEL_FONT_SIZE} fontWeight="700" textAnchor="middle">
                {defaultLabel}
              </SvgText>
            </>
          );
        })())}

        {/* 내장 페이저 점 */}
        {showPager && (
        <>
        <Circle cx={dotCx1} cy={dotCy} r={LINE_PAGER_DOT_R} fill={pagerIndex===0 ? lineRenderColors.pagerActive : lineRenderColors.pagerInactive} />
        <Circle cx={dotCx2} cy={dotCy} r={LINE_PAGER_DOT_R} fill={pagerIndex===1 ? lineRenderColors.pagerActive : lineRenderColors.pagerInactive} />
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
            graphId={GRAPH_RENDER_GRAPH_IDS.LINE_COUNT_CUMULATIVE}
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
            graphId={GRAPH_RENDER_GRAPH_IDS.LINE_MINUTES}
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

const LineFamilyCard = memo(function LineFamilyCard({
 title = null,
 startDate,
 rangeEndDate = null,
 entries = [],
 metric = 'count',
 graphId = null,
 seriesOverride = null,
 labelFormatter = null,
 axisStartLabel = undefined,
 axisEndLabel = undefined,
 isEmpty = false,
 emptyText = '데이터 없음',
 disabled = false,
 introProgress = 1,
 lineIntroRunId = null,
 lineIntroPhase = null,
 interactive = true,
 pagerIndex = 0,
 onSelectPagerIndex = () => {},
 showPager = false,
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

 const resolvedGraphId = graphId || (
 metric === 'minutes'
 ? GRAPH_RENDER_GRAPH_IDS.LINE_MINUTES
 : GRAPH_RENDER_GRAPH_IDS.LINE_COUNT_CUMULATIVE
 );

 const lineFamilyRule = useMemo(
 () => resolveGraphRenderRule({ graphId: resolvedGraphId }),
 [resolvedGraphId]
 );

 const lineFamilyColors = lineFamilyRule.colors;
 const lineFamilyLayout = lineFamilyRule.layout;

 const normalizedTitle = (
 typeof title === 'string' ? title.trim() : ''
 );

 const normalizedEmptyText = (
 typeof emptyText === 'string' && emptyText.trim()
 ? emptyText.trim()
 : '데이터 없음'
 );

 const isLayoutReady = chartBox.width > 0 && chartBox.height > 0;
 const chartWidth = Math.max(1, chartBox.width);
 const chartHeight = Math.max(1, chartBox.height);

 return (
 <DashboardWidgetShell
 header={
 normalizedTitle ? (
 <DashboardWidgetHeader
 title={normalizedTitle}
 hideSides
 />
 ) : null
 }
 >
 <View
 style={[
 styles.lineWidgetArea,
 {
 opacity: disabled ? 0.92 : 1,
 position: 'relative',
 },
 ]}
 onLayout={onLayout}
 >
 {isLayoutReady ? (
 <LineGradientChart
 startDate={startDate}
 rangeEndDate={rangeEndDate}
 entries={entries}
 metric={metric}
 width={chartWidth}
 height={chartHeight}
 introProgress={introProgress}
 lineIntroRunId={lineIntroRunId}
 lineIntroPhase={lineIntroPhase}
 interactive={!isEmpty && interactive && !disabled}
 pagerIndex={pagerIndex}
 onSelectPagerIndex={onSelectPagerIndex}
 showPager={!isEmpty && showPager}
 plotInset={0}
 plotTopInset={lineFamilyLayout.dashboardPlotTop}
 plotBottomInset={lineFamilyLayout.dashboardPlotBottom}
 scaleLayout
 layoutBaseHeight={lineFamilyLayout.dashboardBaseHeight}
 graphId={resolvedGraphId}
 seriesOverride={seriesOverride}
 labelFormatter={labelFormatter}
 axisStartLabel={axisStartLabel}
 axisEndLabel={axisEndLabel}
 />
 ) : (
 <View style={{ flex: 1, width: '100%' }} />
 )}

 {isEmpty ? (
 <View
 pointerEvents="none"
 style={[
 StyleSheet.absoluteFill,
 {
 alignItems: 'center',
 justifyContent: 'center',
 paddingHorizontal: 8,
 paddingBottom: lineFamilyLayout.dashboardPlotBottom,
 zIndex: 10,
 elevation: 10,
 },
 ]}
 >
 <Text
 numberOfLines={1}
 style={{
 color: lineFamilyColors.emptyText,
 fontSize: lineFamilyLayout.emptyTextFontSize,
 lineHeight: lineFamilyLayout.emptyTextLineHeight,
 fontWeight: '700',
 textAlign: 'center',
 includeFontPadding: false,
 }}
 >
 {normalizedEmptyText}
 </Text>
 </View>
 ) : null}
 </View>
 </DashboardWidgetShell>
 );
});


const DashboardLineChart = memo(function DashboardLineChart({
 startDate,
 entries,
 metric,
 lineIntroRunId = null,
 lineIntroPhase = null,
 interactive = true,
}) {
 const isMinutes = metric === 'minutes';

 const graphId = isMinutes
 ? GRAPH_RENDER_GRAPH_IDS.LINE_MINUTES
 : GRAPH_RENDER_GRAPH_IDS.LINE_COUNT_CUMULATIVE;

 const title = isMinutes
 ? '시간 선형'
 : '누적 선형';

 const hasEntries = Array.isArray(entries) && entries.length > 0;
 const aggregatedEntries = useMemo(() => aggregateByDate(entries), [entries]);
 const hasDurationEntries = hasEntries && aggregatedEntries.some((item) => item.minutes > 0);
 const isEmpty = isMinutes ? !hasDurationEntries : !hasEntries;

 const today = useMemo(() => {
 const value = new Date();
 value.setHours(0, 0, 0, 0);
 return value;
 }, []);

 const normalizedStartDate = useMemo(() => {
 const value = startDate
 ? new Date(startDate)
 : new Date(today);

 if (isNaN(value.getTime())) {
 value.setTime(today.getTime());
 }

 value.setHours(0, 0, 0, 0);
 return value;
 }, [startDate, today]);

 const startAxisLabel = useMemo(
 () => formatLineAxisDate(normalizedStartDate),
 [normalizedStartDate],
 );
 const endAxisLabel = useMemo(
 () => 'Today ' + formatLineAxisDate(today),
 [today],
 );

 return (
 <LineFamilyCard
 title={title}
 startDate={normalizedStartDate}
 rangeEndDate={today}
 entries={entries}
 metric={metric}
 graphId={graphId}
 axisStartLabel={startAxisLabel}
 axisEndLabel={endAxisLabel}
 isEmpty={isEmpty}
 emptyText="데이터 없음"
 lineIntroRunId={lineIntroRunId}
 lineIntroPhase={lineIntroPhase}
 interactive={interactive}
 pagerIndex={isMinutes ? 1 : 0}
 showPager={false}
 />
 );
});


const DashboardProgressWidget = memo(function DashboardProgressWidget({
  overallPct,
  progress,
  onPress,
  disabled = false,
  graphId = GRAPH_RENDER_GRAPH_IDS.OVERALL_PROGRESS,
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

  const overallRenderRule = useMemo(
    () => resolveGraphFamilyStandardRule({ graphId }),
    [graphId]
  );
  const overallRenderLayout = overallRenderRule.layout;

  const PROGRESS_BODY_BASE_HEIGHT = overallRenderLayout.bodyBaseHeight;
  const progressBodyHeight = Math.max(1, box.height || PROGRESS_BODY_BASE_HEIGHT);
  const PROGRESS_SCALE_RAW = progressBodyHeight / PROGRESS_BODY_BASE_HEIGHT;
  const PROGRESS_SCALE = Math.max(overallRenderLayout.minScale, Math.min(overallRenderLayout.maxScale, PROGRESS_SCALE_RAW));
  const scaleProgress = (value, min, max) => {
    const scaled = value * PROGRESS_SCALE;
    return Math.max(min, Math.min(max, scaled));
  };

  const SAFE_PAD = Math.round(scaleProgress(
    overallRenderLayout.safePadBase,
    overallRenderLayout.safePadMin,
    overallRenderLayout.safePadMax
  ));

  const availableW = Math.max(1, box.width - SAFE_PAD * 2);
  const availableH = Math.max(1, box.height - SAFE_PAD * 2);
  const donutSize = box.width > 0 && box.height > 0
    ? Math.floor(Math.min(availableW, availableH))
    : 0;
  const donutStroke = donutSize > 0
    ? Math.max(
        overallRenderLayout.minStroke,
        Math.round(donutSize * (overallRenderLayout.baseStroke / overallRenderLayout.baseSize))
      )
    : overallRenderLayout.baseStroke;
  const donutLabelFontSize = donutSize > 0
    ? Math.round(Math.max(
        overallRenderLayout.labelMinFontSize,
        Math.min(
          overallRenderLayout.labelMaxFontSize,
          donutSize * (overallRenderLayout.labelBaseFontSize / overallRenderLayout.baseSize)
        )
      ))
    : overallRenderLayout.labelBaseFontSize;

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
            labelFontSize={donutLabelFontSize}
            graphId={graphId}
          />
        ) : null}
      </View>
    </TouchableOpacity>
  );
});


/* ───────── 주간 뷰 ───────── */
const DashboardGoalWidget = memo(function DashboardGoalWidget({
 rewardText,
 graphId = GRAPH_RENDER_GRAPH_IDS.GOAL_BLACK_BOX,
}) {
 const [box, setBox] = useState({ width: 0, height: 0 });
 const [measuredTextWidth, setMeasuredTextWidth] = useState(0);
 const marqueeXRef = useRef(new Animated.Value(0));
 const marqueeX = marqueeXRef.current;

 const infoCardRenderRule = useMemo(
 () => resolveGraphFamilyStandardRule({ graphId }),
 [graphId]
 );
 const infoCardColors = infoCardRenderRule.colors;
 const infoCardLayout = infoCardRenderRule.layout;

 const infoCardBodyBaseHeight = Number(infoCardLayout.bodyBaseHeight) || 72;
 const infoCardTitleFontSize = Number(infoCardLayout.titleFontSize) || 13;
 const infoCardBodyFontSize = Number(infoCardLayout.bodyFontSize) || 12;
 const infoCardCaptionFontSize = Number(infoCardLayout.captionFontSize) || 10;
 const infoCardTitleLineHeight = Number(infoCardLayout.titleLineHeight) || 17;
 const infoCardBodyLineHeight = Number(infoCardLayout.bodyLineHeight) || 16;
 const infoCardVerticalGap = Number(infoCardLayout.verticalGap) || 5;
 const infoCardHorizontalPadding = Number(infoCardLayout.horizontalPadding) || 12;

 const GOAL_FONT_SIZE = Math.max(16, infoCardBodyFontSize + 4);
 const GOAL_LINE_HEIGHT = Math.max(20, infoCardBodyLineHeight + 4);
 const GOAL_LABEL_FONT_SIZE = Math.max(infoCardCaptionFontSize, infoCardTitleFontSize - 2);
 const GOAL_LABEL_LINE_HEIGHT = Math.max(14, infoCardTitleLineHeight);
 const GOAL_PADDING_V = Math.max(8, infoCardVerticalGap * 2);
 const GOAL_PADDING_H = Math.max(12, infoCardHorizontalPadding);
 const GOAL_RADIUS = 12;
 const GOAL_MARQUEE_GAP = 36;
 const GOAL_MIN_HEIGHT = Math.max(0, Math.min(infoCardBodyBaseHeight, 72));

 const rawGoalText = String(rewardText ?? '').trim();
 const hasGoalText = rawGoalText.length > 0 && rawGoalText !== '—';
 const goalText = hasGoalText ? rawGoalText : '보상이 없습니다';
 const goalLabel = hasGoalText ? '보상' : '보상 없음';
 const goalLabelColor = hasGoalText ? infoCardColors.titleText : infoCardColors.captionText;
 const goalTextColor = hasGoalText
 ? (infoCardColors.accentText || infoCardColors.bodyText)
 : infoCardColors.emptyText;

 const estimatedTextWidth = Math.ceil(goalText.length * GOAL_FONT_SIZE * 0.9);
 const effectiveTextWidth = Math.max(measuredTextWidth, estimatedTextWidth);
 const textViewportWidth = Math.max(1, box.width - GOAL_PADDING_H * 2);
 const shouldMarquee = effectiveTextWidth > textViewportWidth + 2;

 const fixedGoalTextStyle = {
 color: goalTextColor,
 fontSize: GOAL_FONT_SIZE,
 lineHeight: GOAL_LINE_HEIGHT,
 includeFontPadding: false,
 textAlign: 'center',
 };

 const marqueeGoalTextStyle = {
 ...fixedGoalTextStyle,
 width: effectiveTextWidth,
 textAlign: 'left',
 };

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

 const handleGoalTextLayout = useCallback((event) => {
 const layoutWidth = Math.ceil(event?.nativeEvent?.layout?.width || 0);
 const lineWidth = Math.ceil(event?.nativeEvent?.lines?.[0]?.width || 0);
 const nextWidth = Math.max(layoutWidth, lineWidth);
 if (nextWidth > 0) {
 setMeasuredTextWidth((prev) => (
 Math.abs(prev - nextWidth) <= 1 ? prev : nextWidth
 ));
 }
 }, []);

 useEffect(() => {
 marqueeX.stopAnimation();
 marqueeX.setValue(0);

 if (!shouldMarquee || effectiveTextWidth <= 0) {
 return undefined;
 }

 const travelDistance = effectiveTextWidth + GOAL_MARQUEE_GAP;
 const duration = Math.max(5200, Math.round(travelDistance * 36));

 const animation = Animated.loop(
 Animated.timing(marqueeX, {
 toValue: -travelDistance,
 duration,
 easing: Easing.linear,
 useNativeDriver: true,
 }),
 { resetBeforeIteration: true }
 );

 animation.start();

 return () => {
 animation.stop();
 marqueeX.stopAnimation();
 marqueeX.setValue(0);
 };
 }, [marqueeX, shouldMarquee, effectiveTextWidth]);

 return (
 <View style={styles.goalWidgetArea} onLayout={onLayout}>
 <View
 style={[
 styles.rewardBlackBox,
 {
 minHeight: GOAL_MIN_HEIGHT,
 borderRadius: GOAL_RADIUS,
 paddingVertical: GOAL_PADDING_V,
 paddingHorizontal: GOAL_PADDING_H,
 backgroundColor: infoCardColors.surfaceFill,
 borderWidth: 1,
 borderColor: infoCardColors.divider,
 },
 ]}
 >
 <Text
 numberOfLines={1}
 style={{
 color: goalLabelColor,
 fontSize: GOAL_LABEL_FONT_SIZE,
 lineHeight: GOAL_LABEL_LINE_HEIGHT,
 fontWeight: '800',
 textAlign: 'center',
 includeFontPadding: false,
 marginBottom: infoCardVerticalGap,
 }}
 >
 {goalLabel}</Text>

 <View
 style={{
 width: '100%',
 overflow: 'hidden',
 alignItems: shouldMarquee ? 'flex-start' : 'center',
 justifyContent: 'center',
 }}
 >
 {shouldMarquee ? (
 <Animated.View
 style={{
 flexDirection: 'row',
 alignItems: 'center',
 transform: [{ translateX: marqueeX }],
 }}
 >
 <Text
 onLayout={handleGoalTextLayout}
 onTextLayout={handleGoalTextLayout}
 numberOfLines={1}
 ellipsizeMode="clip"
 style={[styles.rewardBlackText, marqueeGoalTextStyle]}
 >
 {goalText}
 </Text>
 <View style={{ width: GOAL_MARQUEE_GAP }} />
 <Text
 numberOfLines={1}
 ellipsizeMode="clip"
 style={[styles.rewardBlackText, marqueeGoalTextStyle]}
 >
 {goalText}
 </Text>
 <View style={{ width: GOAL_MARQUEE_GAP }} />
 </Animated.View>
 ) : (
 <Text
 onLayout={handleGoalTextLayout}
 onTextLayout={handleGoalTextLayout}
 numberOfLines={1}
 style={[styles.rewardBlackText, fixedGoalTextStyle]}
 >
 {goalText}
 </Text>
 )}
 </View>
 </View>
 </View>
 );
});

const WeeklyAnimatedBarSegment = memo(function WeeklyAnimatedBarSegment({
  progress,
  finalHeight,
  segmentCount,
  segmentGap,
  ratio,
  width,
  radius: segmentRadius,
  color: segmentColor,
  isLast,
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const height = finalHeight * progress.value;
    const available = Math.max(
      height - segmentGap * (segmentCount - 1),
      2 * segmentCount,
    );
    return { height: Math.max(4, ratio * available) };
  }, [finalHeight, ratio, segmentCount, segmentGap]);

  return (
    <Reanimated.View
      style={[
        {
          width,
          borderRadius: segmentRadius,
          marginBottom: isLast ? 0 : segmentGap,
          backgroundColor: segmentColor,
        },
        animatedStyle,
      ]}
    />
  );
});

const WeeklyAnimatedBarGeometry = memo(function WeeklyAnimatedBarGeometry({
  progress,
  finalHeight,
  segmentRatios,
  segmentGap,
  width,
  radius: barRadius,
  color: barColor,
  verticalGap,
}) {
  const animatedContainerStyle = useAnimatedStyle(() => ({
    height: finalHeight * progress.value,
  }), [finalHeight]);

  return (
    <Reanimated.View
      style={[
        {
          marginVertical: verticalGap,
          justifyContent: 'flex-end',
          alignItems: 'center',
        },
        animatedContainerStyle,
      ]}
    >
      {segmentRatios.length <= 1 ? (
        <View style={{
          width,
          height: '100%',
          borderRadius: barRadius,
          backgroundColor: barColor,
        }} />
      ) : segmentRatios.map((ratio, index) => (
        <WeeklyAnimatedBarSegment
          key={index}
          progress={progress}
          finalHeight={finalHeight}
          segmentCount={segmentRatios.length}
          segmentGap={segmentGap}
          ratio={ratio}
          width={width}
          radius={barRadius}
          color={barColor}
          isLast={index === segmentRatios.length - 1}
        />
      ))}
    </Reanimated.View>
  );
});

const WeeklyAnimatedGoalLine = memo(function WeeklyAnimatedGoalLine({
  progress,
  finalBarHeight,
  barTopGap,
  barRowHeight,
  countLineHeight,
  verticalGap,
  rowOffsetX,
  rowWidth,
  lineColor,
  children,
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    top: barTopGap + Math.max(
      0,
      barRowHeight - countLineHeight - verticalGap - finalBarHeight * progress.value,
    ),
  }), [barRowHeight, barTopGap, countLineHeight, finalBarHeight, verticalGap]);

  return (
    <Reanimated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: rowOffsetX,
          width: rowWidth,
          height: 1,
          backgroundColor: lineColor,
          opacity: 0.78,
        },
        animatedStyle,
      ]}
    >
      {children}
    </Reanimated.View>
  );
});

const WeekView = memo(function WeekView({
  weeksData,
  currentIndex = 0,
  onIndexChange,
  introProgress = 1,
  weekIntroRunId = null,
  weekIntroPhase = null,
  weekIntroTargetIndex = null,
  onPressDay,
  onTapBar,
  challengeStartDate,
  challengeEndDate,
  graphId = GRAPH_RENDER_GRAPH_IDS.WEEKLY_BAR,
  valueMode = 'challenge',
  formatPrimaryValue = null,
  formatSecondaryValue = null,
  title = null,
  goalValue = null,
  goalLabel = null,
}) {
  const scrollRef = useRef(null);
  const scrollXRef = useRef(new Animated.Value(0));
  const scrollX = scrollXRef.current;
  const [pageW, setPageW] = useState(0);
  const [viewH, setViewH] = useState(168);
  const [weekDateTextWidth, setWeekDateTextWidth] = useState(34);
  const usesSharedWeekIntro = Number.isFinite(weekIntroRunId) && (
    weekIntroPhase === 'pending' ||
    weekIntroPhase === 'animate' ||
    weekIntroPhase === 'complete'
  );
  const resolvedWeekIntroTargetIndex = Number.isInteger(weekIntroTargetIndex)
    ? weekIntroTargetIndex
    : weekIntroPhase === 'pending'
    ? currentIndex
    : null;
  const weekIntroProgress = useSharedValue(
    usesSharedWeekIntro && weekIntroPhase !== 'complete' ? 0 : 1,
  );

  useEffect(() => {
    if (!usesSharedWeekIntro) {
      const fallbackProgress = Number(introProgress);
      weekIntroProgress.value = Number.isFinite(fallbackProgress)
        ? Math.max(0, Math.min(1, fallbackProgress))
        : 1;
      return;
    }

    if (weekIntroPhase === 'animate') {
      weekIntroProgress.value = 0;
      weekIntroProgress.value = withTiming(1, {
        duration: 900,
        easing: ReanimatedEasing.inOut(ReanimatedEasing.cubic),
      });
      return;
    }

    weekIntroProgress.value = weekIntroPhase === 'complete' ? 1 : 0;
  }, [
    introProgress,
    usesSharedWeekIntro,
    weekIntroPhase,
    weekIntroProgress,
    weekIntroRunId,
  ]);

  useEffect(() => {
    if (
      usesSharedWeekIntro &&
      Number.isInteger(resolvedWeekIntroTargetIndex) &&
      currentIndex !== resolvedWeekIntroTargetIndex
    ) {
      weekIntroProgress.value = 1;
    }
  }, [
    currentIndex,
    resolvedWeekIntroTargetIndex,
    usesSharedWeekIntro,
    weekIntroProgress,
  ]);

  const recordWeekDateTextWidth = useCallback((event) => {
    const width = Math.ceil(event?.nativeEvent?.layout?.width || 0);
    if (width <= 0) return;

    setWeekDateTextWidth((prev) => {
      if (width <= prev + 1) return prev;
      return width;
    });
  }, []);

  const onLayout = useCallback((e) => {
    const w = Math.floor(e.nativeEvent.layout.width || SCREEN_WIDTH);
    const h = Math.floor(e.nativeEvent.layout.height || 0);
    if (w && w !== pageW) setPageW(w);
    if (h && Math.abs(h - viewH) >= 4) setViewH(h);
  }, [pageW, viewH]);

 const weeklyRenderRule = useMemo(
    () => resolveGraphFamilyStandardRule({ graphId }),
    [graphId]
  );
  const weeklyRenderColors = weeklyRenderRule.colors;
  const weeklyRenderLayout = weeklyRenderRule.layout;

  const normalizedTitle = typeof title === 'string' ? title.trim() : '';
  const normalizedGoalValue = Number(goalValue);
  const hasGoalLine = (
   valueMode === 'steps' &&
   Number.isFinite(normalizedGoalValue) &&
   normalizedGoalValue > 0
  );
  const normalizedGoalLabel = (
   typeof goalLabel === 'string' && goalLabel.trim()
   ? goalLabel.trim()
   : hasGoalLine
   ? `${Math.round(normalizedGoalValue).toLocaleString('ko-KR')}보`
   : ''
  );

   const PADDING_H = 0;
  const WEEK_BAR_W = weeklyRenderLayout.barWidth;
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
    const nextX = nextIndex * pageW;
    scrollRef.current?.scrollTo({ x: nextX, animated: true });
    scrollX.setValue(nextX);
    if (typeof onIndexChange === 'function') onIndexChange(nextIndex);
  }, [pageW, weeksData, onIndexChange, scrollX]);

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

  const WEEK_FALLBACK_VIEW_HEIGHT = weeklyRenderLayout.fallbackViewHeight;
  const WEEK_BASE_VIEW_HEIGHT = weeklyRenderLayout.baseViewHeight;

  const WEEK_VIEW_HEIGHT = viewH > 0 ? viewH : WEEK_FALLBACK_VIEW_HEIGHT;
  const WEEK_SCALE_RAW = WEEK_VIEW_HEIGHT / WEEK_BASE_VIEW_HEIGHT;
  const WEEK_SCALE = Math.max(0.75, Math.min(1.45, WEEK_SCALE_RAW));
  const scaleWeek = (value, min, max) => {
    const scaled = value * WEEK_SCALE;
    return Math.max(min, Math.min(max, scaled));
  };

  const WEEK_CONTROL_HEIGHT = Math.round(scaleWeek(20, 18, 28));
  const WEEK_DATE_FONT_SIZE = scaleWeek(10.5, 9.5, 11);
  const WEEK_DATE_LINE_H = Math.round(scaleWeek(13.5, 11.5, 18));
  const WEEK_DAY_FONT_SIZE = scaleWeek(9.5, 9, 10.5);
  const WEEK_DAY_LINE_H = Math.round(scaleWeek(12.5, 10.5, 17));
  const WEEK_DATE_DAY_GAP = Math.round(scaleWeek(2, 1, 5));
  const WEEK_DATE_ROW_HEIGHT = WEEK_DATE_LINE_H + WEEK_DATE_DAY_GAP + WEEK_DAY_LINE_H;
  const WEEK_TITLE_FONT_SIZE = scaleWeek(11, 10, 12);
  const WEEK_TITLE_LINE_H = Math.round(scaleWeek(14, 12, 17));
  const WEEK_TITLE_BOTTOM_GAP = Math.round(scaleWeek(2, 1, 4));
  const WEEK_TITLE_BLOCK_HEIGHT = normalizedTitle
   ? WEEK_TITLE_LINE_H + WEEK_TITLE_BOTTOM_GAP
   : 0;
  const WEEK_HEADER_SLOT_HEIGHT = Math.max(
    DASHBOARD_WIDGET_HEADER_HEIGHT,
    WEEK_DATE_ROW_HEIGHT + WEEK_TITLE_BLOCK_HEIGHT
  );

  const WEEK_BAR_TOP_GAP = Math.round(scaleWeek(6, 4, 12));
  const WEEK_GRAPH_BOTTOM_GAP = Math.round(scaleWeek(8, 6, 16));

  const WEEK_BAR_TEXT_FONT_SIZE = scaleWeek(10.5, 9, 11);
  const WEEK_BAR_TEXT_LINE_H = Math.round(scaleWeek(12.5, 10.5, 18));
  const WEEK_COUNT_FONT_SIZE = scaleWeek(10.5, 9, 11);
  const WEEK_COUNT_LINE_H = Math.round(scaleWeek(14.5, 11.5, 20));
  const WEEK_BAR_VERTICAL_GAP = Math.round(scaleWeek(2, 1, 5));
  const WEEK_BAR_LABEL_STACK_H = WEEK_BAR_TEXT_LINE_H + WEEK_COUNT_LINE_H + WEEK_BAR_VERTICAL_GAP * 2;

  const WEEK_GRAPH_HEIGHT = Math.max(1, WEEK_VIEW_HEIGHT - WEEK_CONTROL_HEIGHT);
  const WEEK_BAR_ROW_HEIGHT = Math.max(
    Math.round(scaleWeek(48, 36, 76)),
    WEEK_GRAPH_HEIGHT - WEEK_BAR_TOP_GAP - WEEK_GRAPH_BOTTOM_GAP
  );
  const WEEK_BAR_VALUE_MAX_H = Math.max(
    Math.round(scaleWeek(16, 12, 32)),
    WEEK_BAR_ROW_HEIGHT - WEEK_BAR_LABEL_STACK_H
  );
  const WEEK_BAR_VALUE_BASE_H = Math.min(
    scaleWeek(10, 4, 16),
    Math.max(4, WEEK_BAR_VALUE_MAX_H * 0.25)
  );
  const WEEK_BAR_VALUE_RANGE_H = Math.max(1, WEEK_BAR_VALUE_MAX_H - WEEK_BAR_VALUE_BASE_H);

  const WEEK_EMPTY_DOT_SIZE = scaleWeek(weeklyRenderLayout.emptyDotSize, 3, 6);
  const WEEK_PAGER_DOT_SIZE = scaleWeek(weeklyRenderLayout.pagerDotSize, 4, 8);
  const WEEK_PAGER_DOT_ACTIVE_SIZE = scaleWeek(weeklyRenderLayout.pagerDotActiveSize, 5, 9);
  const WEEK_PAGER_DOT_HIT_W = Math.round(scaleWeek(weeklyRenderLayout.pagerDotHitWidth, 10, 18));
  const WEEK_PAGER_ARROW_HIT_W = Math.round(scaleWeek(weeklyRenderLayout.pagerArrowHitWidth, 18, 30));
  const WEEK_PAGER_ARROW_FONT_SIZE = scaleWeek(weeklyRenderLayout.pagerArrowSize, 13, 20);

const todayKey = useMemo(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return keyOf(today);
}, []);

const WEEK_TODAY_DATE_FONT_SIZE = Math.min(
  scaleWeek(11.5, 10, 11.5),
  WEEK_DATE_FONT_SIZE + scaleWeek(0.5, 0.3, 0.5)
);
const WEEK_TODAY_DATE_LINE_H = Math.max(
  WEEK_DATE_LINE_H,
  Math.round(WEEK_TODAY_DATE_FONT_SIZE + scaleWeek(2, 1.5, 4))
);

const WEEK_TODAY_DAY_FONT_SIZE = Math.min(
  scaleWeek(10.6, 9.5, 10.8),
  WEEK_DAY_FONT_SIZE + scaleWeek(0.3, 0.2, 0.4)
);
const WEEK_TODAY_DAY_LINE_H = Math.max(
  WEEK_DAY_LINE_H,
  Math.round(WEEK_TODAY_DAY_FONT_SIZE + scaleWeek(2, 1.5, 4))
);
const WEEK_TODAY_EMPTY_DOT_COLOR = weeklyRenderColors.todayEmptyDotFill;
const WEEK_TODAY_TEXT_STYLE = {
  color: weeklyRenderColors.todayText,
  fontWeight: '900',
};

  const renderWeekHeader = useCallback(() => {
    if (!pageW || !Array.isArray(weeksData) || weeksData.length === 0) {
return (
      <View style={{ height: WEEK_HEADER_SLOT_HEIGHT, alignItems: 'center' }}>
       {normalizedTitle ? (
        <Text
         numberOfLines={1}
         style={{
          color: weeklyRenderColors.text,
          fontSize: WEEK_TITLE_FONT_SIZE,
          lineHeight: WEEK_TITLE_LINE_H,
          fontWeight: '900',
          textAlign: 'center',
          includeFontPadding: false,
         }}
        >
         {normalizedTitle}
        </Text>
       ) : null}
      </View>
      );
    }

    return (
      <View style={{ width: '100%', height: WEEK_HEADER_SLOT_HEIGHT, overflow: 'hidden', justifyContent: 'flex-start' }}>
      {normalizedTitle ? (
       <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
         color: weeklyRenderColors.text,
         fontSize: WEEK_TITLE_FONT_SIZE,
         lineHeight: WEEK_TITLE_LINE_H,
         fontWeight: '900',
         textAlign: 'center',
         includeFontPadding: false,
         marginBottom: WEEK_TITLE_BOTTOM_GAP,
        }}
       >
        {normalizedTitle}
       </Text>
      ) : null}

        <Animated.View
          style={{
            flexDirection: 'row',
            width: pageW * weeksData.length,
            transform: [
              {
                translateX: Animated.multiply(scrollX, -1),
              },
            ],
          }}
        >
          {weeksData.map((week, idx) => {
            const dailyStats = Array.isArray(week?.dailyStats) ? week.dailyStats : [];

            return (
              <View key={`week-header-${idx}`} style={{ width: pageW }}>
                <View style={{ flexDirection: 'row', width: ROW_W, marginLeft: ROW_OFFSET_X, height: WEEK_DATE_ROW_HEIGHT }}>
                  {dailyStats.map((stat, i) => {
                    const weekStart = week?.ws ? new Date(week.ws) : null;
                    if (weekStart) weekStart.setHours(0, 0, 0, 0);
                    const actualDate = weekStart ? new Date(weekStart) : null;
                    if (actualDate) actualDate.setDate(weekStart.getDate() + i);
                    const isTodayDate = actualDate ? keyOf(actualDate) === todayKey : false;

                    return (
                      <TouchableOpacity
                        key={i}
                        style={{ width: COL_W, alignItems: 'center' }}
                        onPress={() => onPressDay?.(stat.date, week?.ws, i)}
                        activeOpacity={0.7}
                      >
                        <Text
                          onLayout={recordWeekDateTextWidth}
                          style={[
                            styles.dateLabel,
                            {
                              marginBottom: WEEK_DATE_DAY_GAP,
                              color: weeklyRenderColors.text,
                              fontSize: WEEK_DATE_FONT_SIZE,
                              lineHeight: WEEK_DATE_LINE_H,
                              includeFontPadding: false,
                            },
                            isTodayDate && {
                              color: '#000',
                              fontWeight: '900',
                              fontSize: WEEK_TODAY_DATE_FONT_SIZE,
                              lineHeight: WEEK_TODAY_DATE_LINE_H,
                            },
                          ]}
                        >
                          {stat.date}
                        </Text>
                        <Text
                          style={[
                            styles.dayLabel,
                            {
                              color: weeklyRenderColors.text,
                              fontSize: WEEK_DAY_FONT_SIZE,
                              lineHeight: WEEK_DAY_LINE_H,
                              includeFontPadding: false,
                            },
                            isTodayDate && {
                              color: '#000',
                              fontWeight: '900',
                              fontSize: WEEK_TODAY_DAY_FONT_SIZE,
                              lineHeight: WEEK_TODAY_DAY_LINE_H,
                            },
                          ]}
                        >
                          {DAY_LABELS[i]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </Animated.View>
      </View>
    );
  }, [
    pageW,
    weeksData,
    scrollX,
    ROW_W,
    ROW_OFFSET_X,
    COL_W,
    WEEK_HEADER_SLOT_HEIGHT,
    WEEK_DATE_ROW_HEIGHT,
    WEEK_DATE_DAY_GAP,
    WEEK_DATE_FONT_SIZE,
    WEEK_DATE_LINE_H,
    WEEK_DAY_FONT_SIZE,
    WEEK_DAY_LINE_H,
    recordWeekDateTextWidth,
    onPressDay,
    todayKey,
    WEEK_TODAY_DATE_FONT_SIZE,
    WEEK_TODAY_DATE_LINE_H,
    WEEK_TODAY_DAY_FONT_SIZE,
    WEEK_TODAY_DAY_LINE_H,
    weeklyRenderColors,
  ]);

const renderWeek = useCallback(({ dailyStats }, idx) => {
    const isStepValueMode = valueMode === 'steps';
    const shouldAnimateCurrentWeek = (
      usesSharedWeekIntro &&
      idx === currentIndex &&
      idx === resolvedWeekIntroTargetIndex
    );
    const staticIntroProgress = usesSharedWeekIntro
      ? 1
      : Math.max(0, Math.min(1, Number(introProgress) || 0));
    const primaryValueOf = (stat) => Math.max(
     0,
     Number(isStepValueMode ? stat?.steps : stat?.duration) || 0
    );
    const maxTime = Math.max(
     ...dailyStats.map(s => primaryValueOf(s)),
     hasGoalLine ? normalizedGoalValue : 0,
     1
    );
    const maxCount = Math.max(...dailyStats.map(s => s.totalCount || 0), 1);

    const finalWeeklyGoalBarHeight = hasGoalLine
     ? Math.min(
      (normalizedGoalValue / maxTime) * WEEK_BAR_VALUE_RANGE_H + WEEK_BAR_VALUE_BASE_H,
      WEEK_BAR_VALUE_MAX_H
     )
     : 0;
    const weeklyGoalBarHeight = finalWeeklyGoalBarHeight * staticIntroProgress;

    const weeklyGoalLineTop = (
     WEEK_BAR_TOP_GAP +
     Math.max(
      0,
      WEEK_BAR_ROW_HEIGHT -
      WEEK_COUNT_LINE_H -
      WEEK_BAR_VERTICAL_GAP -
      weeklyGoalBarHeight
     )
    );

    return (
      <View key={idx} style={{ width: pageW, paddingHorizontal: PADDING_H, marginBottom: WEEK_GRAPH_BOTTOM_GAP }}>
        <TouchableOpacity onPress={onTapBar} activeOpacity={0.85} style={{ flexDirection:'row', width: ROW_W, marginLeft: ROW_OFFSET_X, alignItems:'flex-end', height: WEEK_BAR_ROW_HEIGHT, marginTop: WEEK_BAR_TOP_GAP }}>
          {dailyStats.map((stat, i) => {
            const primaryValue = primaryValueOf(stat);
            const hasTime = primaryValue > 0;
            const hasCount = !isStepValueMode && (stat.totalCount || 0) > 0;
            const weekStart = weeksData[idx]?.ws ? new Date(weeksData[idx].ws) : null;
            if (weekStart) weekStart.setHours(0, 0, 0, 0);
            const actualDate = weekStart ? new Date(weekStart) : null;
            if (actualDate) actualDate.setDate(weekStart.getDate() + i);
            const isTodayBar = actualDate ? keyOf(actualDate) === todayKey : false;

            if (!hasTime && !hasCount) {
              return (
                <View key={i} style={{ width: COL_W, alignItems:'center', justifyContent:'flex-end' }}>
                  <View
                  style={{
                    width: WEEK_EMPTY_DOT_SIZE,
                    height: WEEK_EMPTY_DOT_SIZE,
                    borderRadius: WEEK_EMPTY_DOT_SIZE / 2,
                    backgroundColor: isTodayBar ? WEEK_TODAY_EMPTY_DOT_COLOR : weeklyRenderColors.countBarFill,
                    marginBottom: WEEK_BAR_VERTICAL_GAP,
                  }}
                />
                </View>
              );
            }

            const finalTimeHeight = hasTime
              ? Math.min(
                (primaryValue / maxTime) * WEEK_BAR_VALUE_RANGE_H + WEEK_BAR_VALUE_BASE_H,
                WEEK_BAR_VALUE_MAX_H
              )
              : 0;
            const finalCountHeight = (!hasTime && hasCount)
              ? Math.min(
                (stat.totalCount / maxCount) * WEEK_BAR_VALUE_RANGE_H + WEEK_BAR_VALUE_BASE_H,
                WEEK_BAR_VALUE_MAX_H
              )
              : 0;
            const hTime = finalTimeHeight * staticIntroProgress;
            const hCount = finalCountHeight * staticIntroProgress;

            if (hasTime) {
              const segDurations = isStepValueMode
               ? (primaryValue > 0 ? [primaryValue] : [])
               : (Array.isArray(stat.durations) ? stat.durations : []);
              const totalSegDur = segDurations.reduce((a, b) => a + b, 0);
              const segmentRatios = segDurations.map((duration) => (
                totalSegDur > 0
                  ? duration / totalSegDur
                  : 1 / Math.max(segDurations.length, 1)
              ));
              const primaryLabel = typeof formatPrimaryValue === 'function'
               ? formatPrimaryValue(primaryValue, stat, i)
               : `${primaryValue}분`;
              const secondaryLabel = typeof formatSecondaryValue === 'function'
               ? formatSecondaryValue(stat, i)
               : ((stat.totalCount || 0) > 0 ? `${stat.totalCount}회` : '—');

              return (
                <View key={i} style={{ width: COL_W, alignItems:'center', justifyContent:'flex-end' }}>
                  <Text style={[styles.barText, { fontSize: WEEK_BAR_TEXT_FONT_SIZE, lineHeight: WEEK_BAR_TEXT_LINE_H, includeFontPadding: false }, isTodayBar && WEEK_TODAY_TEXT_STYLE]}>{primaryLabel}</Text>
                  {shouldAnimateCurrentWeek ? (
                    <WeeklyAnimatedBarGeometry
                      progress={weekIntroProgress}
                      finalHeight={finalTimeHeight}
                      segmentRatios={segmentRatios}
                      segmentGap={weeklyRenderLayout.segmentGap}
                      width={WEEK_BAR_W}
                      radius={weeklyRenderLayout.barRadius}
                      color={weeklyRenderColors.durationBarFill}
                      verticalGap={WEEK_BAR_VERTICAL_GAP}
                    />
                  ) : (
                    <View style={{ marginVertical: WEEK_BAR_VERTICAL_GAP, height: hTime, justifyContent:'flex-end', alignItems:'center' }}>
                      {(() => {
                      if (segDurations.length <= 1) {
                        return <View style={[styles.bar, { width: WEEK_BAR_W, height: hTime, borderRadius: weeklyRenderLayout.barRadius, backgroundColor: weeklyRenderColors.durationBarFill }]} />;
                      }
                      const segGap = weeklyRenderLayout.segmentGap;
                      const available = Math.max(hTime - segGap * (segDurations.length - 1), 2 * segDurations.length);
                      return segDurations.map((dur, s) => {
                        const ratio = totalSegDur > 0 ? (dur / totalSegDur) : (1 / segDurations.length);
                        const segH = Math.max(4, ratio * available);
                        return (
                          <View key={s} style={{
                            width: WEEK_BAR_W, height: segH, borderRadius: weeklyRenderLayout.barRadius,
                            marginBottom: s === segDurations.length - 1 ? 0 : segGap,
                            backgroundColor: weeklyRenderColors.durationBarFill,
                          }}/>
                        );
                      });
                      })()}
                    </View>
                  )}
                  <Text style={[styles.countLabel, { fontSize: WEEK_COUNT_FONT_SIZE, lineHeight: WEEK_COUNT_LINE_H, includeFontPadding: false }, isTodayBar && WEEK_TODAY_TEXT_STYLE]}>{secondaryLabel}</Text>
                </View>
              );
            }

            const segCount = stat.totalCount || 0;
            const countSegmentRatios = Array.from(
              { length: segCount },
              () => 1 / Math.max(segCount, 1),
            );
            return (
              <View key={i} style={{ width: COL_W, alignItems:'center', justifyContent:'flex-end' }}>
                <Text style={[styles.barText, { fontSize: WEEK_BAR_TEXT_FONT_SIZE, lineHeight: WEEK_BAR_TEXT_LINE_H, includeFontPadding: false }, isTodayBar && WEEK_TODAY_TEXT_STYLE]}>{' '}</Text>
                {shouldAnimateCurrentWeek ? (
                  <WeeklyAnimatedBarGeometry
                    progress={weekIntroProgress}
                    finalHeight={finalCountHeight}
                    segmentRatios={countSegmentRatios}
                    segmentGap={weeklyRenderLayout.segmentGap}
                    width={WEEK_BAR_W}
                    radius={weeklyRenderLayout.barRadius}
                    color={weeklyRenderColors.countBarFill}
                    verticalGap={WEEK_BAR_VERTICAL_GAP}
                  />
                ) : (
                  <View style={{ marginVertical: WEEK_BAR_VERTICAL_GAP, height: hCount, justifyContent:'flex-end', alignItems:'center' }}>
                    {(() => {
                    const segGap = weeklyRenderLayout.segmentGap;
                    const available = Math.max(hCount - segGap * (segCount - 1), 2 * segCount);
                    const segH = Math.max(4, available / segCount);
                    return Array.from({ length: segCount }).map((_, s) => (
                      <View key={s} style={{
                        width: WEEK_BAR_W, height: segH, borderRadius: weeklyRenderLayout.barRadius,
                        marginBottom: s === segCount - 1 ? 0 : segGap,
                        backgroundColor: weeklyRenderColors.countBarFill,
                      }}/>
                    ));
                    })()}
                  </View>
                )}
                <Text style={[styles.countLabel, { fontSize: WEEK_COUNT_FONT_SIZE, lineHeight: WEEK_COUNT_LINE_H, includeFontPadding: false }, isTodayBar && WEEK_TODAY_TEXT_STYLE]}>{`${stat.totalCount}회`}</Text>
              </View>
            );
          })}
        </TouchableOpacity>

        {hasGoalLine ? (shouldAnimateCurrentWeek ? (
         <WeeklyAnimatedGoalLine
          progress={weekIntroProgress}
          finalBarHeight={finalWeeklyGoalBarHeight}
          barTopGap={WEEK_BAR_TOP_GAP}
          barRowHeight={WEEK_BAR_ROW_HEIGHT}
          countLineHeight={WEEK_COUNT_LINE_H}
          verticalGap={WEEK_BAR_VERTICAL_GAP}
          rowOffsetX={ROW_OFFSET_X}
          rowWidth={ROW_W}
          lineColor={weeklyRenderColors.countBarFill}
         >
          <Text
           numberOfLines={1}
           style={{
            position: 'absolute',
            right: 0,
            top: -13,
            color: weeklyRenderColors.text,
            fontSize: scaleWeek(9, 8.5, 10),
            lineHeight: 12,
            fontWeight: '800',
            textAlign: 'right',
            includeFontPadding: false,
           }}
          >
           {normalizedGoalLabel}
          </Text>
         </WeeklyAnimatedGoalLine>
        ) : (
         <View
          pointerEvents="none"
          style={{
           position: 'absolute',
           left: ROW_OFFSET_X,
           top: weeklyGoalLineTop,
           width: ROW_W,
           height: 1,
           backgroundColor: weeklyRenderColors.countBarFill,
           opacity: 0.78,
          }}
         >
          <Text
           numberOfLines={1}
           style={{
            position: 'absolute',
            right: 0,
            top: -13,
            color: weeklyRenderColors.text,
            fontSize: scaleWeek(9, 8.5, 10),
            lineHeight: 12,
            fontWeight: '800',
            textAlign: 'right',
            includeFontPadding: false,
           }}
          >
           {normalizedGoalLabel}
          </Text>
         </View>
        )) : null}
      </View>
    );
  }, [pageW, PADDING_H, ROW_W, COL_W, ROW_OFFSET_X, WEEK_GRAPH_BOTTOM_GAP, WEEK_BAR_TOP_GAP, WEEK_BAR_ROW_HEIGHT, WEEK_BAR_VALUE_BASE_H, WEEK_BAR_VALUE_RANGE_H, WEEK_BAR_VALUE_MAX_H, WEEK_EMPTY_DOT_SIZE, WEEK_BAR_VERTICAL_GAP, WEEK_BAR_TEXT_FONT_SIZE, WEEK_BAR_TEXT_LINE_H, WEEK_COUNT_FONT_SIZE, WEEK_COUNT_LINE_H, introProgress, weeksData, onTapBar, todayKey, WEEK_TODAY_EMPTY_DOT_COLOR, WEEK_TODAY_TEXT_STYLE, weeklyRenderColors, weeklyRenderLayout, WEEK_BAR_W, valueMode, formatPrimaryValue, formatSecondaryValue, hasGoalLine, normalizedGoalValue, normalizedGoalLabel, currentIndex, resolvedWeekIntroTargetIndex, usesSharedWeekIntro, weekIntroProgress]);

  useEffect(() => {
    if (!pageW || !Array.isArray(weeksData) || weeksData.length === 0) return;
    const safeIndex = Math.max(0, Math.min(currentIndex, weeksData.length - 1));
    const x = safeIndex * pageW;

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x, animated: false });
      scrollX.setValue(x);
    });
  }, [currentIndex, pageW, weeksData.length, scrollX]);

  const canPrevWeek = currentIndex > 0;
  const canNextWeek = currentIndex < weeksData.length - 1;
  const isWeekLayoutReady = pageW > 0;

  return (
    <DashboardWidgetShell
      header={renderWeekHeader()}
      headerSlotStyle={{
        height: WEEK_HEADER_SLOT_HEIGHT,
        minHeight: WEEK_HEADER_SLOT_HEIGHT,
        marginTop: DASHBOARD_WIDGET_HEADER_TOP_OFFSET,
      }}
    >
      <View style={{ flex: 1, width: '100%' }} onLayout={onLayout}>
        {!isWeekLayoutReady ? (
          <View style={{ height: WEEK_GRAPH_HEIGHT }} />
        ) : (
        <Animated.ScrollView
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
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          onStartShouldSetResponderCapture={() => false}
        >
          {weeksData.map((w, idx) => (
            <View key={`wk-${idx}`} style={{ width: pageW }}>
              {renderWeek(w, idx)}
            </View>
          ))}
        </Animated.ScrollView>
        )}

        <View style={[styles.weekPagerControl, { height: WEEK_CONTROL_HEIGHT }]}>
          <TouchableOpacity
            style={[styles.weekPagerArrowHit, { width: WEEK_PAGER_ARROW_HIT_W, height: WEEK_CONTROL_HEIGHT }]}
            onPress={() => goWeek(currentIndex - 1)}
            disabled={!canPrevWeek}
            activeOpacity={0.7}
          >
            <DashboardArrow direction="left" size={WEEK_PAGER_ARROW_FONT_SIZE} boxHeight={WEEK_CONTROL_HEIGHT} disabled={!canPrevWeek} />
          </TouchableOpacity>

          <View style={styles.weekPagerDots}>
            {monthPagerWeeks.map((week) => {
              const dotStyle = week.isCurrent
                ? styles.weekPagerDotActive
                : week.inChallengeRange
                ? styles.weekPagerDotInRange
                : styles.weekPagerDotOutRange;

              const dotSize = week.isCurrent ? WEEK_PAGER_DOT_ACTIVE_SIZE : WEEK_PAGER_DOT_SIZE;
              const dotColor = week.isCurrent
                ? weeklyRenderColors.pagerActive
                : week.inChallengeRange
                ? weeklyRenderColors.pagerInactive
                : weeklyRenderColors.countBarFill;

              return (
                <TouchableOpacity
                  key={week.key}
                  style={[styles.weekPagerDotHit, { width: WEEK_PAGER_DOT_HIT_W, height: WEEK_CONTROL_HEIGHT }]}
                  onPress={() => {
                    if (week.dataIndex >= 0) goWeek(week.dataIndex);
                  }}
                  disabled={week.dataIndex < 0}
                  activeOpacity={0.75}
                >
                  <View style={[styles.weekPagerDot, dotStyle, { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: dotColor }]} />
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.weekPagerArrowHit, { width: WEEK_PAGER_ARROW_HIT_W, height: WEEK_CONTROL_HEIGHT }]}
            onPress={() => goWeek(currentIndex + 1)}
            disabled={!canNextWeek}
            activeOpacity={0.7}
          >
            <DashboardArrow direction="right" size={WEEK_PAGER_ARROW_FONT_SIZE} boxHeight={WEEK_CONTROL_HEIGHT} disabled={!canNextWeek} />
          </TouchableOpacity>
        </View>
      </View>
    </DashboardWidgetShell>
  );
});

const GRASS_ROWS = 7;
const GRASS_WAVE_COLS = 60;
const DOW_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DOW_SHOW = [1, 3, 5]; // Mon, Wed, Fri

const GrassGraph = memo(function GrassGraph({ entries, startDate, endDate, introProgress = 1, onTap, onTapGrass, dashboardReturnTrigger = 0, graphId = GRAPH_RENDER_GRAPH_IDS.GRASS_GRAPH }) {
    useEffect(() => {
      return () => {};
    }, []);
  const [containerSize, setContainerSize] = useState({
    width: SCREEN_WIDTH - EDGE * 2,
    height: 124,
  });
  const grassScrollRef = useRef(null);
  const [waveTrigger, setWaveTrigger] = useState(0);
  const [scrollPos, setScrollPos] = useState({ x: 0, w: 0 });
  const wavePosition = useSharedValue(0);

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

  const grassRenderRule = useMemo(
    () => resolveGraphFamilyStandardRule({ graphId }),
    [graphId]
  );
  const grassRenderColors = grassRenderRule.colors;
  const grassRenderLayout = grassRenderRule.layout;

  useEffect(() => { if (onTap) onTap(() => setWaveTrigger(t => t + 1)); }, [onTap]);
  useEffect(() => {
    if (!dashboardReturnTrigger) return;
    setWaveTrigger((t) => t + 1);
  }, [dashboardReturnTrigger]);

  useEffect(() => {
    const totalRows = grassRenderLayout.rows;
    const waveWidth = grassRenderLayout.waveWidth;
    const waveSpeed = grassRenderLayout.waveSpeed;
    const diagonal = grassRenderLayout.waveDiagonal;
    const endPosition = GRASS_WAVE_COLS + waveWidth + totalRows * diagonal;
    const duration = waveSpeed > 0 ? endPosition / waveSpeed : 0;

    wavePosition.value = 0;
    wavePosition.value = withTiming(endPosition, {
      duration,
      easing: ReanimatedEasing.linear,
    });
  }, [grassRenderLayout, wavePosition, waveTrigger]);

  const containerWidth = Math.max(1, containerSize.width);
  const containerHeight = Math.max(1, containerSize.height);

  const GRASS_BASE_HEIGHT = grassRenderLayout.baseHeight;
  const GRASS_SCALE_RAW = containerHeight / GRASS_BASE_HEIGHT;
  const GRASS_SCALE = Math.max(0.75, Math.min(1.45, GRASS_SCALE_RAW));
  const scaleGrass = (value, min, max) => {
    const scaled = value * GRASS_SCALE;
    return Math.max(min, Math.min(max, scaled));
  };

  const LEFT_LABEL_W = 0;
  const TOP_LABEL_H = Math.round(scaleGrass(grassRenderLayout.topLabelHeight, 14, 26));
  const TOP_LABEL_GAP = Math.round(scaleGrass(grassRenderLayout.topLabelGap, 3, 8));

  const MIN_CELL_SIZE = scaleGrass(grassRenderLayout.minCellSize, 6, 12);
  const MAX_CELL_SIZE = scaleGrass(grassRenderLayout.maxCellSize, 14, 26);
  const MIN_CELL_GAP = scaleGrass(grassRenderLayout.minCellGap, 1.5, 3);
  const MAX_CELL_GAP = scaleGrass(grassRenderLayout.maxCellGap, 3, 6);

  const GRASS_CELL_RADIUS = scaleGrass(grassRenderLayout.cellRadius, 1.5, 4);
  const GRASS_MONTH_FONT_SIZE = scaleGrass(grassRenderLayout.monthFontSize, 9.7, 11.2);
  const GRASS_MONTH_LINE_H = Math.round(scaleGrass(grassRenderLayout.monthLineHeight, 11, 16));

  const CELL_GAP = Math.max(
    MIN_CELL_GAP,
    Math.min(MAX_CELL_GAP, scaleGrass(grassRenderLayout.maxCellGap, 2, 6))
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
const GRASS_ARROW_BOX_H = TOP_LABEL_H;
const GRASS_ARROW_SIZE = scaleGrass(grassRenderLayout.arrowSize, 12, 18);

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
  const levelColors = useMemo(() => [
    grassRenderColors.level0,
    grassRenderColors.level1,
    grassRenderColors.level2,
    grassRenderColors.level3,
    grassRenderColors.level4,
  ], [
    grassRenderColors.level0,
    grassRenderColors.level1,
    grassRenderColors.level2,
    grassRenderColors.level3,
    grassRenderColors.level4,
  ]);
  const cellLevels = useMemo(() => {
    const levels = new Array(totalCols * GRASS_ROWS).fill(0);
    for (const cell of cellData) {
      if (cell.col < totalCols && cell.row < GRASS_ROWS) {
        levels[cell.col * GRASS_ROWS + cell.row] = cell.level;
      }
    }
    return levels;
  }, [cellData, totalCols]);

  const gridHeight = GRASS_ROWS * cellSize + (GRASS_ROWS - 1) * CELL_GAP;
  const waveColumnCount = Math.min(totalCols, GRASS_WAVE_COLS);
  const waveMaskWidth = Math.min(
    graphWidth,
    GRASS_WAVE_COLS * colUnit - CELL_GAP,
  );
  const grassWaveIdBase = useMemo(
    () => String(graphId || 'grass').replace(/[^a-zA-Z0-9_-]/g, '-'),
    [graphId],
  );
  const grassWavePatternId = `grass-wave-pattern-${grassWaveIdBase}`;
  const grassWaveMaskId = `grass-wave-mask-${grassWaveIdBase}`;
  const waveCellPaths = useDerivedValue(() => {
    const waveWidth = grassRenderLayout.waveWidth;
    const diagonal = grassRenderLayout.waveDiagonal;
    const wavePos = wavePosition.value;
    let low = '';
    let mid = '';
    let high = '';
    let peak = '';

    for (let row = 0; row < GRASS_ROWS; row += 1) {
      const centerCol = wavePos - row * diagonal;
      const firstCol = Math.max(0, Math.floor(centerCol - waveWidth));
      const lastCol = Math.min(
        waveColumnCount - 1,
        Math.ceil(centerCol + waveWidth),
      );

      for (let col = firstCol; col <= lastCol; col += 1) {
        const dist = Math.abs((col + row * diagonal) - wavePos);
        if (dist >= waveWidth) continue;
        const intensity = Math.sin(
          (1 - dist / waveWidth) * Math.PI * 0.5,
        );
        if (intensity <= 0.05) continue;

        const x = col * colUnit;
        const y = row * colUnit;
        const cellPath = `M ${x} ${y} h ${cellSize} v ${cellSize} h ${-cellSize} Z `;
        if (intensity > 0.85) peak += cellPath;
        else if (intensity > 0.6) high += cellPath;
        else if (intensity > 0.25) mid += cellPath;
        else low += cellPath;
      }
    }

    return { low, mid, high, peak };
  }, [
    cellSize,
    colUnit,
    grassRenderLayout.waveDiagonal,
    grassRenderLayout.waveWidth,
    waveColumnCount,
    wavePosition,
  ]);
  const waveLowAnimatedProps = useAnimatedProps(
    () => ({ d: waveCellPaths.value.low }),
  );
  const waveMidAnimatedProps = useAnimatedProps(
    () => ({ d: waveCellPaths.value.mid }),
  );
  const waveHighAnimatedProps = useAnimatedProps(
    () => ({ d: waveCellPaths.value.high }),
  );
  const wavePeakAnimatedProps = useAnimatedProps(
    () => ({ d: waveCellPaths.value.peak }),
  );

  const handlePressGrass = useCallback(() => {
    setWaveTrigger((t) => t + 1);
    if (typeof onTapGrass === 'function') {
      onTapGrass();
    }
  }, [onTapGrass]);

  const GridContent = useMemo(() => (
    <View style={{ flexDirection: 'row', width: graphWidth }}>
      {Array.from({ length: totalCols }).map((_, col) => {
        return (
          <View key={col} style={{ marginRight: col < totalCols - 1 ? CELL_GAP : 0 }}>
            {Array.from({ length: GRASS_ROWS }).map((__, row) => {
              const baseLevel = cellLevels[col * GRASS_ROWS + row] ?? 0;
              const baseColor = levelColors[baseLevel] ?? '#F3F4F6';
              return (
                <View key={row} style={{
                  width: cellSize, height: cellSize,
                  borderRadius: GRASS_CELL_RADIUS,
                  backgroundColor: baseColor,
                  marginBottom: row < GRASS_ROWS - 1 ? CELL_GAP : 0,
                }} />
              );
            })}
          </View>
        );
      })}
    </View>
  ), [
    CELL_GAP,
    GRASS_CELL_RADIUS,
    cellLevels,
    cellSize,
    graphWidth,
    levelColors,
    totalCols,
  ]);

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
                    {
                      left: ml.col * (cellSize + CELL_GAP),
                      fontSize: GRASS_MONTH_FONT_SIZE,
                      lineHeight: GRASS_MONTH_LINE_H,
                      color: grassRenderColors.monthLabel,
                      includeFontPadding: false,
                    },
                  ]}
                >
                  {ml.label}
                </Text>
              ))}
            </View>
            {/* 잔디 블록 영역 */}
            <TouchableOpacity onPress={handlePressGrass} activeOpacity={1}>
              <View style={{ width: graphWidth, height: gridHeight }}>
                {GridContent}
                <Svg
                  pointerEvents="none"
                  width={graphWidth}
                  height={gridHeight}
                  style={StyleSheet.absoluteFill}
                >
                  <Defs>
                    <Pattern
                      id={grassWavePatternId}
                      width={colUnit}
                      height={colUnit}
                      patternUnits="userSpaceOnUse"
                    >
                      <Rect
                        x={0}
                        y={0}
                        width={cellSize}
                        height={cellSize}
                        rx={GRASS_CELL_RADIUS}
                        fill="#FFFFFF"
                      />
                    </Pattern>
                    <Mask
                      id={grassWaveMaskId}
                      maskUnits="userSpaceOnUse"
                      maskContentUnits="userSpaceOnUse"
                    >
                      <Rect
                        x={0}
                        y={0}
                        width={waveMaskWidth}
                        height={gridHeight}
                        fill={`url(#${grassWavePatternId})`}
                      />
                    </Mask>
                  </Defs>
                  <G mask={`url(#${grassWaveMaskId})`}>
                    <ReanimatedSvgPath
                      animatedProps={waveLowAnimatedProps}
                      fill={grassRenderColors.waveLow}
                    />
                    <ReanimatedSvgPath
                      animatedProps={waveMidAnimatedProps}
                      fill={grassRenderColors.waveMid}
                    />
                    <ReanimatedSvgPath
                      animatedProps={waveHighAnimatedProps}
                      fill={grassRenderColors.waveHigh}
                    />
                    <ReanimatedSvgPath
                      animatedProps={wavePeakAnimatedProps}
                      fill={grassRenderColors.wavePeak}
                    />
                  </G>
                </Svg>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* 좌측 화살표 (Absolute) - 월 글씨 위치에 맞춤 */}
          {canScrollGrass && scrollPos.x > 5 && (
          <View style={styles.grassArrowLeft}>
            <TouchableOpacity onPress={() => grassScrollRef.current?.scrollTo({x: 0, animated: true})} hitSlop={{top:12, bottom:12, left:12, right:12}}>
              <DashboardArrow direction="left" size={GRASS_ARROW_SIZE} boxHeight={GRASS_ARROW_BOX_H} color={grassRenderColors.arrow} />
            </TouchableOpacity>
          </View>
        )}

        {/* 우측 화살표 (Absolute) */}
          {canScrollGrass && scrollPos.x + containerWidth < graphWidth - 5 && (
          <View style={styles.grassArrowRight}>
            <TouchableOpacity onPress={() => grassScrollRef.current?.scrollToEnd({animated: true})} hitSlop={{top:12, bottom:12, left:12, right:12}}>
              <DashboardArrow direction="right" size={GRASS_ARROW_SIZE} boxHeight={GRASS_ARROW_BOX_H} color={grassRenderColors.arrow} />
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
              <Text style={{ marginTop: 4, color: canonicalColor.textPrimary }}>
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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [entryListFrameWidth, setEntryListFrameWidth] = useState(0);
  const entryListLayoutWidth = entryListFrameWidth || windowWidth;
  const entryListLayoutKey = Math.round(Number(entryListLayoutWidth || 0));
  const WIDE_GRID_COLUMNS = GRID_COLUMNS * 2;
  const foldableLayoutRefreshKey = `${entryListLayoutKey}:${Math.round(windowHeight || 0)}`;
  const { refresh: refreshFoldableLayoutState } = useFoldableLayoutState(foldableLayoutRefreshKey);
  const isWideDashboardLayout = entryListLayoutWidth >= 600;

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      const refreshNow = async () => {
        try {
          await refreshFoldableLayoutState();
        } catch (error) {
          console.warn('[EntryList][foldableRefresh][focus] failed:', error);
        }
      };

      refreshNow();

      const delayedRefreshTimer = setTimeout(() => {
        if (alive) {
          refreshNow();
        }
      }, 350);

      return () => {
        alive = false;
        clearTimeout(delayedRefreshTimer);
      };
    }, [refreshFoldableLayoutState])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;

      refreshFoldableLayoutState().catch((error) => {
        console.warn('[EntryList][foldableRefresh][active] failed:', error);
      });

      setTimeout(() => {
        refreshFoldableLayoutState().catch((error) => {
          console.warn('[EntryList][foldableRefresh][activeDelayed] failed:', error);
        });
      }, 350);
    });

    return () => subscription.remove();
  }, [refreshFoldableLayoutState]);

  const shareCaptureWidth = Math.max(1, Math.floor(windowWidth || SCREEN_WIDTH));
  const headerTitleContainerWidth = Math.max(160, shareCaptureWidth - 120);

  const {

    challengeId,
    title: titleFromRoute,
    startDate: startDateFromRoute,
    targetScore: targetScoreFromRoute,
    goalScore: goalScoreFromRoute,
    endDate: endDateFromRoute,
    rewardTitle: rewardTitleFromRoute,
    reward: rewardFromRoute,
    dashboardEditLayout,
    dashboardEditRowGap,
    readOnly = false,
  } = params;

    const [dashboardLayoutReady, setDashboardLayoutReady] = useState(false);



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
  const [dashboardRowGap, setDashboardRowGap] = useState(DASHBOARD_ROW_GAP_DEFAULT);
  const [dashboardLayoutHasStored, setDashboardLayoutHasStored] = useState(false);

  useFocusEffect(
  useCallback(() => {
    let mounted = true;
    setDashboardLayoutReady(false);
    const loadDashboardLayout = async () => {
      try {
        const [result, storedRowGap] = await Promise.all([
          getDashboardLayoutStateForChallenge(challengeId, dashboardTarget),
          getDashboardRowGapForChallenge(challengeId),
        ]);
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
        setDashboardRowGap(storedRowGap);
        const nextLayout = Array.isArray(result?.layout) ? result.layout : getDefaultDashboardLayout(dashboardTarget);
        setDashboardLayoutHasStored(Boolean(result?.hasStoredLayout));
        setDashboardLayout(nextLayout.map((item) => ({ ...item })));
      } catch (error) {
        console.log('Failed to load dashboard layout', error);
        if (!mounted) return;
        const fallbackLayout = getDefaultDashboardLayout(dashboardTarget);
        setDashboardRowGap(DASHBOARD_ROW_GAP_DEFAULT);
        setDashboardLayoutHasStored(false);
        setDashboardLayout(fallbackLayout.map((item) => ({ ...item })));
      } finally {
        if (mounted) {
          setDashboardLayoutReady(true);
        }
      }
    };
    loadDashboardLayout();
    return () => { mounted = false; };
    }, [challengeId, dashboardTarget])
)

  const isFocused = useIsFocused();

  useEffect(() => {
    const wasWideLayout = previousWideLayoutRef.current;
    previousWideLayoutRef.current = isWideDashboardLayout;

    wideReflowFadeAnim.stopAnimation();

    if (!isFocused) {
      wideReflowFadeAnim.setValue(1);
      return;
    }

    if (wasWideLayout !== isWideDashboardLayout) {
      wideReflowFadeAnim.setValue(0.62);
      Animated.timing(wideReflowFadeAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
      return;
    }

    wideReflowFadeAnim.setValue(1);
  }, [isFocused, isWideDashboardLayout, wideReflowFadeAnim]);

  // 뒤로가기 항상 ChallengeList로
  // 단, EntryListScreen이 현재 focus 상태일 때만 등록한다.
  // EntryDetailScreen이 위에 떠 있을 때 이 핸들러가 반응하면,
  // 인증 수정 화면에서 뒤로가기 시 인증 목록을 건너뛰고 ChallengeList로 나가는 문제가 생긴다.
  useFocusEffect(
    useCallback(() => {
      const sub = require('react-native').BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          navigation.navigate('ChallengeList');
          return true;
        }
      );

      return () => sub.remove();
    }, [navigation])
  );

  const [entries, setEntries] = useState([]);
  const [weeksData, setWeeksData] = useState([]);
  const [weekIndex, setWeekIndex] = useState(0);
  const [currentScore, setCurrentScore] = useState(0);

  const normalizeTargetScore = useCallback((value, fallback = 7) => {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    const fallbackNumeric = Number(fallback);
    return Number.isFinite(fallbackNumeric) && fallbackNumeric > 0 ? fallbackNumeric : 7;
  }, []);

  useEffect(() => {
    const routeScore =
      targetScoreFromRoute ??
      goalScoreFromRoute ??
      params.challenge?.targetScore ??
      params.challenge?.goalScore ??
      params.item?.targetScore ??
      params.item?.goalScore;

    if (routeScore == null) return;

    setTargetScore((current) => normalizeTargetScore(routeScore, current));
  }, [
    targetScoreFromRoute,
    goalScoreFromRoute,
    params.challenge?.targetScore,
    params.challenge?.goalScore,
    params.item?.targetScore,
    params.item?.goalScore,
    normalizeTargetScore,
  ]);

  const [targetScore, setTargetScore] = useState(() => normalizeTargetScore(
    targetScoreFromRoute ??
    goalScoreFromRoute ??
    params.challenge?.targetScore ??
    params.challenge?.goalScore ??
    params.item?.targetScore ??
    params.item?.goalScore,
    7,
  ));

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
      health_steps_weekly: 'healthStepsWeekly',
      health_steps_trend: 'healthStepsTrend',
      healthStepsTrend: 'healthStepsTrend',
      health_exercise_minutes_trend: 'healthExerciseMinutesTrend',
      healthExerciseMinutesTrend: 'healthExerciseMinutesTrend',
      health_distance_trend: 'healthDistanceTrend',
      healthDistanceTrend: 'healthDistanceTrend',
      healthStepsWeekly: 'healthStepsWeekly',
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
            progress={isShare ? undefined : donutProgressK}
            onPress={isShare ? undefined : runDonut}
            disabled={isShare}
            graphId={GRAPH_RENDER_GRAPH_IDS.OVERALL_PROGRESS}
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
              graphId={GRAPH_RENDER_GRAPH_IDS.MONTH_CALENDAR}
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
        <DashboardGoalWidget
          rewardText={meta.rewardTitle ?? meta.reward}
          graphId={GRAPH_RENDER_GRAPH_IDS.GOAL_BLACK_BOX}
        />
      );
    }

/* ───────── 건강 목표 달성률 ───────── */
const HealthStepsGoalRateWidget = memo(function HealthStepsGoalRateWidget(_ref) {
 var entries = _ref.entries || [];
 var disabled = _ref.disabled || false;
 var graphId = _ref.graphId || GRAPH_RENDER_GRAPH_IDS.HEALTH_STEPS_GOAL_RATE;

 var progressRenderRule = useMemo(function() {
 return resolveGraphFamilyVariantStandardRule({ graphId });
 }, [graphId]);
 var progressRenderColors = progressRenderRule.colors;
 var progressRenderLayout = progressRenderRule.layout;

 var todaySteps = useMemo(function() {
 var today = keyOf(new Date());
 var agg = aggregateHealthLinkedRecordsByDate(entries, 'steps');
 var found = null;
 for (var i = 0; i < agg.length; i++) {
 if (agg[i].key === today) { found = agg[i]; break; }
 }
 return found ? Number(found.value) || 0 : 0;
 }, [entries]);

 var goal = 8000;
 var rate = Math.min(100, Math.round((todaySteps / goal) * 100));
 var barWidthRatio = Number(progressRenderLayout.barWidthRatio) || 0.8;
 var barWidthPercent = Math.max(1, Math.min(100, Math.round(barWidthRatio * 100))) + '%';
 var progressFillColor = rate >= 100
 ? progressRenderColors.successFill
 : progressRenderColors.progressFill;

 return React.createElement(DashboardWidgetShell, {
 header: React.createElement(DashboardWidgetHeader, { title: '걸음 목표 달성률', hideSides: true })
 }, React.createElement(View, {
 style: {
 flex: 1,
 justifyContent: 'center',
 alignItems: 'center',
 padding: 8,
 opacity: disabled ? 0.92 : 1
 }
 },
 !entries || !entries.length ?
 React.createElement(Text, {
 style: {
 color: progressRenderColors.emptyText,
 fontSize: progressRenderLayout.captionFontSize,
 fontWeight: '700'
 }
 }, '걸음 수 데이터가 없습니다.')
 :
 React.createElement(React.Fragment, null,
 React.createElement(Text, {
 style: {
 color: progressRenderColors.valueText,
 fontSize: progressRenderLayout.valueFontSize,
 fontWeight: '900',
 includeFontPadding: false
 }
 },
 rate + '%'
 ),
 React.createElement(Text, {
 style: {
 color: progressRenderColors.captionText,
 fontSize: progressRenderLayout.captionFontSize,
 fontWeight: '700',
 marginTop: progressRenderLayout.gapAfterValue
 }
 },
 '오늘 ' + todaySteps.toLocaleString('ko-KR') + ' / ' + goal.toLocaleString('ko-KR') + '보'
 ),
 React.createElement(View, {
 style: {
 width: barWidthPercent,
 height: progressRenderLayout.barHeight,
 backgroundColor: progressRenderColors.trackFill,
 borderRadius: progressRenderLayout.barRadius,
 marginTop: progressRenderLayout.gapBeforeBar,
 overflow: 'hidden'
 }
 },
 React.createElement(View, {
 style: {
 width: rate + '%',
 height: '100%',
 backgroundColor: progressFillColor,
 borderRadius: progressRenderLayout.barRadius
 }
 })
 )
 )
 ));
});

/* ───────── 주간 요약 막대 카드 (재사용) ───────── */
const HealthWeeklyMetricWidget = memo(function HealthWeeklyMetricWidget(_ref2) {
 var entries = _ref2.entries || [];
 var metricType = _ref2.metricType || 'steps';
 var title = _ref2.title || '';
 var unit = _ref2.unit || '';
 var goalValue = _ref2.goalValue || 0;
 var isCumulative = _ref2.isCumulative || false;
 var disabled = _ref2.disabled || false;
 var graphId = _ref2.graphId || GRAPH_RENDER_GRAPH_IDS.HEALTH_STEPS_CUMULATIVE;

 var metricBarRenderRule = useMemo(function() {
 return resolveGraphFamilyVariantStandardRule({ graphId });
 }, [graphId]);
 var metricBarColors = metricBarRenderRule.colors;
 var metricBarLayout = metricBarRenderRule.layout;

 var boxState = useState({ width: 0, height: 0 });
 var box = boxState[0];
 var setBox = boxState[1];

 var onLayout = useCallback(function(e) {
 var w = Math.floor(e?.nativeEvent?.layout?.width || 0);
 var h = Math.floor(e?.nativeEvent?.layout?.height || 0);
 if (w <= 0 || h <= 0) return;
 setBox(function(p) {
 return (p.width === w && p.height === h) ? p : { width: w, height: h };});
 }, []);

 var series = useMemo(function() {
 var raw = aggregateHealthLinkedRecordsByDate(entries, metricType);
 if (isCumulative) {
 var cum = 0;
 return raw.map(function(item) {
 cum += Number(item.value) || 0;
 return { key: item.key, value: cum, label: item.label };
 });
 }
 return raw;
 }, [entries, metricType, isCumulative]);

 var latest = series.length > 0 ? series[series.length - 1] : null;

 var maxVal = 1;
 for (var i = 0; i < series.length; i++) {
 var v = Number(series[i].value) || 0;
 if (v > maxVal) maxVal = v;
 }
 if (goalValue > maxVal) maxVal = goalValue;

 var bodyHeight = Math.max(1, Number(box.height) || metricBarLayout.bodyBaseHeight);
 var chartHeight = Math.max(metricBarLayout.chartMinHeight, bodyHeight - metricBarLayout.chartBottomReserved);
 var displayVal = latest
 ? (metricType === 'steps'
 ? Math.round(Number(latest.value)).toLocaleString('ko-KR')
 : Number(latest.value).toFixed(1))
 : '0';
 var goalLineTop = goalValue > 0
 ? Math.max(0, Math.min(chartHeight - 1, Math.round(chartHeight * (1 - (goalValue / maxVal)))))
 : null;

 return React.createElement(DashboardWidgetShell, {
 header: React.createElement(DashboardWidgetHeader, { title: title, hideSides: true })
 }, React.createElement(View, {
 onLayout: onLayout,
 style: {
 flex: 1,
 paddingHorizontal: 8,
 paddingBottom: 4,
 opacity: disabled ? 0.92 : 1
 }
 },
 !series.length ?
 React.createElement(View, {
 style: {
 flex: 1,
 alignItems: 'center',
 justifyContent: 'center'
 }
 },
 React.createElement(Text, {
 style: {
 color: metricBarColors.emptyText,
 fontSize: metricBarLayout.valueFontSize,
 fontWeight: '700'
 }
 }, '데이터가 없습니다.')
 )
 :
 React.createElement(React.Fragment, null,
 React.createElement(View, {
 style: {
 position: 'relative',
 flexDirection: 'row',
 alignItems: 'flex-end',
 justifyContent: 'space-between',
 height: chartHeight,
 paddingTop: 4
 }
 },
 goalLineTop == null ? null : React.createElement(View, {
 pointerEvents: 'none',
 style: {
 position: 'absolute',
 left: 0,
 right: 0,
 top: goalLineTop,
 height: 1,
 backgroundColor: metricBarColors.goalLine,
 opacity: 0.8
 }
 }),
 series.map(function(item, i) {
 var v = Number(item.value) || 0;
 var barH = Math.max(
 metricBarLayout.minBarHeight,
 Math.round((v / maxVal) * (chartHeight - 8))
 );
 var barW = isCumulative
 ? metricBarLayout.cumulativeBarWidth
 : metricBarLayout.barWidth;
 var isLatest = i === series.length - 1;
 return React.createElement(View, {
 key: item.key,
 style: {
 flex: 1,
 alignItems: 'center',
 height: chartHeight,
 justifyContent: 'flex-end'
 }
 },
 React.createElement(View, {
 style: {
 width: barW,
 height: barH,
 borderRadius: metricBarLayout.barRadius,
 backgroundColor: isLatest ? metricBarColors.latestBarFill : metricBarColors.barFill,
 opacity: v > 0 ? 1 : 0.3
 }
 })
 );
 })
 ),
 React.createElement(View, {
 style: {
 flexDirection: 'row',
 justifyContent: 'flex-end',
 marginTop: 2
 }
 },
 React.createElement(Text, {
 style: {
 color: metricBarColors.valueText,
 fontSize: metricBarLayout.valueFontSize,
 fontWeight: '900'
 }}, '최신 ' + displayVal + unit)
 )
 )
 ));
});
    if (widgetKind === 'healthStepsGoalRate') {
          return (
            <HealthDashboardWidgetErrorBoundary widgetId="healthStepsGoalRate" title="걸음 목표 달성률">
            {React.createElement(HealthStepsGoalRateWidget, { entries: entries, disabled: isShare, graphId: GRAPH_RENDER_GRAPH_IDS.HEALTH_STEPS_GOAL_RATE, key: widgetKind + '-' + id })}
          </HealthDashboardWidgetErrorBoundary>
          );
        }
        if (widgetKind === 'healthStepsWeekly') {
      return (<HealthDashboardWidgetErrorBoundary widgetId="healthStepsWeekly" title="걸음 리듬">

        <View style={styles.weeklyWidgetArea}>
          <HealthStepsWeeklyWidget
            entries={entries}
            disabled={isShare}
            graphId={GRAPH_RENDER_GRAPH_IDS.HEALTH_STEPS_WEEKLY}
          />
        </View>

          </HealthDashboardWidgetErrorBoundary>);
    }
    if (widgetKind === 'healthStepsTrend') {
      return (<HealthDashboardWidgetErrorBoundary widgetId="healthStepsTrend" title="걸음 수 추세">

        <View style={styles.lineWidgetArea}>
          <HealthLinkedRecordsLineWidget entries={entries} metricType="steps" disabled={isShare} graphId={GRAPH_RENDER_GRAPH_IDS.HEALTH_STEPS_TREND}  startDate={meta.startDate} />
        </View>

          </HealthDashboardWidgetErrorBoundary>);
    }
    if (widgetKind === 'healthStepsCumulative') {
          return (
            <HealthDashboardWidgetErrorBoundary widgetId="healthStepsCumulative" title="누적 걸음수">
            {React.createElement(HealthWeeklyMetricWidget, { entries: entries, metricType: 'steps', title: '누적 걸음수', unit: '보', isCumulative: true, disabled: isShare, graphId: GRAPH_RENDER_GRAPH_IDS.HEALTH_STEPS_CUMULATIVE, key: widgetKind + '-' + id })}
          </HealthDashboardWidgetErrorBoundary>
          );
        }
        if (widgetKind === 'healthExerciseMinutesTrend') {
      return (<HealthDashboardWidgetErrorBoundary widgetId="healthExerciseMinutesTrend" title="운동 시간 추세">

        <View style={styles.lineWidgetArea}>
          <HealthLinkedRecordsLineWidget entries={entries} metricType="minutes" disabled={isShare} graphId={GRAPH_RENDER_GRAPH_IDS.HEALTH_EXERCISE_MINUTES_TREND}  startDate={meta.startDate} />
        </View>

          </HealthDashboardWidgetErrorBoundary>);
    }
    if (widgetKind === 'healthExerciseWeeklyMinutes') {
          return (
            <HealthDashboardWidgetErrorBoundary widgetId="healthExerciseWeeklyMinutes" title="주간 운동시간">
            {React.createElement(HealthWeeklyMetricWidget, { entries: entries, metricType: 'minutes', title: '주간 운동시간', unit: '분', disabled: isShare, graphId: GRAPH_RENDER_GRAPH_IDS.HEALTH_EXERCISE_WEEKLY_MINUTES, key: widgetKind + '-' + id })}
          </HealthDashboardWidgetErrorBoundary>
          );
        }
        if (widgetKind === 'healthDistanceWeekly') {
          return (
            <HealthDashboardWidgetErrorBoundary widgetId="healthDistanceWeekly" title="주간 이동거리">
            {React.createElement(HealthWeeklyMetricWidget, { entries: entries, metricType: 'distance', title: '주간 이동거리', unit: 'km', disabled: isShare, graphId: GRAPH_RENDER_GRAPH_IDS.HEALTH_DISTANCE_WEEKLY, key: widgetKind + '-' + id })}
          </HealthDashboardWidgetErrorBoundary>
          );
        }
        if (widgetKind === 'healthDistanceCumulative') {
          return (
            <HealthDashboardWidgetErrorBoundary widgetId="healthDistanceCumulative" title="누적 운동거리">
            {React.createElement(HealthWeeklyMetricWidget, { entries: entries, metricType: 'distance', title: '누적 운동거리', unit: 'km', isCumulative: true, disabled: isShare, graphId: GRAPH_RENDER_GRAPH_IDS.HEALTH_DISTANCE_CUMULATIVE, key: widgetKind + '-' + id })}
          </HealthDashboardWidgetErrorBoundary>
          );
        }
        if (widgetKind === 'healthDistanceTrend') {
      return (<HealthDashboardWidgetErrorBoundary widgetId="healthDistanceTrend" title="운동 거리 추세">

        <View style={styles.lineWidgetArea}>
          <HealthLinkedRecordsLineWidget entries={entries} metricType="distance" disabled={isShare} graphId={GRAPH_RENDER_GRAPH_IDS.HEALTH_DISTANCE_TREND}  startDate={meta.startDate} />
        </View>

          </HealthDashboardWidgetErrorBoundary>);
    }

    if (widgetKind === 'healthActiveCaloriesTrend') {
      return (<HealthDashboardWidgetErrorBoundary widgetId="healthActiveCaloriesTrend" title="운동 칼로리">

        <View style={styles.lineWidgetArea}>
          <HealthLinkedRecordsLineWidget entries={entries} metricType="calories" disabled={isShare} graphId={GRAPH_RENDER_GRAPH_IDS.HEALTH_ACTIVE_CALORIES_TREND}  startDate={meta.startDate} />
        </View>

          </HealthDashboardWidgetErrorBoundary>);
    }
    if (widgetKind === 'healthSleepHoursTrend') {
      return (<HealthDashboardWidgetErrorBoundary widgetId="healthSleepHoursTrend" title="수면 시간 추세">

        <View style={styles.lineWidgetArea}>
          <HealthLinkedRecordsLineWidget entries={entries} metricType="sleepHours" disabled={isShare} graphId={GRAPH_RENDER_GRAPH_IDS.HEALTH_SLEEP_HOURS_TREND}  startDate={meta.startDate} />
        </View>

          </HealthDashboardWidgetErrorBoundary>);
    }
    if (widgetKind === 'healthSleepRhythm') {
      return (<HealthDashboardWidgetErrorBoundary widgetId="healthSleepRhythm" title="수면 리듬">

        <View style={styles.weeklyWidgetArea}>
          <HealthSleepRhythmWidget entries={entries} disabled={isShare} graphId={GRAPH_RENDER_GRAPH_IDS.HEALTH_SLEEP_RHYTHM} />
        </View>

          </HealthDashboardWidgetErrorBoundary>);
    }
    if (widgetKind === 'healthHeartRateTrend') {
      return (<HealthDashboardWidgetErrorBoundary widgetId="healthHeartRateTrend" title="평균 심박 추세">

        <View style={styles.lineWidgetArea}>
          <HealthLinkedRecordsLineWidget entries={entries} metricType="heartRate" disabled={isShare} graphId={GRAPH_RENDER_GRAPH_IDS.HEALTH_HEART_RATE_TREND}  startDate={meta.startDate} />
        </View>

          </HealthDashboardWidgetErrorBoundary>);
    }
    if (widgetKind === 'healthWeightTrend') {
      return (<HealthDashboardWidgetErrorBoundary widgetId="healthWeightTrend" title="체중 추세">

        <View style={styles.lineWidgetArea}>
          <HealthLinkedRecordsLineWidget entries={entries} metricType="weight" disabled={isShare} graphId={GRAPH_RENDER_GRAPH_IDS.HEALTH_WEIGHT_TREND}  startDate={meta.startDate} />
        </View>

          </HealthDashboardWidgetErrorBoundary>);
    }
    if (widgetKind === 'healthBodyFatTrend') {
      return (<HealthDashboardWidgetErrorBoundary widgetId="healthBodyFatTrend" title="체지방률 추세">

        <View style={styles.lineWidgetArea}>
          <HealthLinkedRecordsLineWidget entries={entries} metricType="bodyFat" disabled={isShare} graphId={GRAPH_RENDER_GRAPH_IDS.HEALTH_BODY_FAT_TREND}  startDate={meta.startDate} />
        </View>

          </HealthDashboardWidgetErrorBoundary>);
    }
    if (widgetKind === 'healthBmiTrend') {
      return (<HealthDashboardWidgetErrorBoundary widgetId="healthBmiTrend" title="BMI 추세">

        <View style={styles.lineWidgetArea}>
          <HealthLinkedRecordsLineWidget entries={entries} metricType="bmi" disabled={isShare} graphId={GRAPH_RENDER_GRAPH_IDS.HEALTH_BMI_TREND}  startDate={meta.startDate} />
        </View>

          </HealthDashboardWidgetErrorBoundary>);
    }

    if (widgetKind === 'weeklyBar') {
      return (
        <View style={styles.weeklyWidgetArea}>
          <WeekView
            weeksData={weeksData}
            currentIndex={weekIndex}
            onIndexChange={isShare ? undefined : setWeekIndex}
            weekIntroRunId={isShare ? null : weekIntroCommand.runId}
            weekIntroPhase={isShare ? null : weekIntroCommand.phase}
            weekIntroTargetIndex={isShare ? null : weekIntroCommand.targetIndex}
            onPressDay={isShare ? undefined : handlePressDay}
            onTapBar={isShare ? undefined : runWeek}
            challengeStartDate={meta.startDate}
            challengeEndDate={meta.endDate}
            graphId={GRAPH_RENDER_GRAPH_IDS.WEEKLY_BAR}
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
            graphId={GRAPH_RENDER_GRAPH_IDS.GRASS_GRAPH}
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
          lineIntroRunId={isShare ? null : lineIntroCommand.runId}
          lineIntroPhase={isShare ? null : lineIntroCommand.phase}
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
          lineIntroRunId={isShare ? null : lineIntroCommand.runId}
          lineIntroPhase={isShare ? null : lineIntroCommand.phase}
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
      targetScore,
      goalScore: meta?.goalScore ?? meta?.targetScore ?? targetScore,
      item: params.item,
      challenge: params.challenge,
      returnRouteKey: route?.key,
    });
  }, [navigation, challengeId, params, displayTitle, meta, route?.key, targetScore, meta?.goalScore, meta?.targetScore]);

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
  const [offscreenRenderReady, setOffscreenRenderReady] = useState(false);
  const grassTapRef = useRef(null);
  const wideReflowFadeAnim = useRef(new Animated.Value(1)).current;
  const previousWideLayoutRef = useRef(isWideDashboardLayout);
  const weekIndexRef = useRef(weekIndex);
  weekIndexRef.current = weekIndex;
  const isIntroAnimatingRef = useRef(false);
  const isDonutTapAnimatingRef = useRef(false);
  const isGrassAnimatingRef = useRef(false);
  const introAnimFrameRef = useRef(null);
  const donutTapAnimFrameRef = useRef(null);
  const skipDashboardReturnIntroRef = useRef(false);
  const skipDashboardReturnReloadRef = useRef(false);
  const dashboardReturnSuppressUntilRef = useRef(0);
  const dashboardReturnSuppressTimerRef = useRef(null);
  const dashboardReturnModeRef = useRef(null);
  const dashboardReturnIntroHandledRef = useRef(false);

  /* ── 인트로 애니메이션 ── */
  const [introK, setIntroK] = useState(0);
  const [donutK, setDonutK] = useState(1);
  const [weekIntroCommand, setWeekIntroCommand] = useState(() => ({
    runId: 0,
    phase: 'pending',
    targetIndex: null,
  }));
  const [lineIntroCommand, setLineIntroCommand] = useState(() => ({
    runId: 0,
    phase: 'pending',
  }));
  const [grassDashboardReturnTick, setGrassDashboardReturnTick] = useState(0);
 const [introReadyTick, setIntroReadyTick] = useState(0);
 const [reloadNonce, setReloadNonce] = useState(0);

  const cancelKFrame = useCallback((frameRef) => {
    if (frameRef?.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const cancelIntroAnimations = useCallback(() => {
    cancelKFrame(introAnimFrameRef);
    isIntroAnimatingRef.current = false;
  }, [cancelKFrame]);

const cancelWidgetTapAnimations = useCallback(() => {
    cancelKFrame(donutTapAnimFrameRef);
    isDonutTapAnimatingRef.current = false;
  }, [cancelKFrame]);

const setDonutTapK = useCallback((nextValue) => {
    setDonutK(nextValue);
  }, []);

  const animateK = useCallback((setter, onDone, frameRef = null) => {
    if (frameRef) {
      cancelKFrame(frameRef);
    }

    const ease = (t) => (
      t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2
    );
    const DUR = 900;
    const MIN_SETTER_INTERVAL = 16;
    const t0 = Date.now();
    let lastSetterAt = 0;

    const tick = () => {
      const now = Date.now();
      const t = Math.min(1, (now - t0) / DUR);
      const k = ease(t);

      if (now - lastSetterAt >= MIN_SETTER_INTERVAL || t >= 1) {
        setter(k);
        lastSetterAt = now;
      }

      if (t < 1) {
        const nextFrame = requestAnimationFrame(tick);
        if (frameRef) {
          frameRef.current = nextFrame;
        }
        return;
      }

      if (frameRef) {
        frameRef.current = null;
      }
      if (typeof onDone === 'function') onDone();
    };

    const firstFrame = requestAnimationFrame(tick);
    if (frameRef) {
      frameRef.current = firstFrame;
    }
    return firstFrame;
  }, [cancelKFrame]);

  const runTapAnimation = useCallback((setter, frameRef, busyRef) => {
    if (isIntroAnimatingRef.current || busyRef.current) return;

    busyRef.current = true;
    setter(0);
    animateK(setter, () => {
      busyRef.current = false;
    }, frameRef);
  }, [animateK]);

  const runDonut = useCallback(() => {
    runTapAnimation(setDonutK, donutTapAnimFrameRef, isDonutTapAnimatingRef);
  }, [runTapAnimation]);

  const hasWeeklyDataReady = Array.isArray(weeksData) && weeksData.length > 0;

const hasWeeklyBarData = useMemo(() => (
  hasWeeklyDataReady &&
  weeksData.some((week) => (
    Array.isArray(week?.dailyStats) &&
    week.dailyStats.some((stat) => (
      (Number(stat?.duration) || 0) > 0 ||
      (Number(stat?.totalCount) || 0) > 0
    ))
  ))
), [weeksData, hasWeeklyDataReady]);

const runWeek = useCallback(() => {
    if (hasWeeklyDataReady && !hasWeeklyBarData) {
      setWeekIntroCommand((current) => ({
        runId: current.runId + 1,
        phase: 'complete',
        targetIndex: weekIndex,
      }));
      return;
    }

    setWeekIntroCommand((current) => ({
      runId: current.runId + 1,
      phase: 'animate',
      targetIndex: weekIndex,
    }));
  }, [hasWeeklyDataReady, hasWeeklyBarData, weekIndex]);

  useEffect(() => {
    if (hasWeeklyDataReady && !hasWeeklyBarData) {
      setWeekIntroCommand((current) => ({
        runId: current.runId + 1,
        phase: 'complete',
        targetIndex: weekIndexRef.current,
      }));
      setIntroK(1);
    }
  }, [hasWeeklyDataReady, hasWeeklyBarData]);

  const donutProgressK = introK * donutK;

  const updateWeekIntro = useCallback((phase) => {
    setWeekIntroCommand((current) => ({
      runId: current.runId + 1,
      phase,
      targetIndex: weekIndexRef.current,
    }));
  }, []);

  const updateLineIntro = useCallback((phase) => {
    setLineIntroCommand((current) => ({
      runId: current.runId + 1,
      phase,
    }));
  }, []);

  const runAllIntro = useCallback(() => {
    cancelIntroAnimations();
    cancelWidgetTapAnimations();
    setDonutTapK(1);
    updateLineIntro('animate');

    if (hasWeeklyDataReady && !hasWeeklyBarData) {
      updateWeekIntro('complete');
      setIntroK(1);
      return;
    }

    updateWeekIntro('animate');
    isIntroAnimatingRef.current = true;
    setIntroK(0);
    animateK(setIntroK, () => { isIntroAnimatingRef.current = false; }, introAnimFrameRef);
  }, [animateK, cancelIntroAnimations, cancelWidgetTapAnimations, setDonutTapK, hasWeeklyDataReady, hasWeeklyBarData, updateLineIntro, updateWeekIntro]);

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

    const statsByDay = new Map();
    for (const entry of list) {
      const entryDate = new Date(entry.timestamp);
      if (Number.isNaN(entryDate.getTime())) continue;

      const dayKey = new Date(
        entryDate.getFullYear(),
        entryDate.getMonth(),
        entryDate.getDate(),
      ).getTime();
      const current = statsByDay.get(dayKey) || {
        duration: 0,
        totalCount: 0,
        durations: [],
      };

      current.totalCount += 1;
      if (typeof entry.duration === 'number' && entry.duration > 0) {
        current.duration += entry.duration;
        current.durations.push(entry.duration);
      }
      statsByDay.set(dayKey, current);
    }

    const now = new Date(); const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const td = todayMid.getDay();
    const thisSaturday = new Date(todayMid); thisSaturday.setDate(todayMid.getDate() + (6 - td));

    const weeks = [];
    let cursor = new Date(start);
    while (cursor <= thisSaturday) {
      const wsMid = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      const dailyStats = Array(7).fill(null).map((_, i) => {
        const dayStart = new Date(wsMid); dayStart.setDate(wsMid.getDate() + i);
        const dayStats = statsByDay.get(dayStart.getTime());
        const durations = dayStats?.durations || [];

        return {
          date: `${dayStart.getMonth() + 1}/${dayStart.getDate()}`,
          duration: dayStats?.duration || 0,
          countTimed: durations.length,
          totalCount: dayStats?.totalCount || 0,
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

    if (normalizedMode === 'save') {
      if (Array.isArray(dashboardEditLayout) && dashboardEditLayout.length > 0) {
        setDashboardLayout(dashboardEditLayout.map((item) => ({ ...item })));
        setDashboardLayoutHasStored(true);
      }

      const numericRowGap = Number(dashboardEditRowGap);
      if (Number.isFinite(numericRowGap) && numericRowGap >= 0) {
        setDashboardRowGap(numericRowGap);
      }
    }

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

    cancelWidgetTapAnimations();
    setDonutTapK(1);

    if (normalizedMode === 'save') {
      setIntroK(0);
      updateLineIntro('pending');
      updateWeekIntro('pending');
      setGrassDashboardReturnTick((tick) => tick + 1);
    } else {
      setIntroK(1);
      updateLineIntro('complete');
      updateWeekIntro('complete');
    }
  }, [dashboardEditReturnMode, dashboardEditReturnedAt, dashboardEditLayout, dashboardEditRowGap, cancelWidgetTapAnimations, setDonutTapK, updateLineIntro, updateWeekIntro]);

  // focus 해제 시 저장 복귀 skip ref 초기화
  useEffect(() => {
    if (isFocused) return;
    if (dashboardReturnSuppressUntilRef.current > Date.now()) return;
    skipDashboardReturnIntroRef.current = false;
    skipDashboardReturnReloadRef.current = false;
    dashboardReturnModeRef.current = null;
    dashboardReturnIntroHandledRef.current = false;
  }, [isFocused]);

  // 인트로 애니메이션 — 데이터·저장 레이아웃 준비 후 한 번만 실행
  useEffect(() => {
    if (!isFocused || introReadyTick === 0) return;
    if (!dashboardLayoutReady) return;
    if (!Array.isArray(dashboardLayout) || dashboardLayout.length === 0) return;

    let cancelled = false;
    let timeoutId = null;

    const task = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(() => {
        if (cancelled) return;

        const suppressDashboardReturn = dashboardReturnSuppressUntilRef.current > Date.now();
        const dashboardReturnMode = dashboardReturnModeRef.current;

        if (skipDashboardReturnIntroRef.current || suppressDashboardReturn) {
          if (dashboardReturnMode === 'save') {
            if (!dashboardReturnIntroHandledRef.current) {
              dashboardReturnIntroHandledRef.current = true;
              runAllIntro();
            }
            return;
          }

          if (dashboardReturnMode === 'cancel') {
            if (!dashboardReturnIntroHandledRef.current) {
              dashboardReturnIntroHandledRef.current = true;
              setIntroK(1);
              updateLineIntro('complete');
              updateWeekIntro('complete');
            }
            return;
          }

          setIntroK(1);
          updateLineIntro('complete');
          updateWeekIntro('complete');
          return;
        }
        runAllIntro();
      }, 180);
    });

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (task && typeof task.cancel === 'function') {
        task.cancel();
      }
    };
  }, [isFocused, introReadyTick, dashboardLayoutReady, dashboardLayout.length, runAllIntro, navigation, updateLineIntro, updateWeekIntro]);

  useEffect(() => {
    if (!isFocused) {
      setOffscreenRenderReady(false);
      return;
    }

    if (introReadyTick === 0) {
      setOffscreenRenderReady(false);
      return;
    }

    setOffscreenRenderReady(false);

    let cancelled = false;
    let timeoutId = null;

    const task = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(() => {
        if (!cancelled) {
          setOffscreenRenderReady(true);
        }
      }, 2800);
    });

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (task && typeof task.cancel === 'function') {
        task.cancel();
      }
    };
  }, [isFocused, introReadyTick, challengeId]);

  useEffect(()=>()=>{
    aliveRef.current = false;
    loadingRef.current = false;
    cancelIntroAnimations();
    cancelWidgetTapAnimations();
    if (dashboardReturnSuppressTimerRef.current) {
      clearTimeout(dashboardReturnSuppressTimerRef.current);
      dashboardReturnSuppressTimerRef.current = null;
    }
    dashboardReturnModeRef.current = null;
    dashboardReturnIntroHandledRef.current = false;
  },[cancelIntroAnimations, cancelWidgetTapAnimations]);

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

    const GRID_ROW_HEIGHT_VIEW = 60;
    const GRID_ROW_GAP_VIEW = Math.max(0, Number(dashboardRowGap) || DASHBOARD_ROW_GAP_DEFAULT);
    const GRID_CELL_PADDING_VIEW = 4;
    const DASHBOARD_BOARD_SIDE_BLEED = 4;

 const effectiveGridColumns =
 isWideDashboardLayout
 ? WIDE_GRID_COLUMNS
 : GRID_COLUMNS;

 const baseSafeLayout = baseLayout.map(
 (item, index) => {
 const widgetId =
 item.widgetId ||
 item.id ||
 item.i ||
 `dashboard_graph_${index}`;

 const safeW = Math.max(
 1,
 Math.min(
 GRID_COLUMNS,
 Number(item.w) || GRID_COLUMNS,
 ),
 );

 const safeH = Math.max(
 1,
 Number(item.h) || 1,
 );

 const safeX = Math.max(
 0,
 Math.min(
 GRID_COLUMNS - safeW,
 Number(item.x) || 0,
 ),
 );

 const safeY = Number.isFinite(
 Number(item.y),
 )
 ? Math.max(0, Number(item.y))
 : index;

 return {
 ...item,
 id: widgetId,
 widgetId,
 x: safeX,
 y: safeY,
 w: safeW,
 h: safeH,
 };
 },
 );

 const safeLayout =
 buildResponsiveDashboardLayout(
 baseSafeLayout,
 {
 columns: effectiveGridColumns,
 maxCardWidth: GRID_COLUMNS,
 },
 );

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
      const safeW = Math.max(1, Math.min(effectiveGridColumns, Number(item.w) || GRID_COLUMNS));
      const safeX = Math.max(0, Math.min(effectiveGridColumns - safeW, Number(item.x) || 0));
      const safeY = Math.max(0, Number(item.y) || 0);
      const safeH = Math.max(1, Number(item.h) || 1);

      const leftPct = `${(safeX / effectiveGridColumns) * 100}%`;
      const widthPct = `${(safeW / effectiveGridColumns) * 100}%`;
      const top = safeY * (GRID_ROW_HEIGHT_VIEW + GRID_ROW_GAP_VIEW);
      const height = safeH * GRID_ROW_HEIGHT_VIEW;

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
      <View
    style={{ marginTop: isShare ? 10 : 20 }}
  >
        {!isShare && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: canonicalColor.textPrimary }}>대시보드</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                onPress={enterDashboardEdit}
                activeOpacity={0.85}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <DashboardEditIcon />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ marginHorizontal: -DASHBOARD_BOARD_SIDE_BLEED }}>
          <Animated.View
            style={[
              { position: 'relative', width: '100%', height: boardHeight },
              !isShare && isWideDashboardLayout ? { opacity: wideReflowFadeAnim } : null,
            ]}
          >
            {safeLayout.map((item, index) => renderAbsoluteSlot(item, index))}
          </Animated.View>
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
          <TitleTwoLine text={displayTitle} style={styles.title} containerWidth={headerTitleContainerWidth} />
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
    weekIndex, donutProgressK, entries, overallPct, highlightDate, isWideDashboardLayout, wideReflowFadeAnim,
    lineIntroCommand.runId, lineIntroCommand.phase,
    weekIntroCommand.runId, weekIntroCommand.phase, weekIntroCommand.targetIndex
  , dashboardLayout, dashboardRowGap,
    displayTitle, headerTitleContainerWidth
  ]);

  /* ===== 헤더 카드(공유 캡처용) ===== */
  const HeaderCardForShare = useMemo(()=>(<View style={styles.card}>
            <View style={styles.headerTop}>
        <View style={styles.headerInfoBtn}>
           <ShadowIcon forShare={true} />
        </View>
        <View style={styles.headerTitleWrap}>
          <TitleTwoLine text={displayTitle} style={styles.title} containerWidth={headerTitleContainerWidth} />
          <Text style={[styles.period, { textAlign:'center' }]}>{`${fmtDate(meta.startDate)} ~ ${fmtDate(meta.endDate)}`}</Text>
        </View>
        <View style={styles.headerInfoBtn} />
      </View>

            {DashboardGraphArea({ isShare: true })}
    </View>
  ), [meta.title, meta.startDate, meta.endDate,
    weeksData, monthDate, canPrevMonth, canNextMonth, entriesByDaySet,
    weekIndex, entries, overallPct,
    isWideDashboardLayout, dashboardLayout, dashboardRowGap,
    displayTitle, headerTitleContainerWidth
  ]);

  const cidForDebug = String(route?.params?.challengeId ?? route?.params?.id ?? challengeId ?? '');

  const handleShare = useCallback(async ()=>{
    try {
      if (!offscreenRenderReady) {
        setOffscreenRenderReady(true);
        await new Promise(r => setTimeout(r, 320));
      } else {
        await new Promise(r => setTimeout(r, 80));
      }
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
  }, [ meta.title, offscreenRenderReady ]);

  const renderEntryItem = useCallback(({ item, index }) => {
    const indexFromEnd = sortedEntries.length - index;
    const onPress = readOnly ? undefined : () =>
      navigation.navigate('EntryDetail', { challengeId, entryId: item.id, title: displayTitle });

    if (isWideDashboardLayout) {
      return (
        <View
          style={[
            styles.entryGridItemWide,
            index % 2 === 0 ? styles.entryGridItemWideLeft : styles.entryGridItemWideRight,
          ]}
        >
          <EntryRow item={item} indexFromEnd={indexFromEnd} readOnly={readOnly} onPress={onPress}/>
        </View>
      );
    }

    return (
      <View>
        <EntryRow item={item} indexFromEnd={indexFromEnd} readOnly={readOnly} onPress={onPress}/>
        <View style={[styles.separator, styles.sectionPadNarrow]} />
      </View>
    );
  }, [challengeId, displayTitle, isWideDashboardLayout, navigation, readOnly, sortedEntries.length]);

  const entryKeyExtractor = useCallback(
    (item, index) => String(item?.id ?? `${item?.timestamp ?? 0}-${index}`),
    [],
  );

  const handleEntryListLayout = useCallback((event) => {
    setEntryListFrameWidth(event.nativeEvent.layout.width || 0);
  }, []);

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

            {/* 공유 캡처는 실제 화면 상단 영역의 ViewShot을 직접 사용한다. */}


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
      <FlatList
        key={isWideDashboardLayout ? 'entry-list-wide' : 'entry-list-normal'}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        onLayout={handleEntryListLayout}
        data={sortedEntries}
        renderItem={renderEntryItem}
        keyExtractor={entryKeyExtractor}
        numColumns={isWideDashboardLayout ? 2 : 1}
        columnWrapperStyle={isWideDashboardLayout ? styles.entryGridWide : undefined}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={32}
        windowSize={7}
        ListHeaderComponent={(
          <ViewShot ref={shareRef} style={{ width: '100%' }} options={{ format: 'png', quality: 1 }}>
          <View collapsable={false} style={{ width: '100%', backgroundColor: '#fff' }}>
        <HeaderWithCountMemo HeaderCard={HeaderCard} />

        {/* 보상 박스 (위/아래 간격을 상수로 제어) */}
<View style={[styles.sectionPadNarrow, styles.rewardBlockSpacing]}>

</View>

{/* 누적시간 / 전체·남은 횟수 (postSummaryRow는 marginTop:0) */}
<View style={[styles.postSummaryRow, styles.sectionPadNarrow]}>
  <Text style={styles.accumText}>누적시간 : {hours}시간 {minutes}분</Text>
  <Text style={styles.countBelowText}>{`${currentScore}/${targetScore}`}</Text>
</View>

          <View style={{ height: EDGE }} />
          </View>
        </ViewShot>
        )}
        ListEmptyComponent={(
          <Text style={[styles.empty, styles.sectionPadNarrow]}>등록된 인증이 없습니다.</Text>
        )}
        ListFooterComponent={<View style={{ height: insets.bottom + 24 }} />}
      />

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
{offscreenRenderReady && (
<WidgetDonutCapture1x1
  challengeId={challengeId}
  deps={[overallPct /* 또는 progressPct 등 진행률 변수 */]}
  renderDonut={(size) => (
   <Donut targetPercent={overallPct} progress={1} size={size} />
  )}
/>
)}


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
  headerBackArrow: { fontSize: 32, fontWeight: '300', color: canonicalColor.textPrimary, lineHeight: 32, includeFontPadding: false, marginTop: -8 },
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

  title: { fontSize: 20, fontWeight: '800', color: canonicalColor.textPrimary, lineHeight: 26 },
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
    color: canonicalColor.textPrimary,
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
  dashboardArrowBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashboardArrowText: {
    fontWeight: '800',
    color: canonicalColor.textPrimary,
    includeFontPadding: false,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
weekPagerArrow: {
  fontSize: 15,
  fontWeight: '800',
  color: canonicalColor.textPrimary,
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
  fontSize: 10.5,
  lineHeight: 13,
  fontWeight: '700',
  color: '#6B7280',
  includeFontPadding: false,
},
grassArrowLeft: {
  position: 'absolute',
  left: 0,
  top: 0,
  height: 18,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255,255,255,0.72)',
  borderRadius: 6,
  paddingHorizontal: 2,
},
grassArrowRight: {
  position: 'absolute',
  right: 0,
  top: 0,
  height: 18,
  alignItems: 'center',
  justifyContent: 'center',
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
  borderRadius: radius.md,
  backgroundColor: canonicalColor.primary,
  paddingVertical: 10,
  paddingHorizontal: 16,
  alignItems: 'center',
  justifyContent: 'center',
},
rewardBlackText: { fontSize: 17, fontWeight: '900', color: canonicalColor.textInverse },

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
  calNavText: { fontSize: 15, fontWeight: '800', color: canonicalColor.textPrimary },
  calTitle: { fontSize: 12, fontWeight: '700', color: canonicalColor.textPrimary },
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
    width: 24,
    paddingHorizontal: 0,
    paddingVertical: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    transform: [{ translateY: DASHBOARD_WIDGET_HEADER_TITLE_TOP_ADJUST }],
  },
  dashboardWidgetHeaderSideDisabled: {
    opacity: 0.3,
  },
  dashboardWidgetHeaderSideInvisible: {
    width: 0,
    paddingHorizontal: 0,
    opacity: 0,
  },
  dashboardWidgetHeaderNavText: {
    fontSize: 15,
    fontWeight: '800',
    color: canonicalColor.textPrimary,
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
    height: DASHBOARD_WIDGET_HEADER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-start',
    transform: [{ translateY: DASHBOARD_WIDGET_HEADER_TITLE_TOP_ADJUST }],
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
    justifyContent: 'flex-start',
  },
  dashboardWidgetHeaderTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    color: canonicalColor.textPrimary,
    textAlign: 'center',
    includeFontPadding: false,
    transform: [{ translateY: DASHBOARD_WIDGET_HEADER_TITLE_TOP_ADJUST }],
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
  calCellText: { fontSize: 9.5, color: canonicalColor.textPrimary },
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

  entryGridWide: {
    paddingHorizontal: EDGE + NARROW_PLUS,
  },
  entryGridItemWide: {
    width: '50%',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  entryGridItemWideLeft: {
    paddingRight: 4,
  },
  entryGridItemWideRight: {
    paddingLeft: 4,
  },

  shareBtn: {
    position: 'absolute', right: 12,
    backgroundColor: canonicalColor.primary, borderRadius: radius.md,
    width: 52, height: 42,
    alignItems: 'center', justifyContent: 'center',
    elevation: 3,
  },
  shareBtnText: { color: canonicalColor.textInverse, fontWeight: '800', fontSize: 13 },

  uploadFloatingBtn: {
    position: 'absolute', left: 12,
    backgroundColor: canonicalColor.primary, borderRadius: radius.md,
    width: 52, height: 42,
    alignItems: 'center', justifyContent: 'center',
    elevation: 3,
  },
  uploadFloatingText: { color: canonicalColor.textInverse, fontWeight: '800', fontSize: 13 },

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
  modalFieldValue: { fontSize: 13, color: canonicalColor.textPrimary },
  modalFieldValueMultiline: { fontSize: 13, color: canonicalColor.textPrimary, lineHeight: 18 },
});
