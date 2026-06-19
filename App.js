// App.js
import 'react-native-gesture-handler'; // ✅ 반드시 최상단에!
import React, { useEffect, useState } from 'react';
import { Image, View, StyleSheet, Platform, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

import NotificationDefaultsScreen from './screens/NotificationDefaultsScreen';
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
import TrashScreen from './screens/TrashScreen';
import ProfileInventoryScreen from './screens/ProfileInventoryScreen';
import WidgetShopScreen from './screens/WidgetShopScreen';
import GraphShopScreen from './screens/GraphShopScreen';
import MyGraphScreen from './screens/MyGraphScreen';

import { colors } from './styles/common';
import { syncWidgetChallengeList } from './utils/widgetSync';
import { cleanExpiredTrash } from './utils/trash';
import { initializeNotificationsAsync } from './utils/notificationScheduler';
import { PURCHASED_GRAPHS_KEY } from './utils/graphOwnership';
import { DASHBOARD_LAYOUTS_KEY, DASHBOARD_ROW_GAPS_KEY } from './utils/dashboardLayout';
import { STAR_KEYS } from './utils/starWallet';
import DashboardEditScreen from './screens/DashboardEditScreen';

const Stack = createNativeStackNavigator();

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
      HallOfFameScreen: 'hall-of-fame',
      ProfileInventory: 'profile-inventory',
      WidgetShop: 'widget-shop',
      MyGraphs: 'my-graphs',
      Settings: 'settings',
      Backup: 'backup',
      FullRangeNotification: 'full-range',
      NotificationDefaults: 'notification-defaults',
    },
  },
};

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

const DEV_GRAPH_LINK_RESET_ONCE_KEY = 'dev_graph_link_reset_20260618_v1';
const DEV_GRAPH_LINK_RESET_STAR_BALANCE = 10000;
const LEGACY_DASHBOARD_GRAPH_WIDGET_IDS = new Set([
  'weekly_bar',
  'line_count_cumulative',
  'line_minutes',
  'grass_graph',
]);

const parseJsonSafe = (raw, fallback) => {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const removeLegacyGraphWidgetsFromLayoutMap = (layoutMap) => {
  if (!layoutMap || typeof layoutMap !== 'object' || Array.isArray(layoutMap)) return {};

  return Object.entries(layoutMap).reduce((nextMap, [key, value]) => {
    if (!Array.isArray(value)) {
      nextMap[key] = value;
      return nextMap;
    }

    const filteredLayout = value.filter((item) => {
      const widgetId = String(item?.widgetId || item?.id || item?.i || '');
      return !LEGACY_DASHBOARD_GRAPH_WIDGET_IDS.has(widgetId);
    });

    nextMap[key] = filteredLayout;
    return nextMap;
  }, {});
};

const runGraphLinkResetOnce = async () => {
  const alreadyDone = await AsyncStorage.getItem(DEV_GRAPH_LINK_RESET_ONCE_KEY);
  if (alreadyDone === '1') return;

  const rawLayoutMap = await AsyncStorage.getItem(DASHBOARD_LAYOUTS_KEY);
  const layoutMap = parseJsonSafe(rawLayoutMap, {});
  const cleanedLayoutMap = removeLegacyGraphWidgetsFromLayoutMap(layoutMap);

  await AsyncStorage.multiSet([
    [PURCHASED_GRAPHS_KEY, JSON.stringify([])],
    [DASHBOARD_LAYOUTS_KEY, JSON.stringify(cleanedLayoutMap)],
    [STAR_KEYS.wallet, JSON.stringify({
      balance: DEV_GRAPH_LINK_RESET_STAR_BALANCE,
      updatedAt: Date.now(),
    })],
    [STAR_KEYS.bootstrap, '1'],
    [DEV_GRAPH_LINK_RESET_ONCE_KEY, '1'],
  ]);

  await AsyncStorage.removeItem(DASHBOARD_ROW_GAPS_KEY);

  console.log('[GraphLinkReset] reset graph ownership, dashboard graph widgets, and star wallet once');
};

export default function App() {
  const [showStartup, setShowStartup] = useState(true);

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
    initializeNotificationsAsync();
  }, []);

  // 휴지통 만료 항목 자동 정리 (30일 경과)
  useEffect(() => {
    cleanExpiredTrash(30);
  }, []);

  // 633 migration: 그래프 연동 준비 1회 리셋 + 별 10000개 지급
  useEffect(() => {
    runGraphLinkResetOnce().catch((error) => {
      console.warn('[GraphLinkReset] reset failed:', error);
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar translucent={false} backgroundColor={colors.background} barStyle="dark-content" />
      <SafeAreaProvider>
        <NavigationContainer linking={linking}>
          <Stack.Navigator
            initialRouteName={showStartup ? 'Startup' : 'ChallengeList'}
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            {/* 스타트업 */}
            {showStartup && <Stack.Screen name="Startup" component={StartupScreen} />}

            {/* 메인 */}
            <Stack.Screen name="ChallengeList" component={ChallengeListScreen} />
        <Stack.Screen name="ProfileInventory" component={ProfileInventoryScreen} />
        <Stack.Screen name="WidgetShop" component={GraphShopScreen} />
        <Stack.Screen name="MyGraphs" component={MyGraphScreen} />

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
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
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