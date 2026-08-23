import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useSync } from '../../src/contexts/SyncContext';

export default function HistoryScreen() {
  const { passes } = useSync();

  const statusColors: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
    APPROVED: { bg: 'bg-green-500/20', text: 'text-green-400' },
    OUT: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    IN: { bg: 'bg-slate-500/20', text: 'text-slate-400' },
    REJECTED: { bg: 'bg-red-500/20', text: 'text-red-400' },
    CANCELLED: { bg: 'bg-slate-500/20', text: 'text-slate-400' },
    EXPIRED: { bg: 'bg-slate-500/20', text: 'text-slate-400' },
  };

  const renderItem = ({ item }: { item: any }) => {
    const colors = statusColors[item.status] || statusColors.PENDING;
    return (
      <View className="bg-slate-800 rounded-xl p-4 mb-3 border border-slate-700/50">
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1 mr-3">
            <Text className="text-white font-semibold text-base">{item.destination}</Text>
            <Text className="text-slate-400 text-sm mt-0.5">{item.purpose}</Text>
          </View>
          <View className={`${colors.bg} px-3 py-1 rounded-full`}>
            <Text className={`${colors.text} text-xs font-bold`}>{item.status}</Text>
          </View>
        </View>
        <View className="flex-row justify-between mt-2">
          <Text className="text-slate-500 text-xs">{new Date(item.validFrom).toLocaleDateString()}</Text>
          <Text className="text-slate-500 text-xs">
            {item.syncStatus === 'SYNCED' ? '✅ Synced' : '⏳ Pending sync'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-slate-900 p-4">
      <Text className="text-white text-2xl font-bold mb-4 mt-2">Pass History</Text>
      <FlatList
        data={passes}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View className="items-center py-16">
            <Text className="text-4xl mb-3">📋</Text>
            <Text className="text-slate-400">No passes yet</Text>
          </View>
        }
      />
    </View>
  );
}
