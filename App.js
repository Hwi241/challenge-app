// App.js
import React, { useEffect, useState } from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ChallengeListScreen from './screens/ChallengeListScreen';
import AddChallengeScreen from './screens/AddChallengeScreen';
import EditChallengeScreen from './screens/EditChallengeScreen';
import EntryListScreen from './screens/EntryListScreen';
import EntryDetailScreen from './screens/EntryDetailScreen';
import UploadScreen from './screens/UploadScreen';
import SimpleNotificationScreen from './screens/SimpleNotificationScreen';
import WeeklyNotificationScreen from './screens/WeeklyNotificationScreen';
import MonthlyNotificationScreen from './screens/MonthlyNotificationScreen';
import HallOfFameScreen from './screens/HallOfFameScreen';
import SettingsScreen from './screens/SettingsScreen';
import BackupScreen from './screens/BackupScreen';
import { colors } from './styles/common'; // header 스타일 import 제거

const Stack = createNativeStackNavigator();

// 간단 스타트업 화면(브랜드 이미지 1장만 노출)
function StartupScreen() {
  return (
    <View style={styles.startupWrap}>
      <Image
        source={require('./assets/startup.png')}
        style={styles.startupImage}
        resizeMode="contain"
      />
    </View>
  );
}

export default function App() {
  const [showStartup, setShowStartup] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowStartup(false), 1200); // 필요 시 시간 조정
    return () => clearTimeout(t);
  }, []);

  return (
    <NavigationContainer>
      {showStartup ? (
        <StartupScreen />
      ) : (
        <Stack.Navigator
          screenOptions={{
            headerShown: false, // ✅ 전 화면 기본 헤더 제거
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          {/* 메인 */}
          <Stack.Screen name="ChallengeList" component={ChallengeListScreen} />

          {/* 알림 설정들 */}
          <Stack.Screen name="SimpleNotification" component={SimpleNotificationScreen} />
          <Stack.Screen name="WeeklyNotification" component={WeeklyNotificationScreen} />
          <Stack.Screen name="MonthlyNotification" component={MonthlyNotificationScreen} />

          {/* 도전 편집/상세/업로드 */}
          <Stack.Screen name="AddChallenge" component={AddChallengeScreen} />
          <Stack.Screen name="EditChallenge" component={EditChallengeScreen} />
          <Stack.Screen name="EntryList" component={EntryListScreen} />
          <Stack.Screen name="EntryDetail" component={EntryDetailScreen} />
          <Stack.Screen name="Upload" component={UploadScreen} />

          {/* 명예의 전당 */}
          <Stack.Screen name="HallOfFameScreen" component={HallOfFameScreen} />

          {/* 설정/백업 */}
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Backup" component={BackupScreen} />
          
          <Stack.Screen
  name="FullRangeNotification"
  component={require('./screens/FullRangeNotificationScreen').default}
  options={{ title: '전체 일정 알림' }}
/>

        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  startupWrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startupImage: {
    width: '70%',
    height: '30%',
  },
});
