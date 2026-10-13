import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!name.trim() || !rollNumber.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await register({
        name: name.trim(),
        rollNumber: rollNumber.trim(),
        department: department.trim() || 'General',
        email: email.trim().toLowerCase(),
        password,
      });
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-900"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        className="px-8 py-10"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="items-center mb-6">
          <View className="w-16 h-16 bg-primary-500 rounded-2xl items-center justify-center mb-3">
            <Text className="text-white text-2xl font-bold">GP</Text>
          </View>
          <Text className="text-white text-2xl font-bold">Create Account</Text>
          <Text className="text-slate-400 text-sm mt-1">Student Registration</Text>
        </View>

        {/* Tab Switcher */}
        <View className="flex-row bg-slate-800 p-1 rounded-xl mb-6 border border-slate-700">
          <TouchableOpacity
            className="flex-1 py-2.5 rounded-lg items-center"
            onPress={() => router.replace('/(auth)/login')}
            activeOpacity={0.8}
          >
            <Text className="text-slate-400 font-semibold text-sm">Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 py-2.5 rounded-lg items-center bg-primary-500"
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-sm">Register</Text>
          </TouchableOpacity>
        </View>

        {/* Error */}
        {error ? (
          <View className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 mb-4">
            <Text className="text-red-400 text-center text-sm">{error}</Text>
          </View>
        ) : null}

        {/* Full Name */}
        <View className="mb-4">
          <Text className="text-slate-400 text-sm mb-1.5 ml-1">Full Name *</Text>
          <TextInput
            className="bg-slate-800 text-white rounded-xl px-4 py-3 text-base border border-slate-700"
            placeholder="Rahul Kumar"
            placeholderTextColor="#64748b"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        {/* Roll Number */}
        <View className="mb-4">
          <Text className="text-slate-400 text-sm mb-1.5 ml-1">Roll Number / Student ID *</Text>
          <TextInput
            className="bg-slate-800 text-white rounded-xl px-4 py-3 text-base border border-slate-700"
            placeholder="20231234"
            placeholderTextColor="#64748b"
            value={rollNumber}
            onChangeText={setRollNumber}
            autoCapitalize="characters"
          />
        </View>

        {/* Department */}
        <View className="mb-4">
          <Text className="text-slate-400 text-sm mb-1.5 ml-1">Department</Text>
          <TextInput
            className="bg-slate-800 text-white rounded-xl px-4 py-3 text-base border border-slate-700"
            placeholder="Computer Science"
            placeholderTextColor="#64748b"
            value={department}
            onChangeText={setDepartment}
          />
        </View>

        {/* Email */}
        <View className="mb-4">
          <Text className="text-slate-400 text-sm mb-1.5 ml-1">Email Address *</Text>
          <TextInput
            className="bg-slate-800 text-white rounded-xl px-4 py-3 text-base border border-slate-700"
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
        <View className="mb-4">
          <Text className="text-slate-400 text-sm mb-1.5 ml-1">Password *</Text>
          <TextInput
            className="bg-slate-800 text-white rounded-xl px-4 py-3 text-base border border-slate-700"
            placeholder="Min 6 characters"
            placeholderTextColor="#64748b"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        {/* Confirm Password */}
        <View className="mb-6">
          <Text className="text-slate-400 text-sm mb-1.5 ml-1">Confirm Password *</Text>
          <TextInput
            className="bg-slate-800 text-white rounded-xl px-4 py-3 text-base border border-slate-700"
            placeholder="Re-enter password"
            placeholderTextColor="#64748b"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </View>

        {/* Register Button */}
        <TouchableOpacity
          className={`rounded-xl py-4 items-center ${loading ? 'bg-primary-700' : 'bg-primary-500'}`}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-base font-semibold">Create Student Account</Text>
          )}
        </TouchableOpacity>

        {/* Switch to Login link */}
        <View className="flex-row justify-center mt-6">
          <Text className="text-slate-400 text-sm">Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text className="text-primary-400 font-semibold text-sm">Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
