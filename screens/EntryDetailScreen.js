// screens/EntryDetailScreen.js
// - 사진 변경/삭제: 우측 상단 작은 검은 버튼 2개
// - 저장/삭제 버튼: 검은색 버튼
// - 저장/삭제 시 entries & challenges 동기화 후 인증목록으로 복귀
// - 텍스트 또는 사진 중 하나만 있으면 저장 가능(소요 시간은 선택 사항)

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Image, ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import { buttonStyles, colors, spacing, radius, cardStyles } from '../styles/common';
import { numericInputProps, createNumberChangeHandler, toNumberOrZero } from '../utils/number';

export default function EntryDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { challengeId, entryId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState(null);

  // form
  const [text, setText] = useState('');
  const [duration, setDuration] = useState(''); // 선택 입력
  const [imageUri, setImageUri] = useState(null);

  // challenge meta for return
  const [challengeMeta, setChallengeMeta] = useState(null);

  // 초기 로드
  useEffect(() => {
    (async () => {
      try {
        const challRaw = await AsyncStorage.getItem('challenges');
        const challenges = challRaw ? JSON.parse(challRaw) : [];
        const ch = challenges.find((c) => c.id === challengeId);
        setChallengeMeta(ch || null);

        const raw = await AsyncStorage.getItem(`entries_${challengeId}`);
        const list = raw ? JSON.parse(raw) : [];
        const current = list.find((e) => e.id === entryId);
        if (!current) {
          Alert.alert('오류', '인증 정보를 찾을 수 없습니다.', [
            { text: '확인', onPress: () => navigation.goBack() },
          ]);
          return;
        }
        setEntry(current);
        setText(String(current.text ?? ''));
        setDuration(
          typeof current.duration === 'number' && current.duration > 0
            ? String(current.duration)
            : ''
        );
        setImageUri(current.imageUri ?? null);
      } catch (e) {
        console.error(e);
        Alert.alert('오류', '인증 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [challengeId, entryId, navigation]);

  const goEntryList = useCallback(() => {
    navigation.replace('EntryList', {
      challengeId,
      title: challengeMeta?.title,
      startDate: challengeMeta?.startDate,
      endDate: challengeMeta?.endDate,
      targetScore: challengeMeta?.goalScore,
      reward: challengeMeta?.reward,
    });
  }, [navigation, challengeId, challengeMeta]);

  // 사진 변경
  const onPickImage = useCallback(async () => {
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
  }, []);

  // 사진 삭제
  const onRemoveImage = useCallback(() => {
    if (!imageUri) return;
    Alert.alert('사진 삭제', '현재 사진을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => setImageUri(null) },
    ]);
  }, [imageUri]);

  // 저장
  const onSave = useCallback(async () => {
    if (!entry) return;
    const trimmed = (text || '').trim();

    // 텍스트 또는 사진 중 최소 하나 필요
    if (!trimmed && !imageUri) {
      Alert.alert('확인', '텍스트 또는 사진 중 하나는 입력/선택해주세요.');
      return;
    }

    // 시간은 선택 입력: 값이 있을 때만 유효성 체크
    const dur = toNumberOrZero(duration);
    if (duration !== '' && dur <= 0) {
      Alert.alert('확인', '소요 시간은 1 이상의 숫자로 입력해주세요.');
      return;
    }

    const raw = await AsyncStorage.getItem(`entries_${challengeId}`);
    const list = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((e) => e.id === entryId);
    if (idx < 0) {
      Alert.alert('오류', '수정할 인증을 찾을 수 없습니다.');
      return;
    }
    const updated = {
      ...list[idx],
      text: trimmed,
      imageUri: imageUri || null,
      duration: duration !== '' ? dur : 0, // 미입력이면 0으로 저장
      // timestamp는 수정하지 않음
    };
    list[idx] = updated;
    await AsyncStorage.setItem(`entries_${challengeId}`, JSON.stringify(list));

    // 점수 동기화(엔트리 수 기준)
    const challRaw = await AsyncStorage.getItem('challenges');
    const challenges = challRaw ? JSON.parse(challRaw) : [];
    const cidx = challenges.findIndex((c) => c.id === challengeId);
    if (cidx >= 0) {
      challenges[cidx] = { ...challenges[cidx], currentScore: list.length };
      await AsyncStorage.setItem('challenges', JSON.stringify(challenges));
      await AsyncStorage.setItem(`challenge_${challengeId}`, JSON.stringify(challenges[cidx]));
    }

    Alert.alert('완료', '인증이 수정되었습니다.', [
      { text: '확인', onPress: goEntryList },
    ]);
  }, [entry, text, imageUri, duration, challengeId, entryId, goEntryList]);

  // 삭제
  const onDelete = useCallback(async () => {
    Alert.alert('삭제 확인', '이 인증을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          const raw = await AsyncStorage.getItem(`entries_${challengeId}`);
          const list = raw ? JSON.parse(raw) : [];
          const next = list.filter((e) => e.id !== entryId);
          await AsyncStorage.setItem(`entries_${challengeId}`, JSON.stringify(next));

          // 점수 동기화
          const challRaw = await AsyncStorage.getItem('challenges');
          const challenges = challRaw ? JSON.parse(challRaw) : [];
          const cidx = challenges.findIndex((c) => c.id === challengeId);
          if (cidx >= 0) {
            challenges[cidx] = { ...challenges[cidx], currentScore: next.length };
            await AsyncStorage.setItem('challenges', JSON.stringify(challenges));
            await AsyncStorage.setItem(`challenge_${challengeId}`, JSON.stringify(challenges[cidx]));
          }

          Alert.alert('삭제됨', '인증이 삭제되었습니다.', [
            { text: '확인', onPress: goEntryList },
          ]);
        }
      }
    ]);
  }, [challengeId, entryId, goEntryList]);

  if (loading) {
    return (
      <ScrollView contentContainerStyle={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.gray500 }}>불러오는 중…</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.screenTitle}>인증 수정</Text>

      <View style={cardStyles.container}>
        <Text style={cardStyles.title}>내용</Text>

        {/* 우측 상단: 사진 변경/삭제 (작은 검은 버튼) */}
        <View style={styles.rowRight}>
          <TouchableOpacity style={buttonStyles.compactRight} onPress={onPickImage}>
            <Text style={buttonStyles.compactRightText}>사진 변경</Text>
          </TouchableOpacity>
          {imageUri && (
            <TouchableOpacity style={[buttonStyles.compactRight, { marginLeft: 8 }]} onPress={onRemoveImage}>
              <Text style={buttonStyles.compactRightText}>사진 삭제</Text>
            </TouchableOpacity>
          )}
        </View>

        {!!imageUri && <Image source={{ uri: imageUri }} style={styles.preview} />}

        <Text style={styles.label}>텍스트</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="인증 내용을 입력하세요"
          style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
          multiline
          placeholderTextColor={colors.gray400}
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>소요 시간(분) (선택)</Text>
        <TextInput
          value={duration}
          onChangeText={createNumberChangeHandler(setDuration)}
          placeholder="입력하지 않아도 됩니다"
          style={styles.input}
          placeholderTextColor={colors.gray400}
          {...numericInputProps}
        />
      </View>

      {/* 하단 액션: 검은 버튼 2개 */}
      <TouchableOpacity style={[buttonStyles.primary, { marginTop: spacing.xl }]} onPress={onSave}>
        <Text style={buttonStyles.primaryText}>저장</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[buttonStyles.primary, { marginTop: spacing.sm }]} onPress={onDelete}>
        <Text style={buttonStyles.primaryText}>삭제</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, backgroundColor: colors.gray50 },
  screenTitle: { fontSize: 20, fontWeight: '800', color: colors.gray800, marginBottom: spacing.lg },
  label: { fontSize: 13, color: colors.gray600, marginBottom: 6 },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200,
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: colors.gray800,
  },
  rowRight: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.sm },
  preview: {
    width: '100%', height: 200, borderRadius: radius.md,
    marginBottom: spacing.md, backgroundColor: colors.gray100,
  },
});
