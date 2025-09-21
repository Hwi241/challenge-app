// screens/EntryListScreen.js
// ✅ 주간 그래프: 7일 고정 + 한 주 단위 페이징 (부모/자식 폭 기준 통일 & 정수화)
// 나머지 UI/기능은 이전 버전 그대로 유지

import React, {
  useState, useEffect, useRef, useMemo, useCallback, memo,
} from 'react';
import {
  SafeAreaView, View, Text, FlatList, Image, StyleSheet, TouchableOpacity,
  Dimensions, ScrollView, Share
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import Svg, { Circle } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// 요일 순서: 일→월→화→수→목→금→토
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const CAL_HEADER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const ICON = require('../assets/icon.png');

const SCROLL_MODE = 'today';
const baseBlack = '#111111';

// ───────── 색상 유틸(5%씩 밝아짐) ─────────
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

// ───────── 도넛 ─────────
const Donut = memo(function Donut({ percent = 0, size = 110, stroke = 12 }) {
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const dash = (clamped / 100) * circumference;

  // 내부 검은 원(조금 작게)
  const innerRadius = Math.max(2, radius - stroke * 1.25);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={radius} stroke="#E5E7EB" strokeWidth={stroke} fill="none" />
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={baseBlack}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx}, ${cy}`}
        />
        <Circle cx={cx} cy={cy} r={innerRadius} fill="#111" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff' }}>{clamped}%</Text>
      </View>
    </View>
  );
});

// ───────── 달력 ─────────
const MonthCalendar = memo(function MonthCalendar({
  startDate, endDate, entriesByDaySet, onPrev, onNext, monthDate, canPrev, canNext,
}) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const first = new Date(year, month, 1);
  const firstDow = first.getDay(); // 0=Sun
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

// ───────── 주간 뷰 (반드시 7일 + 1주 페이징) ─────────
const WeekView = memo(function WeekView({
  weeksData,
  currentIndex,                 // ✅ 부모가 제어하는 현재 페이지 인덱스
  onIndexChange,               // ✅ 스크롤 후 부모에게 알림
}) {
  const scrollRef = useRef(null);

  // ❶ 실제 뷰포트 폭 측정
  const [pageW, setPageW] = useState(SCREEN_WIDTH);
  const onLayout = useCallback((e) => {
    const w = Math.floor(e.nativeEvent.layout.width || SCREEN_WIDTH);
    if (w && w !== pageW) setPageW(w);
  }, [pageW]);

  // ❷ 내부 패딩과 7칸 폭(정수) 계산
  const PADDING_H = 14;
  const INNER_W = Math.floor(pageW - PADDING_H * 2);
  const COL_W   = Math.floor(INNER_W / 7);
  const ROW_W   = COL_W * 7; // 7칸 합도 정수

  // ❸ 기본 열 주(오늘 or 최신)
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
  const defaultIndex = useMemo(
    () => (SCROLL_MODE === 'today' ? todayWeekIndex : latestWeekIndex),
    [todayWeekIndex, latestWeekIndex]
  );

  // ❹ 실제 사용할 인덱스(부모 제어 우선)
  const effectiveIndex = typeof currentIndex === 'number' ? currentIndex : defaultIndex;

  // ❺ 스냅/오프셋도 실제 폭(pageW) 기준
  const initialOffsetX = useMemo(() => effectiveIndex * pageW, [effectiveIndex, pageW]);

  // 외부 인덱스 변경 시 스크롤 동기화
  useEffect(() => {
    try { scrollRef.current?.scrollTo({ x: initialOffsetX, y: 0, animated: false }); } catch {}
  }, [initialOffsetX]);

  const renderWeek = useCallback(({ dailyStats }, idx) => {
    const maxBarHeight = 80;
    const maxTime = Math.max(...dailyStats.map(s => s.duration || 0), 1);
    const maxCount = Math.max(...dailyStats.map(s => s.totalCount || 0), 1);

    return (
      <View key={idx} style={{ width: pageW, paddingHorizontal: PADDING_H, marginBottom: 10 }}>
        {/* 라벨 7칸 (일→토) */}
        <View style={{ flexDirection:'row', width: ROW_W, alignSelf:'center' }}>
          {dailyStats.map((stat, i) => (
            <View key={i} style={{ width: COL_W, alignItems:'center' }}>
              <Text style={[styles.dateLabel, { marginBottom: 2 }]}>{stat.date}</Text>
              <Text style={styles.dayLabel}>{DAY_LABELS[i]}</Text>
            </View>
          ))}
        </View>

        {/* 막대 7칸 */}
        <View style={{ flexDirection:'row', width: ROW_W, alignSelf:'center', alignItems:'flex-end', height: 120, marginTop: 10 }}>
          {dailyStats.map((stat, i) => {
            // 시간 막대 높이(있으면 시간 기준)
            const hTime = stat.duration > 0
              ? Math.min((stat.duration / maxTime) * maxBarHeight + 10, maxBarHeight + 10)
              : 1;

            // 횟수만 있는 날(시간=0)용 회색 막대 총 높이
            const onlyCount = stat.duration <= 0 && (stat.totalCount || 0) > 0;
            const hCount = onlyCount
              ? Math.min((stat.totalCount / maxCount) * maxBarHeight + 10, maxBarHeight + 10)
              : 1;

            const segDurations = Array.isArray(stat.durations) ? stat.durations : [];
            const totalSegDur = segDurations.reduce((a, b) => a + b, 0);

            if (stat.duration > 0) {
              // 시간 막대(여러 세그먼트면 분할)
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
                            <View
                              key={s}
                              style={{
                                width: 16,
                                height: segH,
                                borderRadius: 4,
                                marginBottom: s === segDurations.length - 1 ? 0 : 2,
                                backgroundColor: lighten(baseBlack, s),
                              }}
                            />
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

            // 시간 없음 + 횟수만 있음 → 회색 막대를 '횟수 개수'만큼 분절해서 표시
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
                      <View
                        key={s}
                        style={{
                          width: 16,
                          height: segH,
                          borderRadius: 4,
                          marginBottom: s === segCount - 1 ? 0 : segGap,
                          backgroundColor: '#D1D5DB', // 회색 세그먼트
                        }}
                      />
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
        key={`sv-${weeksData.length}-${initialOffsetX}`}
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


// ───────── 리스트 행 ─────────
const EntryRow = memo(function EntryRow({ item, indexFromEnd, readOnly, onPress }) {
  const body = (
    <>
      <Text style={styles.number}>{indexFromEnd}</Text>
      {item.imageUri && <Image source={{ uri: item.imageUri }} style={styles.thumbnail} />}
      <View style={styles.textContainer}>
        <Text style={styles.text} numberOfLines={2}>{item.text}</Text>
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

// ───────── 본문 ─────────
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
  const [weekIndex, setWeekIndex] = useState(0);   // ✅ 현재 보고 있는 주 인덱스
  const [currentScore, setCurrentScore] = useState(0);

  const [meta, setMeta] = useState({
    startDate: startDateFromRoute ?? null,
    endDate: endDateFromRoute ?? null,
    rewardTitle: rewardTitleFromRoute ?? null,
    reward: rewardFromRoute ?? null,
  });

  const [monthDate, setMonthDate] = useState(()=> {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const shareRef = useRef(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, challengeId]);

  // 주간 데이터 구성 (일~토) + 기본 인덱스 설정
  const buildWeeks = useCallback((list, startDateStr) => {
    if (!startDateStr) { setWeeksData([]); return; }
    const start = new Date(startDateStr);
    const sd = start.getDay();        // 0(일)~6(토)
    start.setDate(start.getDate() - sd); // 해당 주 일요일로 보정

    const today = new Date();
    const td = today.getDay();        // 0(일)~6(토)
    const thisSaturday = new Date(today);
    thisSaturday.setDate(today.getDate() + (6 - td)); // 이번 주 토요일(포함)

    const weeks = [];
    let cursor = new Date(start);     // 일요일 시작
    while (cursor <= thisSaturday) {
      const ws = new Date(cursor); // 일요일

      const dailyStats = Array(7).fill(null).map((_, i) => {
        const dayStart = new Date(ws); dayStart.setDate(dayStart.getDate() + i);
        const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);

        const dailyEntries = list.filter(e => {
          const d = new Date(e.timestamp);
          return d >= dayStart && d < dayEnd;
        });
        // 시간이 있는 인증
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

      weeks.push({ ws, dailyStats });
      cursor.setDate(cursor.getDate() + 7);
    }
    setWeeksData(weeks);

    // 👉 초기 인덱스(오늘이 포함된 주, 없으면 마지막 주)
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let initIdx = Math.max(weeks.length - 1, 0);
    for (let i = 0; i < weeks.length; i++) {
      const ws = new Date(weeks[i].ws);
      const we = new Date(ws); we.setDate(we.getDate() + 7);
      if (t0 >= ws && t0 < we) { initIdx = i; break; }
    }
    setWeekIndex(initIdx);
  }, []);

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
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${day}`;
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
      const y = d.getFullYear();
      const m = `${d.getMonth()+1}`.padStart(2,'0');
      const dd = `${d.getDate()}`.padStart(2,'0');
      set.add(`${y}-${m}-${dd}`);
    }
    return set;
  }, [entries]);

  // ✅ 전체 누적 시간(분)
  const totalMinutes = useMemo(() => {
    return entries.reduce((sum, e) => {
      const v = e?.duration;
      return sum + (typeof v === 'number' && v > 0 ? v : 0);
    }, 0);
  }, [entries]);

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const HeaderCard = useMemo(()=>(
    <View style={styles.card}>
      {/* 상단 아이콘 + 제목/기간 */}
      <View style={styles.headerTop}>
        <Image source={ICON} style={styles.iconSquare} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.period}>{`${fmtDate(meta.startDate)} ~ ${fmtDate(meta.endDate)}`}</Text>
      </View>

      {/* 도넛 & 달력 */}
      <View style={[styles.row, { marginTop: 20 }]}>
        <View style={styles.donutArea}>
          <Text style={[styles.sectionLabel, styles.progressLabel, { textAlign:'center', marginBottom: 10 }]}>
            전체 진행률
          </Text>
          <View style={{ marginTop: 30 }}>
            <Donut percent={overallPct} />
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

      {/* 주간 그래프 — 현재 보고 있는 주와 동기화 */}
      <View style={styles.sectionBox}>
        <WeekView
          weeksData={weeksData}
          currentIndex={weekIndex}
          onIndexChange={setWeekIndex}
        />
      </View>

      {/* 보상(상/하 동일 회색선) */}
      <View style={styles.sectionBox}>
        <View style={styles.hr} />
        <Text style={[styles.sectionLabel, { textAlign:'center', marginBottom: 8 }]}>보상</Text>
        <View style={styles.rewardBox}>
          <Text style={styles.rewardText}>
            {meta.rewardTitle ?? meta.reward ?? '—'}
          </Text>
        </View>
        <View style={[styles.hr, { marginTop: 8 }]} />
      </View>
    </View>
  ), [
    title, meta.startDate, meta.endDate, meta.rewardTitle, meta.reward,
    overallPct, weeksData, monthDate, canPrevMonth, canNextMonth, entriesByDaySet,
    weekIndex
  ]);

  // 카드 아래(목록 시작 위) — 왼쪽: 누적시간(0분이면 숨김), 오른쪽: 현재/목표
  const HeaderWithCount = useMemo(() => (
    <View>
      {HeaderCard}
      <View style={[styles.countBelowRow, totalMinutes === 0 && styles.countBelowRightOnly]}>
        {totalMinutes > 0 && (
          <Text style={styles.accumText}>누적시간 : {hours}시간 {minutes}분</Text>
        )}
        <Text style={styles.countBelowText}>{`${currentScore}/${targetScore}`}</Text>
      </View>
    </View>
  ), [HeaderCard, currentScore, targetScore, totalMinutes, hours, minutes]);

  const keyExtractor = useCallback((it) => it.id, []);

  const renderEntry = useCallback(({ item, index }) => {
    const indexFromEnd = sortedEntries.length - index;
    const onPress = readOnly
      ? undefined
      : () => navigation.navigate('EntryDetail', { challengeId, entryId: item.id });

    return (
      <EntryRow
        item={item}
        indexFromEnd={indexFromEnd}
        readOnly={readOnly}
        onPress={onPress}
      />
    );
  }, [challengeId, navigation, readOnly, sortedEntries.length]);

  const handleShare = useCallback(async ()=>{
    try {
      // 👉 공유용 뷰가 현재 주 인덱스로 레이아웃될 시간을 살짝 줌
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
        {/* 공유용 헤더에도 동일한 주 인덱스 적용 */}
        <View style={styles.card}>
          <View style={styles.headerTop}>
            <Image source={ICON} style={styles.iconSquare} />
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.period}>{`${fmtDate(meta.startDate)} ~ ${fmtDate(meta.endDate)}`}</Text>
          </View>

          <View style={[styles.row, { marginTop: 20 }]}>
            <View style={styles.donutArea}>
              <Text style={[styles.sectionLabel, styles.progressLabel, { textAlign:'center', marginBottom: 10 }]}>
                전체 진행률
              </Text>
              <View style={{ marginTop: 30 }}>
                <Donut percent={overallPct} />
              </View>
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
            <WeekView
              weeksData={weeksData}
              currentIndex={weekIndex}      // ✅ 현재 보던 주로 캡처
            />
          </View>

          <View style={styles.sectionBox}>
            <View style={styles.hr} />
            <Text style={[styles.sectionLabel, { textAlign:'center', marginBottom: 8 }]}>보상</Text>
            <View style={styles.rewardBox}>
              <Text style={styles.rewardText}>
                {meta.rewardTitle ?? meta.reward ?? '—'}
              </Text>
            </View>
            <View style={[styles.hr, { marginTop: 8 }]} />
          </View>
        </View>

        <View style={[styles.countBelowRow, totalMinutes === 0 && styles.countBelowRightOnly]}>
          {totalMinutes > 0 && (
            <Text style={styles.accumText}>누적시간 : {hours}시간 {minutes}분</Text>
          )}
          <Text style={styles.countBelowText}>{`${currentScore}/${targetScore}`}</Text>
        </View>

        {sortedEntries.map((item, idx)=>{
          const indexFromEnd = sortedEntries.length - idx;
          return (
            <View key={item.id} style={styles.entry}>
              <Text style={styles.number}>{indexFromEnd}</Text>
              {item.imageUri && <Image source={{ uri: item.imageUri }} style={styles.thumbnail} />}
              <View style={styles.textContainer}>
                <Text style={styles.text} numberOfLines={2}>{item.text}</Text>
                <Text style={styles.time}>{new Date(item.timestamp).toLocaleString()}</Text>
                {(typeof item.duration === 'number' && item.duration > 0) && (
                  <Text style={styles.duration}>소요 시간: {item.duration}분</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </ViewShot>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom }]} >
      {/* 숨김 공유 뷰 */}
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

      {/* 공유 버튼 */}
      <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.9}>
        <Text style={styles.shareBtnText}>공유</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // 카드(테두리 없음)
  card: {
    margin: 14,
    padding: 16,
    borderRadius: 12,
    borderWidth: 0,
    backgroundColor: '#fff',
  },

  // 목록 시작 위, 왼쪽: 누적시간 / 오른쪽: 현재/목표
  countBelowRow: {
    paddingHorizontal: 24,
    marginTop: 4,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countBelowRightOnly: { justifyContent: 'flex-end' },
  accumText: { fontSize: 12, color: '#999', fontWeight: '600' },
  countBelowText: { fontSize: 12, color: '#999', fontWeight: '700' },

  headerTop: { marginBottom: 10, alignItems: 'center' },
  iconSquare: {
    width: 42, height: 42, borderRadius: 8, alignSelf: 'flex-start',
    shadowColor: '#000', shadowOpacity: 0.38, shadowOffset: {width:0, height:5}, shadowRadius: 12,
    elevation: 14,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111', textAlign: 'center', marginTop: -42 },
  period: { fontSize: 12, color: '#666', textAlign: 'center', marginTop: 8 },

  // 도넛 & 달력 가로 정렬
  progressLabel: { marginTop: 20 },
  row: { flexDirection: 'row', marginTop: 20 },
  donutArea: { width: SCREEN_WIDTH * 0.4 - 20, alignItems: 'center', justifyContent: 'flex-start' },
  calendarArea: { flex: 1, paddingLeft: 10 },

  sectionBox: { marginTop: 10 },
  sectionLabel: { fontSize: 12, color: '#666', marginBottom: 6 },

  // 구분선(보상 상/하 동일)
  hr: {
    height: 1,
    backgroundColor: '#C7C7C7',
    marginHorizontal: 8,
    marginBottom: 8,
  },

  // 달력
  calWrap: { padding: 10, borderWidth: 0 },
  calHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calNavBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  calNavText: { fontSize: 18, fontWeight: '800', color: '#111' },
  calTitle: { fontSize: 14, fontWeight: '700', color: '#111' },

  calDowRow: { flexDirection: 'row', justifyContent: 'flex-start', marginTop: 6 },
  calDow: { width: '14.2857%', textAlign: 'center', fontSize: 10, color: '#666' },

  calGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  calCell: {
    width: '14.2857%',
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    borderRadius: 4,
  },
  calBadge: {
    minWidth: 24,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#111',
    borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 0.4,
    marginVertical: 3.5,
  },
  calBadgeText: { color: '#fff', fontWeight: '800', fontSize: 10.5 },

  calCellText: { fontSize: 10.5, color: '#111' },
  calCellTextDim: { color: '#9CA3AF' },

  // ── 주간 그래프 레이아웃(7칸 정수폭) ──
  weekPage: { paddingHorizontal: 14, marginBottom: 10 },
  weekRow: { flexDirection: 'row' },
  weekCol: { alignItems: 'center' },

  barText: { fontSize: 10, color: '#666', textAlign:'center' },
  dateLabel: { fontSize: 10, color: '#666' },
  dayLabel: { fontSize: 9, color: '#333' },
  bar: { width: 16, borderRadius: 4, alignSelf:'center' },
  barGray: { width: 16, borderRadius: 4, alignSelf:'center', backgroundColor: '#D1D5DB' }, // 회색 막대

  countLabel: { fontSize: 10, color: '#333', marginTop: 2, textAlign:'center' },

  // 보상 (배경 제거 유지)
  rewardBox: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  rewardText: { fontSize: 22, fontWeight: '900', color: '#111', textAlign: 'center' },

  // 목록(좌/우 여백 확대)
  entry: { flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 12 },
  number: { width: 28, fontWeight: 'bold' },
  thumbnail: { width: 50, height: 50, borderRadius: 6, backgroundColor: '#f2f2f2' },
  textContainer: { flex: 1, paddingHorizontal: 10 },
  text: { fontSize: 14 },
  time: { fontSize: 12, color: '#666' },
  duration: { fontSize: 12, color: '#000', marginTop: 4 },
  durationPlaceholder: { opacity: 0, includeFontPadding: false },

  empty: { textAlign: 'center', marginTop: 50, color: '#999' },

  // 공유 버튼
  shareBtn: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    backgroundColor: '#111',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    elevation: 3,
  },
  shareBtnText: { color: '#fff', fontWeight: '800' },
});
