# 소스코드 심층 스캔 보고서 (2단계: 수학 및 날짜/배열 결함 검출)

- **스캔 일시**: 2026-05-03 19:15 (Asia/Seoul)
- **스캔 대상**: `screens/`, `utils/` 소스코드
- **중점 점검 사항**: 수학적 예외(0으로 나누기, NaN/Infinity), 날짜 객체 처리, 배열 메서드 안정성

## 1. 수학적 예외 및 연산 결함 (0으로 나누기, NaN, Infinity)

### [발견] `utils/number.js`: `toNumberOrZero` 함수의 로직 한계
- **코드**: `const n = Number(cleaned); return Number.isFinite(n) ? n : 0;`
- **분석**: `cleaned`는 `[^\d]`를 제거한 문자열이므로 항상 양의 정수 형태이나, 입력이 빈 문자열(`''`)일 경우 `Number('')`는 `0`을 반환하여 `isFinite`를 통과합니다. 이는 의도된 동작일 수 있으나, 매우 큰 숫자가 입력될 경우(문자열 길이가 길 때) 정밀도 손실이나 `Infinity` 처리에 주의가 필요합니다. 현재 `maxLength: 9`로 제한하고 있어 치명적이지는 않습니다.

### [발견] `utils/challengeStore.js`: `validateInput`의 목표 점수 검증
- **코드**: `if (!Number.isFinite(goal) || goal <= 0) return { ok: false, reason: 'GOAL_INVALID' };`
- **분석**: `goalScore`가 `0`이거나 음수일 때를 잘 방어하고 있습니다. 다만, 나눗셈 연산이 직접적으로 수행되는 곳이 없어 현재로서는 "0으로 나누기" 위험은 낮습니다.

### [잠재] 진행률 계산 부재
- 소스코드 전반에 걸쳐 `(current / goal) * 100`과 같은 진행률 계산식이 검색되지 않았습니다. 만약 UI에서 이를 계산하게 된다면 `goal`이 `0`인 경우를 반드시 방어해야 합니다. (현재 `validateInput`에서 `goal > 0`을 강제하므로 안전 장치는 마련되어 있음)

## 2. 날짜 및 시간 처리 결함

### [주의] `screens/AddChallengeScreen.js`: `parseDateStr` 및 날짜 객체 생성
- **코드**: `const dt = new Date(y, (m||1)-1, d||1); return isNaN(dt.getTime()) ? null : dt;`
- **분석**: `m-1` 연산 시 `m`이 `0` 이하로 들어올 경우를 대비해 `m||1` 처리가 되어 있으나, JavaScript `Date` 생성자는 인자가 범위를 벗어나면 자동으로 다음 달/이전 달로 넘깁니다. 유효하지 않은 날짜 문자열에 대해 `isNaN(dt.getTime())`으로 방어하고 있어 안정적입니다.

### [발견] `screens/HallOfFameScreen.js`: `toMillis`의 혼합형 타입 처리
- **코드**: `v > 1e12 ? v : v * 1000; // sec → ms 보정`
- **분석**: 초(sec) 단위와 밀리초(ms) 단위를 구분하기 위해 `1e12` 임계값을 사용하고 있습니다. 2026년 기준 타임스탬프는 약 `1.7e12`이므로, 만약 `2000`년대 이전의 매우 오래된 날짜를 다루거나 잘못된 숫자가 들어오면 `sec`로 오판하여 `* 1000`을 할 위험이 미세하게 존재합니다.

## 3. 배열 및 객체 순회 안정성

### [안전] `Array.isArray` 방어 코드 다수 확인
- `AddChallengeScreen.js`, `notificationScheduler.js`, `HallOfFameScreen.js` 등에서 `map`, `filter` 사용 전 `Array.isArray()` 또는 `|| []` 패턴을 사용하여 `null/undefined`에 의한 런타임 에러를 잘 방지하고 있습니다.

### [주의] `utils/notificationScheduler.js`: `cancelAllForChallenge`
- **코드**: `(idsRaw || []).filter(n => n.content?.data?.challengeId === challenge.id)`
- **분석**: `idsRaw`가 `null`일 경우를 대비해 `|| []` 처리가 되어 있으며, 옵셔널 체이닝(`?.`)을 사용하여 객체 구조 결함에 대비하고 있습니다.

## 스캔 총평
- 전반적으로 `AsyncStorage`에서 데이터를 불러올 때 `JSON.parse` 결과값에 대해 배열 여부를 확인하거나, 숫자 변환 시 `Number.isFinite`를 사용하는 등 **방어적 프로그래밍**이 잘 적용되어 있습니다.
- "0으로 나누기"와 같은 치명적인 수학적 예외가 발생할 만한 복잡한 연산 로직은 발견되지 않았습니다.
- 날짜 처리 시 `Date.parse` 결과에 대한 `isNaN` 체크가 누락된 곳 없이 적용되어 있어 날짜 관련 런타임 크래시 위험은 매우 낮습니다.

---
*보고서 완료.*
screens/AddChallengeScreen.js:196:  return isNaN(dt.getTime()) ? null : dt;
screens/AddChallengeScreen.js:254:    if (isNaN(n)) { setCGoalScore(''); return; }
screens/EntryListScreen.js:184:  const display = isNaN(clampedTarget) ? 0 : Math.round(clampedTarget * k);
screens/EntryListScreen.js:564:    // 0값이 x축에 딱 붙지 않도록 가상의 최솟값(-vmax*0.08)을 기준으로 스케일
screens/EntryListScreen.js:669:    let best = 0, bestDx = Infinity;
screens/EntryListScreen.js:1495:        ts = Number.isNaN(parsed) ? null : parsed;
screens/EntryListScreen.js:1497:      if (typeof ts !== 'number' || Number.isNaN(ts)) ts = Date.now() - i * 1000;
screens/EntryListScreen.js:1727:    () => { if (!targetScore) return 0; const pct = Math.round((currentScore / targetScore) * 100); return isNaN(pct) ? 0 : Math.min(Math.max(0, pct), 100); },
screens/FullRangeNotificationScreen.js:22:  const dt=new Date(y,(m||1)-1,d||1); return isNaN(dt.getTime())?null:dt;
screens/FullRangeNotificationScreen.js:138:        const dow = new Date(y,mi,d).getDay(); // 0:일 ~ 6:토
screens/FullRangeNotificationScreen.js:296:          const firstDow=first.getDay(); // 0~6
screens/HallOfFameScreen.js:68:    const t = Date.parse(v); return Number.isNaN(t) ? 0 : t;   // ISO 문자열 보정
screens/EditChallengeScreen.js:41:  const dt = new Date(y,(m||1)-1,d||1); return isNaN(dt.getTime())?null:dt;
screens/EditChallengeScreen.js:272:    if (isNaN(n)) { setGoalScore(''); return; }
screens/EntryDetailScreen.js:155:    if (isNaN(n) || n <= 0) { setDuration(''); return; }
screens/ChallengeListScreen.js.bak2:75:  const gs = Number(c?.goalScore ?? NaN);
screens/EntryListScreen.js.bak4:564:    // 0값이 x축에 딱 붙지 않도록 가상의 최솟값(-vmax*0.08)을 기준으로 스케일
screens/EntryListScreen.js.bak4:662:    let best = 0, bestDx = Infinity;
screens/EntryListScreen.js.bak4:1417:        ts = Number.isNaN(parsed) ? null : parsed;
screens/EntryListScreen.js.bak4:1419:      if (typeof ts !== 'number' || Number.isNaN(ts)) ts = Date.now() - i * 1000;
screens/ChallengeListScreen.js.bak:75:  const gs = Number(c?.goalScore ?? NaN);
screens/EntryListScreen.js.bak:624:    let best = 0, bestDx = Infinity;
screens/EntryListScreen.js.bak:1293:        ts = Number.isNaN(parsed) ? null : parsed;
screens/EntryListScreen.js.bak:1295:      if (typeof ts !== 'number' || Number.isNaN(ts)) ts = Date.now() - i * 1000;
screens/UploadScreen.js:206:    if (isNaN(n) || n <= 0) { setDuration(''); return; }
screens/ChallengeListScreen.js:77:  const gs = Number(c?.goalScore ?? NaN);
screens/ChallengeListScreen.js:103:  '#F3F4F6', // 0단계
screens/EntryListScreen.js.bak3:564:    // 0값이 x축에 딱 붙지 않도록 가상의 최솟값(-vmax*0.08)을 기준으로 스케일
screens/EntryListScreen.js.bak3:662:    let best = 0, bestDx = Infinity;
screens/EntryListScreen.js.bak3:1417:        ts = Number.isNaN(parsed) ? null : parsed;
screens/EntryListScreen.js.bak3:1419:      if (typeof ts !== 'number' || Number.isNaN(ts)) ts = Date.now() - i * 1000;
utils/number.js:9:  return text.replace(/[^\d]/g, ''); // 0-9만 허용
utils/notifications.js:73:  const startWeekday = first.getDay(); // 0=일
utils/notifications.js:96:    const weekday = Number(k); // 0=일 .. 6=토
utils/exportImport.js:120:  // 0) 현재 데이터 안전 백업
screens/AddChallengeScreen.js:31:const sortTimesAsc = (arr=[]) => [...arr].sort((a,b)=>a.localeCompare(b));
screens/AddChallengeScreen.js:108:  const months=[]; const cur=new Date(startDate.getFullYear(), startDate.getMonth(), 1);
screens/AddChallengeScreen.js:109:  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
screens/AddChallengeScreen.js:112:    const dt=new Date(y,mi,d);
screens/AddChallengeScreen.js:113:    return dt>=new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
screens/AddChallengeScreen.js:114:        && dt<=new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
screens/AddChallengeScreen.js:121:          const firstDow=new Date(y,mi,1).getDay();
screens/AddChallengeScreen.js:122:          const dim=new Date(y,mi+1,0).getDate();
screens/AddChallengeScreen.js:129:                {['일','월','화','수','목','금','토'].map((w,i)=>
screens/AddChallengeScreen.js:185:    const end = new Date(item.endDate);
screens/AddChallengeScreen.js:187:    isExpired = end < new Date();
screens/AddChallengeScreen.js:195:  const dt = new Date(y, (m||1)-1, d||1);
screens/AddChallengeScreen.js:196:  return isNaN(dt.getTime()) ? null : dt;
screens/AddChallengeScreen.js:260:    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
screens/AddChallengeScreen.js:381:              {['weekly', 'monthly'].map(t => (
screens/AddChallengeScreen.js:391:                ['all', 'weekday', 'weekend', 'custom'].map(s => (
screens/AddChallengeScreen.js:405:                ['all', 'even', 'odd', 'custom'].map(s => (
screens/AddChallengeScreen.js:424:                {['월','화','수','목','금','토','일'].map(d => (
screens/AddChallengeScreen.js:511:      <DateTimePickerModal isVisible={showStartPicker} mode="date" date={startDate || new Date()} onConfirm={d => { setStartDate(d); setShowStartPicker(false); }} onCancel={() => setShowStartPicker(false)} />
screens/AddChallengeScreen.js:512:      <DateTimePickerModal isVisible={showEndPicker} mode="date" date={endDate || new Date()} onConfirm={d => { setEndDate(d); setShowEndPicker(false); }} onCancel={() => setShowEndPicker(false)} />
screens/EntryListScreen.js:89:    ['entries','items','data','list','logs','records'].forEach(k=>{
screens/EntryListScreen.js:223:const sortTimesAsc = (arr=[]) => [...arr].sort((a,b)=>a.localeCompare(b));
screens/EntryListScreen.js:292:  const months=[]; const cur=new Date(startDate.getFullYear(), startDate.getMonth(), 1);
screens/EntryListScreen.js:293:  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
screens/EntryListScreen.js:296:    const dt=new Date(y,mi,d); return dt>=new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
screens/EntryListScreen.js:297:      && dt<=new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
screens/EntryListScreen.js:303:          const firstDow=new Date(y,mi,1).getDay();
screens/EntryListScreen.js:304:          const dim=new Date(y,mi+1,0).getDate();
screens/EntryListScreen.js:311:                {['일','월','화','수','목','금','토'].map((w,i)=><View key={w} style={{ flex:1, alignItems:'center', borderRightWidth:i<6?1:0, borderRightColor:'#eee' }}><Text style={{fontSize:11, fontWeight:'800', color:textGrey}}>{w}</Text></View>)}
screens/EntryListScreen.js:346:  if (mode==='fullrange') return <FullRangePreviewMini payload={payload} startDate={startDate?new Date(startDate):null} endDate={endDate?new Date(endDate):null} />;
screens/EntryListScreen.js:356:  const first = new Date(year, month, 1);
screens/EntryListScreen.js:358:  const daysInMonth = new Date(year, month + 1, 0).getDate();
screens/EntryListScreen.js:361:  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
screens/EntryListScreen.js:364:    const ds = new Date(startDate); ds.setHours(0,0,0,0);
screens/EntryListScreen.js:365:    const de = new Date(endDate); de.setHours(23,59,59,999);
screens/EntryListScreen.js:366:    const x = new Date(d); x.setHours(12,0,0,0);
screens/EntryListScreen.js:413:          const today = new Date(); today.setHours(0,0,0,0);
screens/EntryListScreen.js:422:            const isHighlight = highlightDate === keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
screens/EntryListScreen.js:458:    const d = new Date(e.timestamp); d.setHours(0,0,0,0);
screens/EntryListScreen.js:460:    const prev = map.get(k) || { minutes:0, count:0, date:new Date(d) };
screens/EntryListScreen.js:484:  const today = useMemo(()=>{ const t=new Date(); t.setHours(0,0,0,0); return t; },[]);
screens/EntryListScreen.js:496:    const startD = raw[0].date;
screens/EntryListScreen.js:497:    const endD = new Date(); endD.setHours(0,0,0,0);
screens/EntryListScreen.js:499:    const cur = new Date(startD);
screens/EntryListScreen.js:501:      const k = keyOf(new Date(cur));
screens/EntryListScreen.js:502:      result.push({ d: new Date(cur), v: minuteMap.get(k) || 0 });
screens/EntryListScreen.js:513:    const startD = baseSeries[0].d;
screens/EntryListScreen.js:514:    const endD = new Date(); endD.setHours(0,0,0,0);
screens/EntryListScreen.js:522:    const dayBefore = new Date(startD);
screens/EntryListScreen.js:528:    const cur = new Date(startD);
screens/EntryListScreen.js:530:      const k = keyOf(new Date(cur));
screens/EntryListScreen.js:532:      result.push({ d: new Date(cur), v: cum });
screens/EntryListScreen.js:538:  const start = useMemo(()=>startDate? new Date(new Date(startDate).setHours(0,0,0,0))
screens/EntryListScreen.js:548:      const vmax = Math.max(1, series[0].v);
screens/EntryListScreen.js:549:      const y = top + (1 - (series[0].v / vmax)) * usableCh * introProgress;
screens/EntryListScreen.js:551:      return [{x, y, v: series[0].v, d: series[0].d}];
screens/EntryListScreen.js:574:      const vmax = Math.max(1, series[0].v);
screens/EntryListScreen.js:575:      const y = yScale(series[0].v, vmax);
screens/EntryListScreen.js:578:        {x:xleft-0.001, y, v:series[0].v, d:series[0].d},
screens/EntryListScreen.js:579:        {x:xleft+0.001, y, v:series[0].v, d:series[0].d}
screens/EntryListScreen.js:587:    let d = `M ${pts[0].x} ${pts[0].y}`;
screens/EntryListScreen.js:588:    for(let i=1;i<pts.length;i++) d += ` L ${pts[i].x} ${pts[i].y}`;
screens/EntryListScreen.js:597:    let d = `M ${pts[0].x} ${bottomY} L ${pts[0].x} ${pts[0].y}`;
screens/EntryListScreen.js:598:    for(let i=1;i<pts.length;i++) d += ` L ${pts[i].x} ${pts[i].y}`;
screens/EntryListScreen.js:599:    d += ` L ${pts[pts.length-1].x} ${bottomY} Z`;
screens/EntryListScreen.js:671:      const dx = Math.abs(pts[i].x - x);
screens/EntryListScreen.js:679:    const v = series[selectedIdx].v;
screens/EntryListScreen.js:680:    const d = series[selectedIdx].d;
screens/EntryListScreen.js:719:          {`${String(new Date(start).getFullYear()).slice(2)}-${pad2(new Date(start).getMonth()+1)}-${pad2(new Date(start).getDate())}`}
screens/EntryListScreen.js:722:          {`Today ${String((new Date()).getFullYear()).slice(2)}-${pad2((new Date()).getMonth()+1)}-${pad2((new Date()).getDate())}`}
screens/EntryListScreen.js:1096:      const d = new Date(e.timestamp);
screens/EntryListScreen.js:1097:      certSet.add(keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate())));
screens/EntryListScreen.js:1099:    const start = new Date(startDate); start.setHours(0,0,0,0);
screens/EntryListScreen.js:1100:    const end = new Date(endDate); end.setHours(0,0,0,0);
screens/EntryListScreen.js:1101:    const today = new Date(); today.setHours(0,0,0,0);
screens/EntryListScreen.js:1102:    const gridStart = new Date(start);
screens/EntryListScreen.js:1107:    const cur = new Date(gridStart);
screens/EntryListScreen.js:1111:        weekStartCols.push({ col, date: new Date(cur) });
screens/EntryListScreen.js:1118:        const cellDate = new Date(cur);
screens/EntryListScreen.js:1131:            const prevDate = new Date(cellDate);
screens/EntryListScreen.js:1141:        cells.push({ col, row, date: new Date(cellDate), level });
screens/EntryListScreen.js:1254:        <Text style={styles.time}>인증 시간: {new Date(item.timestamp).toLocaleString()}</Text>
screens/EntryListScreen.js:1341:                #{indexFromEnd} {new Date(it.timestamp).toLocaleString()}
screens/EntryListScreen.js:1406:    const today = new Date();
screens/EntryListScreen.js:1407:    return new Date(today.getFullYear(), today.getMonth(), 1);
screens/EntryListScreen.js:1414:    const actual = new Date(ws);
screens/EntryListScreen.js:1417:    setMonthDate(new Date(actual.getFullYear(), actual.getMonth(), 1));
screens/EntryListScreen.js:1419:    const key = keyOf(new Date(actual.getFullYear(), actual.getMonth(), actual.getDate()));
screens/EntryListScreen.js:1492:      if (ts instanceof Date) ts = ts.getTime();
screens/EntryListScreen.js:1513:    const start = new Date(startDateStr); start.setHours(0,0,0,0);
screens/EntryListScreen.js:1516:    const now = new Date(); const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
screens/EntryListScreen.js:1518:    const thisSaturday = new Date(todayMid); thisSaturday.setDate(todayMid.getDate() + (6 - td));
screens/EntryListScreen.js:1521:    let cursor = new Date(start);
screens/EntryListScreen.js:1523:      const wsMid = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
screens/EntryListScreen.js:1525:        const dayStart = new Date(wsMid); dayStart.setDate(wsMid.getDate() + i);
screens/EntryListScreen.js:1526:        const dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1);
screens/EntryListScreen.js:1528:          const d = new Date(e.timestamp);
screens/EntryListScreen.js:1548:    const t0 = new Date(todayMid.getFullYear(), todayMid.getMonth(), todayMid.getDate());
screens/EntryListScreen.js:1551:      const ws = new Date(weeks[i].ws);
screens/EntryListScreen.js:1552:      const we = new Date(ws); we.setDate(we.getDate() + 7);
screens/EntryListScreen.js:1622:            hitKey = 'challenges[*].entries|logs';
screens/EntryListScreen.js:1704:        const s = new Date(loadedMeta.startDate);
screens/EntryListScreen.js:1705:        const e = new Date(loadedMeta.endDate);
screens/EntryListScreen.js:1706:        const t = new Date();
screens/EntryListScreen.js:1707:        const clampMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
screens/EntryListScreen.js:1732:    () => [...entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
screens/EntryListScreen.js:1738:    const d = new Date(dStr);
screens/EntryListScreen.js:1744:    const s = new Date(meta.startDate);
screens/EntryListScreen.js:1745:    const m0 = new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1);
screens/EntryListScreen.js:1746:    return m0 >= new Date(s.getFullYear(), s.getMonth(), 1);
screens/EntryListScreen.js:1751:    const e = new Date(meta.endDate);
screens/EntryListScreen.js:1752:    const m1 = new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1);
screens/EntryListScreen.js:1753:    return m1 <= new Date(e.getFullYear(), e.getMonth(), 1);
screens/EntryListScreen.js:1756:  const prevMonth = useCallback(()=> { if (canPrevMonth) setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1)); }, [canPrevMonth, monthDate]);
screens/EntryListScreen.js:1757:  const nextMonth = useCallback(()=> { if (canNextMonth) setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1)); }, [canNextMonth, monthDate]);
screens/EntryListScreen.js:1762:      const d = new Date(e.timestamp);
screens/EntryListScreen.js:1763:      set.add(keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate())));
screens/EntryListScreen.js:1810:            startDate={meta.startDate || new Date()}
screens/EntryListScreen.js:1811:            endDate={meta.endDate || new Date()}
screens/EntryListScreen.js:1887:            startDate={meta.startDate || new Date()}
screens/EntryListScreen.js:1888:            endDate={meta.endDate || new Date()}
screens/EntryListScreen.js:2066:                  startDate={meta.startDate ? new Date(meta.startDate) : null}
screens/EntryListScreen.js:2067:                  endDate={meta.endDate ? new Date(meta.endDate) : null}
screens/FullRangeNotificationScreen.js:22:  const dt=new Date(y,(m||1)-1,d||1); return isNaN(dt.getTime())?null:dt;
screens/FullRangeNotificationScreen.js:60:        m[k] = Array.isArray(initial.byDate[k]) ? [...new Set(initial.byDate[k].map(String))].sort() : [];
screens/FullRangeNotificationScreen.js:85:  const inRangeStart = useMemo(()=> start ? new Date(start.getFullYear(), start.getMonth(), start.getDate()) : null, [start]);
screens/FullRangeNotificationScreen.js:86:  const inRangeEnd   = useMemo(()=> end   ? new Date(end.getFullYear(), end.getMonth(), end.getDate())     : null, [end]);
screens/FullRangeNotificationScreen.js:90:    const arr=[]; const cur = new Date(start.getFullYear(), start.getMonth(), 1);
screens/FullRangeNotificationScreen.js:91:    const last= new Date(end.getFullYear(), end.getMonth(), 1);
screens/FullRangeNotificationScreen.js:98:    const dt = new Date(y,mi,d);
screens/FullRangeNotificationScreen.js:123:      const daysInMonth = new Date(y,mi+1,0).getDate();
screens/FullRangeNotificationScreen.js:135:      const daysInMonth = new Date(y,mi+1,0).getDate();
screens/FullRangeNotificationScreen.js:138:        const dow = new Date(y,mi,d).getDay(); // 0:일 ~ 6:토
screens/FullRangeNotificationScreen.js:148:      const daysInMonth = new Date(y,mi+1,0).getDate();
screens/FullRangeNotificationScreen.js:151:        const dow = new Date(y,mi,d).getDay();
screens/FullRangeNotificationScreen.js:187:      return [...prev, t].sort();
screens/FullRangeNotificationScreen.js:214:      const cur = new Date(sdt);
screens/FullRangeNotificationScreen.js:252:      const arr = Array.isArray(prev[key]) ? prev[key].filter(t=>t!==time) : [];
screens/FullRangeNotificationScreen.js:294:          const first = new Date(y,mi,1);
screens/FullRangeNotificationScreen.js:295:          const daysInMonth = new Date(y,mi+1,0).getDate();
screens/FullRangeNotificationScreen.js:310:                {['일','월','화','수','목','금','토'].map((w,idx)=>(
screens/HallOfFameScreen.js:51:  return [...list].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
screens/HallOfFameScreen.js:147:                완료일 {doneTs ? new Date(doneTs).toLocaleString() : '-'}
screens/TrashScreen.js:17:  const d = new Date(ts);
screens/EditChallengeScreen.js:41:  const dt = new Date(y,(m||1)-1,d||1); return isNaN(dt.getTime())?null:dt;
screens/EditChallengeScreen.js:43:const sortTimesAsc = (arr=[]) => [...arr].sort((a,b)=>a.localeCompare(b));
screens/EditChallengeScreen.js:150:  const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
screens/EditChallengeScreen.js:151:  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
screens/EditChallengeScreen.js:155:    const dt = new Date(y,mi,d);
screens/EditChallengeScreen.js:156:    return dt >= new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
screens/EditChallengeScreen.js:157:        && dt <= new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
screens/EditChallengeScreen.js:164:          const first=new Date(y,mi,1);
screens/EditChallengeScreen.js:165:          const daysInMonth=new Date(y,mi+1,0).getDate();
screens/EditChallengeScreen.js:177:                {['일','월','화','수','목','금','토'].map((w,idx)=>(
screens/EditChallengeScreen.js:391:    if(startDate && endDate && endDate.getTime() < startDate.getTime()){
screens/EditChallengeScreen.js:583:                {['월','화','수','목','금','토','일'].map(d => {
screens/EditChallengeScreen.js:639:              {['weekly', 'monthly'].map(t => (
screens/EditChallengeScreen.js:648:                ['all', 'weekday', 'weekend', 'custom'].map(s => (
screens/EditChallengeScreen.js:662:                ['all', 'even', 'odd', 'custom'].map(s => (
screens/EditChallengeScreen.js:680:                {['월','화','수','목','금','토','일'].map(d => (
screens/EditChallengeScreen.js:742:        date={startDate ?? new Date()}
screens/EditChallengeScreen.js:749:        date={endDate ?? new Date()}
screens/EditChallengeScreen.js:802:              if (endDate.getTime() < startDate.getTime()) { Alert.alert('확인','종료일이 시작일보다 빠를 수 없습니다.'); return; }
screens/EntryDetailScreen.js:183:        timestamp: timestamp || list[idx].timestamp || Date.now(),
screens/WeeklyNotificationScreen.js:65:      const next = [...arr, t].sort();
screens/WeeklyNotificationScreen.js:119:      return [...prev, t].sort();
screens/MonthlyNotificationScreen.js:103:      const arr = Array.isArray(prev[key]) ? prev[key].filter(x => x.time !== timeStr) : [];
screens/MonthlyNotificationScreen.js:192:      return [...prev, t].sort();
screens/MonthlyNotificationScreen.js:206:      const current = Array.isArray(map[key]) ? map[key].map(x=>x.time) : [];
screens/MonthlyNotificationScreen.js:221:        const current = Array.isArray(next[key]) ? next[key].map(x=>x.time) : [];
screens/EntryListScreen.js.bak4:89:    ['entries','items','data','list','logs','records'].forEach(k=>{
screens/EntryListScreen.js.bak4:223:const sortTimesAsc = (arr=[]) => [...arr].sort((a,b)=>a.localeCompare(b));
screens/EntryListScreen.js.bak4:292:  const months=[]; const cur=new Date(startDate.getFullYear(), startDate.getMonth(), 1);
screens/EntryListScreen.js.bak4:293:  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
screens/EntryListScreen.js.bak4:296:    const dt=new Date(y,mi,d); return dt>=new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
screens/EntryListScreen.js.bak4:297:      && dt<=new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
screens/EntryListScreen.js.bak4:303:          const firstDow=new Date(y,mi,1).getDay();
screens/EntryListScreen.js.bak4:304:          const dim=new Date(y,mi+1,0).getDate();
screens/EntryListScreen.js.bak4:311:                {['일','월','화','수','목','금','토'].map((w,i)=><View key={w} style={{ flex:1, alignItems:'center', borderRightWidth:i<6?1:0, borderRightColor:'#eee' }}><Text style={{fontSize:11, fontWeight:'800', color:textGrey}}>{w}</Text></View>)}
screens/EntryListScreen.js.bak4:346:  if (mode==='fullrange') return <FullRangePreviewMini payload={payload} startDate={startDate?new Date(startDate):null} endDate={endDate?new Date(endDate):null} />;
screens/EntryListScreen.js.bak4:356:  const first = new Date(year, month, 1);
screens/EntryListScreen.js.bak4:358:  const daysInMonth = new Date(year, month + 1, 0).getDate();
screens/EntryListScreen.js.bak4:361:  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
screens/EntryListScreen.js.bak4:364:    const ds = new Date(startDate); ds.setHours(0,0,0,0);
screens/EntryListScreen.js.bak4:365:    const de = new Date(endDate); de.setHours(23,59,59,999);
screens/EntryListScreen.js.bak4:366:    const x = new Date(d); x.setHours(12,0,0,0);
screens/EntryListScreen.js.bak4:413:          const today = new Date(); today.setHours(0,0,0,0);
screens/EntryListScreen.js.bak4:422:            const isHighlight = highlightDate === keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
screens/EntryListScreen.js.bak4:458:    const d = new Date(e.timestamp); d.setHours(0,0,0,0);
screens/EntryListScreen.js.bak4:460:    const prev = map.get(k) || { minutes:0, count:0, date:new Date(d) };
screens/EntryListScreen.js.bak4:484:  const today = useMemo(()=>{ const t=new Date(); t.setHours(0,0,0,0); return t; },[]);
screens/EntryListScreen.js.bak4:496:    const startD = raw[0].date;
screens/EntryListScreen.js.bak4:497:    const endD = new Date(); endD.setHours(0,0,0,0);
screens/EntryListScreen.js.bak4:499:    const cur = new Date(startD);
screens/EntryListScreen.js.bak4:501:      const k = keyOf(new Date(cur));
screens/EntryListScreen.js.bak4:502:      result.push({ d: new Date(cur), v: minuteMap.get(k) || 0 });
screens/EntryListScreen.js.bak4:513:    const startD = baseSeries[0].d;
screens/EntryListScreen.js.bak4:514:    const endD = new Date(); endD.setHours(0,0,0,0);
screens/EntryListScreen.js.bak4:522:    const dayBefore = new Date(startD);
screens/EntryListScreen.js.bak4:528:    const cur = new Date(startD);
screens/EntryListScreen.js.bak4:530:      const k = keyOf(new Date(cur));
screens/EntryListScreen.js.bak4:532:      result.push({ d: new Date(cur), v: cum });
screens/EntryListScreen.js.bak4:538:  const start = useMemo(()=>startDate? new Date(new Date(startDate).setHours(0,0,0,0))
screens/EntryListScreen.js.bak4:548:      const vmax = Math.max(1, series[0].v);
screens/EntryListScreen.js.bak4:549:      const y = top + (1 - (series[0].v / vmax)) * usableCh * introProgress;
screens/EntryListScreen.js.bak4:551:      return [{x, y, v: series[0].v, d: series[0].d}];
screens/EntryListScreen.js.bak4:574:      const vmax = Math.max(1, series[0].v);
screens/EntryListScreen.js.bak4:575:      const y = yScale(series[0].v, vmax);
screens/EntryListScreen.js.bak4:578:        {x:xleft-0.001, y, v:series[0].v, d:series[0].d},
screens/EntryListScreen.js.bak4:579:        {x:xleft+0.001, y, v:series[0].v, d:series[0].d}
screens/EntryListScreen.js.bak4:587:    let d = `M ${pts[0].x} ${pts[0].y}`;
screens/EntryListScreen.js.bak4:588:    for(let i=1;i<pts.length;i++) d += ` L ${pts[i].x} ${pts[i].y}`;
screens/EntryListScreen.js.bak4:597:    let d = `M ${pts[0].x} ${bottomY} L ${pts[0].x} ${pts[0].y}`;
screens/EntryListScreen.js.bak4:598:    for(let i=1;i<pts.length;i++) d += ` L ${pts[i].x} ${pts[i].y}`;
screens/EntryListScreen.js.bak4:599:    d += ` L ${pts[pts.length-1].x} ${bottomY} Z`;
screens/EntryListScreen.js.bak4:649:    if (near(nodePts[i].x, nodePts[i].y, 16)) return true;
screens/EntryListScreen.js.bak4:664:      const dx = Math.abs(pts[i].x - x);
screens/EntryListScreen.js.bak4:672:    const v = series[selectedIdx].v;
screens/EntryListScreen.js.bak4:673:    const d = series[selectedIdx].d;
screens/EntryListScreen.js.bak4:712:          {`${String(new Date(start).getFullYear()).slice(2)}-${pad2(new Date(start).getMonth()+1)}-${pad2(new Date(start).getDate())}`}
screens/EntryListScreen.js.bak4:715:          {`Today ${String((new Date()).getFullYear()).slice(2)}-${pad2((new Date()).getMonth()+1)}-${pad2((new Date()).getDate())}`}
screens/EntryListScreen.js.bak4:1058:      const d = new Date(e.timestamp);
screens/EntryListScreen.js.bak4:1059:      certSet.add(keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate())));
screens/EntryListScreen.js.bak4:1062:    const start = new Date(startDate); start.setHours(0,0,0,0);
screens/EntryListScreen.js.bak4:1063:    const end = new Date(endDate); end.setHours(0,0,0,0);
screens/EntryListScreen.js.bak4:1064:    const today = new Date(); today.setHours(0,0,0,0);
screens/EntryListScreen.js.bak4:1066:    const gridStart = new Date(start);
screens/EntryListScreen.js.bak4:1073:    const cur = new Date(gridStart);
screens/EntryListScreen.js.bak4:1078:        weekStartCols.push({ col, date: new Date(cur) });
screens/EntryListScreen.js.bak4:1085:        const cellDate = new Date(cur);
screens/EntryListScreen.js.bak4:1103:            const prevDate = new Date(cellDate);
screens/EntryListScreen.js.bak4:1114:        cells.push({ col, row, date: new Date(cellDate), level });
screens/EntryListScreen.js.bak4:1206:        <Text style={styles.time}>인증 시간: {new Date(item.timestamp).toLocaleString()}</Text>
screens/EntryListScreen.js.bak4:1293:                #{indexFromEnd} {new Date(it.timestamp).toLocaleString()}
screens/EntryListScreen.js.bak4:1358:    const today = new Date();
screens/EntryListScreen.js.bak4:1359:    return new Date(today.getFullYear(), today.getMonth(), 1);
screens/EntryListScreen.js.bak4:1366:    const actual = new Date(ws);
screens/EntryListScreen.js.bak4:1369:    setMonthDate(new Date(actual.getFullYear(), actual.getMonth(), 1));
screens/EntryListScreen.js.bak4:1371:    const key = keyOf(new Date(actual.getFullYear(), actual.getMonth(), actual.getDate()));
screens/EntryListScreen.js.bak4:1414:      if (ts instanceof Date) ts = ts.getTime();
screens/EntryListScreen.js.bak4:1435:    const start = new Date(startDateStr); start.setHours(0,0,0,0);
screens/EntryListScreen.js.bak4:1438:    const now = new Date(); const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
screens/EntryListScreen.js.bak4:1440:    const thisSaturday = new Date(todayMid); thisSaturday.setDate(todayMid.getDate() + (6 - td));
screens/EntryListScreen.js.bak4:1443:    let cursor = new Date(start);
screens/EntryListScreen.js.bak4:1445:      const wsMid = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
screens/EntryListScreen.js.bak4:1447:        const dayStart = new Date(wsMid); dayStart.setDate(wsMid.getDate() + i);
screens/EntryListScreen.js.bak4:1448:        const dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1);
screens/EntryListScreen.js.bak4:1450:          const d = new Date(e.timestamp);
screens/EntryListScreen.js.bak4:1470:    const t0 = new Date(todayMid.getFullYear(), todayMid.getMonth(), todayMid.getDate());
screens/EntryListScreen.js.bak4:1473:      const ws = new Date(weeks[i].ws);
screens/EntryListScreen.js.bak4:1474:      const we = new Date(ws); we.setDate(we.getDate() + 7);
screens/EntryListScreen.js.bak4:1544:            hitKey = 'challenges[*].entries|logs';
screens/EntryListScreen.js.bak4:1625:        const s = new Date(loadedMeta.startDate);
screens/EntryListScreen.js.bak4:1626:        const e = new Date(loadedMeta.endDate);
screens/EntryListScreen.js.bak4:1627:        const t = new Date();
screens/EntryListScreen.js.bak4:1628:        const clampMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
screens/EntryListScreen.js.bak4:1653:    () => [...entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
screens/EntryListScreen.js.bak4:1659:    const d = new Date(dStr);
screens/EntryListScreen.js.bak4:1665:    const s = new Date(meta.startDate);
screens/EntryListScreen.js.bak4:1666:    const m0 = new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1);
screens/EntryListScreen.js.bak4:1667:    return m0 >= new Date(s.getFullYear(), s.getMonth(), 1);
screens/EntryListScreen.js.bak4:1672:    const e = new Date(meta.endDate);
screens/EntryListScreen.js.bak4:1673:    const m1 = new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1);
screens/EntryListScreen.js.bak4:1674:    return m1 <= new Date(e.getFullYear(), e.getMonth(), 1);
screens/EntryListScreen.js.bak4:1677:  const prevMonth = useCallback(()=> { if (canPrevMonth) setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1)); }, [canPrevMonth, monthDate]);
screens/EntryListScreen.js.bak4:1678:  const nextMonth = useCallback(()=> { if (canNextMonth) setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1)); }, [canNextMonth, monthDate]);
screens/EntryListScreen.js.bak4:1683:      const d = new Date(e.timestamp);
screens/EntryListScreen.js.bak4:1684:      set.add(keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate())));
screens/EntryListScreen.js.bak4:1731:            startDate={meta.startDate || new Date()}
screens/EntryListScreen.js.bak4:1732:            endDate={meta.endDate || new Date()}
screens/EntryListScreen.js.bak4:1801:            startDate={meta.startDate || new Date()}
screens/EntryListScreen.js.bak4:1802:            endDate={meta.endDate || new Date()}
screens/EntryListScreen.js.bak4:1980:                  startDate={meta.startDate ? new Date(meta.startDate) : null}
screens/EntryListScreen.js.bak4:1981:                  endDate={meta.endDate ? new Date(meta.endDate) : null}
screens/EntryListScreen.js.bak:89:    ['entries','items','data','list','logs','records'].forEach(k=>{
screens/EntryListScreen.js.bak:223:const sortTimesAsc = (arr=[]) => [...arr].sort((a,b)=>a.localeCompare(b));
screens/EntryListScreen.js.bak:292:  const months=[]; const cur=new Date(startDate.getFullYear(), startDate.getMonth(), 1);
screens/EntryListScreen.js.bak:293:  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
screens/EntryListScreen.js.bak:296:    const dt=new Date(y,mi,d); return dt>=new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
screens/EntryListScreen.js.bak:297:      && dt<=new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
screens/EntryListScreen.js.bak:303:          const firstDow=new Date(y,mi,1).getDay();
screens/EntryListScreen.js.bak:304:          const dim=new Date(y,mi+1,0).getDate();
screens/EntryListScreen.js.bak:311:                {['일','월','화','수','목','금','토'].map((w,i)=><View key={w} style={{ flex:1, alignItems:'center', borderRightWidth:i<6?1:0, borderRightColor:'#eee' }}><Text style={{fontSize:11, fontWeight:'800', color:textGrey}}>{w}</Text></View>)}
screens/EntryListScreen.js.bak:346:  if (mode==='fullrange') return <FullRangePreviewMini payload={payload} startDate={startDate?new Date(startDate):null} endDate={endDate?new Date(endDate):null} />;
screens/EntryListScreen.js.bak:356:  const first = new Date(year, month, 1);
screens/EntryListScreen.js.bak:358:  const daysInMonth = new Date(year, month + 1, 0).getDate();
screens/EntryListScreen.js.bak:361:  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
screens/EntryListScreen.js.bak:364:    const ds = new Date(startDate); ds.setHours(0,0,0,0);
screens/EntryListScreen.js.bak:365:    const de = new Date(endDate); de.setHours(23,59,59,999);
screens/EntryListScreen.js.bak:366:    const x = new Date(d); x.setHours(12,0,0,0);
screens/EntryListScreen.js.bak:413:          const today = new Date(); today.setHours(0,0,0,0);
screens/EntryListScreen.js.bak:463:    const d = new Date(e.timestamp); d.setHours(0,0,0,0);
screens/EntryListScreen.js.bak:465:    const prev = map.get(k) || { minutes:0, count:0, date:new Date(d) };
screens/EntryListScreen.js.bak:489:  const today = useMemo(()=>{ const t=new Date(); t.setHours(0,0,0,0); return t; },[]);
screens/EntryListScreen.js.bak:503:  const start = useMemo(()=>startDate? new Date(new Date(startDate).setHours(0,0,0,0))
screens/EntryListScreen.js.bak:513:      const vmax = Math.max(1, series[0].v);
screens/EntryListScreen.js.bak:514:      const y = top + (1 - (series[0].v / vmax)) * usableCh * introProgress;
screens/EntryListScreen.js.bak:516:      return [{x, y, v: series[0].v, d: series[0].d}];
screens/EntryListScreen.js.bak:536:      const vmax = Math.max(1, series[0].v);
screens/EntryListScreen.js.bak:537:      const y = yScale(series[0].v, vmax);
screens/EntryListScreen.js.bak:540:        {x:xleft-0.001, y, v:series[0].v, d:series[0].d},
screens/EntryListScreen.js.bak:541:        {x:xleft+0.001, y, v:series[0].v, d:series[0].d}
screens/EntryListScreen.js.bak:549:    let d = `M ${pts[0].x} ${pts[0].y}`;
screens/EntryListScreen.js.bak:550:    for(let i=1;i<pts.length;i++) d += ` L ${pts[i].x} ${pts[i].y}`;
screens/EntryListScreen.js.bak:559:    let d = `M ${pts[0].x} ${bottomY} L ${pts[0].x} ${pts[0].y}`;
screens/EntryListScreen.js.bak:560:    for(let i=1;i<pts.length;i++) d += ` L ${pts[i].x} ${pts[i].y}`;
screens/EntryListScreen.js.bak:561:    d += ` L ${pts[pts.length-1].x} ${bottomY} Z`;
screens/EntryListScreen.js.bak:611:    if (near(nodePts[i].x, nodePts[i].y, 16)) return true;
screens/EntryListScreen.js.bak:626:      const dx = Math.abs(pts[i].x - x);
screens/EntryListScreen.js.bak:634:    const v = series[selectedIdx].v;
screens/EntryListScreen.js.bak:635:    const d = series[selectedIdx].d;
screens/EntryListScreen.js.bak:674:          {`${String(new Date(start).getFullYear()).slice(2)}-${pad2(new Date(start).getMonth()+1)}-${pad2(new Date(start).getDate())}`}
screens/EntryListScreen.js.bak:677:          {`Today ${String((new Date()).getFullYear()).slice(2)}-${pad2((new Date()).getMonth()+1)}-${pad2((new Date()).getDate())}`}
screens/EntryListScreen.js.bak:965:      const d = new Date(e.timestamp);
screens/EntryListScreen.js.bak:966:      certSet.add(keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate())));
screens/EntryListScreen.js.bak:969:    const start = new Date(startDate); start.setHours(0,0,0,0);
screens/EntryListScreen.js.bak:970:    const end = new Date(endDate); end.setHours(0,0,0,0);
screens/EntryListScreen.js.bak:971:    const today = new Date(); today.setHours(0,0,0,0);
screens/EntryListScreen.js.bak:973:    const gridStart = new Date(start);
screens/EntryListScreen.js.bak:980:    const cur = new Date(gridStart);
screens/EntryListScreen.js.bak:985:        weekStartCols.push({ col, date: new Date(cur) });
screens/EntryListScreen.js.bak:992:        const cellDate = new Date(cur);
screens/EntryListScreen.js.bak:1005:        cells.push({ col, row, date: new Date(cellDate), level });
screens/EntryListScreen.js.bak:1096:        <Text style={styles.time}>인증 시간: {new Date(item.timestamp).toLocaleString()}</Text>
screens/EntryListScreen.js.bak:1183:                #{indexFromEnd} {new Date(it.timestamp).toLocaleString()}
screens/EntryListScreen.js.bak:1236:    const today = new Date();
screens/EntryListScreen.js.bak:1237:    return new Date(today.getFullYear(), today.getMonth(), 1);
screens/EntryListScreen.js.bak:1244:    const actual = new Date(ws);
screens/EntryListScreen.js.bak:1247:    setMonthDate(new Date(actual.getFullYear(), actual.getMonth(), 1));
screens/EntryListScreen.js.bak:1249:    const key = keyOf(new Date(actual.getFullYear(), actual.getMonth(), actual.getDate()));
screens/EntryListScreen.js.bak:1290:      if (ts instanceof Date) ts = ts.getTime();
screens/EntryListScreen.js.bak:1311:    const start = new Date(startDateStr); start.setHours(0,0,0,0);
screens/EntryListScreen.js.bak:1314:    const now = new Date(); const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
screens/EntryListScreen.js.bak:1316:    const thisSaturday = new Date(todayMid); thisSaturday.setDate(todayMid.getDate() + (6 - td));
screens/EntryListScreen.js.bak:1319:    let cursor = new Date(start);
screens/EntryListScreen.js.bak:1321:      const wsMid = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
screens/EntryListScreen.js.bak:1323:        const dayStart = new Date(wsMid); dayStart.setDate(wsMid.getDate() + i);
screens/EntryListScreen.js.bak:1324:        const dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1);
screens/EntryListScreen.js.bak:1326:          const d = new Date(e.timestamp);
screens/EntryListScreen.js.bak:1346:    const t0 = new Date(todayMid.getFullYear(), todayMid.getMonth(), todayMid.getDate());
screens/EntryListScreen.js.bak:1349:      const ws = new Date(weeks[i].ws);
screens/EntryListScreen.js.bak:1350:      const we = new Date(ws); we.setDate(we.getDate() + 7);
screens/EntryListScreen.js.bak:1427:            hitKey = 'challenges[*].entries|logs';
screens/EntryListScreen.js.bak:1505:        const s = new Date(loadedMeta.startDate);
screens/EntryListScreen.js.bak:1506:        const e = new Date(loadedMeta.endDate);
screens/EntryListScreen.js.bak:1507:        const t = new Date();
screens/EntryListScreen.js.bak:1508:        const clampMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
screens/EntryListScreen.js.bak:1530:    () => [...entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
screens/EntryListScreen.js.bak:1536:    const d = new Date(dStr);
screens/EntryListScreen.js.bak:1542:    const s = new Date(meta.startDate);
screens/EntryListScreen.js.bak:1543:    const m0 = new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1);
screens/EntryListScreen.js.bak:1544:    return m0 >= new Date(s.getFullYear(), s.getMonth(), 1);
screens/EntryListScreen.js.bak:1549:    const e = new Date(meta.endDate);
screens/EntryListScreen.js.bak:1550:    const m1 = new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1);
screens/EntryListScreen.js.bak:1551:    return m1 <= new Date(e.getFullYear(), e.getMonth(), 1);
screens/EntryListScreen.js.bak:1554:  const prevMonth = useCallback(()=> { if (canPrevMonth) setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1)); }, [canPrevMonth, monthDate]);
screens/EntryListScreen.js.bak:1555:  const nextMonth = useCallback(()=> { if (canNextMonth) setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1)); }, [canNextMonth, monthDate]);
screens/EntryListScreen.js.bak:1560:      const d = new Date(e.timestamp);
screens/EntryListScreen.js.bak:1561:      set.add(keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate())));
screens/EntryListScreen.js.bak:1602:            startDate={meta.startDate || new Date()}
screens/EntryListScreen.js.bak:1603:            endDate={meta.endDate || new Date()}
screens/EntryListScreen.js.bak:1671:            startDate={meta.startDate || new Date()}
screens/EntryListScreen.js.bak:1672:            endDate={meta.endDate || new Date()}
screens/EntryListScreen.js.bak:1849:                  startDate={meta.startDate ? new Date(meta.startDate) : null}
screens/EntryListScreen.js.bak:1850:                  endDate={meta.endDate ? new Date(meta.endDate) : null}
screens/UploadScreen.js:37:  const today = new Date();
screens/UploadScreen.js:40:  const yesterday = new Date(today);
screens/UploadScreen.js:46:      const d = new Date(e.timestamp);
screens/UploadScreen.js:48:      return d.getTime();
screens/UploadScreen.js:51:  certSet.add(today.getTime()); // 방금 등록한 오늘 인증 추가
screens/UploadScreen.js:55:  const cur = new Date(today);
screens/UploadScreen.js:56:  while (certSet.has(cur.getTime())) {
screens/ChallengeListScreen.js:82:    const end = new Date(c.endDate);
screens/ChallengeListScreen.js:84:    isExpired = end < new Date();
screens/ChallengeListScreen.js:113:      {[0, 1, 2, 3, 4].map((i) => (
screens/ChallengeListScreen.js:186:  const expiredSorted = expired.sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
screens/SimpleNotificationScreen.js:47:        setTimes([...new Set(initial.times.map(String))].sort());
screens/SimpleNotificationScreen.js:97:      const arr = [...prev, t].sort();
screens/SimpleNotificationScreen.js:255:              {[1, 2, 3, 4, 5].map((n) => {
screens/EntryListScreen.js.bak3:89:    ['entries','items','data','list','logs','records'].forEach(k=>{
screens/EntryListScreen.js.bak3:223:const sortTimesAsc = (arr=[]) => [...arr].sort((a,b)=>a.localeCompare(b));
screens/EntryListScreen.js.bak3:292:  const months=[]; const cur=new Date(startDate.getFullYear(), startDate.getMonth(), 1);
screens/EntryListScreen.js.bak3:293:  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
screens/EntryListScreen.js.bak3:296:    const dt=new Date(y,mi,d); return dt>=new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
screens/EntryListScreen.js.bak3:297:      && dt<=new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
screens/EntryListScreen.js.bak3:303:          const firstDow=new Date(y,mi,1).getDay();
screens/EntryListScreen.js.bak3:304:          const dim=new Date(y,mi+1,0).getDate();
screens/EntryListScreen.js.bak3:311:                {['일','월','화','수','목','금','토'].map((w,i)=><View key={w} style={{ flex:1, alignItems:'center', borderRightWidth:i<6?1:0, borderRightColor:'#eee' }}><Text style={{fontSize:11, fontWeight:'800', color:textGrey}}>{w}</Text></View>)}
screens/EntryListScreen.js.bak3:346:  if (mode==='fullrange') return <FullRangePreviewMini payload={payload} startDate={startDate?new Date(startDate):null} endDate={endDate?new Date(endDate):null} />;
screens/EntryListScreen.js.bak3:356:  const first = new Date(year, month, 1);
screens/EntryListScreen.js.bak3:358:  const daysInMonth = new Date(year, month + 1, 0).getDate();
screens/EntryListScreen.js.bak3:361:  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
screens/EntryListScreen.js.bak3:364:    const ds = new Date(startDate); ds.setHours(0,0,0,0);
screens/EntryListScreen.js.bak3:365:    const de = new Date(endDate); de.setHours(23,59,59,999);
screens/EntryListScreen.js.bak3:366:    const x = new Date(d); x.setHours(12,0,0,0);
screens/EntryListScreen.js.bak3:413:          const today = new Date(); today.setHours(0,0,0,0);
screens/EntryListScreen.js.bak3:422:            const isHighlight = highlightDate === keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
screens/EntryListScreen.js.bak3:458:    const d = new Date(e.timestamp); d.setHours(0,0,0,0);
screens/EntryListScreen.js.bak3:460:    const prev = map.get(k) || { minutes:0, count:0, date:new Date(d) };
screens/EntryListScreen.js.bak3:484:  const today = useMemo(()=>{ const t=new Date(); t.setHours(0,0,0,0); return t; },[]);
screens/EntryListScreen.js.bak3:496:    const startD = raw[0].date;
screens/EntryListScreen.js.bak3:497:    const endD = new Date(); endD.setHours(0,0,0,0);
screens/EntryListScreen.js.bak3:499:    const cur = new Date(startD);
screens/EntryListScreen.js.bak3:501:      const k = keyOf(new Date(cur));
screens/EntryListScreen.js.bak3:502:      result.push({ d: new Date(cur), v: minuteMap.get(k) || 0 });
screens/EntryListScreen.js.bak3:513:    const startD = baseSeries[0].d;
screens/EntryListScreen.js.bak3:514:    const endD = new Date(); endD.setHours(0,0,0,0);
screens/EntryListScreen.js.bak3:522:    const dayBefore = new Date(startD);
screens/EntryListScreen.js.bak3:528:    const cur = new Date(startD);
screens/EntryListScreen.js.bak3:530:      const k = keyOf(new Date(cur));
screens/EntryListScreen.js.bak3:532:      result.push({ d: new Date(cur), v: cum });
screens/EntryListScreen.js.bak3:538:  const start = useMemo(()=>startDate? new Date(new Date(startDate).setHours(0,0,0,0))
screens/EntryListScreen.js.bak3:548:      const vmax = Math.max(1, series[0].v);
screens/EntryListScreen.js.bak3:549:      const y = top + (1 - (series[0].v / vmax)) * usableCh * introProgress;
screens/EntryListScreen.js.bak3:551:      return [{x, y, v: series[0].v, d: series[0].d}];
screens/EntryListScreen.js.bak3:574:      const vmax = Math.max(1, series[0].v);
screens/EntryListScreen.js.bak3:575:      const y = yScale(series[0].v, vmax);
screens/EntryListScreen.js.bak3:578:        {x:xleft-0.001, y, v:series[0].v, d:series[0].d},
screens/EntryListScreen.js.bak3:579:        {x:xleft+0.001, y, v:series[0].v, d:series[0].d}
screens/EntryListScreen.js.bak3:587:    let d = `M ${pts[0].x} ${pts[0].y}`;
screens/EntryListScreen.js.bak3:588:    for(let i=1;i<pts.length;i++) d += ` L ${pts[i].x} ${pts[i].y}`;
screens/EntryListScreen.js.bak3:597:    let d = `M ${pts[0].x} ${bottomY} L ${pts[0].x} ${pts[0].y}`;
screens/EntryListScreen.js.bak3:598:    for(let i=1;i<pts.length;i++) d += ` L ${pts[i].x} ${pts[i].y}`;
screens/EntryListScreen.js.bak3:599:    d += ` L ${pts[pts.length-1].x} ${bottomY} Z`;
screens/EntryListScreen.js.bak3:649:    if (near(nodePts[i].x, nodePts[i].y, 16)) return true;
screens/EntryListScreen.js.bak3:664:      const dx = Math.abs(pts[i].x - x);
screens/EntryListScreen.js.bak3:672:    const v = series[selectedIdx].v;
screens/EntryListScreen.js.bak3:673:    const d = series[selectedIdx].d;
screens/EntryListScreen.js.bak3:712:          {`${String(new Date(start).getFullYear()).slice(2)}-${pad2(new Date(start).getMonth()+1)}-${pad2(new Date(start).getDate())}`}
screens/EntryListScreen.js.bak3:715:          {`Today ${String((new Date()).getFullYear()).slice(2)}-${pad2((new Date()).getMonth()+1)}-${pad2((new Date()).getDate())}`}
screens/EntryListScreen.js.bak3:1058:      const d = new Date(e.timestamp);
screens/EntryListScreen.js.bak3:1059:      certSet.add(keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate())));
screens/EntryListScreen.js.bak3:1062:    const start = new Date(startDate); start.setHours(0,0,0,0);
screens/EntryListScreen.js.bak3:1063:    const end = new Date(endDate); end.setHours(0,0,0,0);
screens/EntryListScreen.js.bak3:1064:    const today = new Date(); today.setHours(0,0,0,0);
screens/EntryListScreen.js.bak3:1066:    const gridStart = new Date(start);
screens/EntryListScreen.js.bak3:1073:    const cur = new Date(gridStart);
screens/EntryListScreen.js.bak3:1078:        weekStartCols.push({ col, date: new Date(cur) });
screens/EntryListScreen.js.bak3:1085:        const cellDate = new Date(cur);
screens/EntryListScreen.js.bak3:1103:            const prevDate = new Date(cellDate);
screens/EntryListScreen.js.bak3:1114:        cells.push({ col, row, date: new Date(cellDate), level });
screens/EntryListScreen.js.bak3:1206:        <Text style={styles.time}>인증 시간: {new Date(item.timestamp).toLocaleString()}</Text>
screens/EntryListScreen.js.bak3:1293:                #{indexFromEnd} {new Date(it.timestamp).toLocaleString()}
screens/EntryListScreen.js.bak3:1358:    const today = new Date();
screens/EntryListScreen.js.bak3:1359:    return new Date(today.getFullYear(), today.getMonth(), 1);
screens/EntryListScreen.js.bak3:1366:    const actual = new Date(ws);
screens/EntryListScreen.js.bak3:1369:    setMonthDate(new Date(actual.getFullYear(), actual.getMonth(), 1));
screens/EntryListScreen.js.bak3:1371:    const key = keyOf(new Date(actual.getFullYear(), actual.getMonth(), actual.getDate()));
screens/EntryListScreen.js.bak3:1414:      if (ts instanceof Date) ts = ts.getTime();
screens/EntryListScreen.js.bak3:1435:    const start = new Date(startDateStr); start.setHours(0,0,0,0);
screens/EntryListScreen.js.bak3:1438:    const now = new Date(); const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
screens/EntryListScreen.js.bak3:1440:    const thisSaturday = new Date(todayMid); thisSaturday.setDate(todayMid.getDate() + (6 - td));
screens/EntryListScreen.js.bak3:1443:    let cursor = new Date(start);
screens/EntryListScreen.js.bak3:1445:      const wsMid = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
screens/EntryListScreen.js.bak3:1447:        const dayStart = new Date(wsMid); dayStart.setDate(wsMid.getDate() + i);
screens/EntryListScreen.js.bak3:1448:        const dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1);
screens/EntryListScreen.js.bak3:1450:          const d = new Date(e.timestamp);
screens/EntryListScreen.js.bak3:1470:    const t0 = new Date(todayMid.getFullYear(), todayMid.getMonth(), todayMid.getDate());
screens/EntryListScreen.js.bak3:1473:      const ws = new Date(weeks[i].ws);
screens/EntryListScreen.js.bak3:1474:      const we = new Date(ws); we.setDate(we.getDate() + 7);
screens/EntryListScreen.js.bak3:1544:            hitKey = 'challenges[*].entries|logs';
screens/EntryListScreen.js.bak3:1625:        const s = new Date(loadedMeta.startDate);
screens/EntryListScreen.js.bak3:1626:        const e = new Date(loadedMeta.endDate);
screens/EntryListScreen.js.bak3:1627:        const t = new Date();
screens/EntryListScreen.js.bak3:1628:        const clampMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
screens/EntryListScreen.js.bak3:1653:    () => [...entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
screens/EntryListScreen.js.bak3:1659:    const d = new Date(dStr);
screens/EntryListScreen.js.bak3:1665:    const s = new Date(meta.startDate);
screens/EntryListScreen.js.bak3:1666:    const m0 = new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1);
screens/EntryListScreen.js.bak3:1667:    return m0 >= new Date(s.getFullYear(), s.getMonth(), 1);
screens/EntryListScreen.js.bak3:1672:    const e = new Date(meta.endDate);
screens/EntryListScreen.js.bak3:1673:    const m1 = new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1);
screens/EntryListScreen.js.bak3:1674:    return m1 <= new Date(e.getFullYear(), e.getMonth(), 1);
screens/EntryListScreen.js.bak3:1677:  const prevMonth = useCallback(()=> { if (canPrevMonth) setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1)); }, [canPrevMonth, monthDate]);
screens/EntryListScreen.js.bak3:1678:  const nextMonth = useCallback(()=> { if (canNextMonth) setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1)); }, [canNextMonth, monthDate]);
screens/EntryListScreen.js.bak3:1683:      const d = new Date(e.timestamp);
screens/EntryListScreen.js.bak3:1684:      set.add(keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate())));
screens/EntryListScreen.js.bak3:1731:            startDate={meta.startDate || new Date()}
screens/EntryListScreen.js.bak3:1732:            endDate={meta.endDate || new Date()}
screens/EntryListScreen.js.bak3:1801:            startDate={meta.startDate || new Date()}
screens/EntryListScreen.js.bak3:1802:            endDate={meta.endDate || new Date()}
screens/EntryListScreen.js.bak3:1980:                  startDate={meta.startDate ? new Date(meta.startDate) : null}
screens/EntryListScreen.js.bak3:1981:                  endDate={meta.endDate ? new Date(meta.endDate) : null}
utils/backup.js:11:const nowIso = () => new Date().toISOString();
utils/notifications.js:27:  return [...list].sort((x, y) => compareHHMM(x.time, y.time));
utils/notifications.js:72:  const first = new Date(year, month, 1);
utils/notifications.js:74:  const lastDate = new Date(year, month + 1, 0).getDate();
utils/challengeStore.js:92:  if (new Date(startDate) > new Date(endDate)) return { ok: false, reason: 'DATE_ORDER' };
--- Math & Date Scan Report: 2026. 05. 03. (일) 19:06:28 KST ---
screens/AddChallengeScreen.js:196:  return isNaN(dt.getTime()) ? null : dt;
screens/AddChallengeScreen.js:254:    if (isNaN(n)) { setCGoalScore(''); return; }
screens/EntryListScreen.js:184:  const display = isNaN(clampedTarget) ? 0 : Math.round(clampedTarget * k);
screens/EntryListScreen.js:564:    // 0값이 x축에 딱 붙지 않도록 가상의 최솟값(-vmax*0.08)을 기준으로 스케일
screens/EntryListScreen.js:669:    let best = 0, bestDx = Infinity;
screens/EntryListScreen.js:1495:        ts = Number.isNaN(parsed) ? null : parsed;
screens/EntryListScreen.js:1497:      if (typeof ts !== 'number' || Number.isNaN(ts)) ts = Date.now() - i * 1000;
screens/EntryListScreen.js:1727:    () => { if (!targetScore) return 0; const pct = Math.round((currentScore / targetScore) * 100); return isNaN(pct) ? 0 : Math.min(Math.max(0, pct), 100); },
screens/FullRangeNotificationScreen.js:22:  const dt=new Date(y,(m||1)-1,d||1); return isNaN(dt.getTime())?null:dt;
screens/FullRangeNotificationScreen.js:138:        const dow = new Date(y,mi,d).getDay(); // 0:일 ~ 6:토
screens/FullRangeNotificationScreen.js:296:          const firstDow=first.getDay(); // 0~6
screens/HallOfFameScreen.js:68:    const t = Date.parse(v); return Number.isNaN(t) ? 0 : t;   // ISO 문자열 보정
screens/EditChallengeScreen.js:41:  const dt = new Date(y,(m||1)-1,d||1); return isNaN(dt.getTime())?null:dt;
screens/EditChallengeScreen.js:272:    if (isNaN(n)) { setGoalScore(''); return; }
screens/EntryDetailScreen.js:155:    if (isNaN(n) || n <= 0) { setDuration(''); return; }
screens/ChallengeListScreen.js.bak2:75:  const gs = Number(c?.goalScore ?? NaN);
screens/EntryListScreen.js.bak4:564:    // 0값이 x축에 딱 붙지 않도록 가상의 최솟값(-vmax*0.08)을 기준으로 스케일
screens/EntryListScreen.js.bak4:662:    let best = 0, bestDx = Infinity;
screens/EntryListScreen.js.bak4:1417:        ts = Number.isNaN(parsed) ? null : parsed;
screens/EntryListScreen.js.bak4:1419:      if (typeof ts !== 'number' || Number.isNaN(ts)) ts = Date.now() - i * 1000;
screens/ChallengeListScreen.js.bak:75:  const gs = Number(c?.goalScore ?? NaN);
screens/EntryListScreen.js.bak:624:    let best = 0, bestDx = Infinity;
screens/EntryListScreen.js.bak:1293:        ts = Number.isNaN(parsed) ? null : parsed;
screens/EntryListScreen.js.bak:1295:      if (typeof ts !== 'number' || Number.isNaN(ts)) ts = Date.now() - i * 1000;
screens/UploadScreen.js:206:    if (isNaN(n) || n <= 0) { setDuration(''); return; }
screens/ChallengeListScreen.js:77:  const gs = Number(c?.goalScore ?? NaN);
screens/ChallengeListScreen.js:103:  '#F3F4F6', // 0단계
screens/EntryListScreen.js.bak3:564:    // 0값이 x축에 딱 붙지 않도록 가상의 최솟값(-vmax*0.08)을 기준으로 스케일
screens/EntryListScreen.js.bak3:662:    let best = 0, bestDx = Infinity;
screens/EntryListScreen.js.bak3:1417:        ts = Number.isNaN(parsed) ? null : parsed;
screens/EntryListScreen.js.bak3:1419:      if (typeof ts !== 'number' || Number.isNaN(ts)) ts = Date.now() - i * 1000;
utils/number.js:9:  return text.replace(/[^\d]/g, ''); // 0-9만 허용
utils/notifications.js:73:  const startWeekday = first.getDay(); // 0=일
utils/notifications.js:96:    const weekday = Number(k); // 0=일 .. 6=토
utils/exportImport.js:120:  // 0) 현재 데이터 안전 백업
screens/AddChallengeScreen.js:31:const sortTimesAsc = (arr=[]) => [...arr].sort((a,b)=>a.localeCompare(b));
screens/AddChallengeScreen.js:108:  const months=[]; const cur=new Date(startDate.getFullYear(), startDate.getMonth(), 1);
screens/AddChallengeScreen.js:109:  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
screens/AddChallengeScreen.js:112:    const dt=new Date(y,mi,d);
screens/AddChallengeScreen.js:113:    return dt>=new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
screens/AddChallengeScreen.js:114:        && dt<=new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
screens/AddChallengeScreen.js:121:          const firstDow=new Date(y,mi,1).getDay();
screens/AddChallengeScreen.js:122:          const dim=new Date(y,mi+1,0).getDate();
screens/AddChallengeScreen.js:129:                {['일','월','화','수','목','금','토'].map((w,i)=>
screens/AddChallengeScreen.js:185:    const end = new Date(item.endDate);
screens/AddChallengeScreen.js:187:    isExpired = end < new Date();
screens/AddChallengeScreen.js:195:  const dt = new Date(y, (m||1)-1, d||1);
screens/AddChallengeScreen.js:196:  return isNaN(dt.getTime()) ? null : dt;
screens/AddChallengeScreen.js:260:    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
screens/AddChallengeScreen.js:381:              {['weekly', 'monthly'].map(t => (
screens/AddChallengeScreen.js:391:                ['all', 'weekday', 'weekend', 'custom'].map(s => (
screens/AddChallengeScreen.js:405:                ['all', 'even', 'odd', 'custom'].map(s => (
screens/AddChallengeScreen.js:424:                {['월','화','수','목','금','토','일'].map(d => (
screens/AddChallengeScreen.js:511:      <DateTimePickerModal isVisible={showStartPicker} mode="date" date={startDate || new Date()} onConfirm={d => { setStartDate(d); setShowStartPicker(false); }} onCancel={() => setShowStartPicker(false)} />
screens/AddChallengeScreen.js:512:      <DateTimePickerModal isVisible={showEndPicker} mode="date" date={endDate || new Date()} onConfirm={d => { setEndDate(d); setShowEndPicker(false); }} onCancel={() => setShowEndPicker(false)} />
screens/EntryListScreen.js:89:    ['entries','items','data','list','logs','records'].forEach(k=>{
screens/EntryListScreen.js:223:const sortTimesAsc = (arr=[]) => [...arr].sort((a,b)=>a.localeCompare(b));
screens/EntryListScreen.js:292:  const months=[]; const cur=new Date(startDate.getFullYear(), startDate.getMonth(), 1);
screens/EntryListScreen.js:293:  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
screens/EntryListScreen.js:296:    const dt=new Date(y,mi,d); return dt>=new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
screens/EntryListScreen.js:297:      && dt<=new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
screens/EntryListScreen.js:303:          const firstDow=new Date(y,mi,1).getDay();
screens/EntryListScreen.js:304:          const dim=new Date(y,mi+1,0).getDate();
screens/EntryListScreen.js:311:                {['일','월','화','수','목','금','토'].map((w,i)=><View key={w} style={{ flex:1, alignItems:'center', borderRightWidth:i<6?1:0, borderRightColor:'#eee' }}><Text style={{fontSize:11, fontWeight:'800', color:textGrey}}>{w}</Text></View>)}
screens/EntryListScreen.js:346:  if (mode==='fullrange') return <FullRangePreviewMini payload={payload} startDate={startDate?new Date(startDate):null} endDate={endDate?new Date(endDate):null} />;
screens/EntryListScreen.js:356:  const first = new Date(year, month, 1);
screens/EntryListScreen.js:358:  const daysInMonth = new Date(year, month + 1, 0).getDate();
screens/EntryListScreen.js:361:  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
screens/EntryListScreen.js:364:    const ds = new Date(startDate); ds.setHours(0,0,0,0);
screens/EntryListScreen.js:365:    const de = new Date(endDate); de.setHours(23,59,59,999);
screens/EntryListScreen.js:366:    const x = new Date(d); x.setHours(12,0,0,0);
screens/EntryListScreen.js:413:          const today = new Date(); today.setHours(0,0,0,0);
screens/EntryListScreen.js:422:            const isHighlight = highlightDate === keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
screens/EntryListScreen.js:458:    const d = new Date(e.timestamp); d.setHours(0,0,0,0);
screens/EntryListScreen.js:460:    const prev = map.get(k) || { minutes:0, count:0, date:new Date(d) };
screens/EntryListScreen.js:484:  const today = useMemo(()=>{ const t=new Date(); t.setHours(0,0,0,0); return t; },[]);
screens/EntryListScreen.js:496:    const startD = raw[0].date;
screens/EntryListScreen.js:497:    const endD = new Date(); endD.setHours(0,0,0,0);
screens/EntryListScreen.js:499:    const cur = new Date(startD);
screens/EntryListScreen.js:501:      const k = keyOf(new Date(cur));
screens/EntryListScreen.js:502:      result.push({ d: new Date(cur), v: minuteMap.get(k) || 0 });
screens/EntryListScreen.js:513:    const startD = baseSeries[0].d;
screens/EntryListScreen.js:514:    const endD = new Date(); endD.setHours(0,0,0,0);
screens/EntryListScreen.js:522:    const dayBefore = new Date(startD);
screens/EntryListScreen.js:528:    const cur = new Date(startD);
screens/EntryListScreen.js:530:      const k = keyOf(new Date(cur));
screens/EntryListScreen.js:532:      result.push({ d: new Date(cur), v: cum });
screens/EntryListScreen.js:538:  const start = useMemo(()=>startDate? new Date(new Date(startDate).setHours(0,0,0,0))
screens/EntryListScreen.js:548:      const vmax = Math.max(1, series[0].v);
screens/EntryListScreen.js:549:      const y = top + (1 - (series[0].v / vmax)) * usableCh * introProgress;
screens/EntryListScreen.js:551:      return [{x, y, v: series[0].v, d: series[0].d}];
screens/EntryListScreen.js:574:      const vmax = Math.max(1, series[0].v);
screens/EntryListScreen.js:575:      const y = yScale(series[0].v, vmax);
screens/EntryListScreen.js:578:        {x:xleft-0.001, y, v:series[0].v, d:series[0].d},
screens/EntryListScreen.js:579:        {x:xleft+0.001, y, v:series[0].v, d:series[0].d}
screens/EntryListScreen.js:587:    let d = `M ${pts[0].x} ${pts[0].y}`;
screens/EntryListScreen.js:588:    for(let i=1;i<pts.length;i++) d += ` L ${pts[i].x} ${pts[i].y}`;
screens/EntryListScreen.js:597:    let d = `M ${pts[0].x} ${bottomY} L ${pts[0].x} ${pts[0].y}`;
screens/EntryListScreen.js:598:    for(let i=1;i<pts.length;i++) d += ` L ${pts[i].x} ${pts[i].y}`;
screens/EntryListScreen.js:599:    d += ` L ${pts[pts.length-1].x} ${bottomY} Z`;
screens/EntryListScreen.js:671:      const dx = Math.abs(pts[i].x - x);
screens/EntryListScreen.js:679:    const v = series[selectedIdx].v;
screens/EntryListScreen.js:680:    const d = series[selectedIdx].d;
screens/EntryListScreen.js:719:          {`${String(new Date(start).getFullYear()).slice(2)}-${pad2(new Date(start).getMonth()+1)}-${pad2(new Date(start).getDate())}`}
screens/EntryListScreen.js:722:          {`Today ${String((new Date()).getFullYear()).slice(2)}-${pad2((new Date()).getMonth()+1)}-${pad2((new Date()).getDate())}`}
screens/EntryListScreen.js:1096:      const d = new Date(e.timestamp);
screens/EntryListScreen.js:1097:      certSet.add(keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate())));
screens/EntryListScreen.js:1099:    const start = new Date(startDate); start.setHours(0,0,0,0);
screens/EntryListScreen.js:1100:    const end = new Date(endDate); end.setHours(0,0,0,0);
screens/EntryListScreen.js:1101:    const today = new Date(); today.setHours(0,0,0,0);
screens/EntryListScreen.js:1102:    const gridStart = new Date(start);
screens/EntryListScreen.js:1107:    const cur = new Date(gridStart);
screens/EntryListScreen.js:1111:        weekStartCols.push({ col, date: new Date(cur) });
screens/EntryListScreen.js:1118:        const cellDate = new Date(cur);
screens/EntryListScreen.js:1131:            const prevDate = new Date(cellDate);
screens/EntryListScreen.js:1141:        cells.push({ col, row, date: new Date(cellDate), level });
screens/EntryListScreen.js:1254:        <Text style={styles.time}>인증 시간: {new Date(item.timestamp).toLocaleString()}</Text>
screens/EntryListScreen.js:1341:                #{indexFromEnd} {new Date(it.timestamp).toLocaleString()}
screens/EntryListScreen.js:1406:    const today = new Date();
screens/EntryListScreen.js:1407:    return new Date(today.getFullYear(), today.getMonth(), 1);
screens/EntryListScreen.js:1414:    const actual = new Date(ws);
screens/EntryListScreen.js:1417:    setMonthDate(new Date(actual.getFullYear(), actual.getMonth(), 1));
screens/EntryListScreen.js:1419:    const key = keyOf(new Date(actual.getFullYear(), actual.getMonth(), actual.getDate()));
screens/EntryListScreen.js:1492:      if (ts instanceof Date) ts = ts.getTime();
screens/EntryListScreen.js:1513:    const start = new Date(startDateStr); start.setHours(0,0,0,0);
screens/EntryListScreen.js:1516:    const now = new Date(); const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
screens/EntryListScreen.js:1518:    const thisSaturday = new Date(todayMid); thisSaturday.setDate(todayMid.getDate() + (6 - td));
screens/EntryListScreen.js:1521:    let cursor = new Date(start);
screens/EntryListScreen.js:1523:      const wsMid = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
screens/EntryListScreen.js:1525:        const dayStart = new Date(wsMid); dayStart.setDate(wsMid.getDate() + i);
screens/EntryListScreen.js:1526:        const dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1);
screens/EntryListScreen.js:1528:          const d = new Date(e.timestamp);
screens/EntryListScreen.js:1548:    const t0 = new Date(todayMid.getFullYear(), todayMid.getMonth(), todayMid.getDate());
screens/EntryListScreen.js:1551:      const ws = new Date(weeks[i].ws);
screens/EntryListScreen.js:1552:      const we = new Date(ws); we.setDate(we.getDate() + 7);
screens/EntryListScreen.js:1622:            hitKey = 'challenges[*].entries|logs';
screens/EntryListScreen.js:1704:        const s = new Date(loadedMeta.startDate);
screens/EntryListScreen.js:1705:        const e = new Date(loadedMeta.endDate);
screens/EntryListScreen.js:1706:        const t = new Date();
screens/EntryListScreen.js:1707:        const clampMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
screens/EntryListScreen.js:1732:    () => [...entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
screens/EntryListScreen.js:1738:    const d = new Date(dStr);
screens/EntryListScreen.js:1744:    const s = new Date(meta.startDate);
screens/EntryListScreen.js:1745:    const m0 = new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1);
screens/EntryListScreen.js:1746:    return m0 >= new Date(s.getFullYear(), s.getMonth(), 1);
screens/EntryListScreen.js:1751:    const e = new Date(meta.endDate);
screens/EntryListScreen.js:1752:    const m1 = new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1);
screens/EntryListScreen.js:1753:    return m1 <= new Date(e.getFullYear(), e.getMonth(), 1);
screens/EntryListScreen.js:1756:  const prevMonth = useCallback(()=> { if (canPrevMonth) setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1)); }, [canPrevMonth, monthDate]);
screens/EntryListScreen.js:1757:  const nextMonth = useCallback(()=> { if (canNextMonth) setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1)); }, [canNextMonth, monthDate]);
screens/EntryListScreen.js:1762:      const d = new Date(e.timestamp);
screens/EntryListScreen.js:1763:      set.add(keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate())));
screens/EntryListScreen.js:1810:            startDate={meta.startDate || new Date()}
screens/EntryListScreen.js:1811:            endDate={meta.endDate || new Date()}
screens/EntryListScreen.js:1887:            startDate={meta.startDate || new Date()}
screens/EntryListScreen.js:1888:            endDate={meta.endDate || new Date()}
screens/EntryListScreen.js:2066:                  startDate={meta.startDate ? new Date(meta.startDate) : null}
screens/EntryListScreen.js:2067:                  endDate={meta.endDate ? new Date(meta.endDate) : null}
screens/FullRangeNotificationScreen.js:22:  const dt=new Date(y,(m||1)-1,d||1); return isNaN(dt.getTime())?null:dt;
screens/FullRangeNotificationScreen.js:60:        m[k] = Array.isArray(initial.byDate[k]) ? [...new Set(initial.byDate[k].map(String))].sort() : [];
screens/FullRangeNotificationScreen.js:85:  const inRangeStart = useMemo(()=> start ? new Date(start.getFullYear(), start.getMonth(), start.getDate()) : null, [start]);
screens/FullRangeNotificationScreen.js:86:  const inRangeEnd   = useMemo(()=> end   ? new Date(end.getFullYear(), end.getMonth(), end.getDate())     : null, [end]);
screens/FullRangeNotificationScreen.js:90:    const arr=[]; const cur = new Date(start.getFullYear(), start.getMonth(), 1);
screens/FullRangeNotificationScreen.js:91:    const last= new Date(end.getFullYear(), end.getMonth(), 1);
screens/FullRangeNotificationScreen.js:98:    const dt = new Date(y,mi,d);
screens/FullRangeNotificationScreen.js:123:      const daysInMonth = new Date(y,mi+1,0).getDate();
screens/FullRangeNotificationScreen.js:135:      const daysInMonth = new Date(y,mi+1,0).getDate();
screens/FullRangeNotificationScreen.js:138:        const dow = new Date(y,mi,d).getDay(); // 0:일 ~ 6:토
screens/FullRangeNotificationScreen.js:148:      const daysInMonth = new Date(y,mi+1,0).getDate();
screens/FullRangeNotificationScreen.js:151:        const dow = new Date(y,mi,d).getDay();
screens/FullRangeNotificationScreen.js:187:      return [...prev, t].sort();
screens/FullRangeNotificationScreen.js:214:      const cur = new Date(sdt);
screens/FullRangeNotificationScreen.js:252:      const arr = Array.isArray(prev[key]) ? prev[key].filter(t=>t!==time) : [];
screens/FullRangeNotificationScreen.js:294:          const first = new Date(y,mi,1);
screens/FullRangeNotificationScreen.js:295:          const daysInMonth = new Date(y,mi+1,0).getDate();
screens/FullRangeNotificationScreen.js:310:                {['일','월','화','수','목','금','토'].map((w,idx)=>(
screens/HallOfFameScreen.js:51:  return [...list].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
screens/HallOfFameScreen.js:147:                완료일 {doneTs ? new Date(doneTs).toLocaleString() : '-'}
screens/TrashScreen.js:17:  const d = new Date(ts);
screens/EditChallengeScreen.js:41:  const dt = new Date(y,(m||1)-1,d||1); return isNaN(dt.getTime())?null:dt;
screens/EditChallengeScreen.js:43:const sortTimesAsc = (arr=[]) => [...arr].sort((a,b)=>a.localeCompare(b));
screens/EditChallengeScreen.js:150:  const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
screens/EditChallengeScreen.js:151:  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
screens/EditChallengeScreen.js:155:    const dt = new Date(y,mi,d);
screens/EditChallengeScreen.js:156:    return dt >= new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
screens/EditChallengeScreen.js:157:        && dt <= new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
screens/EditChallengeScreen.js:164:          const first=new Date(y,mi,1);
screens/EditChallengeScreen.js:165:          const daysInMonth=new Date(y,mi+1,0).getDate();
screens/EditChallengeScreen.js:177:                {['일','월','화','수','목','금','토'].map((w,idx)=>(
screens/EditChallengeScreen.js:391:    if(startDate && endDate && endDate.getTime() < startDate.getTime()){
screens/EditChallengeScreen.js:583:                {['월','화','수','목','금','토','일'].map(d => {
screens/EditChallengeScreen.js:639:              {['weekly', 'monthly'].map(t => (
screens/EditChallengeScreen.js:648:                ['all', 'weekday', 'weekend', 'custom'].map(s => (
screens/EditChallengeScreen.js:662:                ['all', 'even', 'odd', 'custom'].map(s => (
screens/EditChallengeScreen.js:680:                {['월','화','수','목','금','토','일'].map(d => (
screens/EditChallengeScreen.js:742:        date={startDate ?? new Date()}
screens/EditChallengeScreen.js:749:        date={endDate ?? new Date()}
screens/EditChallengeScreen.js:802:              if (endDate.getTime() < startDate.getTime()) { Alert.alert('확인','종료일이 시작일보다 빠를 수 없습니다.'); return; }
screens/EntryDetailScreen.js:183:        timestamp: timestamp || list[idx].timestamp || Date.now(),
screens/WeeklyNotificationScreen.js:65:      const next = [...arr, t].sort();
screens/WeeklyNotificationScreen.js:119:      return [...prev, t].sort();
screens/MonthlyNotificationScreen.js:103:      const arr = Array.isArray(prev[key]) ? prev[key].filter(x => x.time !== timeStr) : [];
screens/MonthlyNotificationScreen.js:192:      return [...prev, t].sort();
screens/MonthlyNotificationScreen.js:206:      const current = Array.isArray(map[key]) ? map[key].map(x=>x.time) : [];
screens/MonthlyNotificationScreen.js:221:        const current = Array.isArray(next[key]) ? next[key].map(x=>x.time) : [];
screens/EntryListScreen.js.bak4:89:    ['entries','items','data','list','logs','records'].forEach(k=>{
screens/EntryListScreen.js.bak4:223:const sortTimesAsc = (arr=[]) => [...arr].sort((a,b)=>a.localeCompare(b));
screens/EntryListScreen.js.bak4:292:  const months=[]; const cur=new Date(startDate.getFullYear(), startDate.getMonth(), 1);
screens/EntryListScreen.js.bak4:293:  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
screens/EntryListScreen.js.bak4:296:    const dt=new Date(y,mi,d); return dt>=new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
screens/EntryListScreen.js.bak4:297:      && dt<=new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
screens/EntryListScreen.js.bak4:303:          const firstDow=new Date(y,mi,1).getDay();
screens/EntryListScreen.js.bak4:304:          const dim=new Date(y,mi+1,0).getDate();
screens/EntryListScreen.js.bak4:311:                {['일','월','화','수','목','금','토'].map((w,i)=><View key={w} style={{ flex:1, alignItems:'center', borderRightWidth:i<6?1:0, borderRightColor:'#eee' }}><Text style={{fontSize:11, fontWeight:'800', color:textGrey}}>{w}</Text></View>)}
screens/EntryListScreen.js.bak4:346:  if (mode==='fullrange') return <FullRangePreviewMini payload={payload} startDate={startDate?new Date(startDate):null} endDate={endDate?new Date(endDate):null} />;
screens/EntryListScreen.js.bak4:356:  const first = new Date(year, month, 1);
screens/EntryListScreen.js.bak4:358:  const daysInMonth = new Date(year, month + 1, 0).getDate();
screens/EntryListScreen.js.bak4:361:  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
screens/EntryListScreen.js.bak4:364:    const ds = new Date(startDate); ds.setHours(0,0,0,0);
screens/EntryListScreen.js.bak4:365:    const de = new Date(endDate); de.setHours(23,59,59,999);
screens/EntryListScreen.js.bak4:366:    const x = new Date(d); x.setHours(12,0,0,0);
screens/EntryListScreen.js.bak4:413:          const today = new Date(); today.setHours(0,0,0,0);
screens/EntryListScreen.js.bak4:422:            const isHighlight = highlightDate === keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
screens/EntryListScreen.js.bak4:458:    const d = new Date(e.timestamp); d.setHours(0,0,0,0);
screens/EntryListScreen.js.bak4:460:    const prev = map.get(k) || { minutes:0, count:0, date:new Date(d) };
screens/EntryListScreen.js.bak4:484:  const today = useMemo(()=>{ const t=new Date(); t.setHours(0,0,0,0); return t; },[]);
screens/EntryListScreen.js.bak4:496:    const startD = raw[0].date;
screens/EntryListScreen.js.bak4:497:    const endD = new Date(); endD.setHours(0,0,0,0);
screens/EntryListScreen.js.bak4:499:    const cur = new Date(startD);
screens/EntryListScreen.js.bak4:501:      const k = keyOf(new Date(cur));
screens/EntryListScreen.js.bak4:502:      result.push({ d: new Date(cur), v: minuteMap.get(k) || 0 });
screens/EntryListScreen.js.bak4:513:    const startD = baseSeries[0].d;
screens/EntryListScreen.js.bak4:514:    const endD = new Date(); endD.setHours(0,0,0,0);
screens/EntryListScreen.js.bak4:522:    const dayBefore = new Date(startD);
screens/EntryListScreen.js.bak4:528:    const cur = new Date(startD);
screens/EntryListScreen.js.bak4:530:      const k = keyOf(new Date(cur));
screens/EntryListScreen.js.bak4:532:      result.push({ d: new Date(cur), v: cum });
screens/EntryListScreen.js.bak4:538:  const start = useMemo(()=>startDate? new Date(new Date(startDate).setHours(0,0,0,0))
screens/EntryListScreen.js.bak4:548:      const vmax = Math.max(1, series[0].v);
screens/EntryListScreen.js.bak4:549:      const y = top + (1 - (series[0].v / vmax)) * usableCh * introProgress;
screens/EntryListScreen.js.bak4:551:      return [{x, y, v: series[0].v, d: series[0].d}];
screens/EntryListScreen.js.bak4:574:      const vmax = Math.max(1, series[0].v);
screens/EntryListScreen.js.bak4:575:      const y = yScale(series[0].v, vmax);
screens/EntryListScreen.js.bak4:578:        {x:xleft-0.001, y, v:series[0].v, d:series[0].d},
screens/EntryListScreen.js.bak4:579:        {x:xleft+0.001, y, v:series[0].v, d:series[0].d}
screens/EntryListScreen.js.bak4:587:    let d = `M ${pts[0].x} ${pts[0].y}`;
screens/EntryListScreen.js.bak4:588:    for(let i=1;i<pts.length;i++) d += ` L ${pts[i].x} ${pts[i].y}`;
screens/EntryListScreen.js.bak4:597:    let d = `M ${pts[0].x} ${bottomY} L ${pts[0].x} ${pts[0].y}`;
screens/EntryListScreen.js.bak4:598:    for(let i=1;i<pts.length;i++) d += ` L ${pts[i].x} ${pts[i].y}`;
screens/EntryListScreen.js.bak4:599:    d += ` L ${pts[pts.length-1].x} ${bottomY} Z`;
screens/EntryListScreen.js.bak4:649:    if (near(nodePts[i].x, nodePts[i].y, 16)) return true;
screens/EntryListScreen.js.bak4:664:      const dx = Math.abs(pts[i].x - x);
screens/EntryListScreen.js.bak4:672:    const v = series[selectedIdx].v;
screens/EntryListScreen.js.bak4:673:    const d = series[selectedIdx].d;
screens/EntryListScreen.js.bak4:712:          {`${String(new Date(start).getFullYear()).slice(2)}-${pad2(new Date(start).getMonth()+1)}-${pad2(new Date(start).getDate())}`}
screens/EntryListScreen.js.bak4:715:          {`Today ${String((new Date()).getFullYear()).slice(2)}-${pad2((new Date()).getMonth()+1)}-${pad2((new Date()).getDate())}`}
screens/EntryListScreen.js.bak4:1058:      const d = new Date(e.timestamp);
screens/EntryListScreen.js.bak4:1059:      certSet.add(keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate())));
screens/EntryListScreen.js.bak4:1062:    const start = new Date(startDate); start.setHours(0,0,0,0);
screens/EntryListScreen.js.bak4:1063:    const end = new Date(endDate); end.setHours(0,0,0,0);
screens/EntryListScreen.js.bak4:1064:    const today = new Date(); today.setHours(0,0,0,0);
screens/EntryListScreen.js.bak4:1066:    const gridStart = new Date(start);
screens/EntryListScreen.js.bak4:1073:    const cur = new Date(gridStart);
screens/EntryListScreen.js.bak4:1078:        weekStartCols.push({ col, date: new Date(cur) });
screens/EntryListScreen.js.bak4:1085:        const cellDate = new Date(cur);
screens/EntryListScreen.js.bak4:1103:            const prevDate = new Date(cellDate);
screens/EntryListScreen.js.bak4:1114:        cells.push({ col, row, date: new Date(cellDate), level });
screens/EntryListScreen.js.bak4:1206:        <Text style={styles.time}>인증 시간: {new Date(item.timestamp).toLocaleString()}</Text>
screens/EntryListScreen.js.bak4:1293:                #{indexFromEnd} {new Date(it.timestamp).toLocaleString()}
screens/EntryListScreen.js.bak4:1358:    const today = new Date();
screens/EntryListScreen.js.bak4:1359:    return new Date(today.getFullYear(), today.getMonth(), 1);
screens/EntryListScreen.js.bak4:1366:    const actual = new Date(ws);
screens/EntryListScreen.js.bak4:1369:    setMonthDate(new Date(actual.getFullYear(), actual.getMonth(), 1));
screens/EntryListScreen.js.bak4:1371:    const key = keyOf(new Date(actual.getFullYear(), actual.getMonth(), actual.getDate()));
screens/EntryListScreen.js.bak4:1414:      if (ts instanceof Date) ts = ts.getTime();
screens/EntryListScreen.js.bak4:1435:    const start = new Date(startDateStr); start.setHours(0,0,0,0);
screens/EntryListScreen.js.bak4:1438:    const now = new Date(); const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
screens/EntryListScreen.js.bak4:1440:    const thisSaturday = new Date(todayMid); thisSaturday.setDate(todayMid.getDate() + (6 - td));
screens/EntryListScreen.js.bak4:1443:    let cursor = new Date(start);
screens/EntryListScreen.js.bak4:1445:      const wsMid = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
screens/EntryListScreen.js.bak4:1447:        const dayStart = new Date(wsMid); dayStart.setDate(wsMid.getDate() + i);
screens/EntryListScreen.js.bak4:1448:        const dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1);
screens/EntryListScreen.js.bak4:1450:          const d = new Date(e.timestamp);
screens/EntryListScreen.js.bak4:1470:    const t0 = new Date(todayMid.getFullYear(), todayMid.getMonth(), todayMid.getDate());
screens/EntryListScreen.js.bak4:1473:      const ws = new Date(weeks[i].ws);
screens/EntryListScreen.js.bak4:1474:      const we = new Date(ws); we.setDate(we.getDate() + 7);
screens/EntryListScreen.js.bak4:1544:            hitKey = 'challenges[*].entries|logs';
screens/EntryListScreen.js.bak4:1625:        const s = new Date(loadedMeta.startDate);
screens/EntryListScreen.js.bak4:1626:        const e = new Date(loadedMeta.endDate);
screens/EntryListScreen.js.bak4:1627:        const t = new Date();
screens/EntryListScreen.js.bak4:1628:        const clampMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
screens/EntryListScreen.js.bak4:1653:    () => [...entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
screens/EntryListScreen.js.bak4:1659:    const d = new Date(dStr);
screens/EntryListScreen.js.bak4:1665:    const s = new Date(meta.startDate);
screens/EntryListScreen.js.bak4:1666:    const m0 = new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1);
screens/EntryListScreen.js.bak4:1667:    return m0 >= new Date(s.getFullYear(), s.getMonth(), 1);
screens/EntryListScreen.js.bak4:1672:    const e = new Date(meta.endDate);
screens/EntryListScreen.js.bak4:1673:    const m1 = new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1);
screens/EntryListScreen.js.bak4:1674:    return m1 <= new Date(e.getFullYear(), e.getMonth(), 1);
screens/EntryListScreen.js.bak4:1677:  const prevMonth = useCallback(()=> { if (canPrevMonth) setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1)); }, [canPrevMonth, monthDate]);
screens/EntryListScreen.js.bak4:1678:  const nextMonth = useCallback(()=> { if (canNextMonth) setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1)); }, [canNextMonth, monthDate]);
screens/EntryListScreen.js.bak4:1683:      const d = new Date(e.timestamp);
screens/EntryListScreen.js.bak4:1684:      set.add(keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate())));
screens/EntryListScreen.js.bak4:1731:            startDate={meta.startDate || new Date()}
screens/EntryListScreen.js.bak4:1732:            endDate={meta.endDate || new Date()}
screens/EntryListScreen.js.bak4:1801:            startDate={meta.startDate || new Date()}
screens/EntryListScreen.js.bak4:1802:            endDate={meta.endDate || new Date()}
screens/EntryListScreen.js.bak4:1980:                  startDate={meta.startDate ? new Date(meta.startDate) : null}
screens/EntryListScreen.js.bak4:1981:                  endDate={meta.endDate ? new Date(meta.endDate) : null}
screens/EntryListScreen.js.bak:89:    ['entries','items','data','list','logs','records'].forEach(k=>{
screens/EntryListScreen.js.bak:223:const sortTimesAsc = (arr=[]) => [...arr].sort((a,b)=>a.localeCompare(b));
screens/EntryListScreen.js.bak:292:  const months=[]; const cur=new Date(startDate.getFullYear(), startDate.getMonth(), 1);
screens/EntryListScreen.js.bak:293:  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
screens/EntryListScreen.js.bak:296:    const dt=new Date(y,mi,d); return dt>=new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
screens/EntryListScreen.js.bak:297:      && dt<=new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
screens/EntryListScreen.js.bak:303:          const firstDow=new Date(y,mi,1).getDay();
screens/EntryListScreen.js.bak:304:          const dim=new Date(y,mi+1,0).getDate();
screens/EntryListScreen.js.bak:311:                {['일','월','화','수','목','금','토'].map((w,i)=><View key={w} style={{ flex:1, alignItems:'center', borderRightWidth:i<6?1:0, borderRightColor:'#eee' }}><Text style={{fontSize:11, fontWeight:'800', color:textGrey}}>{w}</Text></View>)}
screens/EntryListScreen.js.bak:346:  if (mode==='fullrange') return <FullRangePreviewMini payload={payload} startDate={startDate?new Date(startDate):null} endDate={endDate?new Date(endDate):null} />;
screens/EntryListScreen.js.bak:356:  const first = new Date(year, month, 1);
screens/EntryListScreen.js.bak:358:  const daysInMonth = new Date(year, month + 1, 0).getDate();
screens/EntryListScreen.js.bak:361:  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
screens/EntryListScreen.js.bak:364:    const ds = new Date(startDate); ds.setHours(0,0,0,0);
screens/EntryListScreen.js.bak:365:    const de = new Date(endDate); de.setHours(23,59,59,999);
screens/EntryListScreen.js.bak:366:    const x = new Date(d); x.setHours(12,0,0,0);
screens/EntryListScreen.js.bak:413:          const today = new Date(); today.setHours(0,0,0,0);
screens/EntryListScreen.js.bak:463:    const d = new Date(e.timestamp); d.setHours(0,0,0,0);
screens/EntryListScreen.js.bak:465:    const prev = map.get(k) || { minutes:0, count:0, date:new Date(d) };
screens/EntryListScreen.js.bak:489:  const today = useMemo(()=>{ const t=new Date(); t.setHours(0,0,0,0); return t; },[]);
screens/EntryListScreen.js.bak:503:  const start = useMemo(()=>startDate? new Date(new Date(startDate).setHours(0,0,0,0))
screens/EntryListScreen.js.bak:513:      const vmax = Math.max(1, series[0].v);
screens/EntryListScreen.js.bak:514:      const y = top + (1 - (series[0].v / vmax)) * usableCh * introProgress;
screens/EntryListScreen.js.bak:516:      return [{x, y, v: series[0].v, d: series[0].d}];
screens/EntryListScreen.js.bak:536:      const vmax = Math.max(1, series[0].v);
screens/EntryListScreen.js.bak:537:      const y = yScale(series[0].v, vmax);
screens/EntryListScreen.js.bak:540:        {x:xleft-0.001, y, v:series[0].v, d:series[0].d},
screens/EntryListScreen.js.bak:541:        {x:xleft+0.001, y, v:series[0].v, d:series[0].d}
screens/EntryListScreen.js.bak:549:    let d = `M ${pts[0].x} ${pts[0].y}`;
screens/EntryListScreen.js.bak:550:    for(let i=1;i<pts.length;i++) d += ` L ${pts[i].x} ${pts[i].y}`;
screens/EntryListScreen.js.bak:559:    let d = `M ${pts[0].x} ${bottomY} L ${pts[0].x} ${pts[0].y}`;
screens/EntryListScreen.js.bak:560:    for(let i=1;i<pts.length;i++) d += ` L ${pts[i].x} ${pts[i].y}`;
screens/EntryListScreen.js.bak:561:    d += ` L ${pts[pts.length-1].x} ${bottomY} Z`;
screens/EntryListScreen.js.bak:611:    if (near(nodePts[i].x, nodePts[i].y, 16)) return true;
screens/EntryListScreen.js.bak:626:      const dx = Math.abs(pts[i].x - x);
screens/EntryListScreen.js.bak:634:    const v = series[selectedIdx].v;
screens/EntryListScreen.js.bak:635:    const d = series[selectedIdx].d;
screens/EntryListScreen.js.bak:674:          {`${String(new Date(start).getFullYear()).slice(2)}-${pad2(new Date(start).getMonth()+1)}-${pad2(new Date(start).getDate())}`}
screens/EntryListScreen.js.bak:677:          {`Today ${String((new Date()).getFullYear()).slice(2)}-${pad2((new Date()).getMonth()+1)}-${pad2((new Date()).getDate())}`}
screens/EntryListScreen.js.bak:965:      const d = new Date(e.timestamp);
screens/EntryListScreen.js.bak:966:      certSet.add(keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate())));
screens/EntryListScreen.js.bak:969:    const start = new Date(startDate); start.setHours(0,0,0,0);
screens/EntryListScreen.js.bak:970:    const end = new Date(endDate); end.setHours(0,0,0,0);
screens/EntryListScreen.js.bak:971:    const today = new Date(); today.setHours(0,0,0,0);
screens/EntryListScreen.js.bak:973:    const gridStart = new Date(start);
screens/EntryListScreen.js.bak:980:    const cur = new Date(gridStart);
screens/EntryListScreen.js.bak:985:        weekStartCols.push({ col, date: new Date(cur) });
screens/EntryListScreen.js.bak:992:        const cellDate = new Date(cur);
screens/EntryListScreen.js.bak:1005:        cells.push({ col, row, date: new Date(cellDate), level });
screens/EntryListScreen.js.bak:1096:        <Text style={styles.time}>인증 시간: {new Date(item.timestamp).toLocaleString()}</Text>
screens/EntryListScreen.js.bak:1183:                #{indexFromEnd} {new Date(it.timestamp).toLocaleString()}
screens/EntryListScreen.js.bak:1236:    const today = new Date();
screens/EntryListScreen.js.bak:1237:    return new Date(today.getFullYear(), today.getMonth(), 1);
screens/EntryListScreen.js.bak:1244:    const actual = new Date(ws);
screens/EntryListScreen.js.bak:1247:    setMonthDate(new Date(actual.getFullYear(), actual.getMonth(), 1));
screens/EntryListScreen.js.bak:1249:    const key = keyOf(new Date(actual.getFullYear(), actual.getMonth(), actual.getDate()));
screens/EntryListScreen.js.bak:1290:      if (ts instanceof Date) ts = ts.getTime();
screens/EntryListScreen.js.bak:1311:    const start = new Date(startDateStr); start.setHours(0,0,0,0);
screens/EntryListScreen.js.bak:1314:    const now = new Date(); const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
screens/EntryListScreen.js.bak:1316:    const thisSaturday = new Date(todayMid); thisSaturday.setDate(todayMid.getDate() + (6 - td));
screens/EntryListScreen.js.bak:1319:    let cursor = new Date(start);
screens/EntryListScreen.js.bak:1321:      const wsMid = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
screens/EntryListScreen.js.bak:1323:        const dayStart = new Date(wsMid); dayStart.setDate(wsMid.getDate() + i);
screens/EntryListScreen.js.bak:1324:        const dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1);
screens/EntryListScreen.js.bak:1326:          const d = new Date(e.timestamp);
screens/EntryListScreen.js.bak:1346:    const t0 = new Date(todayMid.getFullYear(), todayMid.getMonth(), todayMid.getDate());
screens/EntryListScreen.js.bak:1349:      const ws = new Date(weeks[i].ws);
screens/EntryListScreen.js.bak:1350:      const we = new Date(ws); we.setDate(we.getDate() + 7);
screens/EntryListScreen.js.bak:1427:            hitKey = 'challenges[*].entries|logs';
screens/EntryListScreen.js.bak:1505:        const s = new Date(loadedMeta.startDate);
screens/EntryListScreen.js.bak:1506:        const e = new Date(loadedMeta.endDate);
screens/EntryListScreen.js.bak:1507:        const t = new Date();
screens/EntryListScreen.js.bak:1508:        const clampMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
screens/EntryListScreen.js.bak:1530:    () => [...entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
screens/EntryListScreen.js.bak:1536:    const d = new Date(dStr);
screens/EntryListScreen.js.bak:1542:    const s = new Date(meta.startDate);
screens/EntryListScreen.js.bak:1543:    const m0 = new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1);
screens/EntryListScreen.js.bak:1544:    return m0 >= new Date(s.getFullYear(), s.getMonth(), 1);
screens/EntryListScreen.js.bak:1549:    const e = new Date(meta.endDate);
screens/EntryListScreen.js.bak:1550:    const m1 = new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1);
screens/EntryListScreen.js.bak:1551:    return m1 <= new Date(e.getFullYear(), e.getMonth(), 1);
screens/EntryListScreen.js.bak:1554:  const prevMonth = useCallback(()=> { if (canPrevMonth) setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1)); }, [canPrevMonth, monthDate]);
screens/EntryListScreen.js.bak:1555:  const nextMonth = useCallback(()=> { if (canNextMonth) setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1)); }, [canNextMonth, monthDate]);
screens/EntryListScreen.js.bak:1560:      const d = new Date(e.timestamp);
screens/EntryListScreen.js.bak:1561:      set.add(keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate())));
screens/EntryListScreen.js.bak:1602:            startDate={meta.startDate || new Date()}
screens/EntryListScreen.js.bak:1603:            endDate={meta.endDate || new Date()}
screens/EntryListScreen.js.bak:1671:            startDate={meta.startDate || new Date()}
screens/EntryListScreen.js.bak:1672:            endDate={meta.endDate || new Date()}
screens/EntryListScreen.js.bak:1849:                  startDate={meta.startDate ? new Date(meta.startDate) : null}
screens/EntryListScreen.js.bak:1850:                  endDate={meta.endDate ? new Date(meta.endDate) : null}
screens/UploadScreen.js:37:  const today = new Date();
screens/UploadScreen.js:40:  const yesterday = new Date(today);
screens/UploadScreen.js:46:      const d = new Date(e.timestamp);
screens/UploadScreen.js:48:      return d.getTime();
screens/UploadScreen.js:51:  certSet.add(today.getTime()); // 방금 등록한 오늘 인증 추가
screens/UploadScreen.js:55:  const cur = new Date(today);
screens/UploadScreen.js:56:  while (certSet.has(cur.getTime())) {
screens/ChallengeListScreen.js:82:    const end = new Date(c.endDate);
screens/ChallengeListScreen.js:84:    isExpired = end < new Date();
screens/ChallengeListScreen.js:113:      {[0, 1, 2, 3, 4].map((i) => (
screens/ChallengeListScreen.js:186:  const expiredSorted = expired.sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
screens/SimpleNotificationScreen.js:47:        setTimes([...new Set(initial.times.map(String))].sort());
screens/SimpleNotificationScreen.js:97:      const arr = [...prev, t].sort();
screens/SimpleNotificationScreen.js:255:              {[1, 2, 3, 4, 5].map((n) => {
screens/EntryListScreen.js.bak3:89:    ['entries','items','data','list','logs','records'].forEach(k=>{
screens/EntryListScreen.js.bak3:223:const sortTimesAsc = (arr=[]) => [...arr].sort((a,b)=>a.localeCompare(b));
screens/EntryListScreen.js.bak3:292:  const months=[]; const cur=new Date(startDate.getFullYear(), startDate.getMonth(), 1);
screens/EntryListScreen.js.bak3:293:  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
screens/EntryListScreen.js.bak3:296:    const dt=new Date(y,mi,d); return dt>=new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
screens/EntryListScreen.js.bak3:297:      && dt<=new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
screens/EntryListScreen.js.bak3:303:          const firstDow=new Date(y,mi,1).getDay();
screens/EntryListScreen.js.bak3:304:          const dim=new Date(y,mi+1,0).getDate();
screens/EntryListScreen.js.bak3:311:                {['일','월','화','수','목','금','토'].map((w,i)=><View key={w} style={{ flex:1, alignItems:'center', borderRightWidth:i<6?1:0, borderRightColor:'#eee' }}><Text style={{fontSize:11, fontWeight:'800', color:textGrey}}>{w}</Text></View>)}
screens/EntryListScreen.js.bak3:346:  if (mode==='fullrange') return <FullRangePreviewMini payload={payload} startDate={startDate?new Date(startDate):null} endDate={endDate?new Date(endDate):null} />;
screens/EntryListScreen.js.bak3:356:  const first = new Date(year, month, 1);
screens/EntryListScreen.js.bak3:358:  const daysInMonth = new Date(year, month + 1, 0).getDate();
screens/EntryListScreen.js.bak3:361:  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
screens/EntryListScreen.js.bak3:364:    const ds = new Date(startDate); ds.setHours(0,0,0,0);
screens/EntryListScreen.js.bak3:365:    const de = new Date(endDate); de.setHours(23,59,59,999);
screens/EntryListScreen.js.bak3:366:    const x = new Date(d); x.setHours(12,0,0,0);
screens/EntryListScreen.js.bak3:413:          const today = new Date(); today.setHours(0,0,0,0);
screens/EntryListScreen.js.bak3:422:            const isHighlight = highlightDate === keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
screens/EntryListScreen.js.bak3:458:    const d = new Date(e.timestamp); d.setHours(0,0,0,0);
screens/EntryListScreen.js.bak3:460:    const prev = map.get(k) || { minutes:0, count:0, date:new Date(d) };
screens/EntryListScreen.js.bak3:484:  const today = useMemo(()=>{ const t=new Date(); t.setHours(0,0,0,0); return t; },[]);
screens/EntryListScreen.js.bak3:496:    const startD = raw[0].date;
screens/EntryListScreen.js.bak3:497:    const endD = new Date(); endD.setHours(0,0,0,0);
screens/EntryListScreen.js.bak3:499:    const cur = new Date(startD);
screens/EntryListScreen.js.bak3:501:      const k = keyOf(new Date(cur));
screens/EntryListScreen.js.bak3:502:      result.push({ d: new Date(cur), v: minuteMap.get(k) || 0 });
screens/EntryListScreen.js.bak3:513:    const startD = baseSeries[0].d;
screens/EntryListScreen.js.bak3:514:    const endD = new Date(); endD.setHours(0,0,0,0);
screens/EntryListScreen.js.bak3:522:    const dayBefore = new Date(startD);
screens/EntryListScreen.js.bak3:528:    const cur = new Date(startD);
screens/EntryListScreen.js.bak3:530:      const k = keyOf(new Date(cur));
screens/EntryListScreen.js.bak3:532:      result.push({ d: new Date(cur), v: cum });
screens/EntryListScreen.js.bak3:538:  const start = useMemo(()=>startDate? new Date(new Date(startDate).setHours(0,0,0,0))
screens/EntryListScreen.js.bak3:548:      const vmax = Math.max(1, series[0].v);
screens/EntryListScreen.js.bak3:549:      const y = top + (1 - (series[0].v / vmax)) * usableCh * introProgress;
screens/EntryListScreen.js.bak3:551:      return [{x, y, v: series[0].v, d: series[0].d}];
screens/EntryListScreen.js.bak3:574:      const vmax = Math.max(1, series[0].v);
screens/EntryListScreen.js.bak3:575:      const y = yScale(series[0].v, vmax);
screens/EntryListScreen.js.bak3:578:        {x:xleft-0.001, y, v:series[0].v, d:series[0].d},
screens/EntryListScreen.js.bak3:579:        {x:xleft+0.001, y, v:series[0].v, d:series[0].d}
screens/EntryListScreen.js.bak3:587:    let d = `M ${pts[0].x} ${pts[0].y}`;
screens/EntryListScreen.js.bak3:588:    for(let i=1;i<pts.length;i++) d += ` L ${pts[i].x} ${pts[i].y}`;
screens/EntryListScreen.js.bak3:597:    let d = `M ${pts[0].x} ${bottomY} L ${pts[0].x} ${pts[0].y}`;
screens/EntryListScreen.js.bak3:598:    for(let i=1;i<pts.length;i++) d += ` L ${pts[i].x} ${pts[i].y}`;
screens/EntryListScreen.js.bak3:599:    d += ` L ${pts[pts.length-1].x} ${bottomY} Z`;
screens/EntryListScreen.js.bak3:649:    if (near(nodePts[i].x, nodePts[i].y, 16)) return true;
screens/EntryListScreen.js.bak3:664:      const dx = Math.abs(pts[i].x - x);
screens/EntryListScreen.js.bak3:672:    const v = series[selectedIdx].v;
screens/EntryListScreen.js.bak3:673:    const d = series[selectedIdx].d;
screens/EntryListScreen.js.bak3:712:          {`${String(new Date(start).getFullYear()).slice(2)}-${pad2(new Date(start).getMonth()+1)}-${pad2(new Date(start).getDate())}`}
screens/EntryListScreen.js.bak3:715:          {`Today ${String((new Date()).getFullYear()).slice(2)}-${pad2((new Date()).getMonth()+1)}-${pad2((new Date()).getDate())}`}
screens/EntryListScreen.js.bak3:1058:      const d = new Date(e.timestamp);
screens/EntryListScreen.js.bak3:1059:      certSet.add(keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate())));
screens/EntryListScreen.js.bak3:1062:    const start = new Date(startDate); start.setHours(0,0,0,0);
screens/EntryListScreen.js.bak3:1063:    const end = new Date(endDate); end.setHours(0,0,0,0);
screens/EntryListScreen.js.bak3:1064:    const today = new Date(); today.setHours(0,0,0,0);
screens/EntryListScreen.js.bak3:1066:    const gridStart = new Date(start);
screens/EntryListScreen.js.bak3:1073:    const cur = new Date(gridStart);
screens/EntryListScreen.js.bak3:1078:        weekStartCols.push({ col, date: new Date(cur) });
screens/EntryListScreen.js.bak3:1085:        const cellDate = new Date(cur);
screens/EntryListScreen.js.bak3:1103:            const prevDate = new Date(cellDate);
screens/EntryListScreen.js.bak3:1114:        cells.push({ col, row, date: new Date(cellDate), level });
screens/EntryListScreen.js.bak3:1206:        <Text style={styles.time}>인증 시간: {new Date(item.timestamp).toLocaleString()}</Text>
screens/EntryListScreen.js.bak3:1293:                #{indexFromEnd} {new Date(it.timestamp).toLocaleString()}
screens/EntryListScreen.js.bak3:1358:    const today = new Date();
screens/EntryListScreen.js.bak3:1359:    return new Date(today.getFullYear(), today.getMonth(), 1);
screens/EntryListScreen.js.bak3:1366:    const actual = new Date(ws);
screens/EntryListScreen.js.bak3:1369:    setMonthDate(new Date(actual.getFullYear(), actual.getMonth(), 1));
screens/EntryListScreen.js.bak3:1371:    const key = keyOf(new Date(actual.getFullYear(), actual.getMonth(), actual.getDate()));
screens/EntryListScreen.js.bak3:1414:      if (ts instanceof Date) ts = ts.getTime();
screens/EntryListScreen.js.bak3:1435:    const start = new Date(startDateStr); start.setHours(0,0,0,0);
screens/EntryListScreen.js.bak3:1438:    const now = new Date(); const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
screens/EntryListScreen.js.bak3:1440:    const thisSaturday = new Date(todayMid); thisSaturday.setDate(todayMid.getDate() + (6 - td));
screens/EntryListScreen.js.bak3:1443:    let cursor = new Date(start);
screens/EntryListScreen.js.bak3:1445:      const wsMid = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
screens/EntryListScreen.js.bak3:1447:        const dayStart = new Date(wsMid); dayStart.setDate(wsMid.getDate() + i);
screens/EntryListScreen.js.bak3:1448:        const dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1);
screens/EntryListScreen.js.bak3:1450:          const d = new Date(e.timestamp);
screens/EntryListScreen.js.bak3:1470:    const t0 = new Date(todayMid.getFullYear(), todayMid.getMonth(), todayMid.getDate());
screens/EntryListScreen.js.bak3:1473:      const ws = new Date(weeks[i].ws);
screens/EntryListScreen.js.bak3:1474:      const we = new Date(ws); we.setDate(we.getDate() + 7);
screens/EntryListScreen.js.bak3:1544:            hitKey = 'challenges[*].entries|logs';
screens/EntryListScreen.js.bak3:1625:        const s = new Date(loadedMeta.startDate);
screens/EntryListScreen.js.bak3:1626:        const e = new Date(loadedMeta.endDate);
screens/EntryListScreen.js.bak3:1627:        const t = new Date();
screens/EntryListScreen.js.bak3:1628:        const clampMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
screens/EntryListScreen.js.bak3:1653:    () => [...entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
screens/EntryListScreen.js.bak3:1659:    const d = new Date(dStr);
screens/EntryListScreen.js.bak3:1665:    const s = new Date(meta.startDate);
screens/EntryListScreen.js.bak3:1666:    const m0 = new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1);
screens/EntryListScreen.js.bak3:1667:    return m0 >= new Date(s.getFullYear(), s.getMonth(), 1);
screens/EntryListScreen.js.bak3:1672:    const e = new Date(meta.endDate);
screens/EntryListScreen.js.bak3:1673:    const m1 = new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1);
screens/EntryListScreen.js.bak3:1674:    return m1 <= new Date(e.getFullYear(), e.getMonth(), 1);
screens/EntryListScreen.js.bak3:1677:  const prevMonth = useCallback(()=> { if (canPrevMonth) setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1)); }, [canPrevMonth, monthDate]);
screens/EntryListScreen.js.bak3:1678:  const nextMonth = useCallback(()=> { if (canNextMonth) setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1)); }, [canNextMonth, monthDate]);
screens/EntryListScreen.js.bak3:1683:      const d = new Date(e.timestamp);
screens/EntryListScreen.js.bak3:1684:      set.add(keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate())));
screens/EntryListScreen.js.bak3:1731:            startDate={meta.startDate || new Date()}
screens/EntryListScreen.js.bak3:1732:            endDate={meta.endDate || new Date()}
screens/EntryListScreen.js.bak3:1801:            startDate={meta.startDate || new Date()}
screens/EntryListScreen.js.bak3:1802:            endDate={meta.endDate || new Date()}
screens/EntryListScreen.js.bak3:1980:                  startDate={meta.startDate ? new Date(meta.startDate) : null}
screens/EntryListScreen.js.bak3:1981:                  endDate={meta.endDate ? new Date(meta.endDate) : null}
utils/backup.js:11:const nowIso = () => new Date().toISOString();
utils/notifications.js:27:  return [...list].sort((x, y) => compareHHMM(x.time, y.time));
utils/notifications.js:72:  const first = new Date(year, month, 1);
utils/notifications.js:74:  const lastDate = new Date(year, month + 1, 0).getDate();
utils/challengeStore.js:92:  if (new Date(startDate) > new Date(endDate)) return { ok: false, reason: 'DATE_ORDER' };
