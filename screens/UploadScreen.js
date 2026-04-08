// screens/UploadScreen.js
// - 제목 중앙, "내용"+“사진 선택” 한 줄, "텍스트" 라벨 제거
// - 인증내용 500자 제한(표시 X), 입력에 따라 자동 높이 확장
// - 소요시간 숫자만, 최대 1440분(표시 X), 입력/저장 시 클램프
// - 사진 미리보기 우상단에 반투명 회색 원형 X 버튼으로 삭제
// - 🔧 폴리싱: 중복 탭 방지(busy), try/finally로 상태 복구

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, Image, StyleSheet, TouchableOpacity, Alert, ScrollView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';

import { buttonStyles, spacing, radius } from '../styles/common';
import { numericInputProps, toNumberOrZero } from '../utils/number';

const PALETTE = {
  white: '#FFFFFF',
  gray50: '#FAFAFA',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray400: '#9CA3AF',
  gray600: '#525252',
  gray800: '#111111',
};

const MAX_TEXT_LEN = 500;
const MAX_MINUTES = 1440;

export default function UploadScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { challengeId } = route.params || {};

  const [text, setText] = useState('');
  const [textHeight, setTextHeight] = useState(140); // 자동 확장용 높이 상태
  const [duration, setDuration] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [busy, setBusy] = useState(false);
  const [challengeTitle, setChallengeTitle] = useState('');

  // 화면 포커스될 때마다 state 초기화
  useFocusEffect(
    useCallback(() => {
      setText('');
      setTextHeight(140);
      setDuration('');
      setImageUri(null);
      setBusy(false);

      if (challengeId) {
        AsyncStorage.getItem('challenges').then(raw => {
          const list = raw ? JSON.parse(raw) : [];
          const found = list.find(c => String(c.id) === String(challengeId));
          if (found) setChallengeTitle(found.title || '');
        }).catch(() => {});
      }
    }, [challengeId])
  );

  // 뒤로가기 시 경고
  useEffect(() => {
    const onBack = navigation.addListener('beforeRemove', (e) => {
      const hasContent = text.trim() || imageUri || duration;
      if (!hasContent) return;
      e.preventDefault();
      Alert.alert(
        '작성 중인 내용이 있어요',
        '뒤로 가면 작성한 내용이 삭제됩니다.',
        [
          { text: '계속 작성', style: 'cancel' },
          { text: '나가기', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]
      );
    });
    return onBack;
  }, [navigation, text, imageUri, duration]);

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

  const onSubmit = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!challengeId) {
        Alert.alert('오류', '도전 정보를 찾을 수 없습니다.');
        return;
      }
      const trimmed = (text || '').trim();

      if (!trimmed && !imageUri) {
        Alert.alert('확인', '텍스트 또는 사진 중 하나는 입력/선택해주세요.');
        return;
      }

      // 최종 클램프
      const rawDur = toNumberOrZero(duration);
      const finalDur = duration ? Math.min(Math.max(rawDur, 1), MAX_MINUTES) : 0;

      const entry = {
        id: `en_${Date.now()}`,
        text: trimmed,
        imageUri: imageUri || null,
        duration: finalDur,
        timestamp: Date.now(),
      };

      // entries 저장
      const raw = await AsyncStorage.getItem(`entries_${challengeId}`);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(entry);
      await AsyncStorage.setItem(`entries_${challengeId}`, JSON.stringify(list));

      // challenge의 currentScore 갱신
      const challRaw = await AsyncStorage.getItem('challenges');
      const challenges = challRaw ? JSON.parse(challRaw) : [];
      const idx = challenges.findIndex((c) => c.id === challengeId);
      let nextTitle, nextStart, nextEnd, nextGoal, nextReward;
      if (idx >= 0) {
        challenges[idx] = { ...challenges[idx], currentScore: list.length };
        await AsyncStorage.setItem('challenges', JSON.stringify(challenges));
        await AsyncStorage.setItem(`challenge_${challengeId}`, JSON.stringify(challenges[idx]));
        nextTitle = challenges[idx]?.title;
        nextStart = challenges[idx]?.startDate;
        nextEnd = challenges[idx]?.endDate;
        nextGoal = challenges[idx]?.goalScore;
        nextReward = challenges[idx]?.reward;
      }

      if (Math.random() < 0.3) {
        console.log('[AD_INTERSTITIAL_PLACEHOLDER] 전면광고 표시 위치');
      }

      Alert.alert('완료', '인증이 등록되었습니다.', [
        {
          text: '확인',
          onPress: () =>
            navigation.replace('EntryList', {
              challengeId,
              title: nextTitle,
              startDate: nextStart,
              endDate: nextEnd,
              targetScore: nextGoal,
              reward: nextReward,
            }),
        },
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '인증을 저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }, [busy, challengeId, text, imageUri, duration, navigation]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* 제목 중앙 정렬 */}
      <Text style={styles.screenTitle}>인증 업로드</Text>

      {!!challengeTitle && (
        <View style={styles.titleBox}>
          <Text style={styles.titleBoxText}>{challengeTitle}</Text>
        </View>
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
          value={text}
          onChangeText={(t) => setText((t || '').slice(0, MAX_TEXT_LEN))}
          placeholder="인증 내용을 입력하세요"
          style={[styles.input, { height: textHeight, textAlignVertical: 'top', opacity: busy ? 0.75 : 1 }]}
          multiline
          editable={!busy}
          placeholderTextColor={PALETTE.gray400}
          maxLength={MAX_TEXT_LEN}
          onContentSizeChange={e => {
            const h = e?.nativeEvent?.contentSize?.height || 0;
            const minH = 120; // 최소
            const maxH = 240; // 최대 (너무 커지지 않게)
            if (h > 0) setTextHeight(Math.max(minH, Math.min(h, maxH)));
          }}
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>소요 시간(분)</Text>
        <TextInput
          value={duration}
          onChangeText={handleDurationChange}
          placeholder="숫자만 입력"
          style={[styles.input, { opacity: busy ? 0.75 : 1 }]}
          editable={!busy}
          placeholderTextColor={PALETTE.gray400}
          {...numericInputProps}
        />
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
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, backgroundColor: PALETTE.gray50 },
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

  },
});
) 반투명
  },
  previewDeleteX: {
    fontSize: 18,
    lineHeight: 18,
    color: '#000', // 검은색 X
    fontWeight: '900',
    includeFontPadding: false,
  },
});
