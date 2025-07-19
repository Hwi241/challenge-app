// screens/EditChallengeScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { registerNotifications } from '../utils/notifications';

export default function EditChallengeScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { challengeId } = route.params;

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetScore, setTargetScore] = useState('');
  const [reward, setReward] = useState('');
  const [notificationSetting, setNotificationSetting] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('challenges');
      const parsed = stored ? JSON.parse(stored) : [];
      const found = parsed.find((c) => c.id === challengeId);
      if (found) {
        setTitle(found.title);
        setStartDate(found.startDate);
        setEndDate(found.endDate);
        setTargetScore(found.targetScore?.toString() ?? '');
        setReward(found.reward);
        setNotificationSetting(found.notificationSetting || null);
      }
    })();
  }, [challengeId]);

  const saveEditedChallenge = async () => {
    if (!title.trim()) {
      Alert.alert('제목을 입력해주세요!');
      return;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate && !dateRegex.test(startDate)) {
      Alert.alert('시작일은 YYYY-MM-DD 형식으로 입력해주세요.');
      return;
    }
    if (endDate && !dateRegex.test(endDate)) {
      Alert.alert('종료일은 YYYY-MM-DD 형식으로 입력해주세요.');
      return;
    }

    if (targetScore && isNaN(Number(targetScore))) {
      Alert.alert('목표 점수는 숫자로 입력해주세요.');
      return;
    }

    try {
      const stored = await AsyncStorage.getItem('challenges');
      const parsed = stored ? JSON.parse(stored) : [];
      const updated = parsed.map((c) =>
        c.id === challengeId
          ? {
              ...c,
              title,
              startDate,
              endDate,
              targetScore: Number(targetScore),
              reward,
              notificationSetting,
            }
          : c
      );
      await AsyncStorage.setItem('challenges', JSON.stringify(updated));

      if (notificationSetting) {
        await registerNotifications(challengeId, title, notificationSetting);
      }

      Alert.alert('수정 완료!', '', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (error) {
      Alert.alert('수정 실패', error.message);
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
      <TextInput
        style={styles.input}
        value={targetScore}
        onChangeText={setTargetScore}
        placeholder="숫자 입력"
        keyboardType="numeric"
      />

      <Text style={styles.label}>보상:</Text>
      <TextInput style={styles.input} value={reward} onChangeText={setReward} placeholder="보상 내용 입력" />

      <TouchableOpacity style={styles.alarmButton} onPress={() => setModalVisible(true)}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>알림 설정</Text>
      </TouchableOpacity>

      <Button title="도전 수정하기" onPress={saveEditedChallenge} />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalWrapper}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>알림 설정 방식 선택</Text>
            <Button
              title="월간 상세 알림 설정"
              onPress={() => {
                setModalVisible(false);
                navigation.navigate('MonthlyNotification', {
                  onSaveNotificationSetting: (setting) => setNotificationSetting(setting),
                  initialSetting: notificationSetting,
                });
              }}
            />
            <Button title="닫기" onPress={() => setModalVisible(false)} color="#666" />
          </View>
        </View>
      </Modal>
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
  alarmButton: {
    backgroundColor: '#000',
    padding: 12,
    borderRadius: 8,
    marginVertical: 10,
  },
  modalWrapper: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalBox: {
    margin: 20,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
});
