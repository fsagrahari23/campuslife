import 'react-native-get-random-values';
import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/contexts/AuthContext';
import { DatabaseProvider } from '../src/contexts/DatabaseContext';
import { SyncProvider } from '../src/contexts/SyncContext';

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <AuthProvider>
        <SyncProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal' }} />
          </Stack>
        </SyncProvider>
      </AuthProvider>
    </DatabaseProvider>
  );
}
