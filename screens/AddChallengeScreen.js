// screens/AddChallengeScreen.js
import React, { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { registerNotifications } from '../utils/notifications';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

export default function AddChallengeScreen() {
  const navigation = useNavigation();

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetScore, setTargetScore] = useState('');
  const [reward, setReward] = useState('');
  const [notificationSetting, setNotificationSetting] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [isStartPickerVisible, setStartPickerVisible] = useState(false);
  const [isEndPickerVisible, setEndPickerVisible] = useState(false);

  const formatDate = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const saveChallenge = async () => {
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

      const newChallenge = {
        id: Date.now().toString(),
        title,
        startDate,
        endDate,
        targetScore: Number(targetScore),
        reward,
        notificationSetting,
      };

      const newChallenges = [...parsed, newChallenge];
      await AsyncStorage.setItem('challenges', JSON.stringify(newChallenges));
      if (notificationSetting) {
        await registerNotifications(newChallenge.id, newChallenge.title, notificationSetting);
      }

      Alert.alert('저장 완료!', '', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);

      setTitle('');
      setStartDate('');
      setEndDate('');
      setTargetScore('');
      setReward('');
      setNotificationSetting(null);
    } catch (error) {
      Alert.alert('저장 실패', error.message);
    }
  };

  const openMonthlySetting = () => {
    navigation.navigate('MonthlyNotification', {
      onSaveNotificationSetting: (setting) => {
        setNotificationSetting(setting);
      },
    });
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>도전 제목:</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="제목 입력" />

      <Text style={styles.label}>시작일:</Text>
      <TouchableOpacity onPress={() => setStartPickerVisible(true)}>
        <TextInput style={styles.input} value={startDate} placeholder="YYYY-MM-DD" editable={false} />
      </TouchableOpacity>
      <DateTimePickerModal
        isVisible={isStartPickerVisible}
        mode="date"
        onConfirm={(date) => {
          setStartDate(formatDate(date));
          setStartPickerVisible(false);
        }}
        onCancel={() => setStartPickerVisible(false)}
      />

      <Text style={styles.label}>종료일:</Text>
      <TouchableOpacity onPress={() => setEndPickerVisible(true)}>
        <TextInput style={styles.input} value={endDate} placeholder="YYYY-MM-DD" editable={false} />
      </TouchableOpacity>
      <DateTimePickerModal
        isVisible={isEndPickerVisible}
        mode="date"
        onConfirm={(date) => {
          setEndDate(formatDate(date));
          setEndPickerVisible(false);
        }}
        onCancel={() => setEndPickerVisible(false)}
      />

      <Text style={styles.label}>목표 점수:</Text>
      <TextInput style={styles.input} value={targetScore} onChangeText={setTargetScore} placeholder="숫자 입력" keyboardType="numeric" />

      <Text style={styles.label}>보상:</Text>
      <TextInput style={styles.input} value={reward} onChangeText={setReward} placeholder="보상 내용 입력" />

      <TouchableOpacity style={styles.button} onPress={() => setModalVisible(true)}>
        <Text style={styles.buttonText}>알림 설정</Text>
      </TouchableOpacity>

      <Button title="도전 저장하기" onPress={saveChallenge} />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalWrapper}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>알림 설정 방식 선택</Text>
            <Button title="간단 알림 설정" onPress={() => {
              setModalVisible(false);
              navigation.navigate('SimpleNotification', {
                onSaveNotificationSetting: setNotificationSetting,
              });
            }} />
            <Button title="주간 상세 알림 설정" onPress={() => {
              setModalVisible(false);
              navigation.navigate('WeeklyNotification', {
                onSaveNotificationSetting: setNotificationSetting,
              });
            }} />
            <Button title="월간 상세 알림 설정" onPress={openMonthlySetting} />
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
  button: {
    backgroundColor: '#000',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
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

