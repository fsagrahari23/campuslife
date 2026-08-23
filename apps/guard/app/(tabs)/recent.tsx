import { View, Text, FlatList } from 'react-native';
import { useSync } from '../../src/contexts/SyncContext';

export default function RecentScansScreen() {
  const { recentScans } = useSync();

  return (
    <View className="flex-1 bg-slate-900 p-4">
      <Text className="text-white text-2xl font-bold mb-4 mt-2">Recent Scans</Text>
      <FlatList
        data={recentScans}
        renderItem={({ item }) => (
          <View className="bg-slate-800 rounded-xl p-4 mb-3 border border-slate-700/50">
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1">
                <Text className="text-white font-semibold">{item.studentName || 'Unknown'}</Text>
                <Text className="text-slate-400 text-sm">{item.rollNumber || 'N/A'}</Text>
              </View>
              <View className={`px-3 py-1 rounded-full ${item.scanType === 'OUTGOING' ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                <Text className={`text-xs font-bold ${item.scanType === 'OUTGOING' ? 'text-red-400' : 'text-green-400'}`}>
                  {item.scanType === 'OUTGOING' ? 'OUT' : 'IN'}
                </Text>
              </View>
            </View>
            <View className="flex-row justify-between">
              <Text className={`text-xs font-medium ${item.result === 'VALID' ? 'text-green-400' : 'text-red-400'}`}>
                {item.result === 'VALID' ? '✅ Valid' : '❌ Invalid'}
              </Text>
              <Text className="text-slate-500 text-xs">
                {new Date(item.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          </View>
        )}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View className="items-center py-16">
            <Text className="text-4xl mb-3">📷</Text>
            <Text className="text-slate-400">No scans yet</Text>
          </View>
        }
      />
    </View>
  );
}
