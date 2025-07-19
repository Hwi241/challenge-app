// screens/ChallengeListScreen.js

import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ✅ (생략된 import들은 그대로 유지)

// 📌 loadChallenges 함수는 export 안에서 쓸 수 있게 바깥에 선언
const loadChallenges = async (setChallenges) => {
  try {
    const raw = await AsyncStorage.getItem('challenges');
    const list = raw ? JSON.parse(raw) : [];
    const fixed = list.map(c => ({
      ...c,
      currentScore: c.currentScore ?? 0,
      completed: c.completed ?? false,
    }));
    setChallenges(fixed);
  } catch (e) {
    console.error(e);
    Alert.alert('오류', '챌린지 로드에 실패했습니다.');
  }
};

async function duplicateChallenge(original, setChallenges) {
  try {
    const id = uuid.v4();

    const newChallenge = {
      id,
      title: original.title + ' (복사됨)',
      description: original.description,
      startDate: original.startDate,
      endDate: original.endDate,
      goal: original.goal,
      reward: original.reward,
      createdAt: new Date().toISOString(),

      // ✅ 초기화
      currentScore: 0,
      completedCount: 0,
      progress: 0,
      weeklyProgress: [],
      entries: [],
      targetScore: original.targetScore ?? 1, // ✅ NaN 방지용 보완
    };

    const existing = await AsyncStorage.getItem('challenges');
    const challenges = existing ? JSON.parse(existing) : [];

    challenges.push(newChallenge);
    await AsyncStorage.setItem('challenges', JSON.stringify(challenges));

    // ✅ 복제 후 즉시 리스트 갱신
    loadChallenges(setChallenges);
  } catch (error) {
    console.error('챌린지 복사 오류:', error);
    Alert.alert('오류', '복제 중 오류 발생');
  }
}

export default function ChallengeListScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isPortrait = height >= width;
  const insets = useSafeAreaInsets();
  const [challenges, setChallenges] = useState([]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => loadChallenges(setChallenges));
    return unsub;
  }, [navigation]);

  const handleSort = mode => {
    const sorted = [...challenges];
    if (mode === 'latest') {
      sorted.sort((a, b) => Number(b.id) - Number(a.id));
    } else if (mode === 'title') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else if (mode === 'progress') {
      sorted.sort(
        (a, b) =>
          b.currentScore / b.targetScore - a.currentScore / a.targetScore
      );
    }
    setChallenges(sorted);
  };

  const deleteChallenge = async id => {
    try {
      const raw = await AsyncStorage.getItem('challenges');
      const list = raw ? JSON.parse(raw) : [];
      const filtered = list.filter(c => c.id !== id);
      await AsyncStorage.setItem('challenges', JSON.stringify(filtered));
      setChallenges(filtered);
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '챌린지 삭제에 실패했습니다.');
    }
  };

  const goToUpload = id => navigation.navigate('Upload', { challengeId: id });

  const renderItem = ({ item }) => {
    const pct =
      item.targetScore && item.targetScore > 0
        ? Math.round((item.currentScore / item.targetScore) * 100)
        : 0;

    return (
      <TouchableOpacity
        style={[styles.item, item.completed && styles.completedCard]}
        onPress={() =>
          navigation.navigate('EntryList', {
            challengeId: item.id,
            title: item.title,
            startDate: item.startDate,
            targetScore: item.targetScore,
            currentScore: item.currentScore,
          })
        }
      >
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.sub}>{item.startDate} ~ {item.endDate}</Text>
        <Text style={styles.sub}>목표: {item.targetScore}회</Text>
        <Text style={styles.sub}>현재: {item.currentScore}회</Text>
        <Text style={styles.sub}>진행률: {pct}%</Text>
        <Text style={styles.sub}>보상: {item.reward}</Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => navigation.navigate('EditChallenge', { challenge: item })}
          >
            <Text style={styles.smallButtonText}>수정</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.smallButton} onPress={() => deleteChallenge(item.id)}>
            <Text style={styles.smallButtonText}>삭제</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.smallButton} onPress={() => duplicateChallenge(item, setChallenges)}>
            <Text style={styles.smallButtonText}>복제</Text>
          </TouchableOpacity>
        </View>

        {!item.completed ? (
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.checkButton} onPress={() => goToUpload(item.id)}>
              <Text style={styles.checkButtonText}>도전 인증</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.rewardButton} onPress={() => alert(`보상 받기: ${item.reward}`)}>
              <Text style={styles.rewardButtonText}>보상 받기</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      style={[
        isPortrait ? styles.portrait : styles.landscape,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.heading}>저장된 챌린지</Text>
        <View style={styles.sortContainer}>
          <TouchableOpacity onPress={() => handleSort('latest')} style={styles.sortButton}>
            <Text>최신</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleSort('title')} style={styles.sortButton}>
            <Text>이름</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleSort('progress')} style={styles.sortButton}>
            <Text>진행률</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        contentContainerStyle={[
          challenges.length === 0 && styles.emptyContainer
        ]}
        data={challenges}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>챌린지가 없습니다.</Text>}
      />

      <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddChallenge')}>
        <Text style={styles.addButtonText}>+ 챌린지 추가</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ✅ styles는 그대로 유지 (생략 가능하면 말해줘!)


const styles = StyleSheet.create({
  portrait: { flex:1, backgroundColor:'#f4f4f4', paddingHorizontal:20 },
  landscape:{ flex:1, backgroundColor:'#f4f4f4', flexDirection:'row', padding:10 },
  header:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginHorizontal:20, marginBottom:10 },
  heading:{ fontSize:20, fontWeight:'bold' },
  sortContainer:{ flexDirection:'row' },
  sortButton:{ marginLeft:8, padding:6, backgroundColor:'#eee', borderRadius:4 },
  item:{ backgroundColor:'#fff', padding:16, marginHorizontal:20, marginVertical:8, borderRadius:8, borderColor:'#ddd', borderWidth:1 },
  completedCard:{ backgroundColor:'#e0e0e0', opacity:0.7 },
  title:{ fontSize:16, fontWeight:'bold', marginBottom:4 },
  sub:{ fontSize:14, color:'#333', marginBottom:2 },
  buttonRow:{ flexDirection:'row', justifyContent:'flex-end', marginTop:8 },
  smallButton:{ marginLeft:8, backgroundColor:'#007bff', paddingHorizontal:12, paddingVertical:6, borderRadius:4 },
  smallButtonText:{ color:'#fff', fontWeight:'bold' },
  checkButton:{ flex:1, backgroundColor:'#ffc107', padding:12, borderRadius:4, alignItems:'center' },
  checkButtonText:{ color:'#000', fontWeight:'bold' },
  rewardButton:{ flex:1, backgroundColor:'#28a745', padding:12, borderRadius:4, alignItems:'center' },
  rewardButtonText:{ color:'#fff', fontWeight:'bold' },
  addButton:{ backgroundColor:'#28a745', padding:16, margin:20, borderRadius:8, alignItems:'center' },
  addButtonText:{ color:'#fff', fontWeight:'bold', fontSize:16 },
  empty:{ textAlign:'center', color:'#666', marginTop:50, fontSize:16 },
  emptyContainer:{ flex:1, justifyContent:'center' },
});
