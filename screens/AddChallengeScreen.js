import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Button,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function AddChallengeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetScore, setTargetScore] = useState('');
  const [reward, setReward] = useState('');

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const handleStartDateChange = (event, selectedDate) => {
    setShowStartPicker(false);
    if (selectedDate) {
      const iso = selectedDate.toISOString().split('T')[0];
      setStartDate(iso);
    }
  };

  const handleEndDateChange = (event, selectedDate) => {
    setShowEndPicker(false);
    if (selectedDate) {
      const iso = selectedDate.toISOString().split('T')[0];
      setEndDate(iso);
    }
  };

  const saveChallenge = async () => {
    if (!title.trim()) {
      Alert.alert('제목을 입력해주세요.');
      return;
    }
    if (!startDate || !endDate) {
      Alert.alert('시작일과 종료일을 모두 선택해주세요.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      Alert.alert('종료일은 시작일 이후여야 합니다.');
      return;
    }

    const numScore = Number(targetScore);
    if (isNaN(numScore) || numScore <= 0) {
      Alert.alert('목표 점수는 1 이상의 숫자여야 합니다.');
      return;
    }

    try {
      const raw = await AsyncStorage.getItem('challenges');
      const list = raw ? JSON.parse(raw) : [];
      const newChallenge = {
        id: Date.now().toString(),
        title: title.trim(),
        startDate,
        endDate,
        targetScore: numScore,
        reward: reward.trim(),
        currentScore: 0,
        completed: false,
      };
      const updated = [...list, newChallenge];
      await AsyncStorage.setItem('challenges', JSON.stringify(updated));
      Alert.alert('저장 완료', '새로운 챌린지가 추가되었습니다.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('저장 실패', error);
      Alert.alert('저장 실패', '다시 시도해주세요.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>      
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View>
          <Text style={styles.label}>도전 제목</Text>
          <TextInput
            style={styles.input}
            placeholder="제목 입력"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>시작일</Text>
          <Pressable onPress={() => setShowStartPicker(true)} style={styles.dateInput}>
            <Text>{startDate || '날짜 선택'}</Text>
          </Pressable>
          {showStartPicker && (
            <DateTimePicker
              value={startDate ? new Date(startDate) : new Date()}
              mode="date"
              display="default"
              onChange={handleStartDateChange}
            />
          )}

          <Text style={styles.label}>종료일</Text>
          <Pressable onPress={() => setShowEndPicker(true)} style={styles.dateInput}>
            <Text>{endDate || '날짜 선택'}</Text>
          </Pressable>
          {showEndPicker && (
            <DateTimePicker
              value={endDate ? new Date(endDate) : new Date()}
              mode="date"
              display="default"
              onChange={handleEndDateChange}
            />
          )}

          <Text style={styles.label}>목표 점수</Text>
          <TextInput
            style={styles.input}
            placeholder="숫자 입력"
            value={targetScore}
            onChangeText={setTargetScore}
            keyboardType="numeric"
          />

          <Text style={styles.label}>보상</Text>
          <TextInput
            style={styles.input}
            placeholder="보상 내용 입력"
            value={reward}
            onChangeText={setReward}
          />

          <View style={styles.buttonWrapper}>
            <Button title="도전 저장하기" onPress={saveChallenge} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, padding: 20, justifyContent: 'center' },
  label: { fontWeight: 'bold', marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginTop: 6,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 12,
    marginTop: 6,
  },
  buttonWrapper: { marginTop: 24 },
});
