// screens/StartupScreen.js
import React, { useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function StartupScreen() {
  const navigation = useNavigation();

  useEffect(() => {
    const t = setTimeout(() => {
      navigation.replace('ChallengeList');
    }, 1200); // 표시 시간 (원하면 800~1500 사이로 조정)
    return () => clearTimeout(t);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/startup.png')} // ✅ B 이미지 경로
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  image: { width: '72%', height: '28%' }, // 안전한 여백 비율(원하면 조정)
});
