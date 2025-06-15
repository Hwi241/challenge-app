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
    // 1) 값 검사
    if (!title || !startDate) {
      Alert.alert('필수 항목을 입력해주세요!');
      return;
    }

    try {
      // 2) 기존 저장된 데이터 불러오기
      const stored = await AsyncStorage.getItem('challenges');
      const parsed = stored ? JSON.parse(stored) : [];

      // 3) 새 항목 추가
      const newChallenge = {
        id: Date.now().toString(),
        title,
        startDate,
        endDate,
        targetScore,
        reward,
      };

      const newChallenges = [...parsed, newChallenge];

      // 4) 저장
      await AsyncStorage.setItem('challenges', JSON.stringify(newChallenges));

      // 5) 알림 + 돌아가기
      Alert.alert('저장 완료!', '', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);

      // 6) 입력 초기화 (선택)
      setTitle('');
      setStartDate('');
      setEndDate('');
      setTargetScore('');
      setReward('');
    } catch (error) {
      Alert.alert('에러', '저장 실패: ' + error);
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
