// screens/EntryListScreen.js
import React, {
  useState, useEffect, useRef, useMemo, useCallback, memo,
} from 'react';
import {
  SafeAreaView, View, Text, FlatList, Image, StyleSheet, TouchableOpacity,
  Dimensions, ScrollView, Share, Modal, TouchableWithoutFeedback
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const CAL_HEADER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const ICON = require('../assets/icon.png');

const SCROLL_MODE = 'today';
const baseBlack = '#111111';
const progressGrey = '#E5E7EB';
const textGrey = '#666666'; // ✅ 회색 텍스트 통일

/* ───────── 유틸 ───────── */
const pad2 = (n)=>String(n).padStart(2,'0');
const keyOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
function lighten(hex, step = 0) {
  const p = Math.min(step * 5, 90) / 100;
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  r = Math.round(r + (255 - r) * p);
  g = Math.round(g + (255 - g) * p);
  b = Math.round(b + (255 - b) * p);
  const toHex = (x)=>x.toString(16).padStart(2,'0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

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

/* ───────── 제목: 2줄 고정 + 넘치면 말줄임 ───────── */
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

/* ───────── 알림 미니 프리뷰 (기존 유지, 텍스트 회색 통일) ───────── */
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
      <Text style={{ fontSize:12, color:textGrey, textAlign:'center' }}>{toShow.length? toShow.join('  ') : '시간 미설정'}</Text>
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
                            <Text style={{ fontSize:11, fontWeight:'800', color: show?textGrey:textGrey, textAlign:'right' }}>{d}</Text>
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
  startDate, endDate, entriesByDaySet, onPrev, onNext, monthDate, canPrev, canNext,
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

  return (
    <View style={styles.calWrap}>
      <View style={styles.calHeaderRow}>
        <TouchableOpacity onPress={canPrev ? onPrev : undefined} disabled={!canPrev} style={[styles.calNavBtn, !canPrev && {opacity:0.3}]}>
          <Text style={styles.calNavText}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.calTitle}>{`${month + 1}월`}</Text>
        <TouchableOpacity onPress={canNext ? onNext : undefined} disabled={!canNext} style={[styles.calNavBtn, !canNext && {opacity:0.3}]}>
          <Text style={styles.calNavText}>{'›'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.calDowRow}>
        {CAL_HEADER.map((ch, i)=><Text key={`dow-${i}`} style={styles.calDow}>{ch}</Text>)}
      </View>

      <View style={styles.calGrid}>
        {cells.map((d, idx)=>{
          if (!d) return <View key={`e${idx}`} style={styles.calCell}/>;
          const ranged = inRange(d);
          const isThisMonth = d.getMonth()===month;
          if (!isThisMonth) return <View key={`o${idx}`} style={styles.calCell} />;

          const cert = isCert(d);
          if (cert) {
            return (
              <View key={`d${idx}`} style={styles.calCell}>
                <View style={styles.calBadge}>
                  <Text style={styles.calBadgeText}>{d.getDate()}</Text>
                </View>
              </View>
            );
          }
          return (
            <View key={`d${idx}`} style={styles.calCell}>
              <Text style={[styles.calCellText, !ranged && styles.calCellTextDim]}>
                {d.getDate()}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
});

/* ───────── 전체일정 그래프(균일폭/반투명/각진) ─────────
   - N<=7: 7등분 슬롯 / N>7: 균일 폭으로 나누고 날짜가 많아질수록 얇아짐
   - 회색(횟수) 막대 앞 + 반투명(0.7), 검정(시간) 막대 뒤
   - 모서리 직각에 가깝게(rx 1~3px), 베이스라인과 3px 갭
   - 오른쪽 날짜 라벨 "Today " 접두사
*/
const TaperedStackedBars = memo(function TaperedStackedBars({
  startDate,
  entries,
  width = SCREEN_WIDTH - 56,   // 좌우 여백 동일
  height = 124,
  introProgress = 1,
}) {
  const P = Math.max(0.0001, Number(introProgress||0));
  const left = 10, right = 10, top = 6, bottom = 28;
  const w = width, h = height;
  const cw = w - left - right;
  const ch = h - top - bottom;

  // 날짜: 시작~오늘
  const today = useMemo(()=>{ const t=new Date(); t.setHours(0,0,0,0); return t; }, []);
  const days = useMemo(()=>{
    if(!startDate) return [];
    const s = new Date(startDate); s.setHours(0,0,0,0);
    const arr=[]; const d=new Date(s);
    while(d <= today){ arr.push(new Date(d)); d.setDate(d.getDate()+1); }
    return arr;
  }, [startDate, today]);

  // 집계
  const byDay = useMemo(()=>{
    const m = new Map();
    for(const e of entries){
      const d = new Date(e.timestamp); d.setHours(0,0,0,0);
      const k = keyOf(d);
      const prev = m.get(k) || { minutes:0, count:0 };
      prev.count += 1;
      if (typeof e.duration === 'number' && e.duration > 0) prev.minutes += e.duration;
      m.set(k, prev);
    }
    return m;
  }, [entries]);

  const series = useMemo(()=>days.map(d=>{
    const stat = byDay.get(keyOf(d)) || { minutes:0, count:0 };
    return { date:d, minutes:stat.minutes, count:stat.count };
  }), [days, byDay]);

  const N = series.length;
  const maxM = Math.max(1, ...series.map(s=>s.minutes));
  const maxC = Math.max(1, ...series.map(s=>s.count));

  // 배치: 균일 폭
  const xs = [];
  const widths = [];
  const gap = 2;

  if (N <= 7) {
    const slots = 7;
    const slotW = cw / slots;
    const barW = Math.max(8, Math.min(14, slotW * 0.36));
    for (let i=0;i<N;i++){
      const x = left + slotW * i + (slotW - barW) / 2;
      xs.push(x); widths.push(barW);
    }
  } else {
    const avail = cw - gap * (N - 1);
    const barW = Math.max(2.2, avail / N);
    for (let i=0;i<N;i++){
      xs.push(left + i * (barW + gap));
      widths.push(barW);
    }
  }

  // 높이(동일 바닥선)
  const timeScale  = 0.96;
  const countScale = 0.82;

  // 횟수 막대 완화: 최소 4회를 시각적 최대치로 가정 + 최소 높이
  const visualMaxCount = Math.max(4, maxC);
  const minCountPx = 3;

  const baselineGap = 3;
  const baseTop = top + ch - baselineGap;

  // 라벨
  const startLabel = series[0]?.date
    ? `${String(series[0].date.getFullYear()).slice(2)}-${pad2(series[0].date.getMonth()+1)}-${pad2(series[0].date.getDate())}`
    : '';
  const endRaw = series[N-1]?.date
    ? `${String(series[N-1].date.getFullYear()).slice(2)}-${pad2(series[N-1].date.getMonth()+1)}-${pad2(series[N-1].date.getDate())}`
    : '';
  const endLabel = endRaw ? `Today ${endRaw}` : '';

  // 베이스라인(막대 회색)
  const baselineX1 = left;
  const baselineX2 = left + cw;
  const baselineY  = top + ch + 0.5;

  return (
    <View style={{ width: '100%', alignItems:'center' }}>
      <Svg width={width} height={height}>
        {series.map((s, i)=>{
          const x = xs[i];
          const bw = widths[i] || 8;

          // 모서리: 직각에 가깝게
          const rx = Math.max(1, Math.min(3, bw * 0.12));

          // 시간 막대(뒤)
          const hTimeRaw  = (s.minutes / maxM) * ch * timeScale;
          const hTime     = Math.max(0, hTimeRaw * P);
          const yTime     = baseTop - hTime;

          // 횟수 막대(앞, 반투명)
          const hCountRaw = (s.count / visualMaxCount) * ch * countScale;
          const hCount    = s.count > 0 ? Math.max(minCountPx * P, hCountRaw * P) : 0;
          const yCount    = baseTop - hCount;

          return (
            <React.Fragment key={i}>
              <Rect x={x} y={yTime}  width={bw} height={hTime}  rx={rx} fill={baseBlack} />
              <Rect x={x} y={yCount} width={bw} height={hCount} rx={rx} fill={progressGrey} opacity={0.7} />
            </React.Fragment>
          );
        })}

        {/* X축 베이스라인 */}
        <Line x1={baselineX1} y1={baselineY} x2={baselineX2} y2={baselineY} stroke={progressGrey} strokeWidth={0.8} />

        {/* 좌우 날짜 라벨 */}
        <SvgText x={baselineX1+2} y={top+ch+16} fill={textGrey} fontSize={10} fontWeight="700" textAnchor="start">{startLabel}</SvgText>
        <SvgText x={baselineX2-4} y={top+ch+16} fill={textGrey} fontSize={10} fontWeight="700" textAnchor="end">{endLabel}</SvgText>
      </Svg>
    </View>
  );
});

/* ───────── 주간 뷰 ───────── */
const WeekView = memo(function WeekView({ weeksData, currentIndex, onIndexChange }) {
  const scrollRef = useRef(null);
  const [pageW, setPageW] = useState(SCREEN_WIDTH);
  const onLayout = useCallback((e) => {
    const w = Math.floor(e.nativeEvent.layout.width || SCREEN_WIDTH);
    if (w && w !== pageW) setPageW(w);
  }, [pageW]);

  const PADDING_H = 14;
  const INNER_W = Math.floor(pageW - PADDING_H * 2);
  const COL_W   = Math.floor(INNER_W / 7);
  const ROW_W   = COL_W * 7;

  const todayWeekIndex = useMemo(() => {
    if (!weeksData?.length) return 0;
    const today = new Date();
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    for (let i = 0; i < weeksData.length; i++) {
      const ws = new Date(weeksData[i].ws);
      const we = new Date(ws); we.setDate(we.getDate() + 7);
      if (t0 >= ws && t0 < we) return i;
    }
    return Math.max(weeksData.length - 1, 0);
  }, [weeksData]);
  const latestWeekIndex = useMemo(() => Math.max(weeksData.length - 1, 0), [weeksData]);
  const effectiveIndex = typeof currentIndex === 'number'
    ? currentIndex
    : (SCROLL_MODE === 'today' ? todayWeekIndex : latestWeekIndex);

  const initialOffsetX = useMemo(() => effectiveIndex * pageW, [effectiveIndex, pageW]);
  useEffect(() => { try { scrollRef.current?.scrollTo({ x: initialOffsetX, y: 0, animated: false }); } catch {} }, [initialOffsetX]);

  const renderWeek = useCallback(({ dailyStats }, idx) => {
    const maxBarHeight = 80;
    const maxTime = Math.max(...dailyStats.map(s => s.duration || 0), 1);
    const maxCount = Math.max(...dailyStats.map(s => s.totalCount || 0), 1);

    return (
      <View key={idx} style={{ width: pageW, paddingHorizontal: PADDING_H, marginBottom: 10 }}>
        <View style={{ flexDirection:'row', width: ROW_W, alignSelf:'center' }}>
          {dailyStats.map((stat, i) => (
            <View key={i} style={{ width: COL_W, alignItems:'center' }}>
              <Text style={[styles.dateLabel, { marginBottom: 2 }]}>{stat.date}</Text>
              <Text style={styles.dayLabel}>{DAY_LABELS[i]}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection:'row', width: ROW_W, alignSelf:'center', alignItems:'flex-end', height: 120, marginTop: 10 }}>
          {dailyStats.map((stat, i) => {
            const hTime = stat.duration > 0
              ? Math.min((stat.duration / maxTime) * maxBarHeight + 10, maxBarHeight + 10)
              : 1;
            const onlyCount = stat.duration <= 0 && (stat.totalCount || 0) > 0;
            const hCount = onlyCount
              ? Math.min((stat.totalCount / maxCount) * maxBarHeight + 10, maxBarHeight + 10)
              : 1;

            const segDurations = Array.isArray(stat.durations) ? stat.durations : [];
            const totalSegDur = segDurations.reduce((a, b) => a + b, 0);

            if (stat.duration > 0) {
              return (
                <View key={i} style={{ width: COL_W, alignItems:'center', justifyContent:'flex-end' }}>
                  <Text style={styles.barText}>{`${stat.duration}분`}</Text>
                  {(segDurations.length > 1) ? (
                    <View style={{ marginVertical: 2, height: hTime, justifyContent:'flex-end', alignItems:'center' }}>
                      {(() => {
                        const segGap = 2;
                        const gaps = segGap * (segDurations.length - 1);
                        const available = Math.max(hTime - gaps, 2 * segDurations.length);
                        return segDurations.map((dur, s) => {
                          const ratio = totalSegDur > 0 ? (dur / totalSegDur) : (1 / segDurations.length);
                          const segH = Math.max(4, ratio * available);
                          return (
                            <View key={s} style={{
                              width: 16, height: segH, borderRadius: 4,
                              marginBottom: s === segDurations.length - 1 ? 0 : 2,
                              backgroundColor: lighten(baseBlack, s),
                            }}/>
                          );
                        });
                      })()}
                    </View>
                  ) : (
                    <View style={[styles.bar, { height: hTime, marginVertical: 2, backgroundColor: baseBlack }]} />
                  )}
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
                    const gaps = segGap * (segCount - 1);
                    const available = Math.max(hCount - gaps, 2 * segCount);
                    const segH = Math.max(4, available / segCount);
                    return Array.from({ length: segCount }).map((_, s) => (
                      <View key={s} style={{
                        width: 16, height: segH, borderRadius: 4,
                        marginBottom: s === segCount - 1 ? 0 : segGap,
                        backgroundColor: '#D1D5DB',
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
  }, [pageW, PADDING_H, ROW_W, COL_W]);

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
        contentOffset={{ x: initialOffsetX, y: 0 }}
        onMomentumScrollEnd={(e) => {
          const i = Math.round((e?.nativeEvent?.contentOffset?.x || 0) / pageW);
          if (typeof onIndexChange === 'function') onIndexChange(Math.max(0, Math.min(i, weeksData.length - 1)));
        }}
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

/* ───────── 리스트 행 ───────── */
const EntryRow = memo(function EntryRow({ item, indexFromEnd, readOnly, onPress }) {
  const body = (
    <>
      <Text style={styles.number}>{indexFromEnd}</Text>
      {item.imageUri && <Image source={{ uri: item.imageUri }} style={styles.thumbnail} />}
      <View style={styles.textContainer}>
        <Text style={styles.text}>{item.text}</Text>
        <Text style={styles.time}>{new Date(item.timestamp).toLocaleString()}</Text>
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

/* ───────── 본문 ───────── */
export default function EntryListScreen({ route, navigation }) {
  const {
    challengeId,
    title,
    startDate: startDateFromRoute,
    targetScore = 7,
    endDate: endDateFromRoute,
    rewardTitle: rewardTitleFromRoute,
    reward: rewardFromRoute,
    readOnly = false,
  } = route.params;

  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

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
  const [showInfo, setShowInfo] = useState(false);

  const shareRef = useRef(null);

  // ===== 인트로 애니메이션(부드럽게) =====
  const [introK, setIntroK] = useState(0); // 0→1
  const rafRef = useRef(null);
  const runIntro = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const ease = (t)=> 1 - Math.pow(1 - t, 3); // cubicOut
    const DUR = 1200;
    const t0 = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - t0) / DUR);
      setIntroK(ease(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  useEffect(() => {
    if (!isFocused) return;
    (async () => {
      const raw = await AsyncStorage.getItem(`entries_${challengeId}`);
      const list = raw ? JSON.parse(raw) : [];
      setEntries(list);
      setCurrentScore(list.length);

      let loadedMeta = { ...meta };
      try {
        const oneRaw = await AsyncStorage.getItem(`challenge_${challengeId}`);
        if (oneRaw) {
          const one = JSON.parse(oneRaw);
          loadedMeta = {
            startDate: loadedMeta.startDate ?? one.startDate ?? null,
            endDate:   loadedMeta.endDate   ?? one.endDate   ?? null,
            rewardTitle: loadedMeta.rewardTitle ?? one.rewardTitle ?? null,
            reward:      loadedMeta.reward      ?? one.reward      ?? null,
            description: one.description ?? null,
            notification: one.notification ?? { mode:null, payload:null },
          };
        } else {
          const listRaw = await AsyncStorage.getItem('challenges');
          if (listRaw) {
            const arr = JSON.parse(listRaw);
            const found = Array.isArray(arr) ? arr.find(c => c.id === challengeId) : null;
            if (found) {
              loadedMeta = {
                startDate: loadedMeta.startDate ?? found.startDate ?? null,
                endDate:   loadedMeta.endDate   ?? found.endDate   ?? null,
                rewardTitle: loadedMeta.rewardTitle ?? found.rewardTitle ?? null,
                reward:      loadedMeta.reward      ?? found.reward      ?? null,
                description: found.description ?? null,
                notification: found.notification ?? { mode:null, payload:null },
              };
            }
          }
        }
      } catch {}
      setMeta(loadedMeta);

      buildWeeks(list, loadedMeta.startDate ?? startDateFromRoute);

      if (loadedMeta.startDate && loadedMeta.endDate) {
        const s = new Date(loadedMeta.startDate);
        const e = new Date(loadedMeta.endDate);
        const t = new Date();
        const clamp = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
        let md = clamp(t);
        if (md < clamp(s)) md = clamp(s);
        if (md > clamp(e)) md = clamp(e);
        setMonthDate(md);
      }
    })().catch(console.error);

    runIntro();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, challengeId]);

  const overallPct = useMemo(
    () => Math.min(Math.round((currentScore / targetScore) * 100), 100),
    [currentScore, targetScore]
  );

  // 주간 데이터
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

  const sortedEntries = useMemo(() => [...entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)), [entries]);

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
  const totalMinutes = useMemo(() => entries.reduce((sum, e) => sum + (typeof e.duration === 'number' && e.duration > 0 ? e.duration : 0), 0), [entries]);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  // 헤더 카드
  const HeaderCard = useMemo(()=>(<View style={styles.card}>
      <View style={styles.headerTop}>
        <TouchableOpacity
          onPress={()=>setShowInfo(true)}
          activeOpacity={0.9}
          style={styles.iconWrapAbs}
          collapsable={false}
          renderToHardwareTextureAndroid
          shouldRasterizeIOS
        >
          <Image source={ICON} style={styles.iconSquare} />
        </TouchableOpacity>

        <View style={{ paddingHorizontal: 60, alignItems:'center' }}>
          <TitleTwoLine text={title} style={styles.title} containerWidth={SCREEN_WIDTH - 120} />
          <Text style={[styles.period, { textAlign:'center' }]}>{`${fmtDate(meta.startDate)} ~ ${fmtDate(meta.endDate)}`}</Text>
        </View>
      </View>

      <View style={[styles.row, { marginTop: 16 }]}>
        <View style={styles.donutArea}>
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
          />
        </View>
      </View>

      <View style={styles.sectionBox}>
        <WeekView weeksData={weeksData} currentIndex={weekIndex} onIndexChange={setWeekIndex} />
      </View>

      {/* 전체일정 그래프 */}
      <View style={[styles.sectionBox, { paddingHorizontal: 10, alignItems:'center' }]}>
        {meta.startDate ? (
          <TaperedStackedBars
            startDate={meta.startDate}
            entries={entries}
            width={SCREEN_WIDTH - 56}   // 좌우 동일 여백
            introProgress={introK}
          />
        ) : (
          <Text style={{ textAlign:'center', color:textGrey }}>시작일이 없습니다.</Text>
        )}
      </View>

      <View style={styles.sectionBox}>
        <View style={styles.hr} />
        <Text style={[styles.sectionLabel, { textAlign:'center', marginBottom: 8 }]}>보상</Text>
        <View style={styles.rewardBox}><Text style={styles.rewardText}>{meta.rewardTitle ?? meta.reward ?? '—'}</Text></View>
        <View style={[styles.hr, { marginTop: 8 }]} />
      </View>
    </View>
  ), [
    title, meta.startDate, meta.endDate, meta.rewardTitle, meta.reward,
    weeksData, monthDate, canPrevMonth, canNextMonth, entriesByDaySet,
    weekIndex, introK, entries, overallPct
  ]);

  const HeaderWithCount = useMemo(() => (
    <View>
      {HeaderCard}
      <View style={[styles.countBelowRow, totalMinutes === 0 && styles.countBelowRightOnly]}>
        {totalMinutes > 0 && (<Text style={styles.accumText}>누적시간 : {hours}시간 {minutes}분</Text>)}
        <Text style={styles.countBelowText}>{`${currentScore}/${targetScore}`}</Text>
      </View>
    </View>
  ), [HeaderCard, currentScore, targetScore, totalMinutes, hours, minutes]);

  const keyExtractor = useCallback((it) => it.id, []);
  const renderEntry = useCallback(({ item, index }) => {
    const indexFromEnd = sortedEntries.length - index;
    const onPress = readOnly ? undefined : () => navigation.navigate('EntryDetail', { challengeId, entryId: item.id });
    return <EntryRow item={item} indexFromEnd={indexFromEnd} readOnly={readOnly} onPress={onPress} />;
  }, [challengeId, navigation, readOnly, sortedEntries.length]);

  const handleShare = useCallback(async ()=>{
    try {
      await new Promise(r => setTimeout(r, 60));
      const uri = await captureRef(shareRef, { format: 'png', quality: 1, result: 'tmpfile' });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: '공유' });
      } else {
        await Share.share({ url: uri });
      }
      try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
    } catch (e) { console.warn(e); }
  }, []);

  const ShareContent = (
    <ViewShot ref={shareRef} options={{ format: 'png', quality: 1 }}>
      <View style={[styles.container, { backgroundColor: '#fff' }]}>
        <View style={styles.card}>
          <View style={styles.headerTop}>
            <View style={styles.iconWrapAbs} collapsable={false} renderToHardwareTextureAndroid shouldRasterizeIOS>
              <Image source={ICON} style={styles.iconSquare} />
            </View>
            <View style={{ paddingHorizontal: 60, alignItems:'center' }}>
              <TitleTwoLine text={title} style={styles.title} containerWidth={SCREEN_WIDTH - 120} />
              <Text style={[styles.period, { textAlign:'center' }]}>{`${fmtDate(meta.startDate)} ~ ${fmtDate(meta.endDate)}`}</Text>
            </View>
          </View>

          <View style={[styles.row, { marginTop: 16 }]}>
            <View style={styles.donutArea}>
              <Text style={[styles.sectionLabel, styles.progressLabel, { textAlign:'center', marginBottom: 8 }]}>전체 진행률</Text>
              <View style={{ marginTop: 24 }}><Donut targetPercent={overallPct} progress={1} /></View>
            </View>

            <View style={styles.calendarArea}>
              <MonthCalendar
                startDate={meta.startDate || new Date()}
                endDate={meta.endDate || new Date()}
                entriesByDaySet={entriesByDaySet}
                monthDate={monthDate}
                onPrev={()=>{}}
                onNext={()=>{}}
                canPrev={false}
                canNext={false}
              />
            </View>
          </View>

          <View style={styles.sectionBox}>
            <WeekView weeksData={weeksData} currentIndex={weekIndex} />
          </View>

          <View style={[styles.sectionBox, { paddingHorizontal: 10, alignItems:'center' }]}>
            {meta.startDate ? (
              <TaperedStackedBars
                startDate={meta.startDate}
                entries={entries}
                width={SCREEN_WIDTH - 56}
                introProgress={1}
              />
            ) : (
              <Text style={{ textAlign:'center', color:textGrey }}>시작일이 없습니다.</Text>
            )}
          </View>

          <View style={styles.sectionBox}>
            <View style={styles.hr} />
            <Text style={[styles.sectionLabel, { textAlign:'center', marginBottom: 8 }]}>보상</Text>
            <View style={styles.rewardBox}><Text style={styles.rewardText}>{meta.rewardTitle ?? meta.reward ?? '—'}</Text></View>
            <View style={[styles.hr, { marginTop: 8 }]} />
          </View>
        </View>

        <View style={[styles.countBelowRow, totalMinutes === 0 && styles.countBelowRightOnly]}>
          {totalMinutes > 0 && (<Text style={styles.accumText}>누적시간 : {hours}시간 {minutes}분</Text>)}
          <Text style={styles.countBelowText}>{`${currentScore}/${targetScore}`}</Text>
        </View>

        {sortedEntries.map((item, idx)=>{
          const indexFromEnd = sortedEntries.length - idx;
          return (
            <View key={item.id} style={styles.entry}>
              <Text style={styles.number}>{indexFromEnd}</Text>
              {item.imageUri && <Image source={{ uri: item.imageUri }} style={styles.thumbnail} />}
              <View style={styles.textContainer}>
                <Text style={styles.text}>{item.text}</Text>
                <Text style={styles.time}>{new Date(item.timestamp).toLocaleString()}</Text>
                {(typeof item.duration === 'number' && item.duration > 0) && (<Text style={styles.duration}>소요 시간: {item.duration}분</Text>)}
              </View>
            </View>
          );
        })}
      </View>
    </ViewShot>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom }]} >
      <View style={{ position:'absolute', left:-9999, top:-9999, width:SCREEN_WIDTH }}>
        {ShareContent}
      </View>

      <FlatList
        data={sortedEntries}
        keyExtractor={keyExtractor}
        renderItem={renderEntry}
        ListHeaderComponent={HeaderWithCount}
        ListEmptyComponent={<Text style={styles.empty}>등록된 인증이 없습니다.</Text>}
        removeClippedSubviews
        windowSize={7}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={60}
      />

      <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.9}>
        <Text style={styles.shareBtnText}>공유</Text>
      </TouchableOpacity>

      <Modal visible={showInfo} transparent animationType="fade" onRequestClose={()=>setShowInfo(false)}>
        <TouchableWithoutFeedback onPress={()=>setShowInfo(false)}>
          <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.35)', padding:14, justifyContent:'center' }}>
            <TouchableWithoutFeedback>
              <View style={{ width:'100%', backgroundColor:'#fff', borderRadius:12, padding:16 }}>
                {!!meta?.description && (
                  <>
                    <Text style={{ fontSize:12, color:textGrey, marginBottom:6, textAlign:'center' }}>도전 내용</Text>
                    <Text style={{ fontSize:14, color:'#111', marginBottom:12, textAlign:'center' }}>{meta.description}</Text>
                  </>
                )}
                <Text style={{ fontSize:12, color:textGrey, marginBottom:6, textAlign:'center' }}>알림 미리보기</Text>
                <View style={{ backgroundColor:'#F3F4F6', borderRadius:10, padding:10 }}>
                  <NotiPreviewSwitch notification={meta?.notification} startDate={meta?.startDate} endDate={meta?.endDate} />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

/* ───────── 스타일 ───────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  barText: { fontSize: 9, color: textGrey, textAlign:'center' },

  card: { margin: 10, padding: 14, borderRadius: 12, borderWidth: 0, backgroundColor: '#fff' },

  countBelowRow: {
    paddingHorizontal: 16,
    marginTop: 4, marginBottom: 6,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  countBelowRightOnly: { justifyContent: 'flex-end' },
  accumText: { fontSize: 12, color: textGrey, fontWeight: '600' },
  countBelowText: { fontSize: 12, color: textGrey, fontWeight: '700' },

  headerTop: { minHeight: 48, alignItems:'center', justifyContent:'center', marginBottom: 6 },
  iconWrapAbs: {
    position:'absolute', left: 0, top: 0,
    width: 42, height: 42, borderRadius: 8, backgroundColor:'#fff',
    shadowColor: '#000', shadowOpacity: 0.38, shadowOffset: {width:0, height:5}, shadowRadius: 12,
    elevation: 14, alignItems:'center', justifyContent:'center',
  },
  iconSquare: { width: 42, height: 42, borderRadius: 8 },

  title: { fontSize: 20, fontWeight: '800', color: '#111', lineHeight: 26 },
  period: { fontSize: 12, color: textGrey, marginTop: 4 },

  progressLabel: { marginTop: 12, color: textGrey },
  row: { flexDirection: 'row', marginTop: 16 },
  donutArea: { width: SCREEN_WIDTH * 0.4 - 20, alignItems: 'center', justifyContent: 'flex-start' },
  calendarArea: { flex: 1, paddingLeft: 10 },

  sectionBox: { marginTop: 10 },
  sectionLabel: { fontSize: 12, color: textGrey, marginBottom: 6 },

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

  rewardBox: { backgroundColor: 'transparent', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  rewardText: { fontSize: 22, fontWeight: '900', color: '#111', textAlign: 'center' },

  entry: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12 },
  number: { width: 28, fontWeight: 'bold' },
  thumbnail: { width: 50, height: 50, borderRadius: 6, backgroundColor: '#f2f2f2' },
  textContainer: { flex: 1, paddingHorizontal: 10 },
  text: { fontSize: 14, color:'#111' },
  time: { fontSize: 12, color: textGrey },
  duration: { fontSize: 12, color: '#000', marginTop: 4 },

  empty: { textAlign: 'center', marginTop: 50, color: textGrey },

  shareBtn: {
    position: 'absolute', right: 14, bottom: 14,
    backgroundColor: '#111', borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 14, elevation: 3,
  },
  shareBtnText: { color: '#fff', fontWeight: '800' },
});
