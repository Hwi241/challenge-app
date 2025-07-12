import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ChallengeListScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isPortrait = height >= width;

  const [challenges, setChallenges] = useState([]);

  // 1) 챌린지 목록 로드 및 초기화
  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem('challenges');
        const list = raw ? JSON.parse(raw) : [];
        // 누락된 필드 채우기
        const fixed = list.map(c => ({
          ...c,
          currentScore: c.currentScore ?? 0,
          completed:    c.completed    ?? false,
        }));
        setChallenges(fixed);
      } catch (e) {
        console.error(e);
      }
    };
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation]);

  // 2) 정렬
  const handleSort = (mode) => {
    const sorted = [...challenges];
    if (mode === 'latest')    sorted.sort((a,b) => Number(b.id) - Number(a.id));
    else if (mode === 'title')sorted.sort((a,b) => a.title.localeCompare(b.title));
    else if (mode === 'score')sorted.sort((a,b) => b.currentScore - a.currentScore);
    setChallenges(sorted);
  };

  // 3) 삭제
  const deleteChallenge = async (id) => {
    try {
      const raw = await AsyncStorage.getItem('challenges');
      const list = raw ? JSON.parse(raw) : [];
      const filtered = list.filter(c => c.id !== id);
      await AsyncStorage.setItem('challenges', JSON.stringify(filtered));
      setChallenges(filtered);
    } catch (e) {
      console.error(e);
    }
  };

  // 4) 복제
  const duplicateChallenge = async (item) => {
    try {
      const raw = await AsyncStorage.getItem('challenges');
      const list = raw ? JSON.parse(raw) : [];
      const copy = {
        ...item,
        id: Date.now().toString(),
        title: `${item.title} (복제)`
      };
      const updated = [...list, copy];
      await AsyncStorage.setItem('challenges', JSON.stringify(updated));
      setChallenges(updated);
    } catch (e) {
      console.error(e);
    }
  };

  // 5) 오늘 인증 → UploadScreen으로 이동
  const goToUpload = (id) => {
    navigation.navigate('Upload', { challengeId: id });
  };

  // 6) renderItem (각 카드)
  function renderItem({ item }) {
    const pct = Math.round((item.currentScore / item.targetScore) * 100);
    return (
      <TouchableOpacity
        style={[styles.item, item.completed && styles.completedCard]}
        onPress={() => navigation.navigate('EntryList', {
          challengeId:  item.id,
          title:        item.title,
          startDate:    item.startDate,
          targetScore:  item.targetScore,
          currentScore: item.currentScore
        })}
      >
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.sub}>{item.startDate} ~ {item.endDate}</Text>
        <Text style={styles.sub}>목표: {item.targetScore}회</Text>
        <Text style={styles.sub}>현재: {item.currentScore}회</Text>
        <Text style={styles.sub}>진행률: {pct}%</Text>
        <Text style={styles.sub}>보상: {item.reward}</Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => navigation.navigate('EditChallengeScreen', { challenge: item })}
          >
            <Text style={styles.smallButtonText}>수정</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => deleteChallenge(item.id)}
          >
            <Text style={styles.smallButtonText}>삭제</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => duplicateChallenge(item)}
          >
            <Text style={styles.smallButtonText}>복제</Text>
          </TouchableOpacity>
        </View>

        {!item.completed && (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.checkButton}
              onPress={() => goToUpload(item.id)}
            >
              <Text style={styles.checkButtonText}>도전 인증</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.completed && (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.rewardButton}
              onPress={() => alert(`보상 받기: ${item.reward}`)}
            >
              <Text style={styles.rewardButtonText}>보상 받기</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={isPortrait ? styles.portrait : styles.landscape}>
      <View style={styles.header}>
        <Text style={styles.heading}>저장된 챌린지</Text>
        <View style={styles.sortContainer}>
          <TouchableOpacity onPress={() => handleSort('latest')} style={styles.sortButton}><Text>최신</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => handleSort('title')} style={styles.sortButton}><Text>이름</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => handleSort('score')} style={styles.sortButton}><Text>점수</Text></TouchableOpacity>
        </View>
      </View>
      <FlatList
        contentContainerStyle={challenges.length===0 && styles.emptyContainer}
        data={challenges}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>챌린지가 없습니다.</Text>}
      />
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddChallenge')}
      >
        <Text style={styles.addButtonText}>+ 챌린지 추가</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  portrait: { flex:1, backgroundColor:'#f4f4f4', padding:20, paddingTop:50 },
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
