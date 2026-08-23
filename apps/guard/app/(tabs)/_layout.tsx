import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#1e293b', height: 60, paddingBottom: 8 },
      tabBarActiveTintColor: '#22c55e',
      tabBarInactiveTintColor: '#64748b',
      headerStyle: { backgroundColor: '#0f172a' },
      headerTintColor: '#fff',
    }}>
      <Tabs.Screen name="index" options={{ title: 'Scanner', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📷</Text> }} />
      <Tabs.Screen name="recent" options={{ title: 'Recent', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📋</Text> }} />
      <Tabs.Screen name="queue" options={{ title: 'Queue', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📤</Text> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⚙️</Text> }} />
    </Tabs>
  );
}
