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
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function UploadScreen({ route, navigation }) {
  const { challengeId } = route.params;
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [duration, setDuration] = useState('');
  const insets = useSafeAreaInsets();

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
    } catch (err) {
      console.error(err);
      Alert.alert('오류', '이미지 선택에 실패했습니다.');
    }
  };

  const removeImage = () => setImageUri(null);

  const submit = async () => {
    if (!text.trim() && !imageUri) {
      Alert.alert('입력 필요', '글 또는 사진 중 하나는 입력해야 합니다.');
      return;
    }

    const minutes = parseInt(duration);
    const hasValidDuration = !isNaN(minutes) && minutes > 0;

    try {
      const entryKey = `entries_${challengeId}`;
      const raw = await AsyncStorage.getItem(entryKey);
      const list = raw ? JSON.parse(raw) : [];

      const newEntry = {
        id: Date.now().toString(),
        text: text.trim(),
        imageUri,
        timestamp: new Date().toISOString(),
      };
      if (hasValidDuration) {
        newEntry.duration = minutes;
      }

      const newList = [...list, newEntry];
      await AsyncStorage.setItem(entryKey, JSON.stringify(newList));

      const chalKey = 'challenges';
      const rawChals = await AsyncStorage.getItem(chalKey);
      const chals = rawChals ? JSON.parse(rawChals) : [];
      const updated = chals.map(c =>
        c.id === challengeId
          ? {
              ...c,
              currentScore: (c.currentScore || 0) + 1,
              completed: (c.currentScore || 0) + 1 >= c.targetScore,
            }
          : c
      );
      await AsyncStorage.setItem(chalKey, JSON.stringify(updated));

      navigation.goBack();
    } catch (err) {
      console.error(err);
      Alert.alert('오류', '인증 기록 저장에 실패했습니다.');
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView contentContainerStyle={styles.inner}>
          <TextInput
            style={styles.input}
            placeholder="인증할 글을 입력하세요"
            value={text}
            onChangeText={setText}
            multiline
          />

          <TextInput
            style={styles.input}
            placeholder="도전에 소요된 시간 (분)"
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
            <View style={styles.fileButton}>
              <Button title="사진 선택하기" onPress={pickImage} />
            </View>
          )}

          <View style={styles.submitButton}>
            <Button
              title="제출하기"
              onPress={submit}
              disabled={!text.trim() && !imageUri}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { padding: 20 },
  input: {
    minHeight: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    textAlignVertical: 'top',
  },
  previewContainer: { marginBottom: 15 },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 5,
    marginBottom: 10,
  },
  previewButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fileButton: { marginBottom: 15 },
  submitButton: { marginTop: 20 },
});
