import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';

export default function GuardLoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) { setError('Please enter email and password'); return; }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-slate-900">
      <View className="flex-1 justify-center px-8">
        <View className="items-center mb-12">
          <View className="w-20 h-20 bg-emerald-600 rounded-2xl items-center justify-center mb-4">
            <Text className="text-white text-3xl font-bold">🛡️</Text>
          </View>
          <Text className="text-white text-3xl font-bold">Guard App</Text>
          <Text className="text-slate-400 text-base mt-2">Gate Security</Text>
        </View>

        {error ? (
          <View className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 mb-4">
            <Text className="text-red-400 text-center">{error}</Text>
          </View>
        ) : null}

        <View className="mb-4">
          <Text className="text-slate-400 text-sm mb-2 ml-1">Email</Text>
          <TextInput
            className="bg-slate-800 text-white rounded-xl px-4 py-3.5 text-base border border-slate-700"
            placeholder="guard@campus.edu"
            placeholderTextColor="#64748b"
            value={email} onChangeText={setEmail}
            keyboardType="email-address" autoCapitalize="none"
          />
        </View>

        <View className="mb-6">
          <Text className="text-slate-400 text-sm mb-2 ml-1">Password</Text>
          <TextInput
            className="bg-slate-800 text-white rounded-xl px-4 py-3.5 text-base border border-slate-700"
            placeholder="••••••••"
            placeholderTextColor="#64748b"
            value={password} onChangeText={setPassword} secureTextEntry
          />
        </View>

        <TouchableOpacity
          className={`rounded-xl py-4 items-center ${loading ? 'bg-emerald-700' : 'bg-emerald-600'}`}
          onPress={handleLogin} disabled={loading} activeOpacity={0.8}
        >
          {loading ? <ActivityIndicator color="white" /> : <Text className="text-white text-base font-semibold">Sign In</Text>}
        </TouchableOpacity>

        <View className="mt-8 items-center">
          <Text className="text-slate-500 text-xs">Demo: guard1@campus.edu / password123</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
