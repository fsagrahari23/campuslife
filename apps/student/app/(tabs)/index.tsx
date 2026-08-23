import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useSync } from '../../src/contexts/SyncContext';

export default function DashboardScreen() {
  const { user, profile } = useAuth();
  const { isOnline, lastSyncTime, pendingCount, syncNow } = useSync();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncNow();
    setRefreshing(false);
  }, [syncNow]);

  return (
    <ScrollView
      className="flex-1 bg-slate-900"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
    >
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
            {lastSyncTime ? `Last synced: ${lastSyncTime}` : 'Not yet synced'}
          </Text>
        </View>
        {pendingCount > 0 && (
          <Text className="text-amber-400 text-xs mt-1">
            {pendingCount} pending change{pendingCount > 1 ? 's' : ''} waiting to sync
          </Text>
        )}
      </View>

      <View className="p-4">
        {/* Welcome */}
        <View className="mb-6">
          <Text className="text-slate-400 text-base">Welcome back,</Text>
          <Text className="text-white text-2xl font-bold">{profile?.name || 'Student'}</Text>
          {profile?.rollNumber && (
            <Text className="text-slate-500 text-sm mt-1">Roll No: {profile.rollNumber}</Text>
          )}
        </View>

        {/* Quick Actions */}
        <TouchableOpacity
          className="bg-primary-500 rounded-2xl p-6 mb-4"
          onPress={() => router.push('/(tabs)/create')}
          activeOpacity={0.8}
        >
          <Text className="text-white text-lg font-bold mb-1">Create Gate Pass</Text>
          <Text className="text-primary-200 text-sm">Request permission to leave campus</Text>
        </TouchableOpacity>

        <View className="flex-row gap-3 mb-6">
          <TouchableOpacity
            className="flex-1 bg-slate-800 rounded-2xl p-4 border border-slate-700"
            onPress={() => router.push('/(tabs)/active')}
            activeOpacity={0.8}
          >
            <Text className="text-2xl mb-2">📱</Text>
            <Text className="text-white font-semibold">Active Pass</Text>
            <Text className="text-slate-400 text-xs mt-1">View QR Code</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 bg-slate-800 rounded-2xl p-4 border border-slate-700"
            onPress={() => router.push('/(tabs)/history')}
            activeOpacity={0.8}
          >
            <Text className="text-2xl mb-2">📋</Text>
            <Text className="text-white font-semibold">History</Text>
            <Text className="text-slate-400 text-xs mt-1">All passes</Text>
          </TouchableOpacity>
        </View>

        {/* Info Card */}
        <View className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
          <Text className="text-slate-300 text-sm font-medium mb-2">How it works</Text>
          <Text className="text-slate-400 text-xs leading-5">
            1. Create a gate pass request{'\n'}
            2. Wait for admin approval{'\n'}
            3. Show QR code at the gate{'\n'}
            4. Works offline after approval
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
