import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ChallengeListScreen({ navigation }) {
  const [challenges, setChallenges] = useState([]);

  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        const stored = await AsyncStorage.getItem('challenges');
        const parsed = stored ? JSON.parse(stored) : [];
        setChallenges(parsed);
      } catch (error) {
        console.error('Error fetching challenges:', error);
      }
    };

    // focus 될 때마다 불러오기
    const unsubscribe = navigation.addListener('focus', fetchChallenges);
    return unsubscribe;
  }, [navigation]);

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.item}>
      <Text style={styles.title}>{item.title}</Text>
      <Text>{item.startDate} ~ {item.endDate}</Text>
      <Text>목표 점수: {item.targetScore}</Text>
      <Text>보상: {item.reward}</Text>
    </TouchableOpacity>
  );

return (
  <View style={styles.container}>
    <Text style={styles.heading}>저장된 도전 리스트</Text>
    <FlatList
      data={challenges}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListEmptyComponent={<Text>저장된 도전이 없습니다.</Text>}
    />
    <TouchableOpacity
      style={styles.addButton}
      onPress={() => navigation.navigate('AddChallenge')}
    >
      <Text style={styles.addButtonText}>+ 도전 추가하기</Text>
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
  item: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 5,
    marginBottom: 10,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  addButton: {
  marginTop: 20,
  backgroundColor: '#007bff',
  padding: 15,
  borderRadius: 5,
  alignItems: 'center',
},
addButtonText: {
  color: '#fff',
  fontWeight: 'bold',
  fontSize: 16,
},
});
