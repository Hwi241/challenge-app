// App.js
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ChallengeListScreen from './screens/ChallengeListScreen';
import AddChallengeScreen   from './screens/AddChallengeScreen';
import EditChallengeScreen  from './screens/EditChallengeScreen';
import UploadScreen         from './screens/UploadScreen';
import EntryListScreen      from './screens/EntryListScreen';
import EntryDetailScreen    from './screens/EntryDetailScreen';
import * as Notifications from 'expo-notifications';
import SimpleNotificationScreen from './screens/SimpleNotificationScreen';
import WeeklyNotificationScreen from './screens/WeeklyNotificationScreen';
import MonthlyNotificationScreen from './screens/MonthlyNotificationScreen';
import HallOfFameScreen from './screens/HallOfFameScreen';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="ChallengeList"
          screenOptions={{
            headerStyle: { backgroundColor: '#f8f8f8' },
            headerTitleStyle: { fontWeight: 'bold' },
            contentStyle: { backgroundColor: '#fff' },
          }}
        >
          <Stack.Screen
            name="ChallengeList"
            component={ChallengeListScreen}
            options={{ title: '도전 리스트' }}
          />
          <Stack.Screen
            name="AddChallenge"
            component={AddChallengeScreen}
            options={{ title: '도전 추가' }}
          />
          <Stack.Screen
            name="EditChallenge"
            component={EditChallengeScreen}
            options={{ title: '도전 수정' }}
          />
          <Stack.Screen
            name="Upload"
            component={UploadScreen}
            options={{ title: '인증 업로드' }}
          />
          <Stack.Screen
            name="EntryList"
            component={EntryListScreen}
            options={{ title: '인증 목록' }}
          />
          <Stack.Screen
            name="EntryDetail"
            component={EntryDetailScreen}
            options={{ title: '인증 수정' }}
          />
          <Stack.Screen name="SimpleNotification" component={SimpleNotificationScreen} />
<Stack.Screen name="WeeklyNotification" component={WeeklyNotificationScreen} />
<Stack.Screen name="MonthlyNotification" component={MonthlyNotificationScreen} />
<Stack.Screen name="HallOfFameScreen" component={HallOfFameScreen} options={{ title: '명예의 전당' }} />


        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
