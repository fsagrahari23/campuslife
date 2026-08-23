import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useSync } from '../../src/contexts/SyncContext';

export default function QueueScreen() {
  const { pendingEvents, syncNow, isOnline } = useSync();

  return (
    <View className="flex-1 bg-slate-900 p-4">
      <View className="flex-row justify-between items-center mb-4 mt-2">
        <Text className="text-white text-2xl font-bold">Offline Queue</Text>
        {isOnline && (
          <TouchableOpacity className="bg-primary-500/20 px-4 py-2 rounded-lg" onPress={syncNow}>
            <Text className="text-primary-400 font-semibold text-sm">Sync Now</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={pendingEvents}
        renderItem={({ item }) => (
          <View className="bg-slate-800 rounded-xl p-4 mb-3 border border-slate-700/50">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-white font-medium">{item.event_type}</Text>
              <View className={`px-2 py-0.5 rounded-full ${item.sync_status === 'SYNCED' ? 'bg-green-500/20' : 'bg-amber-500/20'}`}>
                <Text className={`text-xs ${item.sync_status === 'SYNCED' ? 'text-green-400' : 'text-amber-400'}`}>
                  {item.sync_status}
                </Text>
              </View>
            </View>
            <Text className="text-slate-500 text-xs">{new Date(item.created_at).toLocaleString()}</Text>
          </View>
        )}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View className="items-center py-16">
            <Text className="text-4xl mb-3">✅</Text>
            <Text className="text-slate-400">No pending events</Text>
          </View>
        }
      />
    </View>
  );
}
