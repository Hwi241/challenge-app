// screens/WeeklyNotificationScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 10, 20, 30, 40, 50];
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

export default function WeeklyNotificationScreen({ route, navigation }) {
  const { onSaveNotificationSetting } = route.params;
  const [weeklyTimes, setWeeklyTimes] = useState({});

  const addTimeSlot = (day) => {
    const existing = weeklyTimes[day] || [];
    if (existing.length >= 5) return;
    setWeeklyTimes({
      ...weeklyTimes,
      [day]: [...existing, { hour: 8, minute: 0 }],
    });
  };

  const updateTime = (day, index, field, value) => {
    const updated = [...(weeklyTimes[day] || [])];
    updated[index] = {
      ...updated[index],
      [field]: Number(value),
    };
    setWeeklyTimes({ ...weeklyTimes, [day]: updated });
  };

  const removeTime = (day, index) => {
    const filtered = (weeklyTimes[day] || []).filter((_, i) => i !== index);
    setWeeklyTimes({ ...weeklyTimes, [day]: filtered });
  };

  const saveSetting = () => {
    const setting = {
      type: 'weekly',
      data: weeklyTimes,
    };
    onSaveNotificationSetting(setting);
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>요일별 알림 시간 설정</Text>
      {DAYS.map((day) => (
        <View key={day} style={styles.dayBlock}>
          <Text style={styles.dayLabel}>{day}</Text>
          {(weeklyTimes[day] || []).map((time, index) => (
            <View key={index} style={styles.timeRow}>
              <View style={styles.dropdownRow}>
                <Text>시:</Text>
                <ScrollView horizontal>
                  {HOURS.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={time.hour === h ? styles.selected : styles.option}
                      onPress={() => updateTime(day, index, 'hour', h)}>
                      <Text>{h}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.dropdownRow}>
                <Text>분:</Text>
                <ScrollView horizontal>
                  {MINUTES.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={time.minute === m ? styles.selected : styles.option}
                      onPress={() => updateTime(day, index, 'minute', m)}>
                      <Text>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <Button title="삭제" onPress={() => removeTime(day, index)} color="#dc3545" />
            </View>
          ))}
          <Button title="+ 시간 추가" onPress={() => addTimeSlot(day)} />
        </View>
      ))}

      <View style={styles.bottomButton}>
        <Button title="저장" onPress={saveSetting} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  dayBlock: { marginBottom: 20 },
  dayLabel: { fontWeight: 'bold', marginBottom: 10 },
  timeRow: { marginBottom: 10 },
  dropdownRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  option: {
    padding: 6,
    marginHorizontal: 4,
    backgroundColor: '#eee',
    borderRadius: 5,
  },
  selected: {
    padding: 6,
    marginHorizontal: 4,
    backgroundColor: '#000',
    borderRadius: 5,
    color: '#fff',
  },
  bottomButton: { marginTop: 30 },
});
