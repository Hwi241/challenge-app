// ✅ EditChallengeScreen.js

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function EditChallengeScreen({ route, navigation }) {
  const { challenge } = route.params;

  const [title, setTitle] = useState(challenge.title);
  const [startDate, setStartDate] = useState(challenge.startDate);
  const [endDate, setEndDate] = useState(challenge.endDate);
  const [targetScore, setTargetScore] = useState(challenge.targetScore);
  const [reward, setReward] = useState(challenge.reward);

  const saveEditedChallenge = async () => {
    try {
      const stored = await AsyncStorage.getItem('challenges');
      const parsed = stored ? JSON.parse(stored) : [];

      const updated = parsed.map(item =>
        item.id === challenge.id
          ? { ...item, title, startDate, endDate, targetScore, reward }
          : item
      );

      await AsyncStorage.setItem('challenges', JSON.stringify(updated));
      navigation.goBack();
    } catch (error) {
      console.error('수정 실패:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>도전 수정</Text>

      <TextInput
        style={styles.input}
        placeholder="제목"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={styles.input}
        placeholder="시작일"
        value={startDate}
        onChangeText={setStartDate}
      />
      <TextInput
        style={styles.input}
        placeholder="종료일"
        value={endDate}
        onChangeText={setEndDate}
      />
      <TextInput
        style={styles.input}
        placeholder="목표 점수"
        value={targetScore.toString()}
        onChangeText={text => setTargetScore(Number(text))}
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        placeholder="보상"
        value={reward}
        onChangeText={setReward}
      />

      <TouchableOpacity style={styles.saveButton} onPress={saveEditedChallenge}>
        <Text style={styles.saveButtonText}>저장</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    marginTop: 50,
  },
  heading: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  saveButton: {
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
