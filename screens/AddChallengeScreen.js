import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Modal, BackHandler, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePickerModal from 'react-native-modal-datetime-picker';


import {
  buttonStyles,
  color,
  font,
  input as canonicalInputStyles,
  layout as canonicalLayoutStyles,
  modal as canonicalModalStyles,
  primitive,
  radius,
  space,
  surface as canonicalSurfaceStyles,
  text as canonicalTextStyles,
} from '../styles/common';
import { numericInputProps, toNumberOrZero } from '../utils/number';
import { validateInput, saveAndSchedule } from '../utils/challengeStore';
import { syncWidgetChallengeList } from '../utils/widgetSync';
import { CHALLENGE_TYPE } from '../utils/challengeType';
import BackButton from '../components/BackButton';
import { SettingSectionCard, GoalCyclePreview as SettingGoalCyclePreview, NotificationPreview as SettingNotificationPreview } from '../components/ChallengeSettingWidgets';

import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';


const DRAFT_KEY = 'draft_add_challenge';
const WEEK_DAYS_KO = ['월','화','수','목','금','토','일'];
const sortTimesAsc = (arr=[]) => [...arr].sort((a,b)=>a.localeCompare(b));
const LIMITS = { title: 50, reward: 50, description: 500, maxGoal: 1000 };

const pad2 = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => {
  if (!d) return '-';
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt.getTime())) return '-';
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
};

const parseDateForClone = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// --- 프리뷰 컴포넌트들 ---
export default function AddChallengeScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const editChallenge = (
    route.params?.editChallenge
    || null
  );
  const editNonce = (
    route.params?.editNonce
    || null
  );
  const isEditMode = !!editChallenge;
  const requestedTypeSource = isEditMode
    ? editChallenge?.type
    : route.params?.initialType;
  const requestedInitialType = requestedTypeSource === CHALLENGE_TYPE.HABIT
    ? CHALLENGE_TYPE.HABIT
    : CHALLENGE_TYPE.CHALLENGE;
  const lockType = (
    isEditMode
    || [
      CHALLENGE_TYPE.CHALLENGE,
      CHALLENGE_TYPE.HABIT,
    ].includes(route.params?.initialType)
  );
  const duplicateTemplate = isEditMode
    ? null
    : route.params?.duplicateTemplate || null;
  const duplicateNonce = route.params?.duplicateNonce || null;
  const [busy, setBusy] = useState(false);
  const [habitMode, setHabitMode] = useState(
    requestedInitialType === CHALLENGE_TYPE.HABIT
  );

  // 도전 탭 상태
  const [cTitle, setCTitle] = useState('');
  const [cGoalScore, setCGoalScore] = useState('');
  const [cReward, setCReward] = useState('');
  const [cDescription, setCDescription] = useState('');
  const [cStartDate, setCStartDate] = useState(null);
  const [cEndDate, setCEndDate] = useState(null);
  const [challengeNotification, setChallengeNotification] = useState({ mode: null, payload: null });

  // 습관 탭 상태
  const [hTitle, setHTitle] = useState('');
  const [hDescription, setHDescription] = useState('');
  const [hStartDate, setHStartDate] = useState(null);
  const [hEndDate, setHEndDate] = useState(null);
  const [habitNotification, setHabitNotification] = useState({ mode: null, payload: null });

  // UI 매핑 (alias)
  const title = habitMode ? hTitle : cTitle;
  const setTitle = habitMode ? setHTitle : setCTitle;
  const description = habitMode ? hDescription : cDescription;
  const setDescription = habitMode ? setHDescription : setCDescription;
  const startDate = habitMode ? hStartDate : cStartDate;
  const setStartDate = habitMode ? setHStartDate : setCStartDate;
  const endDate = habitMode ? hEndDate : cEndDate;
  const setEndDate = habitMode ? setHEndDate : setCEndDate;
  const notification = habitMode ? habitNotification : challengeNotification;
  const goalScore = cGoalScore;
  const setGoalScore = setCGoalScore;
  const reward = cReward;
  const setReward = setCReward;

  const [showNotifPicker, setShowNotifPicker] = useState(false);
  const [habitCycle, setHabitCycle] = useState(null);
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [cycleTab, setCycleTab] = useState('weekly');
  const [cycleDays, setCycleDays] = useState(new Set());
  const [cycleDates, setCycleDates] = useState(new Set());
  const [cycleWeekScope, setCycleWeekScope] = useState('custom');
  const [cycleMonthScope, setCycleMonthScope] = useState('custom');

  const lastChangedRef = useRef(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const saveDraftDebounce = useRef(null);
  const suppressDraftRef = useRef(false);
  const formScrollRef = useRef(null);
  const titleInputRef = useRef(null);
  const goalInputRef = useRef(null);
  const descriptionInputRef = useRef(null);
  const rewardInputRef = useRef(null);
  const focusedInputRef = useRef(null);
  const keyboardFrameRef = useRef(null);
  const keyboardVisibleRef = useRef(false);
  const scrollYRef = useRef(0);
  const [keyboardBottomInset, setKeyboardBottomInset] = useState(0);

  const currentEditSignature = useMemo(
    () => JSON.stringify({
      habitMode,
      title: String(title || ''),
      description: String(description || ''),
      startDate: fmtDate(startDate),
      endDate: fmtDate(endDate),
      goalScore: habitMode
        ? ''
        : String(goalScore || ''),
      reward: habitMode
        ? ''
        : String(reward || ''),
      notification: notification || {
        mode: null,
        payload: null,
      },
      habitCycle: habitMode
        ? habitCycle || null
        : null,
    }),
    [
      habitMode,
      title,
      description,
      startDate,
      endDate,
      goalScore,
      reward,
      notification,
      habitCycle,
    ]
  );

  const editInitialSignature = useMemo(
    () => {
      if (!editChallenge) return '';

      const editHabit = (
        editChallenge?.type === 'habit'
      );

      return JSON.stringify({
        habitMode: editHabit,
        title: String(editChallenge?.title || ''),
        description: String(editChallenge?.description || ''),
        startDate: fmtDate(
          parseDateForClone(editChallenge?.startDate)
        ),
        endDate: fmtDate(
          parseDateForClone(editChallenge?.endDate)
        ),
        goalScore: editHabit
          ? ''
          : (
              Number(editChallenge?.goalScore) > 0
                ? String(
                    Math.min(
                      LIMITS.maxGoal,
                      Number(editChallenge.goalScore)
                    )
                  )
                : ''
            ),
        reward: editHabit
          ? ''
          : String(
              editChallenge?.reward
              ?? editChallenge?.rewardTitle
              ?? ''
            ).slice(0, LIMITS.reward),
        notification: (
          editChallenge?.notification?.mode
            ? editChallenge.notification
            : {
                mode: null,
                payload: null,
              }
        ),
        habitCycle: editHabit
          ? editChallenge?.habitCycle || null
          : null,
      });
    },
    [
      editChallenge,
      editNonce,
    ]
  );

  const hasUnsavedChanges = useMemo(() => {
    const hasNotification = !!notification?.mode;
    const hasChallengeDraft =
      !!cTitle.trim() ||
      !!cGoalScore ||
      !!cReward.trim() ||
      !!cDescription.trim() ||
      !!cStartDate ||
      !!cEndDate ||
      !!challengeNotification?.mode;

    const hasHabitDraft =
      !!hTitle.trim() ||
      !!hDescription.trim() ||
      !!hStartDate ||
      !!hEndDate ||
      !!habitNotification?.mode ||
      !!habitCycle;

    if (isEditMode) {
      return (
        currentEditSignature
        !== editInitialSignature
      );
    }

    return !!duplicateTemplate || hasNotification || hasChallengeDraft || hasHabitDraft;
  }, [
    isEditMode,
    currentEditSignature,
    editInitialSignature,
    duplicateTemplate,
    notification,
    cTitle,
    cGoalScore,
    cReward,
    cDescription,
    cStartDate,
    cEndDate,
    challengeNotification,
    hTitle,
    hDescription,
    hStartDate,
    hEndDate,
    habitNotification,
    habitCycle,
  ]);

  const { handleBackPress, markAsSaved } = useUnsavedChangesGuard({
    navigation,
    hasUnsavedChanges,
    title: '작성 중인 내용이 있어요',
    message: '뒤로 가면 작성한 내용이 저장되지 않습니다.',
  });

const handleGoalChange = useCallback((txt)=>{
    const digits = (txt || '').replace(/[^\d]/g, '');
    if (!digits) { setCGoalScore(''); return; }
    let n = parseInt(digits, 10);
    if (isNaN(n)) { setCGoalScore(''); return; }
    if (n > LIMITS.maxGoal) n = LIMITS.maxGoal;
    setCGoalScore(String(n));
  }, []);

  const revealInputAboveKeyboard = useCallback((inputRef) => {
    const input = inputRef?.current;
    const scroll = formScrollRef.current;
    const keyboardFrame = keyboardFrameRef.current;
    const keyboardTop = Number(
      keyboardFrame?.screenY ?? keyboardFrame?.y
    );

    if (
      !input?.measureInWindow
      || !scroll?.scrollTo
      || !Number.isFinite(keyboardTop)
    ) return;

    requestAnimationFrame(() => {
      input.measureInWindow((x, y, width, height) => {
        const inputBottom = y + height;
        const safeBottom = keyboardTop - 18;

        if (inputBottom <= safeBottom) return;

        const delta = inputBottom - safeBottom + 18;
        scroll.scrollTo({
          y: Math.max(0, scrollYRef.current + delta),
          animated: true,
        });
      });
    });
  }, []);

  const scrollToFocusedInput = useCallback((inputRef) => {
    focusedInputRef.current = inputRef;

    if (!keyboardVisibleRef.current) return;

    setTimeout(() => {
      revealInputAboveKeyboard(inputRef);
    }, 50);
  }, [revealInputAboveKeyboard]);

  useEffect(() => {
    const handleKeyboardFrame = (event) => {
      const nextFrame = event?.endCoordinates || null;
      keyboardFrameRef.current = nextFrame;
      keyboardVisibleRef.current = true;

      const nextKeyboardHeight = Math.max(0, Number(nextFrame?.height) || 0);
      setKeyboardBottomInset(nextKeyboardHeight);

      if (focusedInputRef.current) {
        setTimeout(() => {
          revealInputAboveKeyboard(focusedInputRef.current);
        }, 80);
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
  }, [revealInputAboveKeyboard]);

  useEffect(() => {
    if (!editChallenge) return;

    const editHabit = (
      editChallenge?.type === 'habit'
    );
    const editStartDate = parseDateForClone(
      editChallenge?.startDate
    );
    const editEndDate = parseDateForClone(
      editChallenge?.endDate
    );
    const editNotification = (
      editChallenge?.notification?.mode
        ? editChallenge.notification
        : {
            mode: null,
            payload: null,
          }
    );

    suppressDraftRef.current = true;
    setHabitMode(editHabit);

    if (editHabit) {
      setHTitle(String(editChallenge?.title ?? '').slice(0, LIMITS.title));
      setHDescription(String(editChallenge?.description ?? '').slice(0, LIMITS.description));
      setHStartDate(editStartDate);
      setHEndDate(editEndDate);
      setHabitNotification(editNotification);

      const nextCycle = editChallenge?.habitCycle || null;
      setHabitCycle(nextCycle);

      if (nextCycle?.type === 'weekly') {
        setCycleTab('weekly');
        setCycleDays(new Set(nextCycle.days || []));
        setCycleDates(new Set());
      } else if (nextCycle?.type === 'monthly') {
        setCycleTab('monthly');
        setCycleDates(new Set(nextCycle.dates || []));
        setCycleDays(new Set());
      } else {
        setCycleDays(new Set());
        setCycleDates(new Set());
      }

      setCTitle('');
      setCGoalScore('');
      setCReward('');
      setCDescription('');
      setCStartDate(null);
      setCEndDate(null);
      setChallengeNotification({ mode: null, payload: null });
      return;
    }

    setCTitle(String(editChallenge?.title ?? '').slice(0, LIMITS.title));
    setCGoalScore(
      Number(editChallenge?.goalScore) > 0
        ? String(Math.min(LIMITS.maxGoal, Number(editChallenge.goalScore)))
        : ''
    );
    setCReward(
      String(
        editChallenge?.reward
        ?? editChallenge?.rewardTitle
        ?? ''
      ).slice(0, LIMITS.reward)
    );
    setCDescription(String(editChallenge?.description ?? '').slice(0, LIMITS.description));
    setCStartDate(editStartDate);
    setCEndDate(editEndDate);
    setChallengeNotification(editNotification);

    setHTitle('');
    setHDescription('');
    setHStartDate(null);
    setHEndDate(null);
    setHabitNotification({ mode: null, payload: null });
    setHabitCycle(null);
    setCycleDays(new Set());
    setCycleDates(new Set());
  }, [editChallenge, editNonce]);

  useEffect(() => {
    if (!duplicateTemplate || isEditMode) return;

    const isDuplicateHabit = duplicateTemplate?.type === 'habit';
    const nextStartDate = parseDateForClone(duplicateTemplate?.startDate);
    const nextEndDate = parseDateForClone(duplicateTemplate?.endDate);
    const nextNotification = duplicateTemplate?.notification?.mode
      ? duplicateTemplate.notification
      : { mode: null, payload: null };

    suppressDraftRef.current = true;
    setHabitMode(isDuplicateHabit);

    if (isDuplicateHabit) {
      setHTitle(String(duplicateTemplate?.title ?? '').slice(0, LIMITS.title));
      setHDescription(String(duplicateTemplate?.description ?? '').slice(0, LIMITS.description));
      setHStartDate(nextStartDate);
      setHEndDate(nextEndDate);
      setHabitNotification(nextNotification);
      setHabitCycle(duplicateTemplate?.habitCycle || null);

      if (duplicateTemplate?.habitCycle?.type === 'weekly') {
        setCycleTab('weekly');
        setCycleDays(new Set(duplicateTemplate.habitCycle.days || []));
        setCycleDates(new Set());
      } else if (duplicateTemplate?.habitCycle?.type === 'monthly') {
        setCycleTab('monthly');
        setCycleDates(new Set(duplicateTemplate.habitCycle.dates || []));
        setCycleDays(new Set());
      } else {
        setCycleDays(new Set());
        setCycleDates(new Set());
      }

      setCTitle('');
      setCGoalScore('');
      setCReward('');
      setCDescription('');
      setCStartDate(null);
      setCEndDate(null);
      setChallengeNotification({ mode: null, payload: null });
      return;
    }

    setCTitle(String(duplicateTemplate?.title ?? '').slice(0, LIMITS.title));
    setCGoalScore(
      Number(duplicateTemplate?.goalScore) > 0
        ? String(Math.min(LIMITS.maxGoal, Number(duplicateTemplate.goalScore)))
        : ''
    );
    setCReward(String(duplicateTemplate?.reward ?? '').slice(0, LIMITS.reward));
    setCDescription(String(duplicateTemplate?.description ?? '').slice(0, LIMITS.description));
    setCStartDate(nextStartDate);
    setCEndDate(nextEndDate);
    setChallengeNotification(nextNotification);

    setHTitle('');
    setHDescription('');
    setHStartDate(null);
    setHEndDate(null);
    setHabitNotification({ mode: null, payload: null });
    setHabitCycle(null);
    setCycleDays(new Set());
    setCycleDates(new Set());
  }, [duplicateTemplate, duplicateNonce, isEditMode]);

  useEffect(() => {
    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
      Alert.alert('확인', '종료일이 시작일보다 빠를 수 없습니다.');
      if (lastChangedRef.current === 'end') setEndDate(null); else setStartDate(null);
    }
  }, [startDate, endDate]);

  const onSave = useCallback(() => {
    if (busy) return;

    const t = title.trim();
    const desc = description.trim();
    const id = isEditMode
      ? String(editChallenge?.id || '')
      : `ch_${Date.now()}`;
    let item;

    if (!id) return;

    if (habitMode) {
      if (!t) {
        Alert.alert('확인', '습관 제목을 입력해주세요.');
        return;
      }
      if (!startDate) {
        Alert.alert('확인', '시작일을 선택해주세요.');
        return;
      }
      item = {
        ...(isEditMode ? editChallenge : {}),
        id,
        type: 'habit',
        title: t,
        description: desc,
        goalScore: 0,
        currentScore: isEditMode
          ? Number(editChallenge?.currentScore || 0)
          : 0,
        startDate: startDate ? fmtDate(startDate) : null,
        endDate: endDate ? fmtDate(endDate) : null,
        habitCycle,
        notification,
        reward: '',
        status: isEditMode
          ? editChallenge?.status || 'active'
          : 'active',
        createdAt: isEditMode
          ? editChallenge?.createdAt || Date.now()
          : Date.now(),
        completedAt: isEditMode
          ? editChallenge?.completedAt || 0
          : 0,
        updatedAt: Date.now(),
      };
    } else {
      if (!t) {
        Alert.alert('확인', '도전 제목을 입력해주세요.');
        return;
      }
      const goalNum = toNumberOrZero(goalScore);
      if (goalNum <= 0) {
        Alert.alert('확인', '목표 점수를 입력해주세요.');
        return;
      }
      item = {
        ...(isEditMode ? editChallenge : {}),
        id,
        title: t,
        goalScore: goalNum,
        currentScore: isEditMode
          ? Number(editChallenge?.currentScore || 0)
          : 0,
        startDate: fmtDate(startDate),
        endDate: fmtDate(endDate),
        reward: reward.trim(),
        description: desc,
        notification,
        status: isEditMode
          ? editChallenge?.status || 'active'
          : 'active',
        createdAt: isEditMode
          ? editChallenge?.createdAt || Date.now()
          : Date.now(),
        completedAt: isEditMode
          ? editChallenge?.completedAt || 0
          : 0,
        updatedAt: Date.now(),
      };
    }

    Alert.alert(
      '저장하시겠습니까?',
      isEditMode
        ? '수정한 내용을 저장할까요?'
        : habitMode
          ? '이 습관을 저장할까요?'
          : '이 도전을 저장할까요?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '저장',
          onPress: async () => {
            setBusy(true);
            try {
              await saveAndSchedule(item, { replaceSchedules: true });
              if (!isEditMode) {
                await AsyncStorage.setItem(`entries_${id}`, JSON.stringify([]));
              }
              await syncWidgetChallengeList();

              suppressDraftRef.current = false;

              // 폼 초기화
              if (habitMode) {
                setHTitle(''); setHDescription(''); setHStartDate(null); setHEndDate(null);
                setHabitNotification({ mode: null, payload: null });
                setHabitCycle(null); setCycleDays(new Set()); setCycleDates(new Set());
              } else {
                setCTitle(''); setCGoalScore(''); setCReward(''); setCDescription('');
                setCStartDate(null); setCEndDate(null);
                setChallengeNotification({ mode: null, payload: null });
              }

              markAsSaved();
              if (typeof navigation.popTo === 'function') {
                navigation.popTo('ChallengeList');
              } else {
                navigation.navigateDeprecated('ChallengeList');
              }
            } catch (e) {
              Alert.alert('오류', '저장 실패');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }, [busy, title, description, habitMode, startDate, endDate, habitCycle, notification, goalScore, reward, saveAndSchedule, syncWidgetChallengeList, markAsSaved, navigation, isEditMode, editChallenge]);

  return (
    <SafeAreaView style={canonicalSurfaceStyles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
      <BackButton
        title={
          isEditMode
            ? (habitMode ? '습관 수정' : '도전 수정')
            : lockType
              ? (habitMode ? '습관 추가' : '도전 추가')
              : '도전/습관 추가'
        }
        onPress={handleBackPress}
      />
      {!lockType && (
      <View style={styles.tabWrap}>
        <TouchableOpacity style={[styles.tabBtn, !habitMode && styles.tabBtnActive]} onPress={() => setHabitMode(false)}>
          <Text style={[styles.tabText, !habitMode && styles.tabTextActive]}>도전</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, habitMode && styles.tabBtnActive]} onPress={() => setHabitMode(true)}>
          <Text style={[styles.tabText, habitMode && styles.tabTextActive]}>습관</Text>
        </TouchableOpacity>
      </View>
      )}
      <ScrollView
        ref={formScrollRef}
        contentContainerStyle={[
          canonicalLayoutStyles.screenContentMuted,
          {
            paddingBottom:
              space.xl * 3
              + keyboardBottomInset
              + space.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onScroll={(event) => {
          scrollYRef.current = event?.nativeEvent?.contentOffset?.y || 0;
        }}
        scrollEventThrottle={16}
      >
        <View style={styles.basicSection}>
          <Text style={styles.formLabel}>
            {habitMode ? '습관 이름' : '도전 이름'}
          </Text>
          <TextInput
            ref={titleInputRef}
            value={title}
            onChangeText={setTitle}
            placeholder={habitMode ? '습관의 이름을 입력하세요' : '도전의 이름을 입력하세요'}
            style={[canonicalInputStyles.compact, styles.inputSpacing]}
            onFocus={() => scrollToFocusedInput(titleInputRef)}
          />
          {!habitMode && (
            <>
              <Text style={[styles.formLabel, styles.formFieldSpacing]}>
                목표 점수 혹은 횟수
              </Text>
              <TextInput
                ref={goalInputRef}
                value={goalScore}
                onChangeText={handleGoalChange}
                placeholder="숫자만 입력"
                style={[canonicalInputStyles.compact, styles.inputSpacing]}
                keyboardType="numeric"
                inputMode="numeric"
                maxLength={4}
                onFocus={() => scrollToFocusedInput(goalInputRef)}
              />
            </>
          )}

          <View style={[styles.labelRow, styles.formFieldSpacing]}>
            <Text style={styles.formLabel}>설명</Text>
            <Text style={styles.optionalText}>선택</Text>
          </View>
          <TextInput
            ref={descriptionInputRef}
            value={description}
            onChangeText={setDescription}
            placeholder={habitMode ? '습관의 내용을 적어주세요' : '도전의 내용을 적어주세요'}
            style={[
              canonicalInputStyles.compact,
              canonicalInputStyles.multilineCompact,
              styles.inputSpacing,
            ]}
            multiline
            textAlignVertical="top"
            maxLength={LIMITS.description}
            onFocus={() => scrollToFocusedInput(descriptionInputRef)}
          />

          <View style={styles.dateRow}>
            <View style={styles.dateColumn}>
              <Text style={styles.formLabel}>시작일</Text>
              <TouchableOpacity
                onPress={() => { setShowStartPicker(true); lastChangedRef.current='start'; }}
                style={styles.dateButton}
                activeOpacity={0.85}
              >
                <Text style={[styles.dateButtonText, !startDate && styles.dateButtonPlaceholder]}>
                  {startDate ? fmtDate(startDate) : '날짜 선택'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dateColumn}>
              <Text style={styles.formLabel}>종료일</Text>
              <TouchableOpacity
                onPress={() => { setShowEndPicker(true); lastChangedRef.current='end'; }}
                style={styles.dateButton}
                activeOpacity={0.85}
              >
                <Text style={[styles.dateButtonText, !endDate && styles.dateButtonPlaceholder]}>
                  {endDate ? fmtDate(endDate) : '날짜 선택'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        {habitMode ? (
          <SettingSectionCard
            flat
            title="목표 주기"
            actionLabel={habitCycle ? '변경' : '선택'}
            onActionPress={() => setShowCycleModal(true)}
            onClear={habitCycle ? () => {
              setHabitCycle(null);
              setCycleDays(new Set());
              setCycleDates(new Set());
              setCycleWeekScope('custom');
              setCycleMonthScope('custom');
            } : undefined}
            clearAccessibilityLabel="목표 주기 삭제"
            style={styles.sectionSpacing}
          >
            <SettingGoalCyclePreview cycle={habitCycle} />
          </SettingSectionCard>

        ) : (
          <View style={styles.sectionSpacing}>
            <View style={styles.labelRow}>
              <Text style={styles.sectionTitle}>보상</Text>
              <Text style={styles.optionalText}>선택</Text>
            </View>
            <TextInput
              ref={rewardInputRef}
              value={reward}
              onChangeText={setReward}
              placeholder="보상을 입력하세요"
              style={[canonicalInputStyles.compact, styles.inputSpacing]}
              onFocus={() => scrollToFocusedInput(rewardInputRef)}
            />
          </View>
        )}
        <SettingSectionCard
          flat
          title="알림"
          actionLabel={notification?.mode ? '변경' : '설정'}
          onActionPress={() => setShowNotifPicker(true)}
          onClear={notification?.mode ? () => {
            if (habitMode) setHabitNotification({ mode: null, payload: null });
            else setChallengeNotification({ mode: null, payload: null });
          } : undefined}
          clearAccessibilityLabel="알림 삭제"
          style={styles.sectionSpacing}
        >
          <SettingNotificationPreview notification={notification} startDate={startDate} endDate={endDate} />
        </SettingSectionCard>
      <TouchableOpacity
          style={[
            buttonStyles.primary.container,
            styles.saveButton,
            busy && styles.busy,
          ]}
          onPress={onSave}
          disabled={busy}
        >
          <Text style={buttonStyles.primary.label}>
            {busy
              ? '저장 중...'
              : isEditMode
                ? (habitMode ? '습관 수정 완료' : '도전 수정 완료')
                : habitMode
                  ? '습관 만들기'
                  : '도전 만들기'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showCycleModal} transparent animationType="fade" onRequestClose={() => setShowCycleModal(false)}>
        <View style={canonicalModalStyles.backdrop}>
          <View style={canonicalModalStyles.sheetBorderless}>
            <Text style={canonicalModalStyles.title}>목표 주기 설정</Text>
            
            <View style={styles.cycleTabRow}>
              {['weekly', 'monthly'].map(t => (
                <TouchableOpacity key={t} style={[styles.cycleTabBtn, cycleTab === t && styles.cycleTabBtnOn]} onPress={() => setCycleTab(t)}>
                  <Text style={[styles.cycleTabText, cycleTab === t && styles.cycleTabTextOn]}>{t === 'weekly' ? '주간' : '월간'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 범위 빠른 선택 */}
            <View style={styles.scopeRow}>
              {cycleTab === 'weekly' ? (
                ['all', 'weekday', 'weekend', 'custom'].map(s => (
                  <TouchableOpacity key={s} onPress={() => {
                    setCycleWeekScope(s);
                    if (s === 'all') setCycleDays(new Set(['월','화','수','목','금','토','일']));
                    else if (s === 'weekday') setCycleDays(new Set(['월','화','수','목','금']));
                    else if (s === 'weekend') setCycleDays(new Set(['토','일']));
                    else if (s === 'custom') setCycleDays(new Set());
                  }} style={[
                styles.scopeButton,
                cycleWeekScope === s && styles.scopeButtonOn,
              ]}>
                    <Text style={[
                  styles.scopeButtonText,
                  cycleWeekScope === s && styles.scopeButtonTextOn,
                ]}>
                      {{ all: '매일', weekday: '평일', weekend: '주말', custom: '직접' }[s]}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                ['all', 'even', 'odd', 'custom'].map(s => (
                  <TouchableOpacity key={s} onPress={() => {
                    setCycleMonthScope(s);
                    if (s === 'all') setCycleDates(new Set(Array.from({length:31}, (_,i)=>i+1)));
                    else if (s === 'even') setCycleDates(new Set(Array.from({length:31}, (_,i)=>i+1).filter(n=>n%2===0)));
                    else if (s === 'odd') setCycleDates(new Set(Array.from({length:31}, (_,i)=>i+1).filter(n=>n%2!==0)));
                    else if (s === 'custom') setCycleDates(new Set());
                  }} style={[
                styles.scopeButton,
                cycleMonthScope === s && styles.scopeButtonOn,
              ]}>
                    <Text style={[
                  styles.scopeButtonText,
                  cycleMonthScope === s && styles.scopeButtonTextOn,
                ]}>
                      {{ all: '매일', even: '짝수', odd: '홀수', custom: '직접' }[s]}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* 그리드 영역 */}
            {cycleTab === 'weekly' ? (
              <View
              style={[
                styles.cycleDaysRow,
                styles.cycleGridSpacing,
              ]}
            >
                {['월','화','수','목','금','토','일'].map(d => (
                  <TouchableOpacity key={d} onPress={() => {
                    const next = new Set(cycleDays);
                    if (next.has(d)) next.delete(d); else next.add(d);
                    setCycleDays(next);
                    setCycleWeekScope('custom');
                  }} style={[styles.cycleDayCircle, cycleDays.has(d) && styles.cycleDayCircleOn]}>
                    <Text style={[styles.cycleDayText, cycleDays.has(d) && styles.cycleDayTextOn]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.cycleGridSpacing}>
                {Array.from({ length: 5 }).map((_, row) => (
                  <View key={row} style={styles.monthGridRow}>
                    {Array.from({ length: 7 }).map((__, col) => {
                      const d = row * 7 + col + 1;
                      if (d > 31) {
              return (
                <View
                  key={col}
                  style={styles.monthGridBlank}
                />
              );
            }
                      const on = cycleDates.has(d);
                      return (
                        <TouchableOpacity key={col} onPress={() => {
                          const next = new Set(cycleDates);
                          if (next.has(d)) next.delete(d); else next.add(d);
                          setCycleDates(next);
                          setCycleMonthScope('custom');
                        }} style={[
                  styles.monthGridCell,
                  on && styles.monthGridCellOn,
                ]}>
                          <Text
                  style={[
                    styles.monthGridText,
                    on && styles.monthGridTextOn,
                  ]}
                >
                  {d}
                </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[
                  buttonStyles.primary.container,
                  styles.actionFlex,
                  styles.cancelButton,
                ]}
                onPress={() => setShowCycleModal(false)}
              >
                <Text
                  style={[
                    buttonStyles.primary.label,
                    styles.cancelButtonText,
                  ]}
                >
                  취소
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  buttonStyles.primary.container,
                  styles.actionFlex,
                ]}
                onPress={() => {
                if (cycleTab === 'weekly') {
                  setHabitCycle(cycleDays.size ? { type: 'weekly', days: Array.from(cycleDays) } : null);
                } else {
                  setHabitCycle(cycleDates.size ? { type: 'monthly', dates: Array.from(cycleDates) } : null);
                }
                setShowCycleModal(false);
              }}>
                <Text style={buttonStyles.primary.label}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showNotifPicker} transparent animationType="fade" onRequestClose={() => setShowNotifPicker(false)}>
        <View style={canonicalModalStyles.backdrop}>
          <View style={canonicalModalStyles.sheetBorderless}>
            <Text style={canonicalModalStyles.title}>알림 방식 선택</Text>

            <TouchableOpacity style={[
                    buttonStyles.primary.container,
                    styles.modalButton,
                  ]} onPress={() => { setShowNotifPicker(false); navigation.navigate('SimpleNotification', { onDone: (res) => { if(habitMode) setHabitNotification(res); else setChallengeNotification(res); }, returnTo: 'AddChallenge' }); }} activeOpacity={0.9}>
              <Text style={buttonStyles.primary.label}>간단 알림</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[
                    buttonStyles.primary.container,
                    styles.modalButton,
                  ]} onPress={() => { setShowNotifPicker(false); navigation.navigate('WeeklyNotification', { onDone: (res) => { if(habitMode) setHabitNotification(res); else setChallengeNotification(res); }, returnTo: 'AddChallenge' }); }} activeOpacity={0.9}>
              <Text style={buttonStyles.primary.label}>주간 알림</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[
                    buttonStyles.primary.container,
                    styles.modalButton,
                  ]} onPress={() => { setShowNotifPicker(false); navigation.navigate('MonthlyNotification', { onDone: (res) => { if(habitMode) setHabitNotification(res); else setChallengeNotification(res); }, returnTo: 'AddChallenge' }); }} activeOpacity={0.9}>
              <Text style={buttonStyles.primary.label}>월간 알림</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                    buttonStyles.primary.container,
                    styles.modalButton,
                  ]}
              onPress={() => {
                if (!startDate || !endDate) return Alert.alert('확인', '날짜를 먼저 선택하세요.');
                const initial = notification?.mode === 'fullrange' ? (notification.payload ?? null) : null;
                setShowNotifPicker(false);
                navigation.navigate('FullRangeNotification', {
                  initial,
                  startDate: fmtDate(startDate),
                  endDate: fmtDate(endDate),
                  onDone: (res) => {
                    if (habitMode) setHabitNotification(res);
                    else setChallengeNotification(res);
                  },
                  returnTo: 'AddChallenge',
                });
              }}
              activeOpacity={0.9}
            >
              <Text style={buttonStyles.primary.label}>전체 일정 세부 알림</Text>
            </TouchableOpacity>

            <View style={styles.modalDivider} />

            <TouchableOpacity
              style={[
                  buttonStyles.primary.container,
                  styles.basicButton,
                ]}
              onPress={() => { setShowNotifPicker(false); navigation.navigate('NotificationDefaults', { returnTo: 'AddChallenge' }); }}
              activeOpacity={0.9}
            >
              <Text
                  style={[
                    buttonStyles.primary.label,
                    styles.basicButtonText,
                  ]}
                >
                  알림 기본 설정
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                    onPress={() => setShowNotifPicker(false)}
                    style={[
                      canonicalModalStyles.closePill,
                      styles.modalCloseColor,
                    ]}
                  >
                    <Text
                      style={[
                        canonicalModalStyles.closePillText,
                        styles.modalCloseTextColor,
                      ]}
                    >
                      닫기
                    </Text>
                  </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <DateTimePickerModal isVisible={showStartPicker} mode="date" date={startDate || new Date()} onConfirm={d => { setStartDate(d); setShowStartPicker(false); }} onCancel={() => setShowStartPicker(false)} />
      <DateTimePickerModal isVisible={showEndPicker} mode="date" date={endDate || new Date()} onConfirm={d => { setEndDate(d); setShowEndPicker(false); }} onCancel={() => setShowEndPicker(false)} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  basicSection: {
    marginBottom: space.xl,
  },
  formLabel: {
    color: color.textPrimary,
    fontSize: font.size.body,
    fontWeight: font.weight.bold,
  },
  sectionTitle: {
    color: color.textPrimary,
    fontSize: font.size.bodyLarge,
    fontWeight: font.weight.heavy,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionalText: {
    marginLeft: space.xs,
    color: color.textTertiary,
    fontSize: font.size.meta,
    fontWeight: font.weight.medium,
  },
  inputSpacing: {
    marginTop: space.xs,
  },
  formFieldSpacing: {
    marginTop: space.md,
  },
  dateRow: {
    flexDirection: 'row',
    marginTop: space.md,
    gap: space.sm,
  },
  dateColumn: {
    flex: 1,
  },
  dateButton: {
    minHeight: 42,
    marginTop: space.xs,
    paddingHorizontal: space.sm,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateButtonText: {
    color: color.textPrimary,
    fontSize: font.size.body,
    fontWeight: font.weight.bold,
  },
  dateButtonPlaceholder: {
    color: color.textTertiary,
    fontWeight: font.weight.regular,
  },
  sectionSpacing: {
    marginTop: space.xl,
  },

  tabWrap: {
    flexDirection: 'row',
    marginHorizontal: space.md,
    marginTop: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },

  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },

  tabBtnActive: {
    borderBottomColor: primitive.black,
  },

  tabText: {
    fontSize: font.size.body,
    fontWeight: font.weight.bold,
    color: color.textDisabled,
  },

  tabTextActive: {
    color: primitive.black,
  },

  saveButton: {
    marginTop: space.xl,
  },

  busy: {
    opacity: 0.6,
  },

  cycleTabRow: {
    flexDirection: 'row',
    marginBottom: space.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.border,
  },

  cycleTabBtn: {
    flex: 1,
    paddingVertical: space.xs,
    alignItems: 'center',
    backgroundColor: color.surfaceMuted,
  },

  cycleTabBtnOn: {
    backgroundColor: primitive.black,
  },

  cycleTabText: {
    fontSize: font.size.bodySmall,
    fontWeight: font.weight.heavy,
    color: color.textSecondary,
  },

  cycleTabTextOn: {
    color: primitive.white,
  },

  scopeRow: {
    flexDirection: 'row',
    gap: space.xxs + 2,
    marginBottom: space.sm,
  },

  scopeButton: {
    flex: 1,
    paddingVertical: space.xxs + 2,
    borderRadius: radius.sm - 2,
    backgroundColor: color.surfaceMuted,
    alignItems: 'center',
  },

  scopeButtonOn: {
    backgroundColor: primitive.black,
  },

  scopeButtonText: {
    fontSize: font.size.caption,
    fontWeight: font.weight.bold,
    color: color.textSecondary,
  },

  scopeButtonTextOn: {
    color: primitive.white,
  },

  cycleDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.xs,
  },

  cycleGridSpacing: {
    marginBottom: space.lg,
  },

  cycleDayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: primitive.neutral[300],
    backgroundColor: primitive.white,
  },

  cycleDayCircleOn: {
    backgroundColor: primitive.black,
    borderColor: primitive.black,
  },

  cycleDayText: {
    fontSize: font.size.meta,
    fontWeight: font.weight.heavy,
    color: primitive.neutral[700],
  },

  cycleDayTextOn: {
    color: primitive.white,
  },

  monthGridRow: {
    flexDirection: 'row',
    marginBottom: space.xxs,
  },

  monthGridBlank: {
    flex: 1,
  },

  monthGridCell: {
    flex: 1,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xs,
    backgroundColor: color.backgroundMuted,
    margin: space.xxs / 2,
  },

  monthGridCellOn: {
    backgroundColor: primitive.black,
  },

  monthGridText: {
    fontSize: font.size.caption,
    fontWeight: font.weight.bold,
    color: primitive.neutral[700],
  },

  monthGridTextOn: {
    color: primitive.white,
  },

  modalActionRow: {
    flexDirection: 'row',
    gap: space.xs,
  },

  actionFlex: {
    flex: 1,
  },

  cancelButton: {
    backgroundColor: primitive.white,
    borderWidth: 1,
    borderColor: primitive.black,
  },

  cancelButtonText: {
    color: primitive.black,
  },

  modalButton: {
    marginTop: space.xs,
  },

  modalDivider: {
    marginTop: space.sm,
    height: 1,
    backgroundColor: color.border,
    opacity: 0.5,
  },

  basicButton: {
    marginTop: space.sm,
    backgroundColor: primitive.white,
    borderWidth: 1,
    borderColor: primitive.black,
  },

  basicButtonText: {
    color: primitive.black,
  },

  modalCloseColor: {
    backgroundColor: primitive.black,
  },

  modalCloseTextColor: {
    color: primitive.white,
  },
});
