import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, FlatList, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ChallengeListScreen({ navigation }) {
  // 화면 방향 감지 (가로/세로)
  const { width, height } = useWindowDimensions();
  const isPortrait = height >= width;

  const [challenges, setChallenges] = useState([]);

  // 정렬 처리 함수
  const handleSort = (type) => {
    let sorted = [...challenges];
    if (type === 'latest') sorted.sort((a, b) => Number(b.id) - Number(a.id));
    else if (type === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (type === 'score') sorted.sort((a, b) => b.targetScore - a.targetScore);
    setChallenges(sorted);
  };

  // 데이터 가져오기 및 초기화
  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        const stored = await AsyncStorage.getItem('challenges');
        const parsed = stored ? JSON.parse(stored) : [];
        const fixed = parsed.map(c => ({ ...c, currentScore: c.currentScore ?? 0, completed: c.completed ?? false }));
        setChallenges(fixed);
      } catch (error) {
        console.error('Error fetching challenges:', error);
      }
    };
    const unsubscribe = navigation.addListener('focus', fetchChallenges);
    return unsubscribe;
  }, [navigation]);

  // 삭제
  const deleteChallenge = async (id) => {
    try {
      const stored = await AsyncStorage.getItem('challenges');
      const parsed = stored ? JSON.parse(stored) : [];
      const filtered = parsed.filter(item => item.id !== id);
      await AsyncStorage.setItem('challenges', JSON.stringify(filtered));
      setChallenges(filtered);
    } catch (error) {
      console.error('삭제 실패:', error);
    }
  };

  // 오늘 인증
  const checkToday = async (id) => {
    try {
      const stored = await AsyncStorage.getItem('challenges');
      const parsed = stored ? JSON.parse(stored) : [];
      const updated = parsed.map(item => {
        if (item.id === id && !item.completed) {
          const newScore = (item.currentScore || 0) + 1;
          const completed = newScore >= item.targetScore;
          return { ...item, currentScore: newScore, completed };
        }
        return item;
      });
      await AsyncStorage.setItem('challenges', JSON.stringify(updated));
      setChallenges(updated);
    } catch (error) {
      console.error('인증 실패:', error);
    }
  };

  // 보상 받기
  const claimReward = (item) => {
    if (item.completed) {
      alert(`축하합니다! 보상을 받으세요: ${item.reward || '🎉'}`);
    } else {
      // 버튼 노출 자체가 완료 후에만 되므로 이 분기는 사용되지 않을 것
    }
  };

  // 복제
  const duplicateChallenge = async (challenge) => {
    try {
      const stored = await AsyncStorage.getItem('challenges');
      const parsed = stored ? JSON.parse(stored) : [];
      const newChallenge = { ...challenge, id: Date.now().toString(), title: `${challenge.title} (복제)` };
      const updated = [...parsed, newChallenge];
      await AsyncStorage.setItem('challenges', JSON.stringify(updated));
      setChallenges(updated);
    } catch (error) {
      console.error('복제 실패:', error);
    }
  };

  // 리스트 렌더링
  const renderItem = ({ item }) => (
    <View style={[styles.item, item.completed && styles.completedCard]}>      
      <Text style={styles.title}>{item.title}</Text>
      <Text>{item.startDate} ~ {item.endDate}</Text>
      <Text>목표 점수: {item.targetScore}</Text>
      <Text>현재 점수: {item.currentScore || 0}</Text>
      <Text>보상: {item.reward}</Text>
      <Text>진행률: {Math.round(((item.currentScore || 0) / item.targetScore) * 100)}%</Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.smallButton} onPress={() => navigation.navigate('EditChallengeScreen', { challenge: item })}>
          <Text style={styles.smallButtonText}>수정</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallButton} onPress={() => deleteChallenge(item.id)}>
          <Text style={styles.smallButtonText}>삭제</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallButton} onPress={() => duplicateChallenge(item)}>
          <Text style={styles.smallButtonText}>복제</Text>
        </TouchableOpacity>
      </View>

      {!item.completed && (
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.checkButton} onPress={() => checkToday(item.id)}>
            <Text style={styles.checkButtonText}>오늘 인증</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.completed && (
        <View>
          <TouchableOpacity style={styles.rewardButton} onPress={() => claimReward(item)}>
            <Text style={styles.rewardButtonText}>보상 받기</Text>
          </TouchableOpacity>
          <Text style={styles.completedText}>✔️ 완료됨</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        style={styles.list}
        data={challenges}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text>저장된 도전이 없습니다.</Text>}
        ListHeaderComponent={(
          <>
            <Text style={styles.heading}>저장된 도전 리스트</Text>
            <View style={styles.sortContainer}>
              <Text style={styles.sortLabel}>정렬:</Text>
              <TouchableOpacity style={styles.sortButton} onPress={() => handleSort('latest')}><Text>최신순</Text></TouchableOpacity>
              <TouchableOpacity style={styles.sortButton} onPress={() => handleSort('title')}><Text>이름순</Text></TouchableOpacity>
              <TouchableOpacity style={styles.sortButton} onPress={() => handleSort('score')}><Text>점수순</Text></TouchableOpacity>
            </View>
          </>
        )}
      />
      <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddChallenge')}>
        <Text style={styles.addButtonText}>+ 도전 추가하기</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f4', padding: 20, paddingTop: 50, paddingBottom: 20 },
  list: { flex: 1 },
  heading: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  sortContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  sortLabel: { marginRight: 10, fontWeight: 'bold' },
  sortButton: { marginRight: 10, backgroundColor: '#eee', padding: 8, borderRadius: 5 },
  item: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#ddd', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  completedCard: { backgroundColor: '#e0e0e0', borderColor: '#bbb', opacity: 0.8 },
  title: { fontWeight: 'bold', fontSize: 16, marginBottom: 5 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  smallButton: { flex: 1, marginHorizontal: 2, backgroundColor: '#007bff', padding: 8, borderRadius: 5, alignItems: 'center' },
  smallButtonText: { color: '#fff', fontWeight: 'bold' },
  checkButton: { flex: 1, marginHorizontal: 2, backgroundColor: '#ffc107', padding: 8, borderRadius: 5, alignItems: 'center' },
  checkButtonText: { color: '#000', fontWeight: 'bold' },
  rewardButton: { backgroundColor: '#6f42c1', padding: 10, borderRadius: 5, alignItems: 'center', marginTop: 10 },
  rewardButtonText: { color: '#fff', fontWeight: 'bold' },
  completedText: { color: 'green', fontWeight: 'bold', marginTop: 5 },
  addButton: { backgroundColor: '#007bff', padding: 15, borderRadius: 5, alignItems: 'center', marginTop: 10, marginBottom: 20 },
  addButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
