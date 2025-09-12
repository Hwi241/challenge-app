// screens/EntryDetailScreen.js
// - 사진 삭제 가능, 소요시간 비워도 저장 가능(0으로 저장)
// - "삭제" 버튼 포함(옅은 테두리)
// - 🔧 미세 폴리싱: 저장/삭제 중 중복 탭 방지(busy), try/finally로 상태 복구

import React, { useEffect, useState, useCallback } from 'react';
import {
  SafeAreaView, View, Text, TextInput, Image, StyleSheet,
  TouchableOpacity, Alert, ScrollView
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { buttonStyles, colors, spacing, radius } from '../styles/common';
import { createNumberChangeHandler, numericInputProps, toNumberOrZero } from '../utils/number';

export default function EntryDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();

  const { challengeId, entryId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false); // 🔧 작업 중 버튼 비활성화

  const [text, setText] = useState('');
  const [duration, setDuration] = useState(''); // 빈 문자열 허용
  const [imageUri, setImageUri] = useState(null);
  const [timestamp, setTimestamp] = useState(null);

  // 로드
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!challengeId || !entryId) {
          Alert.alert('오류', '인증 정보를 찾을 수 없습니다.', [
            { text: '확인', onPress: () => navigation.goBack() },
          ]);
          return;
        }
        const raw = await AsyncStorage.getItem(`entries_${challengeId}`);
        const list = raw ? JSON.parse(raw) : [];
        const found = list.find(e => e.id === entryId);
        if (!found) {
          Alert.alert('오류', '인증 항목이 존재하지 않습니다.', [
            { text: '확인', onPress: () => navigation.goBack() },
          ]);
          return;
        }
        if (!mounted) return;

        setText(String(found.text || ''));
        setDuration(
          typeof found.duration === 'number' && found.duration > 0
            ? String(found.duration)
            : ''
        );
        setImageUri(found.imageUri || null);
        setTimestamp(found.timestamp || Date.now());
      } catch (e) {
        console.error(e);
        Alert.alert('오류', '인증 정보를 불러오지 못했습니다.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [challengeId, entryId, navigation]);

  const onRemovePhoto = useCallback(() => {
    if (!imageUri) return;
    Alert.alert('사진 삭제', '이 인증의 사진을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => setImageUri(null) },
    ]);
  }, [imageUri]);

  const onSave = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!challengeId || !entryId) return;
      const raw = await AsyncStorage.getItem(`entries_${challengeId}`);
      const list = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex(e => e.id === entryId);
      if (idx < 0) {
        Alert.alert('오류', '인증 항목이 존재하지 않습니다.');
        return;
      }

      const dur = duration === '' ? 0 : toNumberOrZero(duration);
      if (duration !== '' && dur <= 0) {
        Alert.alert('확인', '소요 시간은 1 이상의 숫자로 입력해주세요.');
        return;
      }

      const updated = {
        ...list[idx],
        text: (text || '').trim(),
        imageUri: imageUri || null,
        duration: dur,
        timestamp: timestamp || list[idx].timestamp || Date.now(),
      };
      list[idx] = updated;

      await AsyncStorage.setItem(`entries_${challengeId}`, JSON.stringify(list));
      Alert.alert('완료', '인증이 수정되었습니다.', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '인증을 저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }, [busy, challengeId, entryId, duration, imageUri, navigation, text, timestamp]);

  const onDelete = useCallback(() => {
    if (busy) return;
    Alert.alert('삭제 확인', '이 인증을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          setBusy(true);
          try {
            // 1) entries에서 삭제
            const raw = await AsyncStorage.getItem(`entries_${challengeId}`);
            const list = raw ? JSON.parse(raw) : [];
            const next = list.filter(e => e.id !== entryId);
            await AsyncStorage.setItem(`entries_${challengeId}`, JSON.stringify(next));

            // 2) challenges의 currentScore 갱신 (entries 개수 기반)
            const challRaw = await AsyncStorage.getItem('challenges');
            const challenges = challRaw ? JSON.parse(challRaw) : [];
            const idx = challenges.findIndex((c) => c.id === challengeId);
            if (idx >= 0) {
              challenges[idx] = {
                ...challenges[idx],
                currentScore: next.length,
              };
              await AsyncStorage.setItem('challenges', JSON.stringify(challenges));
              await AsyncStorage.setItem(`challenge_${challengeId}`, JSON.stringify(challenges[idx]));
            }

            Alert.alert('삭제됨', '인증이 삭제되었습니다.', [
              { text: '확인', onPress: () => navigation.goBack() },
            ]);
          } catch (e) {
            console.error(e);
            Alert.alert('오류', '인증을 삭제하지 못했습니다.');
          } finally {
            setBusy(false);
          }
        }
      }
    ]);
  }, [busy, challengeId, entryId, navigation]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: '#666' }}>불러오는 중…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={styles.screenTitle}>인증 수정</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>내용</Text>

          {!!imageUri && (
            <>
              <Image source={{ uri: imageUri }} style={styles.preview} />
              <TouchableOpacity style={styles.removeBtn} onPress={onRemovePhoto} disabled={busy}>
                <Text style={styles.removeBtnText}>사진 삭제</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.label}>텍스트</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="인증 내용을 입력하세요"
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            multiline
            placeholderTextColor="#9CA3AF"
            editable={!busy}
          />

          <Text style={[styles.label, { marginTop: spacing.md }]}>소요 시간(분)</Text>
          <TextInput
            value={duration}
            onChangeText={createNumberChangeHandler(setDuration)}
            placeholder="숫자만 입력 (비워도 저장 가능)"
            style={styles.input}
            placeholderTextColor="#9CA3AF"
            editable={!busy}
            {...numericInputProps}
          />
        </View>

        {/* 저장 / 삭제 버튼 */}
        <TouchableOpacity
          style={[buttonStyles.primary.container, { marginTop: spacing.xl, opacity: busy ? 0.6 : 1 }]}
          onPress={onSave}
          activeOpacity={0.9}
          disabled={busy}
        >
          <Text style={buttonStyles.primary.label}>저장</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[buttonStyles.outlineSoft.container, { marginTop: spacing.md, opacity: busy ? 0.6 : 1 }]}
          onPress={onDelete}
          activeOpacity={0.9}
          disabled={busy}
        >
          <Text style={buttonStyles.outlineSoft.label}>삭제</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111',
    marginBottom: spacing.lg,
  },

  // 로컬 카드(기존 카드 느낌)
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
    marginBottom: spacing.md,
  },

  label: { fontSize: 13, color: '#525252', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111',
  },

  preview: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    backgroundColor: '#F3F4F6',
  },
  removeBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: spacing.md,
  },
  removeBtnText: { color: '#111', fontWeight: '700', fontSize: 12 },
});
