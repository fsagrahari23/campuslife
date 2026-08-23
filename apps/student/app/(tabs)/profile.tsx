import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useSync } from '../../src/contexts/SyncContext';

export default function ProfileScreen() {
  const { user, profile, logout } = useAuth();
  const { isOnline, lastSyncTime, pendingCount, syncNow } = useSync();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-slate-900 p-4">
      <Text className="text-white text-2xl font-bold mb-6 mt-2">Profile</Text>

      {/* User Info */}
      <View className="bg-slate-800 rounded-2xl p-6 border border-slate-700 mb-4">
        <View className="items-center mb-4">
          <View className="w-16 h-16 bg-primary-500 rounded-full items-center justify-center mb-3">
            <Text className="text-white text-2xl font-bold">
              {(profile?.name || 'S').charAt(0)}
            </Text>
          </View>
          <Text className="text-white text-lg font-bold">{profile?.name || 'Student'}</Text>
          <Text className="text-slate-400">{user?.email}</Text>
          {profile?.rollNumber && (
            <Text className="text-slate-500 text-sm mt-1">Roll No: {profile.rollNumber}</Text>
          )}
        </View>
      </View>

      {/* Sync Status */}
      <View className="bg-slate-800 rounded-2xl p-4 border border-slate-700 mb-4">
        <Text className="text-white font-semibold mb-3">Synchronization</Text>

        <View className="flex-row justify-between py-2 border-b border-slate-700/50">
          <Text className="text-slate-400 text-sm">Status</Text>
          <View className="flex-row items-center">
            <View className={`w-2 h-2 rounded-full mr-2 ${isOnline ? 'bg-green-400' : 'bg-amber-400'}`} />
            <Text className={`text-sm font-medium ${isOnline ? 'text-green-400' : 'text-amber-400'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>

        <View className="flex-row justify-between py-2 border-b border-slate-700/50">
          <Text className="text-slate-400 text-sm">Last Sync</Text>
          <Text className="text-white text-sm">{lastSyncTime || 'Never'}</Text>
        </View>

        <View className="flex-row justify-between py-2">
          <Text className="text-slate-400 text-sm">Pending Changes</Text>
          <Text className={`text-sm font-medium ${pendingCount > 0 ? 'text-amber-400' : 'text-green-400'}`}>
            {pendingCount}
          </Text>
        </View>

        <TouchableOpacity
          className="bg-primary-500/20 rounded-xl py-3 items-center mt-3"
          onPress={syncNow}
          activeOpacity={0.7}
        >
          <Text className="text-primary-400 font-semibold">Sync Now</Text>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity
        className="bg-red-500/20 rounded-2xl py-4 items-center border border-red-500/30"
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <Text className="text-red-400 font-semibold">Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}
