// screens/UploadScreen.js
import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, Image, StyleSheet, TouchableOpacity, Alert, ScrollView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';

import { buttonStyles, colors, spacing, radius, cardStyles } from '../styles/common';
import { numericInputProps, createNumberChangeHandler, toNumberOrZero } from '../utils/number';

export default function UploadScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { challengeId } = route.params || {};

  const [text, setText] = useState('');
  const [duration, setDuration] = useState('');
  const [imageUri, setImageUri] = useState(null);

  // 권한 요청 + 갤러리에서 이미지 선택
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

  const onSubmit = useCallback(async () => {
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
    if (idx >= 0) {
      challenges[idx] = {
        ...challenges[idx],
        currentScore: list.length,
      };
      await AsyncStorage.setItem('challenges', JSON.stringify(challenges));
      await AsyncStorage.setItem(`challenge_${challengeId}`, JSON.stringify(challenges[idx]));
    }

    Alert.alert('완료', '인증이 등록되었습니다.', [
      {
        text: '확인',
        onPress: () =>
          navigation.replace('EntryList', {
            challengeId,
            title: challenges[idx]?.title,
            startDate: challenges[idx]?.startDate,
            endDate: challenges[idx]?.endDate,
            targetScore: challenges[idx]?.goalScore,
            reward: challenges[idx]?.reward,
          }),
      },
    ]);
  }, [challengeId, text, imageUri, duration, navigation]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.screenTitle}>인증 업로드</Text>

      <View style={cardStyles.container}>
        <Text style={cardStyles.title}>내용</Text>

        {/* 상단 오른쪽: 작은 "사진 선택" 버튼 */}
        <View style={styles.rowRight}>
          <TouchableOpacity style={buttonStyles.compactRight} onPress={onPickImage}>
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
          style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
          multiline
          placeholderTextColor={colors.gray400}
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>소요 시간(분)</Text>
        <TextInput
          value={duration}
          onChangeText={createNumberChangeHandler(setDuration)}
          placeholder="숫자만 입력"
          style={styles.input}
          placeholderTextColor={colors.gray400}
          {...numericInputProps}
        />
      </View>

      <TouchableOpacity style={[buttonStyles.primary, { marginTop: spacing.xl }]} onPress={onSubmit}>
        <Text style={buttonStyles.primaryText}>제출하기</Text>
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
