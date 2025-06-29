import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ChallengeListScreen({ navigation }) {
  const [challenges, setChallenges] = useState([]);

const handleSort = (type) => {
    let sorted = [...challenges];

    if (type === 'latest') {
      sorted.sort((a, b) => Number(b.id) - Number(a.id)); // 최신순: id 내림차순
    } else if (type === 'title') {
      sorted.sort((a, b) => a.title.localeCompare(b.title)); // 이름순: 가나다순
    } else if (type === 'score') {
      sorted.sort((a, b) => b.targetScore - a.targetScore); // 점수순: 큰 점수 먼저
    }

    setChallenges(sorted);
  };

  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        const stored = await AsyncStorage.getItem('challenges');
        const parsed = stored ? JSON.parse(stored) : [];
const fixed = parsed.map(c => ({
  ...c,
  currentScore: c.currentScore ?? 0,
  completed: c.completed ?? false,
}));
setChallenges(fixed);
      } catch (error) {
        console.error('Error fetching challenges:', error);
      }
    };

    // focus 될 때마다 불러오기
    const unsubscribe = navigation.addListener('focus', fetchChallenges);
    return unsubscribe;
  }, [navigation]);

const deleteChallenge = async (id) => {
  try {
    const stored = await AsyncStorage.getItem('challenges');
    const parsed = stored ? JSON.parse(stored) : [];

    // id가 다른 애들만 남김 = 삭제됨!
    const filtered = parsed.filter(item => item.id !== id);

    // 저장하고 상태 업데이트
    await AsyncStorage.setItem('challenges', JSON.stringify(filtered));
    setChallenges(filtered);
  } catch (error) {
    console.error('삭제 실패:', error);
  }
};

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

const claimReward = (item) => {
  if (item.completed) {
    alert(`축하합니다! 보상을 받으세요: ${item.reward || '🎉'}`);
  } else {
    alert('아직 목표에 도달하지 않았어요!');
  }
};


const duplicateChallenge = async (challenge) => {
  try {
    const stored = await AsyncStorage.getItem('challenges');
    const parsed = stored ? JSON.parse(stored) : [];

    // 새로운 ID로 복사본 생성
    const newChallenge = {
      ...challenge,
      id: Date.now().toString(), // 새 ID
      title: challenge.title + ' (복제)', // 제목에 복제 표시
    };

    const updated = [...parsed, newChallenge];

    await AsyncStorage.setItem('challenges', JSON.stringify(updated));
    setChallenges(updated);
  } catch (error) {
    console.error('복제 실패:', error);
  }
};

 const renderItem = ({ item }) => (
  <View style={styles.item}>
    <Text style={styles.title}>{item.title}</Text>
    <Text>{item.startDate} ~ {item.endDate}</Text>
    <Text>목표 점수: {item.targetScore}</Text>
    <Text>현재 점수: {item.currentScore || 0}</Text>
    <Text>보상: {item.reward}</Text>
    <Text>진행률: {Math.round(((item.currentScore || 0) / item.targetScore) * 100)}%</Text>

  {/* ✅ 수정 버튼 */}
    <TouchableOpacity
      style={styles.editButton}
      onPress={() => navigation.navigate('EditChallengeScreen', { challenge: item })}
    >
      <Text style={styles.editButtonText}>수정</Text>
    </TouchableOpacity>

    {/* ✅ 삭제 버튼 */}
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => deleteChallenge(item.id)}
    >
      <Text style={styles.deleteButtonText}>삭제</Text>
    </TouchableOpacity>

    {/* ✅ 복제 버튼 */}
    <TouchableOpacity
      style={styles.duplicateButton}
      onPress={() => duplicateChallenge(item)}
    >
       <Text style={styles.duplicateButtonText}>복제</Text>
    </TouchableOpacity>

     {/* ✅ 오늘 인증 버튼 */}
    <TouchableOpacity
  style={styles.checkButton}
  onPress={() => checkToday(item.id)}
>
  <Text style={styles.checkButtonText}>오늘 인증</Text>
</TouchableOpacity>
  
     {/* ✅ 보상 받기 버튼 */}
<TouchableOpacity
  style={styles.rewardButton}
  onPress={() => claimReward(item)}
>
  <Text style={styles.rewardButtonText}>보상 받기</Text>
</TouchableOpacity>


      {/* ✅ 여기에 완료 체크 표시 */}
{item.completed && (
   <Text style={{ color: 'green', fontWeight: 'bold', marginTop: 5 }}>
    ✔️ 완료됨
  </Text>
)}



  </View>
  
);


return (


<View style={styles.container}>
    <Text style={styles.heading}>저장된 도전 리스트</Text>
     {/* ✅ 정렬 버튼 블록 — FlatList 위에 */}
    <View style={styles.sortContainer}>
      <Text style={styles.sortLabel}>정렬:</Text>

      <TouchableOpacity
        style={styles.sortButton}
        onPress={() => handleSort('latest')}
      >
        <Text>최신순</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.sortButton}
        onPress={() => handleSort('title')}
      >
        <Text>이름순</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.sortButton}
        onPress={() => handleSort('score')}
      >
        <Text>점수순</Text>
      </TouchableOpacity>
    </View>

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
deleteButton: {
  marginTop: 10,
  backgroundColor: '#dc3545',
  padding: 10,
  borderRadius: 5,
  alignItems: 'center',
},
deleteButtonText: {
  color: '#fff',
  fontWeight: 'bold',
},
editButton: {
  marginTop: 10,
  backgroundColor: '#28a745',
  padding: 10,
  borderRadius: 5,
  alignItems: 'center',
},
editButtonText: {
  color: '#fff',
  fontWeight: 'bold',
},
duplicateButton: {
  marginTop: 10,
  backgroundColor: '#17a2b8',
  padding: 10,
  borderRadius: 5,
  alignItems: 'center',
},
duplicateButtonText: {
  color: '#fff',
  fontWeight: 'bold',
},
sortContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 10,
},
sortLabel: {
  marginRight: 10,
  fontWeight: 'bold',
},
sortButton: {
  marginRight: 10,
  backgroundColor: '#eee',
  padding: 8,
  borderRadius: 5,
},
checkButton: {
  marginTop: 10,
  marginBottom: 5,
  backgroundColor: '#ffc107',
  padding: 10,
  borderRadius: 5,
  alignItems: 'center',
},
checkButtonText: {
  color: '#000',
  fontWeight: 'bold',
},
rewardButton: {
  marginBottom: 5,
  backgroundColor: '#6f42c1',
  padding: 10,
  borderRadius: 5,
  alignItems: 'center',
},
rewardButtonText: {
  color: '#fff',
  fontWeight: 'bold',
},



});


