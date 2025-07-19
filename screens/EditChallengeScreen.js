import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function EditChallengeScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { challenge } = route.params;

  const [title, setTitle] = useState(challenge.title);
  const [startDate, setStartDate] = useState(challenge.startDate);
  const [endDate, setEndDate] = useState(challenge.endDate);
  const [targetScore, setTargetScore] = useState(challenge.targetScore.toString());
  const [reward, setReward] = useState(challenge.reward);

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

  const validate = () => {
    if (!title.trim()) {
      Alert.alert('제목을 입력해주세요.');
      return false;
    }
    if (!startDate || !endDate) {
      Alert.alert('시작일과 종료일을 모두 선택해주세요.');
      return false;
    }
    if (new Date(endDate) < new Date(startDate)) {
      Alert.alert('종료일은 시작일 이후여야 합니다.');
      return false;
    }
    const numScore = Number(targetScore);
    if (isNaN(numScore) || numScore <= 0) {
      Alert.alert('목표 점수는 1 이상의 숫자여야 합니다.');
      return false;
    }
    return true;
  };

  const saveEditedChallenge = async () => {
    if (!validate()) return;
    try {
      const raw = await AsyncStorage.getItem('challenges');
      const list = raw ? JSON.parse(raw) : [];
      const updated = list.map(item =>
        item.id === challenge.id
          ? {
              ...item,
              title: title.trim(),
              startDate,
              endDate,
              targetScore: Number(targetScore),
              reward: reward.trim(),
            }
          : item
      );
      await AsyncStorage.setItem('challenges', JSON.stringify(updated));
      Alert.alert('저장 완료', '챌린지가 업데이트되었습니다.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('수정 실패:', error);
      Alert.alert('수정 실패', '다시 시도해주세요.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>      
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.heading}>도전 수정</Text>

        <Text style={styles.label}>제목</Text>
        <TextInput
          style={styles.input}
          placeholder="제목"
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
          placeholder="목표 점수"
          value={targetScore}
          onChangeText={setTargetScore}
          keyboardType="numeric"
        />

        <Text style={styles.label}>보상 내용</Text>
        <TextInput
          style={styles.input}
          placeholder="보상 내용"
          value={reward}
          onChangeText={setReward}
        />

        <TouchableOpacity style={styles.saveButton} onPress={saveEditedChallenge}>
          <Text style={styles.saveButtonText}>저장하기</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, padding: 20, justifyContent: 'center' },
  heading: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  label: { fontWeight: 'bold', marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 12,
    marginTop: 6,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 12,
    marginTop: 6,
  },
  saveButton: {
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
