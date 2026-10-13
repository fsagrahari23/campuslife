import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-900"
    >
      <View className="flex-1 justify-center px-8">
        {/* Header */}
        <View className="items-center mb-6">
          <View className="w-16 h-16 bg-primary-500 rounded-2xl items-center justify-center mb-3">
            <Text className="text-white text-2xl font-bold">GP</Text>
          </View>
          <Text className="text-white text-2xl font-bold">Gate Pass</Text>
          <Text className="text-slate-400 text-sm mt-1">Student Portal</Text>
        </View>

        {/* Tab Switcher */}
        <View className="flex-row bg-slate-800 p-1 rounded-xl mb-6 border border-slate-700">
          <TouchableOpacity
            className="flex-1 py-2.5 rounded-lg items-center bg-primary-500"
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-sm">Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 py-2.5 rounded-lg items-center"
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.8}
          >
            <Text className="text-slate-400 font-semibold text-sm">Register</Text>
          </TouchableOpacity>
        </View>

        {/* Error */}
        {error ? (
          <View className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 mb-4">
            <Text className="text-red-400 text-center text-sm">{error}</Text>
          </View>
        ) : null}

        {/* Email */}
        <View className="mb-4">
          <Text className="text-slate-400 text-sm mb-2 ml-1">Email</Text>
          <TextInput
            className="bg-slate-800 text-white rounded-xl px-4 py-3.5 text-base border border-slate-700"
            placeholder="student@campus.edu"
            placeholderTextColor="#64748b"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Password */}
        <View className="mb-6">
          <Text className="text-slate-400 text-sm mb-2 ml-1">Password</Text>
          <TextInput
            className="bg-slate-800 text-white rounded-xl px-4 py-3.5 text-base border border-slate-700"
            placeholder="••••••••"
            placeholderTextColor="#64748b"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        {/* Login Button */}
        <TouchableOpacity
          className={`rounded-xl py-4 items-center ${loading ? 'bg-primary-700' : 'bg-primary-500'}`}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-base font-semibold">Sign In</Text>
          )}
        </TouchableOpacity>

        {/* Switch to Register link */}
        <View className="flex-row justify-center mt-6">
          <Text className="text-slate-400 text-sm">Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text className="text-primary-400 font-semibold text-sm">Create One</Text>
          </TouchableOpacity>
        </View>

        {/* Demo credentials */}
        <View className="mt-6 items-center">
          <Text className="text-slate-500 text-xs">Demo: rahul@campus.edu / password123</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
