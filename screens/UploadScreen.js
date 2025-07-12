// screens/UploadScreen.js

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

export default function UploadScreen({ route, navigation }) {
  const { challengeId } = route.params;
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const insets = useSafeAreaInsets();

  // 권한 요청
  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 오류', '사진 접근 권한이 필요합니다.');
      }
    })();
  }, []);

  // 사진 선택
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });
      if (!result.canceled) {
        const uri = result.assets?.[0]?.uri ?? result.uri;
        setImageUri(uri);
      }
    } catch (error) {
      console.error('이미지 선택 실패:', error);
    }
  };

  // 사진 제거
  const removeImage = () => setImageUri(null);

  // 제출
  const submit = async () => {
    try {
      // Entry 저장
      const entryKey = `entries_${challengeId}`;
      const storedEntries = await AsyncStorage.getItem(entryKey);
      const entries = storedEntries ? JSON.parse(storedEntries) : [];
      const newEntry = {
        id: Date.now().toString(),
        text,
        imageUri,
        timestamp: new Date().toISOString(),
      };
      await AsyncStorage.setItem(entryKey, JSON.stringify([newEntry, ...entries]));

      // 챌린지 점수 업데이트
      const chalKey = 'challenges';
      const storedChals = await AsyncStorage.getItem(chalKey);
      const parsedChals = storedChals ? JSON.parse(storedChals) : [];
      const updatedChals = parsedChals.map(c =>
        c.id === challengeId
          ? {
              ...c,
              currentScore: (c.currentScore || 0) + 1,
              completed: (c.currentScore || 0) + 1 >= c.targetScore,
            }
          : c
      );
      await AsyncStorage.setItem(chalKey, JSON.stringify(updatedChals));

      navigation.goBack();
    } catch (error) {
      console.error('인증 기록 저장 실패:', error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TextInput
          style={styles.input}
          placeholder="인증할 글을 입력하세요"
          value={text}
          onChangeText={setText}
          multiline
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

        <View style={styles.submitButton}>
          <Button
            title="제출하기"
            onPress={submit}
            disabled={!text && !imageUri}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  inner: {
    flex: 1,
    padding: 20,
  },
  input: {
    flex: 1,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    textAlignVertical: 'top',
  },
  previewContainer: {
    marginBottom: 10,
  },
  image: {
    width: '100%',
    height: 200,
    marginBottom: 5,
    borderRadius: 5,
  },
  previewButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  submitButton: {
    marginTop: 10,
  },
});
