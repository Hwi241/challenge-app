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
const HEALTH_SAMPLE_SOURCE_APP = 'samsungHealth';
const isHealthConnectLinked = (hc = {}) => hc?.status === 'connected' || hc?.enabled === true || Object.values(hc?.permissions || {}).some(Boolean);
const makeHealthSampleRecordsForDate = (dk) => { var s=Number(String(dk||'').replace(/[^\d]/g,'').slice(-4))||620,st=7600+(s%1800),wm=35+(s%15),rm=22+(s%12),rd=Number((3.4+((s%18)/10)).toFixed(1)),tm=wm+rm;return[{id:dk+'-steps',metricType:'steps',label:'걸음 수',value:st,unit:'steps',displayText:'걸음 수 '+st.toLocaleString('ko-KR')+'보',sourceProvider:'healthConnect',sourceApp:'samsungHealth',verified:true,dateKey:dk},{id:dk+'-walk',metricType:'duration',label:'걷기 운동',value:wm,unit:'minutes',displayText:'걷기 운동 '+wm+'분',sourceProvider:'healthConnect',sourceApp:'samsungHealth',verified:true,dateKey:dk},{id:dk+'-run',metricType:'exercise',label:'달리기',value:rm,unit:'minutes',distanceValue:rd,distanceUnit:'km',displayText:'달리기 '+rm+'분 · '+rd+'km',sourceProvider:'healthConnect',sourceApp:'samsungHealth',verified:true,dateKey:dk},{id:dk+'-total',metricType:'duration',label:'운동 시간 합계',value:tm,unit:'minutes',displayText:'운동 시간 합계 '+tm+'분',sourceProvider:'healthConnect',sourceApp:'samsungHealth',verified:true,dateKey:dk}];};

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
      setChallengeInfo(null);
      submittedRef.current = false;

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
    !!isPastEntryDate
  ), [text, imageUri, duration, isPastEntryDate]);

  const { handleBackPress, markAsSaved } = useUnsavedChangesGuard({
    navigation,
    hasUnsavedChanges,
    title: '작성 중인 내용이 있어요',
    message: '뒤로 가면 작성한 내용이 저장되지 않습니다.',
    stayText: '계속 작성',
    leaveText: '나가기',
  });
  const goToDataIntegrations = useCallback(function(){var m=function(){navigation.navigate('DataIntegrations');};if(hasUnsavedChanges()){Alert.alert('작성 중인 내용이 있어요','설정 화면으로 이동하면 입력 내용이 사라질 수 있습니다.',[{text:'취소',style:'cancel'},{text:'계속 이동',style:'destructive',onPress:m}]);return;}m();},[hasUnsavedChanges,navigation]);
  const loadHealthDataForSelectedDate = useCallback(function(){if(busy)return;var r=makeHealthSampleRecordsForDate(selectedEntryDateKey);setHealthDataRecords(r);setHealthDataDateKey(selectedEntryDateKey);setSelectedHealthRecordIds([]);},[busy,selectedEntryDateKey]);
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

      if (!trimmed && !imageUri) {
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

      Alert.alert('완료', completeMessage, [
        {
          text: '확인',
          onPress: () => {
            submittedRef.current = true;
            markAsSaved();
            setText('');
            setImageUri(null);
            setDuration('');
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
          },
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
    safeSelectedEntryDate,
    selectedEntryDateKey,
    navigation,
    markAsSaved,
  ]);

  const onSubmit = useCallback(() => {
    if (busy) return;

    const trimmed = (text || '').trim();

    if (!challengeId) {
      Alert.alert('오류', '도전 정보를 찾을 수 없습니다.');
      return;
    }

    if (!trimmed && !imageUri) {
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
  }, [busy, challengeId, text, imageUri, isPastEntryDate, saveEntry]);



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

      <TouchableOpacity
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
