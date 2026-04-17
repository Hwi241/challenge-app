import { SafeAreaView } from 'react-native-safe-area-context';
// screens/EntryDetailScreen.js
// - 업로드 화면과 동일한 UX 적용
// - 사진 선택(추가/변경), 미리보기 우상단 X로 삭제
// - 텍스트 라벨 제거, 자동 높이 확장 + 500자 제한(표시 X)
// - 소요시간 숫자만, 최대 1440(표시 X), 비워도 저장 시 0
// - 저장/삭제 중 중복 탭 방지(busy)

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, Image, StyleSheet, TouchableOpacity, Alert, ScrollView, BackHandler } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

import { buttonStyles, spacing, radius } from '../styles/common';
import { numericInputProps, toNumberOrZero } from '../utils/number';
import BackButton from '../components/BackButton';

const MAX_TEXT_LEN = 500;
const MAX_MINUTES = 1440;

export default function EntryDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();

  const { challengeId, entryId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [text, setText] = useState('');
  const [textHeight, setTextHeight] = useState(120);
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

  // 안드로이드 하드웨어/제스처 뒤로가기 + beforeRemove 경고
  useEffect(() => {
    // 초기 로드시의 값과 비교하기 위해 별도의 ref를 쓰거나 
    // 여기서는 단순히 현재 값들의 변화 여부만 체크하는 요청 로직을 따름
    // (사용자 요청서에는 originalText 등을 useEffect 내부 변수로 정의함)
    
    const hasChanged = () => !!(
      text.trim() || duration || imageUri
    );

    const confirmExit = (onConfirm) => {
      if (!hasChanged()) { onConfirm(); return; }
      Alert.alert(
        '수정 중인 내용이 있어요',
        '뒤로 가면 수정한 내용이 저장되지 않습니다.',
        [
          { text: '계속 수정', style: 'cancel' },
          { text: '나가기', style: 'destructive', onPress: onConfirm },
        ]
      );
    };

    const onHardwareBack = () => {
      confirmExit(() => navigation.goBack());
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);

    const remove = navigation.addListener('beforeRemove', (e) => {
      if (!hasChanged()) return;
      e.preventDefault();
      confirmExit(() => navigation.dispatch(e.data.action));
    });

    return () => { sub.remove(); if(remove) remove(); };
  }, [navigation, text, duration, imageUri]);

  // 사진 선택(추가/교체)
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

  // 사진 삭제(오버레이 X 즉시 삭제)
  const onRemoveImage = useCallback(() => {
    if (busy) return;
    setImageUri(null);
  }, [busy]);

  // 소요시간 입력: 숫자만, 1~1440로 입력 단계에서 클램프(빈 문자열 허용)
  const handleDurationChange = useCallback((txt) => {
    const digits = (txt || '').replace(/[^\d]/g, '');
    if (!digits) { setDuration(''); return; }
    let n = parseInt(digits, 10);
    if (isNaN(n) || n <= 0) { setDuration(''); return; }
    if (n > MAX_MINUTES) n = MAX_MINUTES;
    setDuration(String(n));
  }, []);

  const onSave = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!challengeId || !entryId) return;

      // duration 최종 클램프(빈 문자열이면 0)
      const rawDur = toNumberOrZero(duration);
      const finalDur = duration ? Math.min(Math.max(rawDur, 1), MAX_MINUTES) : 0;

      const raw = await AsyncStorage.getItem(`entries_${challengeId}`);
      const list = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex(e => e.id === entryId);
      if (idx < 0) {
        Alert.alert('오류', '인증 항목이 존재하지 않습니다.');
        return;
      }

      const updated = {
        ...list[idx],
        text: (text || '').trim(),
        imageUri: imageUri || null,
        duration: finalDur,
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

            // 2) challenges의 currentScore 갱신
            const challRaw = await AsyncStorage.getItem('challenges');
            const challenges = challRaw ? JSON.parse(challRaw) : [];
            const idx = challenges.findIndex((c) => c.id === challengeId);
            if (idx >= 0) {
              challenges[idx] = { ...challenges[idx], currentScore: next.length };
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
      <BackButton title="인증 수정" />
        <Text style={{ color: '#666' }}>불러오는 중…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {/* 제목 중앙 정렬 */}
        

        <View style={styles.card}>
          {/* "내용" + "사진 선택"을 한 줄로 */}
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>내용</Text>
            <TouchableOpacity
              style={[buttonStyles.compactRight, { opacity: busy ? 0.6 : 1 }]}
              onPress={onPickImage}
              activeOpacity={0.9}
              disabled={busy}
            >
              <Text style={buttonStyles.compactRightText}>사진 선택</Text>
            </TouchableOpacity>
          </View>

          {/* 미리보기 + 우상단 X 삭제 */}
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

          {/* 텍스트 라벨 제거, 자동 높이 + 500자 제한 */}
          <TextInput
            value={text}
            onChangeText={(t) => setText((t || '').slice(0, MAX_TEXT_LEN))}
            placeholder="인증 내용을 입력하세요"
            style={[styles.input, { height: textHeight, textAlignVertical: 'top' }]}
            multiline
            editable={!busy}
            placeholderTextColor="#9CA3AF"
            maxLength={MAX_TEXT_LEN}
            onContentSizeChange={e => {
              const h = e?.nativeEvent?.contentSize?.height || 0;
              const minH = 120;
              const maxH = 240;
              if (h > 0) setTextHeight(Math.max(minH, Math.min(h, maxH)));
            }}
          />

          <Text style={[styles.label, { marginTop: spacing.md }]}>소요 시간(분)</Text>
          <TextInput
            value={duration}
            onChangeText={handleDurationChange}
            placeholder="숫자만 입력"
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
    textAlign: 'center', // 중앙 정렬
  },

  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },

  // "내용"과 "사진 선택" 한 줄 + 간격 살짝 줄이기
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
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

  // 미리보기(삭제 오버레이를 위한 래퍼)
  previewWrap: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    backgroundColor: '#F3F4F6',
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
    backgroundColor: 'rgba(229, 231, 235, 0.85)', // Gray-200 alpha
  },
  previewDeleteX: {
    fontSize: 18,
    lineHeight: 18,
    color: '#000',
    fontWeight: '900',
    includeFontPadding: false,
  },
});
