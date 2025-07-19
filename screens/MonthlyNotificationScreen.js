// screens/MonthlyNotificationScreen.js
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

export default function MonthlyNotificationScreen({ route, navigation }) {
  const { onSaveNotificationSetting } = route.params;
  const [monthlyTimes, setMonthlyTimes] = useState({});

  const addTimeSlot = (date) => {
    const existing = monthlyTimes[date] || [];
    if (existing.length >= 5) return;
    setMonthlyTimes({
      ...monthlyTimes,
      [date]: [...existing, { hour: 8, minute: 0 }],
    });
  };

  const updateTime = (date, index, field, value) => {
    const updated = [...(monthlyTimes[date] || [])];
    updated[index] = {
      ...updated[index],
      [field]: Number(value),
    };
    setMonthlyTimes({ ...monthlyTimes, [date]: updated });
  };

  const removeTime = (date, index) => {
    const filtered = (monthlyTimes[date] || []).filter((_, i) => i !== index);
    setMonthlyTimes({ ...monthlyTimes, [date]: filtered });
  };

  const saveSetting = () => {
    const setting = {
      type: 'monthly',
      data: monthlyTimes,
    };
    onSaveNotificationSetting(setting);
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>날짜별 알림 시간 설정</Text>
      {Array.from({ length: 31 }, (_, i) => i + 1).map((date) => (
        <View key={date} style={styles.dayBlock}>
          <Text style={styles.dayLabel}>{date}일</Text>
          {(monthlyTimes[date] || []).map((time, index) => (
            <View key={index} style={styles.timeRow}>
              <View style={styles.dropdownRow}>
                <Text>시:</Text>
                <ScrollView horizontal>
                  {HOURS.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={time.hour === h ? styles.selected : styles.option}
                      onPress={() => updateTime(date, index, 'hour', h)}>
                      <Text style={time.hour === h ? styles.selectedText : null}>{h}</Text>
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
                      onPress={() => updateTime(date, index, 'minute', m)}>
                      <Text style={time.minute === m ? styles.selectedText : null}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <Button title="삭제" onPress={() => removeTime(date, index)} color="#dc3545" />
            </View>
          ))}
          <Button title="+ 시간 추가" onPress={() => addTimeSlot(date)} />
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
  },
  selectedText: { color: '#fff' },
  bottomButton: { marginTop: 30 },
});
