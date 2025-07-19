// screens/SimpleNotificationScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, TouchableOpacity, Platform, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

const repeatOptions = [
  '매일 반복',
  '매주 요일 반복',
  '매달 특정 날짜',
  '매달 몇째 주 요일'
];

const daysOfWeek = ['월', '화', '수', '목', '금', '토', '일'];

export default function SimpleNotificationScreen({ navigation, route }) {
  const [selectedRepeat, setSelectedRepeat] = useState('매일 반복');
  const [selectedDays, setSelectedDays] = useState([]);
  const [time, setTime] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const { onSaveNotificationSetting } = route.params || {};

  const toggleDay = (day) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const onTimeChange = (event, selectedDate) => {
    setShowPicker(false);
    if (selectedDate) setTime(selectedDate);
  };

  const handleSave = () => {
    const data = {
      type: 'simple',
      repeat: selectedRepeat,
      days: selectedDays,
      time: {
        hour: time.getHours(),
        minute: time.getMinutes(),
      },
    };

    if (onSaveNotificationSetting) {
      onSaveNotificationSetting(data);
    } else {
      Alert.alert('저장 실패', '상위 화면에서 콜백 함수가 누락되었습니다.');
    }
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>반복 방식 선택</Text>
      {repeatOptions.map(option => (
        <TouchableOpacity
          key={option}
          style={[styles.option, selectedRepeat === option && styles.selectedOption]}
          onPress={() => setSelectedRepeat(option)}
        >
          <Text style={styles.optionText}>{option}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.title}>요일 선택</Text>
      <View style={styles.daysRow}>
        {daysOfWeek.map(day => (
          <TouchableOpacity
            key={day}
            style={[styles.dayButton, selectedDays.includes(day) && styles.selectedDay]}
            onPress={() => toggleDay(day)}
          >
            <Text style={styles.dayText}>{day}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.title}>알림 시간</Text>
      <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.timeButton}>
        <Text style={styles.timeText}>
          {time.getHours()}시 {time.getMinutes()}분
        </Text>
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={time}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onTimeChange}
        />
      )}

      <View style={styles.submitWrapper}>
        <Button title="선택 완료" onPress={handleSave} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 16, fontWeight: 'bold', marginTop: 20 },
  option: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    marginTop: 10,
    borderRadius: 5,
  },
  selectedOption: {
    borderColor: '#007bff',
    backgroundColor: '#e6f0ff',
  },
  optionText: { fontSize: 14 },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  dayButton: {
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedDay: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  dayText: { color: '#000' },
  timeButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 5,
    padding: 10,
    alignItems: 'center',
  },
  timeText: { fontSize: 14 },
  submitWrapper: { marginTop: 30 },
});
