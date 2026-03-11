import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from './src/screens/HomeScreen';
import LogListScreen from './src/screens/LogListScreen';
import MapScreen from './src/screens/MapScreen';
import { ActivityRecord } from './src/database/db';

// ─── Types de navigation ──────────────────────────────────────────────────────

export type RootStackParamList = {
  Home: undefined;
  LogList: undefined;
  Map: { activity: ActivityRecord };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: { backgroundColor: '#1a1a2e' },
            headerTintColor: '#ffffff',
            headerTitleStyle: { fontWeight: 'bold' },
            contentStyle: { backgroundColor: '#16213e' },
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="LogList"
            component={LogListScreen}
            options={{ title: 'Activités' }}
          />
          <Stack.Screen
            name="Map"
            component={MapScreen}
            options={({ route }) => ({
              title: route.params.activity.date
                ? new Date(route.params.activity.date).toLocaleDateString('fr-FR')
                : 'Parcours',
            })}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
