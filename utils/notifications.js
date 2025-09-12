// utils/notifications.js
// 알림 데이터 포맷과 미리보기/정렬 유틸 모음
// - weekly: { [weekday:number]: Array<{id:string, time:"HH:MM"}> }
// - monthly: { [dateString:"1".."31"]: Array<{id:string, time:"HH:MM"}> }

export function toHHMM(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const hh = h < 10 ? `0${h}` : String(h);
  const mm = m < 10 ? `0${m}` : String(m);
  return `${hh}:${mm}`;
}

export function parseHHMM(hhmm) {
  const [hh, mm] = hhmm.split(':').map((v) => parseInt(v, 10));
  return { hour: hh, minute: mm };
}

export function compareHHMM(a, b) {
  const pa = parseHHMM(a);
  const pb = parseHHMM(b);
  if (pa.hour !== pb.hour) return pa.hour - pb.hour;
  return pa.minute - pb.minute;
}

export function sortTimesAsc(list) {
  return [...list].sort((x, y) => compareHHMM(x.time, y.time));
}

export function ensureWeeklyWithinLimit(list) {
  return (list?.length ?? 0) < 5;
}

export function ensureDailyWithinLimit(list) {
  return (list?.length ?? 0) < 5;
}

// 주간 미리보기 텍스트 (예: 월 08:30, 21:00 / 수 07:00 ...)
const DAY_LABEL = { 0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토' };

export function weeklyPreviewText(weekly) {
  const parts = [];
  Object.keys(weekly)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((k) => {
      const arr = weekly[k];
      if (!arr || arr.length === 0) return;
      const times = sortTimesAsc(arr).map((t) => t.time).join(', ');
      parts.push(`${DAY_LABEL[k]} ${times}`);
    });
  return parts.join(' / ');
}

// 월간 미리보기 텍스트 (예: 1일 08:00 / 10일 07:30, 21:00 ...)
export function monthlyPreviewText(monthly) {
  const parts = [];
  Object.keys(monthly)
    .map((n) => Number(n))
    .sort((a, b) => a - b)
    .forEach((n) => {
      const key = String(n);
      const arr = monthly[key];
      if (!arr || arr.length === 0) return;
      const times = sortTimesAsc(arr).map((t) => t.time).join(', ');
      parts.push(`${n}일 ${times}`);
    });
  return parts.join(' / ');
}

// 현재 달의 달력 매트릭스 생성 (6주 * 7일; 빈칸은 null)
export function getMonthMatrix(year, month /* 0-index */) {
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay(); // 0=일
  const lastDate = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= lastDate; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  // 최대 6주 표시를 위해 42칸 맞추기
  while (cells.length < 42) cells.push(null);
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/**
 * 실제 expo-notifications 스케줄 변환(예시)
 * - 주간: 요일 반복
 * - 월간: 날짜 반복
 * 이 함수들은 등록 단계에서 활용하세요. (여기서는 데이터 포맷만 보장)
 */
export function toExpoWeeklyTriggers(weekly) {
  // return Array<{ content, trigger }>
  const out = [];
  Object.keys(weekly).forEach((k) => {
    const weekday = Number(k); // 0=일 .. 6=토
    weekly[k]?.forEach((item) => {
      const { hour, minute } = parseHHMM(item.time);
      out.push({
        trigger: { weekday, hour, minute, repeats: true },
      });
    });
  });
  return out;
}

export function toExpoMonthlyTriggers(monthly) {
  const out = [];
  Object.keys(monthly).forEach((dateStr) => {
    const day = Number(dateStr);
    monthly[dateStr]?.forEach((item) => {
      const { hour, minute } = parseHHMM(item.time);
      // Expo에는 정확한 "매달 N일" 트리거가 없어서, 실행 시 다음 실행일 계산 or cron-like 대안 필요
      // 여기서는 데이터 포맷만 넘기고, 실제 스케줄 계산은 registerNotifications에서 처리하세요.
      out.push({
        day,
        hour,
        minute,
        repeats: 'monthly',
      });
    });
  });
  return out;
}
