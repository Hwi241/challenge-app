import { grantEntryCreationStars } from '../utils/starEarning';
import { spendStars } from '../utils/starWallet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';

const PALETTE = {
  white: "#FFFFFF",
  black: "#000000",
  gray50: "#FAFAFA",
  gray100: "#F3F4F6",
  gray200: "#E5E7EB",
  gray300: "#D1D5DB",
  gray400: "#9CA3AF",
  gray600: "#525252",
  gray700: "#374151",
  gray800: "#111111"
};

const pad2 = (value) => String(value).padStart(2, '0');

const toLocalDateOnly = (value = new Date()) => {
 const d = value instanceof Date ? new Date(value) : new Date(value);
 if (Number.isNaN(d.getTime())) {
 const today = new Date();
 today.setHours(0, 0, 0, 0);
 return today;
 }
 d.setHours(0, 0, 0, 0);
 return d;
};

const getLocalDateKey = (value = new Date()) => {
 const d = toLocalDateOnly(value);
 return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const formatKoreanDate = (value = new Date()) => {
 const d = toLocalDateOnly(value);
 return `${d.getFullYear()}년 ${pad2(d.getMonth() + 1)}월 ${pad2(d.getDate())}일`;
};

const parseDateValue = (value) => {
 if (!value) return null;
 const d = new Date(value);
 if (Number.isNaN(d.getTime())) return null;
 return toLocalDateOnly(d);
};

const clampLocalDate = (value, minDate, maxDate) => {
 const d = toLocalDateOnly(value);
 const min = toLocalDateOnly(minDate || d);
 const max = toLocalDateOnly(maxDate || d);
 if (d.getTime() < min.getTime()) return min;
 if (d.getTime() > max.getTime()) return max;
 return d;
};

const toEntryTimestamp = (value) => {
 const d = toLocalDateOnly(value);
 d.setHours(12, 0, 0, 0);
 return d.getTime();
};

// screens/UploadScreen.js
// - 제목 중앙, "내용"+“사진 선택” 한 줄, "텍스트" 라벨 제거
// - 인증내용 500자 제한(표시 X), 입력에 따라 자동 높이 확장
// - 소요시간 숫자만, 최대 1440분(표시 X), 입력/저장 시 클램프
// - 사진 미리보기 우상단에 반투명 회색 원형 X 버튼으로 삭제
// - 🔧 폴리싱: 중복 탭 방지(busy), try/finally로 상태 복구

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, Image, StyleSheet, TouchableOpacity, Alert, ScrollView, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';

import { buttonStyles, spacing, radius } from '../styles/common';
import { numericInputProps, toNumberOrZero } from '../utils/number';
import BackButton from '../components/BackButton';
import { syncWidgetChallengeList } from '../utils/widgetSync';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';
import { getAppSettings } from '../utils/appSettings';
import { createCalendarRecordEvent } from '../utils/calendarRecord';

/* 습관 연속 인증 레벨 계산 */
function calcStreakLevel(entries) {
  if (!entries || entries.length === 0) return 1; // 이번이 첫 인증이므로 1단계

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // 날짜별 인증 여부 Set (오늘 날짜 포함하여 계산)
  const certSet = new Set(
    entries.map(e => {
      const d = new Date(e.timestamp);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );
  certSet.add(today.getTime()); // 방금 등록한 오늘 인증 추가

  // 오늘부터 역방향으로 연속일 계산
  let streak = 0;
  const cur = new Date(today);
  while (certSet.has(cur.getTime())) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }

  // 5단계 매핑 (0~4)
  if (streak <= 1) return 1;
  if (streak === 2) return 2;
  if (streak >= 3) return 3;
  return 1;
}

const HEALTH_CONNECT_PROVIDER = 'healthConnect';
const isHealthConnectLinked = (hc = {}) => (
  hc?.status === 'connected' ||
  hc?.enabled === true ||
  Object.values(hc?.permissions || {}).some(Boolean)
);

const HEALTH_SOURCE_APP_LABELS = {
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.google.android.apps.healthdata': 'Health Connect',
};

const EXERCISE_TYPE_LABELS = {
  8: '자전거',
  16: '근력 운동',
  25: '달리기',
  26: '러닝머신',
  57: '걷기',
  58: '걷기',
};

function getHealthConnectModule() {
  try { return require('react-native-health-connect'); } catch (e) { return null; }
}

function getHealthDateRange(dateKey) {
  const safeDateKey = /^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || '')) ? String(dateKey) : getLocalDateKey(new Date());
  const start = new Date(safeDateKey + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return { dateKey: safeDateKey, startTime: start.toISOString(), endTime: end.toISOString() };
}

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeRecordsResult(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.records)) return result.records;
  if (result && Array.isArray(result.data)) return result.data;
  return [];
}

function getNestedValue(obj, path) {
  for (const key of String(path).split('.')) {
    if (obj == null || typeof obj !== 'object' || !(key in obj)) return undefined;
    obj = obj[key];
  }
  return obj;
}

function getSourcePackageName(record) {
  const raw = getNestedValue(record, 'metadata.dataOrigin.packageName') ||
              getNestedValue(record, 'metadata.dataOrigin') ||
              getNestedValue(record, 'dataOrigin.packageName') ||
              getNestedValue(record, 'dataOrigin');
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw.packageName === 'string') return raw.packageName;
  return null;
}

function getSourceAppLabel(record) {
  const pkg = getSourcePackageName(record);
  return pkg ? (HEALTH_SOURCE_APP_LABELS[pkg] || pkg) : 'Health Connect';
}

function getLengthKm(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value / 1000;
  const inKm = getNestedValue(value, 'inKilometers');
  if (inKm != null) return toFiniteNumber(inKm);
  const inM = getNestedValue(value, 'inMeters');
  if (inM != null) return toFiniteNumber(inM) / 1000;
  const unit = String(value.unit || '').toLowerCase();
  const v = toFiniteNumber(value.value);
  if (unit === 'km' || unit === 'kilometers') return v;
  if (unit === 'm' || unit === 'meters') return v / 1000;
  return v;
}

function getDurationMinutes(record) {
  const secs = getNestedValue(record, 'duration.inSeconds') || getNestedValue(record, 'duration.seconds');
  if (secs != null) return toFiniteNumber(secs) / 60;
  const mins = getNestedValue(record, 'duration.inMinutes') || getNestedValue(record, 'duration.minutes');
  if (mins != null) return toFiniteNumber(mins);
  const start = record?.startTime ? new Date(record.startTime) : null;
  const end = record?.endTime ? new Date(record.endTime) : null;
  if (start && end && !isNaN(start) && !isNaN(end)) {
    return Math.max(0, (end - start) / 60000);
  }
  return 0;
}

function getExerciseLabel(record, index = 0) {
  const title = typeof record?.title === 'string' ? record.title.trim() : '';
  if (title) return title;
  const type = record?.exerciseType;
  if (type != null && EXERCISE_TYPE_LABELS[type]) return EXERCISE_TYPE_LABELS[type];
  if (type != null) return '운동 ' + type;
  return '운동 세션 ' + (index + 1);
}

async function safeReadRecords(healthConnect, recordType, options) {
  if (!healthConnect || typeof healthConnect.readRecords !== 'function') return [];
  try {
    const result = await healthConnect.readRecords(recordType, options);
    return normalizeRecordsResult(result);
  } catch (e) { return []; }
}

async function safeAggregate(healthConnect, request) {
  if (!healthConnect || typeof healthConnect.aggregateRecord !== 'function') return null;
  try { return await healthConnect.aggregateRecord(request); } catch (e) { return null; }
}

async function buildStepsRecord(healthConnect, range) {
  let steps = 0;
  let rawRecord = null;
  const agg = await safeAggregate(healthConnect, {
    recordType: 'Steps',
    timeRangeFilter: { operator: 'between', startTime: range.startTime, endTime: range.endTime },
  });
  steps = toFiniteNumber(getNestedValue(agg, 'COUNT_TOTAL'));
  if (!steps) {
    const records = await safeReadRecords(healthConnect, 'Steps', {
      timeRangeFilter: { operator: 'between', startTime: range.startTime, endTime: range.endTime },
    });
    rawRecord = records[0] || null;
    steps = records.reduce((s, r) => s + toFiniteNumber(r.count), 0);
  }
  const rounded = Math.max(0, Math.round(steps));
  if (rounded <= 0) return null;
  return {
    id: range.dateKey + '-steps',
    metricType: 'steps', label: '걸음 수', value: rounded, unit: 'steps',
    displayText: '걸음 수 ' + rounded.toLocaleString('ko-KR') + '보',
    sourceProvider: 'healthConnect', sourceApp: getSourceAppLabel(rawRecord),
    dataOrigin: getSourcePackageName(rawRecord), verified: true, dateKey: range.dateKey,
    startTime: range.startTime, endTime: range.endTime,
  };
}

async function buildDistanceRecord(healthConnect, range) {
  let km = 0;
  let rawRecord = null;
  const agg = await safeAggregate(healthConnect, {
    recordType: 'Distance',
    timeRangeFilter: { operator: 'between', startTime: range.startTime, endTime: range.endTime },
  });
  km = getLengthKm(getNestedValue(agg, 'DISTANCE'));
  if (!km) {
    const records = await safeReadRecords(healthConnect, 'Distance', {
      timeRangeFilter: { operator: 'between', startTime: range.startTime, endTime: range.endTime },
    });
    rawRecord = records[0] || null;
    km = records.reduce((s, r) => s + getLengthKm(r.distance), 0);
  }
  const rounded = Number(km.toFixed(2));
  if (rounded <= 0) return null;
  return {
    id: range.dateKey + '-distance',
    metricType: 'distance', label: '운동 거리', value: rounded, unit: 'km',
    distanceValue: rounded, distanceUnit: 'km',
    displayText: '운동 거리 ' + (rounded >= 10 ? rounded.toFixed(0) : rounded.toFixed(1)) + 'km',
    sourceProvider: 'healthConnect', sourceApp: getSourceAppLabel(rawRecord),
    dataOrigin: getSourcePackageName(rawRecord), verified: true, dateKey: range.dateKey,
    startTime: range.startTime, endTime: range.endTime,
  };
}

async function buildExerciseRecords(healthConnect, range) {
  const records = await safeReadRecords(healthConnect, 'ExerciseSession', {
    timeRangeFilter: { operator: 'between', startTime: range.startTime, endTime: range.endTime },
  });
  return records.map((rec, i) => {
    const minutes = Math.round(getDurationMinutes(rec));
    if (minutes <= 0) return null;
    const label = getExerciseLabel(rec, i);
    return {
      id: range.dateKey + '-exercise-' + i,
      metricType: 'exercise', label: label, value: minutes, unit: 'minutes',
      displayText: label + ' ' + minutes + '분',
      sourceProvider: 'healthConnect', sourceApp: getSourceAppLabel(rec),
      dataOrigin: getSourcePackageName(rec),
      exerciseType: rec?.exerciseType ?? null, title: rec?.title ?? null,
      verified: true, dateKey: range.dateKey,
      startTime: rec?.startTime || range.startTime,
      endTime: rec?.endTime || range.endTime,
    };
  }).filter(Boolean);
}



function getEnergyKilocalories(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  const inKcal = getNestedValue(value, 'inKilocalories') || getNestedValue(value, 'kilocalories') || getNestedValue(value, 'kcal');
  if (inKcal != null) return toFiniteNumber(inKcal);
  const inCal = getNestedValue(value, 'inCalories') || getNestedValue(value, 'calories') || getNestedValue(value, 'cal');
  if (inCal != null) return toFiniteNumber(inCal) / 1000;
  const unit = String(value?.unit || '').toLowerCase();
  const raw = toFiniteNumber(value?.value, 0);
  if (unit === 'kilocalories' || unit === 'kilocalorie' || unit === 'kcal') return raw;
  if (unit === 'calories' || unit === 'calorie' || unit === 'cal') return raw / 1000;
  return raw;
}

function getMassKilograms(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  const inKg = getNestedValue(value, 'inKilograms') || getNestedValue(value, 'kilograms') || getNestedValue(value, 'kg');
  if (inKg != null) return toFiniteNumber(inKg);
  const inG = getNestedValue(value, 'inGrams') || getNestedValue(value, 'grams') || getNestedValue(value, 'g');
  if (inG != null) return toFiniteNumber(inG) / 1000;
  const unit = String(value?.unit || '').toLowerCase();
  const raw = toFiniteNumber(value?.value, 0);
  if (unit === 'kilograms' || unit === 'kilogram' || unit === 'kg') return raw;
  if (unit === 'grams' || unit === 'gram' || unit === 'g') return raw / 1000;
  return raw;
}

function getLengthMeters(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  const inM = getNestedValue(value, 'inMeters') || getNestedValue(value, 'meters') || getNestedValue(value, 'm');
  if (inM != null) return toFiniteNumber(inM);
  const inCm = getNestedValue(value, 'inCentimeters') || getNestedValue(value, 'centimeters') || getNestedValue(value, 'cm');
  if (inCm != null) return toFiniteNumber(inCm) / 100;
  const unit = String(value?.unit || '').toLowerCase();
  const raw = toFiniteNumber(value?.value, 0);
  if (unit === 'meters' || unit === 'meter' || unit === 'm') return raw;
  if (unit === 'centimeters' || unit === 'centimeter' || unit === 'cm') return raw / 100;
  return raw;
}

function getPercentageValue(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  const pct = getNestedValue(value, 'percentage') || getNestedValue(value, 'value');
  return toFiniteNumber(pct, 0);
}

function getHeartRateBpm(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  const bpm = getNestedValue(value, 'inBeatsPerMinute') || getNestedValue(value, 'beatsPerMinute') || getNestedValue(value, 'bpm') || getNestedValue(value, 'value');
  return toFiniteNumber(bpm, 0);
}

function getSleepDurationHours(record) {
  const h = getNestedValue(record, 'duration.inHours') || getNestedValue(record, 'duration.hours');
  if (h != null) return toFiniteNumber(h);
  const m = getNestedValue(record, 'duration.inMinutes') || getNestedValue(record, 'duration.minutes');
  if (m != null) return toFiniteNumber(m) / 60;
  const s = getNestedValue(record, 'duration.inSeconds') || getNestedValue(record, 'duration.seconds');
  if (s != null) return toFiniteNumber(s) / 3600;
  const ms = getNestedValue(record, 'duration.inMilliseconds') || getNestedValue(record, 'duration.milliseconds');
  if (ms != null && typeof ms !== 'object') return toFiniteNumber(ms) / 3600000;
  const start = record?.startTime ? new Date(record.startTime) : null;
  const end = record?.endTime ? new Date(record.endTime) : null;
  if (start && end && !isNaN(start) && !isNaN(end)) return Math.max(0, (end - start) / 3600000);
  return 0;
}

function normalizeSleepStages(record) {
  const rawStages = Array.isArray(record?.stages) ? record.stages : Array.isArray(record?.stageRecords) ? record.stageRecords : [];
  return rawStages.map(function(stage, index) {
    var startTime = stage?.startTime || record?.startTime || null;
    var endTime = stage?.endTime || record?.endTime || null;
    var stageType = stage?.stage ?? stage?.stageType ?? stage?.type ?? stage?.name ?? index;
    var hours = getSleepDurationHours(stage);
    if (!hours && startTime && endTime) {
      var s = new Date(startTime), e = new Date(endTime);
      if (!isNaN(s) && !isNaN(e)) hours = Math.max(0, (e - s) / 3600000);
    }
    if (!hours || hours <= 0) return null;
    return { stageType: stageType, value: Number(hours.toFixed(2)), unit: 'hours', startTime: startTime, endTime: endTime };
  }).filter(Boolean);
}

async function buildCaloriesRecord(hc, range) {
  var calories = 0, rawRecord = null;
  try {
    var agg = await safeAggregate(hc, { recordType: 'ActiveCaloriesBurned', timeRangeFilter: { operator: 'between', startTime: range.startTime, endTime: range.endTime } });
    calories = getEnergyKilocalories(getNestedValue(agg, 'ACTIVE_CALORIES_TOTAL'));
  } catch (e) { console.warn('[HealthConnect] aggregate ActiveCaloriesBurned failed', e?.message || e); }
  if (!calories) {
    try {
      var records = await safeReadRecords(hc, 'ActiveCaloriesBurned', { timeRangeFilter: { operator: 'between', startTime: range.startTime, endTime: range.endTime } });
      rawRecord = records[0] || null;
      calories = records.reduce(function(s, r) { return s + getEnergyKilocalories(r?.energy); }, 0);
    } catch (e) { console.warn('[HealthConnect] read ActiveCaloriesBurned failed', e?.message || e); }
  }
  var rounded = Math.max(0, Math.round(calories));
  if (rounded <= 0) return null;
  return { id: range.dateKey + '-active-calories', metricType: 'calories', label: '운동 칼로리', value: rounded, unit: 'kcal', displayText: '운동 칼로리 ' + rounded.toLocaleString('ko-KR') + 'kcal', sourceProvider: HEALTH_CONNECT_PROVIDER, sourceApp: getSourceAppLabel(rawRecord), dataOrigin: getSourcePackageName(rawRecord), verified: true, dateKey: range.dateKey, startTime: range.startTime, endTime: range.endTime };
}

async function buildSleepRecords(hc, range) {
  var results = [];
  try {
    var records = await safeReadRecords(hc, 'SleepSession', { timeRangeFilter: { operator: 'between', startTime: range.startTime, endTime: range.endTime } });
    records.forEach(function(record, index) {
      var hours = Number(getSleepDurationHours(record).toFixed(2));
      if (hours <= 0) return;
      var sourceApp = getSourceAppLabel(record), dataOrigin = getSourcePackageName(record);
      var st = record?.startTime || range.startTime, et = record?.endTime || range.endTime;
      var stages = normalizeSleepStages(record);
      results.push({ id: range.dateKey + '-sleep-' + index, metricType: 'sleepHours', label: '수면 시간', value: hours, unit: 'hours', displayText: '수면 시간 ' + (hours >= 10 ? hours.toFixed(0) : hours.toFixed(1)) + '시간', sourceProvider: HEALTH_CONNECT_PROVIDER, sourceApp: sourceApp, dataOrigin: dataOrigin, verified: true, dateKey: range.dateKey, startTime: st, endTime: et });
      if (stages.length) {
        results.push({ id: range.dateKey + '-sleep-stage-' + index, metricType: 'sleepStage', label: '수면 리듬', value: hours, unit: 'hours', stages: stages, displayText: '수면 리듬 ' + stages.length + '구간', sourceProvider: HEALTH_CONNECT_PROVIDER, sourceApp: sourceApp, dataOrigin: dataOrigin, verified: true, dateKey: range.dateKey, startTime: st, endTime: et });
      }
    });
  } catch (e) { console.warn('[HealthConnect] read SleepSession failed', e?.message || e); }

  if (results.some(function(r) { return r.metricType === 'sleepHours'; })) return results;

  try {
    var agg = await safeAggregate(hc, { recordType: 'SleepSession', timeRangeFilter: { operator: 'between', startTime: range.startTime, endTime: range.endTime } });
    var dur = getNestedValue(agg, 'SLEEP_DURATION_TOTAL');
    var hours = Number(getSleepDurationHours({ duration: dur }).toFixed(2));
    if (hours > 0) results.push({ id: range.dateKey + '-sleep-total', metricType: 'sleepHours', label: '수면 시간', value: hours, unit: 'hours', displayText: '수면 시간 ' + (hours >= 10 ? hours.toFixed(0) : hours.toFixed(1)) + '시간', sourceProvider: HEALTH_CONNECT_PROVIDER, sourceApp: 'Health Connect', dataOrigin: null, verified: true, dateKey: range.dateKey, startTime: range.startTime, endTime: range.endTime });
  } catch (e) { console.warn('[HealthConnect] aggregate SleepSession failed', e?.message || e); }

  return results;
}

async function buildRestingHeartRateRecord(hc, range) {
  var bpm = 0, rawRecord = null;
  try {
    var agg = await safeAggregate(hc, { recordType: 'RestingHeartRate', timeRangeFilter: { operator: 'between', startTime: range.startTime, endTime: range.endTime } });
    bpm = getHeartRateBpm(getNestedValue(agg, 'BPM_AVG'));
  } catch (e) { console.warn('[HealthConnect] aggregate RestingHeartRate failed', e?.message || e); }
  if (!bpm) {
    try {
      var records = await safeReadRecords(hc, 'RestingHeartRate', { timeRangeFilter: { operator: 'between', startTime: range.startTime, endTime: range.endTime } });
      rawRecord = records[0] || null;
      var vals = records.map(function(r) { return getHeartRateBpm(r?.beatsPerMinute ?? r?.bpm ?? r?.value); }).filter(function(v) { return v > 0; });
      if (vals.length) bpm = vals.reduce(function(s, v) { return s + v; }, 0) / vals.length;
    } catch (e) { console.warn('[HealthConnect] read RestingHeartRate failed', e?.message || e); }
  }
  var rounded = Math.round(bpm);
  if (rounded <= 0) return null;
  return { id: range.dateKey + '-resting-heart-rate', metricType: 'heartRate', label: '평균 심박', value: rounded, unit: 'bpm', displayText: '평균 심박 ' + rounded + 'bpm', sourceProvider: HEALTH_CONNECT_PROVIDER, sourceApp: getSourceAppLabel(rawRecord), dataOrigin: getSourcePackageName(rawRecord), verified: true, dateKey: range.dateKey, startTime: range.startTime, endTime: range.endTime };
}

async function buildWeightRecord(hc, range) {
  var kg = 0, rawRecord = null;
  try {
    var agg = await safeAggregate(hc, { recordType: 'Weight', timeRangeFilter: { operator: 'between', startTime: range.startTime, endTime: range.endTime } });
    kg = getMassKilograms(getNestedValue(agg, 'WEIGHT_AVG'));
  } catch (e) { console.warn('[HealthConnect] aggregate Weight failed', e?.message || e); }
  if (!kg) {
    try {
      var records = await safeReadRecords(hc, 'Weight', { timeRangeFilter: { operator: 'between', startTime: range.startTime, endTime: range.endTime } });
      rawRecord = records[0] || null;
      var vals = records.map(function(r) { return getMassKilograms(r?.weight); }).filter(function(v) { return v > 0; });
      if (vals.length) kg = vals.reduce(function(s, v) { return s + v; }, 0) / vals.length;
    } catch (e) { console.warn('[HealthConnect] read Weight failed', e?.message || e); }
  }
  var rounded = Number(kg.toFixed(1));
  if (rounded <= 0) return null;
  return { id: range.dateKey + '-weight', metricType: 'weight', label: '체중', value: rounded, unit: 'kg', displayText: '체중 ' + rounded.toFixed(1) + 'kg', sourceProvider: HEALTH_CONNECT_PROVIDER, sourceApp: getSourceAppLabel(rawRecord), dataOrigin: getSourcePackageName(rawRecord), verified: true, dateKey: range.dateKey, startTime: range.startTime, endTime: range.endTime };
}

async function getHeightMeters(hc, range) {
  var meters = 0;
  try {
    var agg = await safeAggregate(hc, { recordType: 'Height', timeRangeFilter: { operator: 'between', startTime: range.startTime, endTime: range.endTime } });
    meters = getLengthMeters(getNestedValue(agg, 'HEIGHT_AVG'));
  } catch (e) { console.warn('[HealthConnect] aggregate Height failed', e?.message || e); }
  if (!meters) {
    try {
      var records = await safeReadRecords(hc, 'Height', { timeRangeFilter: { operator: 'between', startTime: range.startTime, endTime: range.endTime } });
      var vals = records.map(function(r) { return getLengthMeters(r?.height); }).filter(function(v) { return v > 0; });
      if (vals.length) meters = vals.reduce(function(s, v) { return s + v; }, 0) / vals.length;
    } catch (e) { console.warn('[HealthConnect] read Height failed', e?.message || e); }
  }
  return meters;
}

async function buildBodyFatRecord(hc, range) {
  try {
    var records = await safeReadRecords(hc, 'BodyFat', { timeRangeFilter: { operator: 'between', startTime: range.startTime, endTime: range.endTime } });
    var rawRecord = records[0] || null;
    var vals = records.map(function(r) { return getPercentageValue(r?.percentage ?? r?.bodyFatPercentage ?? r?.value); }).filter(function(v) { return v > 0; });
    if (!vals.length) return null;
    var avg = vals.reduce(function(s, v) { return s + v; }, 0) / vals.length;
    var rounded = Number(avg.toFixed(1));
    return { id: range.dateKey + '-body-fat', metricType: 'bodyFat', label: '체지방률', value: rounded, unit: '%', displayText: '체지방률 ' + rounded.toFixed(1) + '%', sourceProvider: HEALTH_CONNECT_PROVIDER, sourceApp: getSourceAppLabel(rawRecord), dataOrigin: getSourcePackageName(rawRecord), verified: true, dateKey: range.dateKey, startTime: range.startTime, endTime: range.endTime };
  } catch (e) { console.warn('[HealthConnect] read BodyFat failed', e?.message || e); return null; }
}

async function buildBmiRecord(hc, range, weightRecord) {
  var kg = Number(weightRecord?.value) || 0;
  if (kg <= 0) return null;
  var meters = await getHeightMeters(hc, range);
  if (meters <= 0) return null;
  var bmi = kg / (meters * meters);
  var rounded = Number(bmi.toFixed(1));
  if (rounded <= 0) return null;
  return { id: range.dateKey + '-bmi', metricType: 'bmi', label: 'BMI', value: rounded, unit: 'BMI', heightMeters: Number(meters.toFixed(2)), weightKg: kg, displayText: 'BMI ' + rounded.toFixed(1), sourceProvider: HEALTH_CONNECT_PROVIDER, sourceApp: weightRecord?.sourceApp || 'Health Connect', dataOrigin: weightRecord?.dataOrigin || null, verified: true, dateKey: range.dateKey, startTime: range.startTime, endTime: range.endTime };
}


async function loadHealthConnectRecordsForDate(dateKey, healthConnectSettings = {}) {
  if (!isHealthConnectLinked(healthConnectSettings)) {
    throw new Error('Health Connect 연결 권한이 필요합니다.');
  }
  const hc = getHealthConnectModule();
  if (!hc) throw new Error('이 빌드에서 Health Connect 모듈을 사용할 수 없습니다.');
  if (typeof hc.initialize === 'function') await hc.initialize();
  const range = getHealthDateRange(dateKey);
  const perms = healthConnectSettings?.permissions || {};
  const results = [];
  if (perms.steps !== false) {
    const sr = await buildStepsRecord(hc, range);
    if (sr) results.push(sr);
  }
  if (perms.exercise !== false) {
    const er = await buildExerciseRecords(hc, range);
    results.push(...er);
  }
  if (perms.activeCalories !== false) {
    const cr = await buildCaloriesRecord(hc, range);
    if (cr) results.push(cr);
  }
  if (perms.distance !== false) {
    const dr = await buildDistanceRecord(hc, range);
    if (dr) results.push(dr);
  }
  if (perms.sleep !== false) {
    const slr = await buildSleepRecords(hc, range);
    results.push(...slr);
  }
  if (perms.restingHeartRate !== false) {
    const hrr = await buildRestingHeartRateRecord(hc, range);
    if (hrr) results.push(hrr);
  }
  let wr = null;
  if (perms.weight !== false) {
    wr = await buildWeightRecord(hc, range);
    if (wr) results.push(wr);
  }
  if (perms.bodyFat !== false) {
    const bfr = await buildBodyFatRecord(hc, range);
    if (bfr) results.push(bfr);
  }
  if (perms.weight !== false && perms.height !== false && wr) {
    const bmi = await buildBmiRecord(hc, range, wr);
    if (bmi) results.push(bmi);
  }
  return results;
}

export default function UploadScreen() {
  const MAX_TEXT_LEN = 1000;
const MAX_MINUTES = 1440; // 24시간
  const navigation = useNavigation();
  const route = useRoute();
  const { challengeId } = route.params || {};

  const [text, setText] = useState('');
  const [textHeight, setTextHeight] = useState(140); // 자동 확장용 높이 상태
  const [duration, setDuration] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [busy, setBusy] = useState(false);
  const [challengeTitle, setChallengeTitle] = useState('');
  const [challengeInfo, setChallengeInfo] = useState(null);
  const [selectedEntryDate, setSelectedEntryDate] = useState(() => toLocalDateOnly(new Date()));
  const [dateEditEnabled, setDateEditEnabled] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [healthConnectSettings, setHealthConnectSettings] = useState(null);
  const [healthDataRecords, setHealthDataRecords] = useState([]);
  const [healthDataDateKey, setHealthDataDateKey] = useState(null);
  const [selectedHealthRecordIds, setSelectedHealthRecordIds] = useState([]);
  const submittedRef = useRef(false);
  const calendarRecordSavingRef = useRef(false);
  const formScrollRef = useRef(null);
  const entryTextInputRef = useRef(null);
  const durationInputRef = useRef(null);
  const focusedInputRef = useRef(null);
  const keyboardFrameRef = useRef(null);
  const keyboardVisibleRef = useRef(false);
  const scrollYRef = useRef(0);
  const [keyboardBottomInset, setKeyboardBottomInset] = useState(0);

  const measureAndScrollToInput = useCallback((inputRef, extraOffset = 48) => {
    const input = inputRef?.current;
    const keyboardFrame = keyboardFrameRef.current;

    if (!input?.measureInWindow || !keyboardFrame?.screenY) return;

    requestAnimationFrame(() => {
      input.measureInWindow((x, y, width, height) => {
        const inputBottom = y + height;
        const overlap = inputBottom + extraOffset - keyboardFrame.screenY;

        if (overlap <= 0) return;

        formScrollRef.current?.scrollTo({
          y: Math.max(0, scrollYRef.current + overlap),
          animated: false,
        });
      });
    });
  }, []);

  const scrollToFocusedInput = useCallback((inputRef, extraOffset = 48) => {
    focusedInputRef.current = inputRef;

    if (!keyboardVisibleRef.current) return;

    setTimeout(() => {
      measureAndScrollToInput(inputRef, extraOffset);
    }, 30);
  }, [measureAndScrollToInput]);

  useEffect(() => {
    const handleKeyboardFrame = (event) => {
      const nextFrame = event?.endCoordinates || null;
      keyboardFrameRef.current = nextFrame;
      keyboardVisibleRef.current = true;

      const nextKeyboardHeight = Math.max(0, Number(nextFrame?.height) || 0);
      setKeyboardBottomInset(nextKeyboardHeight);

      if (focusedInputRef.current) {
        setTimeout(() => {
          measureAndScrollToInput(focusedInputRef.current, 48);
        }, 30);
      }
    };

    const showSub = Keyboard.addListener('keyboardDidShow', handleKeyboardFrame);
    const changeSub = Keyboard.addListener('keyboardDidChangeFrame', handleKeyboardFrame);
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      keyboardFrameRef.current = null;
      keyboardVisibleRef.current = false;
      focusedInputRef.current = null;
      setKeyboardBottomInset(0);
    });

    return () => {
      showSub.remove();
      changeSub.remove();
      hideSub.remove();
    };
  }, [measureAndScrollToInput]);

  // 화면 포커스될 때마다 state 초기화
  useFocusEffect(
    useCallback(() => {
      setText('');
      setTextHeight(140);
      setDuration('');
      setImageUri(null);
      setBusy(false);
      setSelectedEntryDate(toLocalDateOnly(new Date()));
      setDateEditEnabled(false);
      setDatePickerVisible(false);
      setHealthDataRecords([]);
      setHealthDataDateKey(null);
      setSelectedHealthRecordIds([]);
      setChallengeInfo(null);
      submittedRef.current = false;
      calendarRecordSavingRef.current = false;

      if (challengeId) {
        AsyncStorage.getItem('challenges').then(raw => {
          const list = raw ? JSON.parse(raw) : [];
          const found = list.find(c => String(c.id) === String(challengeId));
          if (found) {
            setChallengeTitle(found.title || '');
            setChallengeInfo(found);
          }
        }).catch(() => {});
      }
      getAppSettings().then(function(s){setHealthConnectSettings(s?.dataIntegrations?.healthConnect||{});}).catch(function(){setHealthConnectSettings({});});
    }, [challengeId])
  );

  // 사진 선택 (카메라/앨범 선택지)
  const onPickImage = useCallback(async () => {
    if (busy) return;
    Alert.alert('사진 추가', '방법을 선택해주세요', [
      {
        text: '카메라',
        onPress: async () => {
          try {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (perm.status !== 'granted') {
              Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.');
              return;
            }
            const res = await ImagePicker.launchCameraAsync({
              allowsEditing: false,
              quality: 0.8,
              exif: false,
            });
            if (res.canceled) return;
            const asset = res.assets?.[0];
            if (asset?.uri) setImageUri(asset.uri);
          } catch (e) {
            Alert.alert('오류', '카메라 실행 중 문제가 발생했습니다.');
          }
        },
      },
      {
        text: '앨범',
        onPress: async () => {
          try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (perm.status !== 'granted') {
              Alert.alert('권한 필요', '사진 보관함 접근 권한이 필요합니다.');
              return;
            }
            const res = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: false,
              quality: 0.8,
              exif: false,
            });
            if (res.canceled) return;
            const asset = res.assets?.[0];
            if (asset?.uri) setImageUri(asset.uri);
          } catch (e) {
            Alert.alert('오류', '사진 선택 중 문제가 발생했습니다.');
          }
        },
      },
      { text: '취소', style: 'cancel' },
    ]);
  }, [busy]);

  // 사진 삭제
  const onRemoveImage = useCallback(() => {
    if (busy) return;
    setImageUri(null);
  }, [busy]);

  // 소요시간: 숫자만 + 1~1440 범위로 입력단계 클램프
  const handleDurationChange = useCallback((txt) => {
    const digits = (txt || '').replace(/[^\d]/g, '');
    if (!digits) { setDuration(''); return; }
    let n = parseInt(digits, 10);
    if (isNaN(n) || n <= 0) { setDuration(''); return; }
    if (n > MAX_MINUTES) n = MAX_MINUTES;
    setDuration(String(n));
  }, []);

  const todayDate = toLocalDateOnly(new Date());
  const challengeStartDate = parseDateValue(challengeInfo?.startDate);
  const minEntryDate =
    challengeStartDate && challengeStartDate.getTime() <= todayDate.getTime()
      ? challengeStartDate
      : todayDate;
  const maxEntryDate = todayDate;
  const safeSelectedEntryDate = clampLocalDate(selectedEntryDate, minEntryDate, maxEntryDate);
  const selectedEntryDateKey = getLocalDateKey(safeSelectedEntryDate);
  const todayEntryDateKey = getLocalDateKey(todayDate);
  const isPastEntryDate = selectedEntryDateKey !== todayEntryDateKey;
  const healthConnectLinked = isHealthConnectLinked(healthConnectSettings);
  const selectedHealthRecords = healthDataRecords.filter(function(r){return selectedHealthRecordIds.includes(r.id);});

  const hasUnsavedChanges = useCallback(() => (
    !!text.trim() ||
    !!imageUri ||
    !!duration ||
    selectedHealthRecords.length > 0 ||
    !!isPastEntryDate
  ), [text, imageUri, duration, selectedHealthRecords.length, isPastEntryDate]);

  const { handleBackPress, markAsSaved } = useUnsavedChangesGuard({
    navigation,
    hasUnsavedChanges,
    title: '작성 중인 내용이 있어요',
    message: '뒤로 가면 작성한 내용이 저장되지 않습니다.',
    stayText: '계속 작성',
    leaveText: '나가기',
  });
  const goToDataIntegrations = useCallback(function(){var m=function(){navigation.navigate('DataIntegrations');};if(hasUnsavedChanges()){Alert.alert('작성 중인 내용이 있어요','설정 화면으로 이동하면 입력 내용이 사라질 수 있습니다.',[{text:'취소',style:'cancel'},{text:'계속 이동',style:'destructive',onPress:m}]);return;}m();},[hasUnsavedChanges,navigation]);
  const loadHealthDataForSelectedDate = useCallback(async function(){
  if (busy) return;
  setBusy(true);
  try {
    const records = await loadHealthConnectRecordsForDate(selectedEntryDateKey, healthConnectSettings || {});
    setHealthDataRecords(records);
    setHealthDataDateKey(selectedEntryDateKey);
    setSelectedHealthRecordIds([]);
    if (!records.length) {
      Alert.alert('데이터 없음', '선택한 날짜에 Health Connect에서 불러올 수 있는 데이터가 없습니다.');
    }
  } catch (error) {
    console.warn('[HealthConnect] load failed', error?.message || error);
    setHealthDataRecords([]);
    setHealthDataDateKey(selectedEntryDateKey);
    setSelectedHealthRecordIds([]);
    Alert.alert('불러오기 실패', error?.message || 'Health Connect 데이터를 불러오지 못했습니다.');
  } finally {
    setBusy(false);
  }
}, [busy, selectedEntryDateKey, healthConnectSettings]);
  const toggleHealthRecordSelection = useCallback(function(id){setSelectedHealthRecordIds(function(p){return p.includes(id)?p.filter(function(x){return x!==id;}):p.concat([id]);});},[]);
  const confirmSelectedHealthData = useCallback(function(){if(selectedHealthRecordIds.length===0){Alert.alert('선택 필요','인증에 사용할 데이터를 선택해주세요.');return;}Alert.alert('선택 완료','선택한 데이터가 인증 근거로 저장됩니다.');},[selectedHealthRecordIds.length]);

  const openEntryDatePicker = useCallback(() => {
    if (busy) return;
    setDateEditEnabled(true);
    setDatePickerVisible(true);
  }, [busy]);

  const handleEntryDateChange = useCallback((event, pickedDate) => {
    setDatePickerVisible(false);
    if (event?.type === 'dismissed' || !pickedDate) return;
    const today = toLocalDateOnly(new Date());
    const start = parseDateValue(challengeInfo?.startDate);
    const minDate =
      start && start.getTime() <= today.getTime()
        ? start
        : today;
    const nextDate = clampLocalDate(pickedDate, minDate, today);
    setSelectedEntryDate(nextDate);
  }, [challengeInfo?.startDate]);

  const saveEntry = useCallback(async ({ isPastEntry = false } = {}) => {
    if (busy) return;
    setBusy(true);
    submittedRef.current = false;
    let starReward = null;

    try {
      if (!challengeId) {
        Alert.alert('오류', '도전 정보를 찾을 수 없습니다.');
        return;
      }

      const trimmed = (text || '').trim();

      if (!trimmed && !imageUri && selectedHealthRecords.length === 0) {
        Alert.alert('확인', '텍스트, 사진, 건강 데이터 중 하나는 입력/선택해주세요.');
        return;
      }

      const rawDur = toNumberOrZero(duration);
      const finalDur = duration ? Math.min(Math.max(rawDur, 1), MAX_MINUTES) : 0;
      const entryTimestamp = isPastEntry ? toEntryTimestamp(safeSelectedEntryDate) : Date.now();

      if (isPastEntry) {
        const spendResult = await spendStars(1, 'past_entry_date_override', {
          challengeId,
          date: selectedEntryDateKey,
        });

        if (!spendResult?.ok) {
          Alert.alert(
            '별이 부족합니다',
            `과거 기록을 등록하려면 1★가 필요합니다.\n현재 보유 별: ${spendResult?.balance ?? 0}★`
          );
          return;
        }
      }

      const entry = {
        id: `en_${Date.now()}`,
        text: trimmed,
        imageUri: imageUri || null,
        duration: finalDur,
        linkedRecords: selectedHealthRecords,
        timestamp: entryTimestamp,
        ...(isPastEntry && {
          isPastEntry: true,
          adjustedDateCost: 1,
          adjustedDateKey: selectedEntryDateKey,
        }),
      };

      const raw = await AsyncStorage.getItem(`entries_${challengeId}`);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(entry);
      await AsyncStorage.setItem(`entries_${challengeId}`, JSON.stringify(list));

      const challRaw = await AsyncStorage.getItem('challenges');
      const challenges = challRaw ? JSON.parse(challRaw) : [];
      const idx = challenges.findIndex((c) => c.id === challengeId);
      let nextTitle, nextStart, nextEnd, nextGoal, nextReward;

      if (idx >= 0) {
        const isHabit = challenges[idx]?.type === 'habit';
        const streakLevel = isHabit ? calcStreakLevel(list) : undefined;
        challenges[idx] = {
          ...challenges[idx],
          currentScore: list.length,
          ...(isHabit && { lastStreakLevel: streakLevel }),
        };
        await AsyncStorage.setItem('challenges', JSON.stringify(challenges));
        await AsyncStorage.setItem(`challenge_${challengeId}`, JSON.stringify(challenges[idx]));
        await syncWidgetChallengeList();
        nextTitle = challenges[idx]?.title;
        nextStart = challenges[idx]?.startDate;
        nextEnd = challenges[idx]?.endDate;
        nextGoal = challenges[idx]?.goalScore;
        nextReward = challenges[idx]?.reward;
      }

      if (!isPastEntry) {
        try {
          starReward = await grantEntryCreationStars({
            challengeId,
            entryId: entry.id,
            timestamp: entryTimestamp,
          });
        } catch (rewardError) {
          console.log('스타 보상 지급 실패:', rewardError?.message || rewardError);
        }
      }

      if (Math.random() < 0.3) {
        console.log('[AD_INTERSTITIAL_PLACEHOLDER] 전면광고 표시 위치');
      }

      const completeMessage = isPastEntry
        ? '과거 기록이 등록되었습니다.\n-1★ 사용\n과거 기록은 인증 보상이 지급되지 않습니다.'
        : starReward?.granted && starReward?.amount > 0
          ? `인증이 등록되었습니다.\n+${starReward?.amount}★ 획득`
          : '인증이 등록되었습니다.';

      const finishSavedEntryFlow = () => {
        submittedRef.current = true;
        markAsSaved();
        setText('');
        setImageUri(null);
        setDuration('');
        setHealthDataRecords([]);
        setHealthDataDateKey(null);
        setSelectedHealthRecordIds([]);
        setSelectedEntryDate(toLocalDateOnly(new Date()));
        setDateEditEnabled(false);
        setDatePickerVisible(false);
        navigation.replace('EntryList', {
          challengeId,
          title: nextTitle,
          startDate: nextStart,
          endDate: nextEnd,
          targetScore: nextGoal,
          reward: nextReward,
        });
      };

      const handleCalendarRecordPress = async () => {
        if (calendarRecordSavingRef.current) return;
        calendarRecordSavingRef.current = true;

        try {
          const latestSettings = await getAppSettings();
          const calendarRecord = latestSettings?.dataIntegrations?.calendarRecord || {};
          const result = await createCalendarRecordEvent({
            calendarRecord,
            challengeTitle: nextTitle?.challengeTitle || challengeInfo?.title || '도전',
            entry,
            entryDate: new Date(entryTimestamp),
            linkedRecords: selectedHealthRecords,
            draft: null,
          });

          if (result?.ok) {
            Alert.alert(
              '캘린더 기록 완료',
              '선택한 캘린더에 인증 기록을 추가했습니다.',
              [{ text: '확인', onPress: finishSavedEntryFlow }]
            );
            return;
          }

          Alert.alert(
            '캘린더 기록 실패',
            (result?.error || '캘린더 기록에 실패했습니다.') + '\n\n설정 > 데이터 출처 관리에서 캘린더 연결을 확인해주세요.',
            [{ text: '확인', onPress: finishSavedEntryFlow }]
          );
        } catch (calendarError) {
          Alert.alert(
            '캘린더 기록 실패',
            (calendarError?.message || '캘린더 기록에 실패했습니다.') + '\n\n설정 > 데이터 출처 관리에서 캘린더 연결을 확인해주세요.',
            [{ text: '확인', onPress: finishSavedEntryFlow }]
          );
        } finally {
          calendarRecordSavingRef.current = false;
        }
      };

      Alert.alert('완료', completeMessage, [
        {
          text: '확인',
          onPress: finishSavedEntryFlow,
        },
        {
          text: '캘린더에 기록',
          onPress: handleCalendarRecordPress,
        },
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '인증을 저장하지 못했습니다.');
    } finally {
      setBusy(false);
      submittedRef.current = false;
    }
  }, [
    busy,
    challengeId,
    text,
    imageUri,
    duration,
    selectedHealthRecords,
    safeSelectedEntryDate,
    selectedEntryDateKey,
    navigation,
    markAsSaved,
    challengeTitle,
    challengeInfo?.title,
  ]);

  const onSubmit = useCallback(() => {
    if (busy) return;

    const trimmed = (text || '').trim();

    if (!challengeId) {
      Alert.alert('오류', '도전 정보를 찾을 수 없습니다.');
      return;
    }

    if (!trimmed && !imageUri && selectedHealthRecords.length === 0) {
      Alert.alert('확인', '텍스트, 사진, 건강 데이터 중 하나는 입력/선택해주세요.');
      return;
    }

    if (isPastEntryDate) {
      Alert.alert(
        '과거 기록 등록',
        '선택한 날짜로 과거 기록을 등록합니다.\n과거 기록은 인증 보상 없이 1★가 차감됩니다.\n계속할까요?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '등록하기',
            style: 'destructive',
            onPress: () => saveEntry({ isPastEntry: true }),
          },
        ]
      );
      return;
    }

    Alert.alert(
      '저장하시겠습니까?',
      '이 인증을 저장할까요?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '저장',
          onPress: () => saveEntry({ isPastEntry: false }),
        },
      ]
    );
  }, [busy, challengeId, text, imageUri, selectedHealthRecords.length, isPastEntryDate, saveEntry]);



  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
      <BackButton title="인증/기록 하기" onPress={handleBackPress} />
      <ScrollView
        ref={formScrollRef}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(spacing.xl * 3, keyboardBottomInset + spacing.xl * 2) },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onScroll={(event) => {
          scrollYRef.current = event?.nativeEvent?.contentOffset?.y || 0;
        }}
        scrollEventThrottle={16}
      >
      {/* 제목 중앙 정렬 */}


      {!!challengeTitle && (
        <View style={styles.titleBox}>
          <Text style={styles.titleBoxText}>{challengeTitle}</Text>
        </View>
      )}

      <View style={styles.dateBox}>
        <View style={styles.dateTextGroup}>
          <Text style={styles.dateLabel}>기록 날짜</Text>
          <Text style={[
            styles.dateValue,
            dateEditEnabled && styles.dateValueActive,
          ]}>
            {formatKoreanDate(safeSelectedEntryDate)}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.dateCostButton,
            (busy || datePickerVisible) && styles.dateCostButtonDisabled,
          ]}
          onPress={openEntryDatePicker}
          activeOpacity={0.88}
          disabled={busy || datePickerVisible}
        >
          <Text style={styles.dateCostButtonText}>★-1</Text>
        </TouchableOpacity>
      </View>

      {datePickerVisible && (
        <DateTimePicker
          value={safeSelectedEntryDate}
          mode="date"
          display="default"
          minimumDate={minEntryDate}
          maximumDate={maxEntryDate}
          onChange={handleEntryDateChange}
        />
      )}
<View style={styles.card}>
        {/* "내용"과 "사진 넣기"를 가로 한 줄로 */}
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>내용</Text>
          <TouchableOpacity
            style={[buttonStyles.compactRight, { opacity: busy ? 0.6 : 1 }]}
            onPress={onPickImage}
            activeOpacity={0.9}
            disabled={busy}
          >
            <Text style={buttonStyles.compactRightText}>사진 넣기</Text>
          </TouchableOpacity>
        </View>

        {/* 미리보기 + 우상단 삭제 버튼 */}
        {!!imageUri && (
          <View style={styles.previewWrap}>
            <Image source={{ uri: imageUri }} style={styles.preview} />
            <TouchableOpacity
              accessibilityLabel="사진 삭제"
              onPress={onRemoveImage}
              activeOpacity={0.8}
              disabled={busy}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              style={styles.previewDeleteBtn}
            >
              <Text allowFontScaling={false} style={styles.previewDeleteX}>×</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* "텍스트" 라벨 제거, 인증내용 500자, 자동 높이 확장 */}
        <TextInput
          ref={entryTextInputRef}
          value={text}
          onChangeText={(t) => setText((t || '').slice(0, MAX_TEXT_LEN))}
          placeholder="인증 내용을 입력하세요"
          style={[styles.input, { height: textHeight, textAlignVertical: 'top', opacity: busy ? 0.75 : 1 }]}
          multiline
          editable={!busy}
          placeholderTextColor={PALETTE.gray400}
          maxLength={MAX_TEXT_LEN}
          onFocus={() => scrollToFocusedInput(entryTextInputRef, 48)}
          onContentSizeChange={e => {
            const h = e?.nativeEvent?.contentSize?.height || 0;
            const minH = 120; // 최소
            const maxH = 240; // 최대 (너무 커지지 않게)
            if (h > 0) setTextHeight(Math.max(minH, Math.min(h, maxH)));
          }}
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>소요 시간(분)</Text>
        <TextInput
          ref={durationInputRef}
          value={duration}
          onChangeText={handleDurationChange}
          placeholder="숫자만 입력"
          style={[styles.input, { opacity: busy ? 0.75 : 1 }]}
          editable={!busy}
          placeholderTextColor={PALETTE.gray400}
          onFocus={() => scrollToFocusedInput(durationInputRef, 48)}
          {...numericInputProps}
        />
      </View>

      <View style={styles.healthDataBox}>
        <Text style={styles.healthDataTitle}>데이터 불러오기</Text>
        {healthConnectLinked ? (
          <>
            <View style={styles.healthProviderRow}><Text style={styles.healthProviderLabel}>연동된 데이터 출처</Text><Text style={styles.healthProviderValue}>☑ Health Connect</Text></View>
            <TouchableOpacity style={[styles.healthLoadButton,busy&&styles.healthButtonDisabled]} onPress={loadHealthDataForSelectedDate} activeOpacity={0.9} disabled={busy}>
              <Text style={styles.healthLoadButtonText}>선택한 날짜 데이터 불러오기</Text>
            </TouchableOpacity>
            {healthDataRecords.length > 0 && (
              <View style={styles.healthRecordList}>
                <Text style={styles.healthRecordDateTitle}>{String(healthDataDateKey||'').replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$1.$2.$3')} 데이터</Text>
                {healthDataRecords.map(function(r){var c=selectedHealthRecordIds.includes(r.id);return(<TouchableOpacity key={r.id} style={styles.healthRecordRow} onPress={function(){toggleHealthRecordSelection(r.id);}} activeOpacity={0.85} disabled={busy}>
                  <Text style={styles.healthRecCheck}>{c?'☑':'□'}</Text><Text style={styles.healthRecText}>{r.displayText}</Text>
                </TouchableOpacity>);})}
                <TouchableOpacity style={[styles.healthUseButton,selectedHealthRecordIds.length===0&&styles.healthButtonDisabled]} onPress={confirmSelectedHealthData} activeOpacity={0.9} disabled={selectedHealthRecordIds.length===0||busy}>
                  <Text style={styles.healthUseButtonText}>선택한 데이터로 인증</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={styles.healthEmptyTitle}>연동된 앱이 없어요.</Text>
            <Text style={styles.healthEmptyText}>Health Connect를 연결하면 걸음 수와 운동 시간을 불러와 인증할 수 있어요.</Text>
            <TouchableOpacity style={styles.healthLoadButton} onPress={goToDataIntegrations} activeOpacity={0.9} disabled={busy}>
              <Text style={styles.healthLoadButtonText}>어플 연동하러 가기</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <TouchableOpacity
        style={[buttonStyles.primary.container, { marginTop: spacing.xl, opacity: busy ? 0.6 : 1 }]}
        onPress={onSubmit}
        activeOpacity={0.9}
        disabled={busy}
      >
        <Text style={buttonStyles.primary.label}>제출하기</Text>
      </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 3, backgroundColor: PALETTE.gray50 },
  screenTitle: { fontSize: 20, fontWeight: '800', color: PALETTE.gray800, marginBottom: spacing.lg, textAlign: 'center' },

  titleBox: {
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.gray200,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: spacing.lg,
  },
  titleBoxText: {
    fontSize: 15,
    fontWeight: '700',
    color: PALETTE.gray800,
    textAlign: 'center',
  },

  dateBox: {
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.gray200,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dateTextGroup: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: PALETTE.gray600,
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 15,
    fontWeight: '800',
    color: PALETTE.gray800,
  },
  dateValueActive: {
    color: PALETTE.black,
  },
  dateCostButton: {
    minWidth: 56,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: PALETTE.gray800,
    backgroundColor: PALETTE.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dateCostButtonDisabled: {
    opacity: 0.55,
  },
  dateCostButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: PALETTE.gray800,
  },
    healthDataBox: { backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.gray200, borderRadius: radius.md || 12, padding: spacing.lg || 16, marginBottom: spacing.lg || 16 },
  healthDataTitle: { fontSize: 16, fontWeight: '800', color: PALETTE.gray800, marginBottom: spacing.sm || 8 },
  healthProviderRow: { padding: 12, borderWidth: 1, borderColor: PALETTE.gray200, borderRadius: radius.md || 12, backgroundColor: PALETTE.gray50, marginBottom: spacing.md || 12 },
  healthProviderLabel: { fontSize: 12, fontWeight: '700', color: PALETTE.gray600, marginBottom: 4 },
  healthProviderValue: { fontSize: 14, fontWeight: '800', color: PALETTE.gray800 },
  healthLoadButton: { height: 44, borderRadius: radius.md || 12, backgroundColor: PALETTE.gray800, alignItems: 'center', justifyContent: 'center' },
  healthLoadButtonText: { color: PALETTE.white, fontSize: 14, fontWeight: '800' },
  healthRecordList: { marginTop: spacing.md || 12, borderTopWidth: 1, borderTopColor: PALETTE.gray200, paddingTop: spacing.md || 12 },
  healthRecordDateTitle: { fontSize: 14, fontWeight: '800', color: PALETTE.gray800, marginBottom: spacing.sm || 8 },
  healthRecordRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  healthRecCheck: { width: 24, fontSize: 16, color: PALETTE.gray800 },
  healthRecText: { flex: 1, fontSize: 14, color: PALETTE.gray800 },
  healthUseButton: { marginTop: spacing.md || 12, height: 44, borderRadius: radius.md || 12, backgroundColor: PALETTE.black, alignItems: 'center', justifyContent: 'center' },
  healthUseButtonText: { color: PALETTE.white, fontSize: 14, fontWeight: '800' },
  healthButtonDisabled: { opacity: 0.55 },
  healthEmptyTitle: { fontSize: 14, fontWeight: '800', color: PALETTE.gray800, marginBottom: 4 },
  healthEmptyText: { fontSize: 13, lineHeight: 19, color: PALETTE.gray600, marginBottom: spacing.md || 12 },
card: {
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.gray200,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  // "내용"과 "사진 넣기"를 한 줄로, 간격 살짝 줄임
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: PALETTE.gray800 },

  label: { fontSize: 13, color: PALETTE.gray600, marginBottom: 6 },
  input: {
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.gray200,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: PALETTE.gray800,
  },

  // 미리보기 컨테이너 (삭제 버튼을 절대 위치시키기 위해 relative)
  previewWrap: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    backgroundColor: PALETTE.gray100,
  },
  // 우상단 반투명 회색 원형 + 검은 X
  previewDeleteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(229, 231, 235, 0.85)', // 회색(Gray-200) 반투명
  },
  previewDeleteX: {
    fontSize: 18,
    lineHeight: 18,
    color: '#000', // 검은색 X
    fontWeight: '900',
    includeFontPadding: false,
  },
});
