// App.js
import 'react-native-gesture-handler'; // ✅ 반드시 최상단에!
import React, { useEffect, useState } from 'react';
import { Image, View, StyleSheet, Platform, StatusBar } from 'react-native';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { isRunningInExpoGo } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';

import NotificationDefaultsScreen from './screens/NotificationDefaultsScreen';
import ChallengeListScreen from './screens/ChallengeListScreen';
import AddChallengeScreen from './screens/AddChallengeScreen';
import CreateChallengeTypeScreen from './screens/CreateChallengeTypeScreen';
import AddRotationRoutineScreen from './screens/AddRotationRoutineScreen';
import EditRotationRoutineScreen from './screens/EditRotationRoutineScreen';
import RotationRoutineDetailScreen from './screens/RotationRoutineDetailScreen';
import EditChallengeScreen from './screens/EditChallengeScreen';
import EntryListScreen from './screens/EntryListScreen';
import EntryDetailScreen from './screens/EntryDetailScreen';
import UploadScreen from './screens/UploadScreen';
import SimpleNotificationScreen from './screens/SimpleNotificationScreen';
import WeeklyNotificationScreen from './screens/WeeklyNotificationScreen';
import MonthlyNotificationScreen from './screens/MonthlyNotificationScreen';
import HallOfFameScreen from './screens/HallOfFameScreen';
import DataIntegrationsScreen from './screens/DataIntegrationsScreen';
import SettingsScreen from './screens/SettingsScreen';
import BackupScreen from './screens/BackupScreen';
import TrashScreen from './screens/TrashScreen';
import ProfileInventoryScreen from './screens/ProfileInventoryScreen';
import GraphShopScreen from './screens/GraphShopScreen';
import MyGraphScreen from './screens/MyGraphScreen';
import FocusTimerScreen from './screens/FocusTimerScreen';
import FocusMiniTimer from './components/FocusMiniTimer';
import FocusOverlayController from './components/FocusOverlayController';
import MainDock from './components/MainDock';

import { color, surface as canonicalSurfaceStyles } from './styles/common';
import { syncWidgetChallengeList } from './utils/widgetSync';
import { cleanExpiredTrash } from './utils/trash';
import DashboardEditScreen from './screens/DashboardEditScreen';

const Stack = createNativeStackNavigator();

const getDockScreenOptions = ({ route }) => ({
  headerShown: false,
  presentation: 'card',
  animation: (
    route?.params?.__dockDirection === 'backward'
      ? 'slide_from_left'
      : 'slide_from_right'
  ),
  contentStyle: canonicalSurfaceStyles.navigationContent,
});

const appNavigationRef = createNavigationContainerRef();

const DOCK_ROUTE_TO_KEY = {
  ChallengeList: 'home',
  ProfileInventory: 'record',
  GraphShop: 'shop',
};

// ✅ 딥링크 설정
// - thepush://upload?challengeId=xxx  → Upload
// - thepush://dashboard?challengeId=xxx → EntryList (대시보드)
const linking = {
  prefixes: ['thepush://'],
  config: {
    screens: {
      ChallengeList: 'home',
      Upload: {
        path: 'upload/:challengeId',
        parse: { challengeId: v => String(v) },
      },
      EntryList: {
        path: 'dashboard/:challengeId',
        parse: { challengeId: v => String(v) },
      },
      SimpleNotification: 'simple-noti',
      WeeklyNotification: 'weekly-noti',
      MonthlyNotification: 'monthly-noti',
      AddChallenge: 'add',
      EditChallenge: 'edit',
      EntryDetail: 'entry-detail',
      FocusTimer: {
        path: 'focus-timer/:sessionId',
        parse: { sessionId: v => String(v) },
      },
      HallOfFameScreen: 'hall-of-fame',
      ProfileInventory: 'profile-inventory',
      GraphShop: 'graph-shop',
      MyGraphs: 'my-graphs',
      DataIntegrations: 'data-integrations',
 Settings: 'settings',
      Backup: 'backup',
      FullRangeNotification: 'full-range',
      NotificationDefaults: 'notification-defaults',
    },
  },
};

function StartupScreen() {
  return (
    <View style={[canonicalSurfaceStyles.screen, styles.startupWrap]}>
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
  const [currentRouteName, setCurrentRouteName] = useState('Startup');
  const dockActive = DOCK_ROUTE_TO_KEY[currentRouteName] || null;

  // 부팅 시 위젯 데이터 초기 동기화
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    (async () => {
      try {
        await syncWidgetChallengeList();
      } catch (e) {
        console.warn('widget sync on boot failed:', e);
      }
    })();
  }, []);

  // 스플래시 간단 지연
  useEffect(() => {
    const t = setTimeout(() => setShowStartup(false), 1200);
    return () => clearTimeout(t);
  }, []);

  // 안드로이드 미디어 스캐닝 방지 파일 생성(.nomedia)
  useEffect(() => {
    (async () => {
      try {
        const p = FileSystem.documentDirectory + '.nomedia';
        await FileSystem.writeAsStringAsync(p, '');
      } catch {}
    })();
  }, []);

  // 알림 초기화 설정
  useEffect(() => {
    if (Platform.OS === 'android' && isRunningInExpoGo()) return;

    import('./utils/notificationScheduler')
      .then(({ initializeNotificationsAsync }) => initializeNotificationsAsync())
      .catch((e) => {
        console.warn('notification initialization failed:', e);
      });
  }, []);

  // 휴지통 만료 항목 자동 정리 (30일 경과)
  useEffect(() => {
    cleanExpiredTrash(30);
  }, []);

  return (
    <GestureHandlerRootView style={canonicalSurfaceStyles.screen}>
      <StatusBar translucent={false} backgroundColor={color.background} barStyle="dark-content" />
      <SafeAreaProvider>
        <NavigationContainer
          ref={appNavigationRef}
          linking={linking}
          onReady={() => setCurrentRouteName(appNavigationRef.getCurrentRoute()?.name ?? '')}
          onStateChange={() => setCurrentRouteName(appNavigationRef.getCurrentRoute()?.name ?? '')}
        >
          <View style={styles.appShell}>
          <View style={styles.navigationHost}>
          <Stack.Navigator
            initialRouteName={showStartup ? 'Startup' : 'ChallengeList'}
            screenOptions={{
              headerShown: false,
              contentStyle: canonicalSurfaceStyles.navigationContent,
            }}
          >
            {/* 스타트업 */}
            {showStartup && <Stack.Screen name="Startup" component={StartupScreen} />}

            {/* 메인 */}
            <Stack.Screen
              name="ChallengeList"
              component={ChallengeListScreen}
              options={getDockScreenOptions}
            />
        <Stack.Screen
          name="ProfileInventory"
          component={ProfileInventoryScreen}
          options={getDockScreenOptions}
        />
        <Stack.Screen
          name="GraphShop"
          component={GraphShopScreen}
          options={getDockScreenOptions}
        />
        <Stack.Screen name="MyGraphs" component={MyGraphScreen} />

            {/* 알림 설정들 */}
            <Stack.Screen name="SimpleNotification" component={SimpleNotificationScreen} />
            <Stack.Screen name="WeeklyNotification" component={WeeklyNotificationScreen} />
            <Stack.Screen name="MonthlyNotification" component={MonthlyNotificationScreen} />

            {/* 도전 편집/상세/업로드 */}
<Stack.Screen name="AddChallenge" component={AddChallengeScreen} />
            <Stack.Screen name="CreateChallengeType" component={CreateChallengeTypeScreen} />
            <Stack.Screen name="AddRotationRoutine" component={AddRotationRoutineScreen} />
            <Stack.Screen name="EditRotationRoutine" component={EditRotationRoutineScreen} />
            <Stack.Screen name="RotationRoutineDetail" component={RotationRoutineDetailScreen} />
            <Stack.Screen name="EditChallenge" component={EditChallengeScreen} />
            <Stack.Screen name="EntryList" component={EntryListScreen} />
            <Stack.Screen name="EntryDetail" component={EntryDetailScreen} />
            <Stack.Screen name="Upload" component={UploadScreen} />
            <Stack.Screen name="FocusTimer" component={FocusTimerScreen} />

            {/* 명예의 전당 */}
            <Stack.Screen name="HallOfFameScreen" component={HallOfFameScreen} />

            {/* 설정/백업 */}
            <Stack.Screen name="DataIntegrations" component={DataIntegrationsScreen} />
 <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Backup" component={BackupScreen} />
            <Stack.Screen name="Trash" component={TrashScreen} />

            {/* 전체 일정 알림 */}
            <Stack.Screen
              name="FullRangeNotification"
              component={require('./screens/FullRangeNotificationScreen').default}
            />
            {/* 기본 알림 템플릿 */}
            <Stack.Screen
              name="NotificationDefaults"
              component={NotificationDefaultsScreen}
            />
        <Stack.Screen
          name="DashboardEdit"
          component={DashboardEditScreen}
          options={{ headerShown: false }}
        />
          </Stack.Navigator>
          </View>
          {!!dockActive && (
            <MainDock
              active={dockActive}
              navigationRef={appNavigationRef}
            />
          )}
          <FocusMiniTimer
            navigationRef={appNavigationRef}
            routeName={currentRouteName}
          />
          <FocusOverlayController />
          </View>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: color.background,
  },
  navigationHost: {
    flex: 1,
    minHeight: 0,
  },
  startupWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  startupImage: {
    width: '70%',
    height: '30%',
  },
});
