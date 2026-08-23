import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useSync } from '../../src/contexts/SyncContext';

export default function SettingsScreen() {
  const { user, profile, logout } = useAuth();
  const { isOnline, lastSyncTime, pendingCount, syncNow } = useSync();

  return (
    <View className="flex-1 bg-slate-900 p-4">
      <Text className="text-white text-2xl font-bold mb-6 mt-2">Settings</Text>

      <View className="bg-slate-800 rounded-2xl p-5 border border-slate-700 mb-4">
        <View className="items-center mb-3">
          <View className="w-14 h-14 bg-emerald-600 rounded-full items-center justify-center mb-2">
            <Text className="text-white text-xl font-bold">🛡️</Text>
          </View>
          <Text className="text-white text-lg font-bold">{profile?.name || 'Guard'}</Text>
          <Text className="text-slate-400 text-sm">{user?.email}</Text>
        </View>
      </View>

      <View className="bg-slate-800 rounded-2xl p-4 border border-slate-700 mb-4">
        <Text className="text-white font-semibold mb-3">Sync Status</Text>
        <Row label="Connection" value={isOnline ? '🟢 Online' : '🟠 Offline'} />
        <Row label="Last Sync" value={lastSyncTime || 'Never'} />
        <Row label="Pending Events" value={pendingCount.toString()} />
        <TouchableOpacity className="bg-emerald-600/20 rounded-xl py-3 items-center mt-3" onPress={syncNow}>
          <Text className="text-emerald-400 font-semibold">Sync Now</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        className="bg-red-500/20 rounded-2xl py-4 items-center border border-red-500/30"
        onPress={() => Alert.alert('Logout', 'Sure?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login'); } },
        ])}
      >
        <Text className="text-red-400 font-semibold">Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2 border-b border-slate-700/50">
      <Text className="text-slate-400 text-sm">{label}</Text>
      <Text className="text-white text-sm font-medium">{value}</Text>
    </View>
  );
}
