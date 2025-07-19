import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  TextInput,
  Button,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function EntryDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { challengeId, entryId } = route.params;
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [duration, setDuration] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const key = `entries_${challengeId}`;
        const stored = await AsyncStorage.getItem(key);
        const arr = stored ? JSON.parse(stored) : [];
        const entry = arr.find(e => e.id === entryId);
        if (entry) {
          setText(entry.text);
          setImageUri(entry.imageUri || null);
          setDuration(entry.duration?.toString() || '');
        }
      } catch (error) {
        console.error('Entry 불러오기 실패:', error);
        Alert.alert('오류', '인증 정보를 불러오지 못했습니다.');
      }
    })();
  }, [challengeId, entryId]);

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 오류', '사진 접근 권한이 필요합니다.');
      }
    })();
  }, []);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });
      if (!result.canceled) {
        const uri = result.assets?.[0]?.uri ?? result.uri;
        setImageUri(uri);
      }
    } catch (error) {
      console.error('이미지 선택 실패:', error);
      Alert.alert('오류', '이미지 선택에 실패했습니다.');
    }
  };

  const removeImage = () => setImageUri(null);

const saveEntry = async () => {
  if (!text.trim()) {
    Alert.alert('내용을 입력해주세요.');
    return;
  }

  const minutes = parseInt(duration);
  const hasValidDuration = !isNaN(minutes) && minutes > 0;

  try {
    const key = `entries_${challengeId}`;
    const stored = await AsyncStorage.getItem(key);
    const arr = stored ? JSON.parse(stored) : [];

    const updated = arr.map(e =>
      e.id === entryId
        ? {
            ...e,
            text: text.trim(),
            imageUri,
            ...(hasValidDuration ? { duration: minutes } : {}),
          }
        : e
    );

    await AsyncStorage.setItem(key, JSON.stringify(updated));

    Alert.alert('저장 완료', '인증이 수정되었습니다.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  } catch (error) {
    console.error('Entry 수정 실패:', error);
    Alert.alert('오류', '수정 저장에 실패했습니다.');
  }
};


  const deleteEntry = async () => {
    try {
      const key = `entries_${challengeId}`;
      const stored = await AsyncStorage.getItem(key);
      const arr = stored ? JSON.parse(stored) : [];
      const filtered = arr.filter(e => e.id !== entryId);
      await AsyncStorage.setItem(key, JSON.stringify(filtered));

      const chalKey = 'challenges';
      const storedChals = await AsyncStorage.getItem(chalKey);
      const parsedChals = storedChals ? JSON.parse(storedChals) : [];
      const updatedChals = parsedChals.map(c =>
        c.id === challengeId
          ? {
              ...c,
              currentScore: Math.max((c.currentScore || 1) - 1, 0),
              completed: Math.max((c.currentScore || 1) - 1, 0) >= c.targetScore,
            }
          : c
      );
      await AsyncStorage.setItem(chalKey, JSON.stringify(updatedChals));

      navigation.goBack();
    } catch (error) {
      console.error('Entry 삭제 실패:', error);
      Alert.alert('오류', '삭제에 실패했습니다.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>      
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TextInput
          style={styles.input}
          placeholder="인증 내용을 수정하세요"
          value={text}
          onChangeText={setText}
          multiline
        />

        <TextInput
          style={styles.input}
          placeholder="소요 시간 (분)"
          value={duration}
          onChangeText={setDuration}
          keyboardType="numeric"
        />

        {imageUri ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: imageUri }} style={styles.image} />
            <View style={styles.previewButtons}>
              <Button title="사진 변경" onPress={pickImage} />
              <Button title="사진 제거" onPress={removeImage} color="#dc3545" />
            </View>
          </View>
        ) : (
          <Button title="사진 선택하기" onPress={pickImage} />
        )}

        <View style={styles.actionButtons}>
          <Button title="저장" onPress={saveEntry} />
          <Button title="삭제" onPress={deleteEntry} color="#dc3545" />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, padding: 20 },
  input: {
    minHeight: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    textAlignVertical: 'top',
  },
  previewContainer: { marginBottom: 10 },
  image: { width: '100%', height: 200, marginBottom: 5, borderRadius: 5 },
  previewButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
});
