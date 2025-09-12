// screens/UploadScreen.js
// - UI 동일 유지
// - 🔧 폴리싱: 중복 탭 방지(busy), try/finally로 상태 복구

import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, Image, StyleSheet, TouchableOpacity, Alert, ScrollView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';

import { buttonStyles, spacing, radius } from '../styles/common';
import { numericInputProps, createNumberChangeHandler, toNumberOrZero } from '../utils/number';

// 로컬 팔레트(기존 흑/백/회색 톤 유지)
const PALETTE = {
  white: '#FFFFFF',
  gray50: '#FAFAFA',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray400: '#9CA3AF',
  gray600: '#525252',
  gray800: '#111111',
};

export default function UploadScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { challengeId } = route.params || {};

  const [text, setText] = useState('');
  const [duration, setDuration] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [busy, setBusy] = useState(false); // 🔧 제출/저장 중 보호

  // 권한 요청 + 갤러리에서 이미지 선택
  const onPickImage = useCallback(async () => {
    if (busy) return;
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
      console.error(e);
      Alert.alert('오류', '사진 선택 중 문제가 발생했습니다.');
    }
  }, [busy]);

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
      const dur = toNumberOrZero(duration);
      if (duration && dur <= 0) {
        Alert.alert('확인', '소요 시간은 1 이상의 숫자로 입력해주세요.');
        return;
      }

      const entry = {
        id: `en_${Date.now()}`,
        text: trimmed,
        imageUri: imageUri || null,
        duration: duration ? dur : 0,
        timestamp: Date.now(),
      };

      // entries 저장
      const raw = await AsyncStorage.getItem(`entries_${challengeId}`);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(entry);
      await AsyncStorage.setItem(`entries_${challengeId}`, JSON.stringify(list));

      // challenge의 currentScore = entries 개수로 갱신
      const challRaw = await AsyncStorage.getItem('challenges');
      const challenges = challRaw ? JSON.parse(challRaw) : [];
      const idx = challenges.findIndex((c) => c.id === challengeId);
      let nextTitle, nextStart, nextEnd, nextGoal, nextReward;
      if (idx >= 0) {
        challenges[idx] = {
          ...challenges[idx],
          currentScore: list.length,
        };
        await AsyncStorage.setItem('challenges', JSON.stringify(challenges));
        await AsyncStorage.setItem(`challenge_${challengeId}`, JSON.stringify(challenges[idx]));
        nextTitle = challenges[idx]?.title;
        nextStart = challenges[idx]?.startDate;
        nextEnd = challenges[idx]?.endDate;
        nextGoal = challenges[idx]?.goalScore;
        nextReward = challenges[idx]?.reward;
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
      <Text style={styles.screenTitle}>인증 업로드</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>내용</Text>

        {/* 상단 오른쪽: 작은 "사진 선택" 버튼 */}
        <View style={styles.rowRight}>
          <TouchableOpacity
            style={[buttonStyles.compactRight, { opacity: busy ? 0.6 : 1 }]}
            onPress={onPickImage}
            activeOpacity={0.9}
            disabled={busy}
          >
            <Text style={buttonStyles.compactRightText}>사진 선택</Text>
          </TouchableOpacity>
        </View>

        {!!imageUri && (
          <Image source={{ uri: imageUri }} style={styles.preview} />
        )}

        <Text style={styles.label}>텍스트</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="인증 내용을 입력하세요"
          style={[styles.input, { height: 100, textAlignVertical: 'top', opacity: busy ? 0.75 : 1 }]}
          multiline
          editable={!busy}
          placeholderTextColor={PALETTE.gray400}
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>소요 시간(분)</Text>
        <TextInput
          value={duration}
          onChangeText={createNumberChangeHandler(setDuration)}
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
  screenTitle: { fontSize: 20, fontWeight: '800', color: PALETTE.gray800, marginBottom: spacing.lg },

  // 카드(기존 cardStyles.container 대체)
  card: {
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.gray200,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: PALETTE.gray800, marginBottom: spacing.md },

  label: { fontSize: 13, color: PALETTE.gray600, marginBottom: 6 },
  input: {
    backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.gray200,
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: PALETTE.gray800,
  },
  rowRight: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.sm },
  preview: {
    width: '100%', height: 200, borderRadius: radius.md,
    marginBottom: spacing.md, backgroundColor: PALETTE.gray100,
  },
});
