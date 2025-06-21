import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AddChallengeScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetScore, setTargetScore] = useState('');
  const [reward, setReward] = useState('');

const saveChallenge = async () => {
  // 1) 제목 검사 (공백 제거)
  if (!title.trim()) {
    Alert.alert('제목을 입력해주세요!');
    return;
  }

  // 2) 날짜 형식 검사 (있으면)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (startDate && !dateRegex.test(startDate)) {
    Alert.alert('시작일은 YYYY-MM-DD 형식으로 입력해주세요.');
    return;
  }
  if (endDate && !dateRegex.test(endDate)) {
    Alert.alert('종료일은 YYYY-MM-DD 형식으로 입력해주세요.');
    return;
  }

  // 3) 목표 점수 숫자 검사
  if (targetScore && isNaN(Number(targetScore))) {
    Alert.alert('목표 점수는 숫자로 입력해주세요.');
    return;
  }

  // 4) 기존 저장 로직 수행
  try {
    const stored = await AsyncStorage.getItem('challenges');
    const parsed = stored ? JSON.parse(stored) : [];

    const newChallenge = {
      id: Date.now().toString(),
      title,
      startDate,
      endDate,
      targetScore: Number(targetScore), // 숫자화!
      reward,
    };

    const newChallenges = [...parsed, newChallenge];
    await AsyncStorage.setItem('challenges', JSON.stringify(newChallenges));

    Alert.alert('저장 완료!', '', [
      {
        text: 'OK',
        onPress: () => navigation.goBack(),
      },
    ]);

    // 저장 후 폼 초기화
    setTitle('');
    setStartDate('');
    setEndDate('');
    setTargetScore('');
    setReward('');

  } catch (error) {
    Alert.alert('저장 실패', error.message);
  }
};


  return (
    <View style={styles.container}>
      <Text style={styles.label}>도전 제목:</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="제목 입력" />

      <Text style={styles.label}>시작일:</Text>
      <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />

      <Text style={styles.label}>종료일:</Text>
      <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" />

      <Text style={styles.label}>목표 점수:</Text>
      <TextInput style={styles.input} value={targetScore} onChangeText={setTargetScore} placeholder="숫자 입력" keyboardType="numeric" />

      <Text style={styles.label}>보상:</Text>
      <TextInput style={styles.input} value={reward} onChangeText={setReward} placeholder="보상 내용 입력" />

      <Button title="도전 저장하기" onPress={saveChallenge} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    marginTop: 50,
  },
  label: {
    fontWeight: 'bold',
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#aaa',
    padding: 10,
    marginTop: 5,
    borderRadius: 5,
  },
});
