import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ChallengeListScreen from './screens/ChallengeListScreen';
import AddChallengeScreen from './screens/AddChallengeScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
