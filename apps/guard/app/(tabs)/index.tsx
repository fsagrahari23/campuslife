import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSync } from '../../src/contexts/SyncContext';

export default function GuardDashboard() {
  const { isOnline, lastSyncTime, pendingCount } = useSync();

  return (
    <View className="flex-1 bg-slate-900">
      {/* Sync Status Bar */}
      <View className={`px-4 py-2 ${isOnline ? 'bg-green-900/30' : 'bg-amber-900/30'}`}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className={`w-2.5 h-2.5 rounded-full mr-2 ${isOnline ? 'bg-green-400' : 'bg-amber-400'}`} />
            <Text className={`text-sm font-medium ${isOnline ? 'text-green-400' : 'text-amber-400'}`}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </Text>
          </View>
          <Text className="text-slate-400 text-xs">
            {lastSyncTime ? `Synced: ${lastSyncTime}` : 'Not synced'}
          </Text>
        </View>
        {pendingCount > 0 && (
          <Text className="text-amber-400 text-xs mt-1">
            {pendingCount} scan{pendingCount > 1 ? 's' : ''} pending sync
          </Text>
        )}
      </View>

      <View className="flex-1 justify-center p-6 gap-6">
        {/* OUTGOING SCAN - Large Red Button */}
        <TouchableOpacity
          className="bg-red-900/40 border-2 border-red-500 rounded-3xl p-8 items-center"
          onPress={() => router.push('/scan/outgoing')}
          activeOpacity={0.7}
        >
          <Text className="text-5xl mb-4">🔴</Text>
          <Text className="text-red-400 text-2xl font-bold mb-2">OUTGOING SCAN</Text>
          <Text className="text-red-300/70 text-base text-center">Student leaving campus</Text>
          <Text className="text-red-300/50 text-sm mt-3">APPROVED → OUT</Text>
        </TouchableOpacity>

        {/* INCOMING SCAN - Large Green Button */}
        <TouchableOpacity
          className="bg-green-900/40 border-2 border-green-500 rounded-3xl p-8 items-center"
          onPress={() => router.push('/scan/incoming')}
          activeOpacity={0.7}
        >
          <Text className="text-5xl mb-4">🟢</Text>
          <Text className="text-green-400 text-2xl font-bold mb-2">INCOMING SCAN</Text>
          <Text className="text-green-300/70 text-base text-center">Student returning to campus</Text>
          <Text className="text-green-300/50 text-sm mt-3">OUT → IN</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
