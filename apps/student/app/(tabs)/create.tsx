import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '../../src/contexts/AuthContext';
import { useSync } from '../../src/contexts/SyncContext';
import { createGatePassSchema } from '@gatepass/validation';

export default function CreatePassScreen() {
  const { profile } = useAuth();
  const { isOnline, createPassOffline } = useSync();

  const [rollNumber, setRollNumber] = useState(profile?.rollNumber || '');
  const [studentName, setStudentName] = useState(profile?.name || '');
  const [destination, setDestination] = useState('');
  const [purpose, setPurpose] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile?.rollNumber && !rollNumber) setRollNumber(profile.rollNumber);
    if (profile?.name && !studentName) setStudentName(profile.name);
  }, [profile]);

  // Set default dates
  const setDefaultDates = () => {
    const now = new Date();
    const later = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours later
    setValidFrom(now.toISOString().slice(0, 16));
    setValidUntil(later.toISOString().slice(0, 16));
  };

  if (!validFrom) setDefaultDates();

  const handleCreate = async () => {
    setError('');
    setLoading(true);

    try {
      const data = {
        rollNumber: rollNumber.trim() || profile?.rollNumber || '',
        studentName: studentName.trim() || profile?.name || '',
        destination: destination.trim(),
        purpose: purpose.trim(),
        validFrom: new Date(validFrom).toISOString(),
        validUntil: new Date(validUntil).toISOString(),
      };

      // Validate with Zod
      const validated = createGatePassSchema.parse(data);

      // Create pass (offline-first with instant cryptographic QR)
      const result = await createPassOffline(validated);
      setCreated(result || { ...validated, id: 'pass-created' });

      // Reset form
      setDestination('');
      setPurpose('');
      setDefaultDates();
    } catch (err: any) {
      if (err.errors) {
        setError(err.errors.map((e: any) => e.message).join('\n'));
      } else {
        setError(err.message || 'Failed to create pass');
      }
    } finally {
      setLoading(false);
    }
  };

  if (created) {
    return (
      <ScrollView className="flex-1 bg-slate-900 p-4">
        <View className="bg-slate-800 rounded-2xl p-6 border border-slate-700 mt-4 mb-8">
          <View className="items-center mb-6">
            <Text className="text-4xl mb-2">🎉</Text>
            <Text className="text-white text-xl font-bold">Pass Created & Approved</Text>
            <Text className="text-slate-400 text-sm mt-1">Your QR code is ready for scanning</Text>
          </View>

          {/* QR Code */}
          <View className="bg-white rounded-2xl p-6 items-center mb-6">
            <Text className="text-slate-900 text-sm font-semibold mb-3">Show this QR at the gate</Text>
            <View className="p-4 bg-white rounded-2xl shadow-sm">
              <QRCode
                value={created.signature || JSON.stringify({ id: created.id, rollNumber: created.rollNumber, destination: created.destination })}
                size={240}
                color="#0f172a"
                backgroundColor="#ffffff"
              />
            </View>
            <Text className="text-slate-500 text-xs mt-3">Valid for Guard Scanner</Text>
          </View>

          <View className="gap-3 mb-6">
            <InfoRow label="Destination" value={created.destination} />
            <InfoRow label="Purpose" value={created.purpose} />
            <InfoRow label="From" value={new Date(created.validFrom).toLocaleString()} />
            <InfoRow label="Until" value={new Date(created.validUntil).toLocaleString()} />
            <InfoRow label="Status" value="APPROVED" highlight="green" />
          </View>

          <View className="gap-3">
            <TouchableOpacity
              className="bg-primary-500 rounded-xl py-3.5 items-center"
              onPress={() => router.push('/(tabs)/active')}
              activeOpacity={0.8}
            >
              <Text className="text-white font-semibold">Open Active Pass Tab</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-slate-700 rounded-xl py-3.5 items-center"
              onPress={() => setCreated(null)}
              activeOpacity={0.8}
            >
              <Text className="text-slate-200 font-medium">Create Another</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-900 p-4">
      <Text className="text-white text-2xl font-bold mb-6 mt-2">Create Gate Pass</Text>

      {error ? (
        <View className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 mb-4">
          <Text className="text-red-400 text-sm">{error}</Text>
        </View>
      ) : null}

      {/* Roll Number & Student Name */}
      <View className="mb-4">
        <Text className="text-slate-400 text-sm mb-2 ml-1">Roll Number *</Text>
        <TextInput
          className="bg-slate-800 text-white rounded-xl px-4 py-3.5 border border-slate-700"
          placeholder="e.g. CS2024001"
          placeholderTextColor="#64748b"
          value={rollNumber}
          onChangeText={setRollNumber}
          autoCapitalize="characters"
        />
      </View>

      <View className="mb-4">
        <Text className="text-slate-400 text-sm mb-2 ml-1">Student Name *</Text>
        <TextInput
          className="bg-slate-800 text-white rounded-xl px-4 py-3.5 border border-slate-700"
          placeholder="Your full name"
          placeholderTextColor="#64748b"
          value={studentName}
          onChangeText={setStudentName}
        />
      </View>

      {/* Editable fields */}
      <View className="mb-4">
        <Text className="text-slate-400 text-sm mb-2 ml-1">Destination *</Text>
        <TextInput
          className="bg-slate-800 text-white rounded-xl px-4 py-3.5 border border-slate-700"
          placeholder="e.g. Home, Hospital, Market"
          placeholderTextColor="#64748b"
          value={destination}
          onChangeText={setDestination}
        />
      </View>

      <View className="mb-4">
        <Text className="text-slate-400 text-sm mb-2 ml-1">Purpose *</Text>
        <TextInput
          className="bg-slate-800 text-white rounded-xl px-4 py-3.5 border border-slate-700"
          placeholder="Reason for leaving campus"
          placeholderTextColor="#64748b"
          value={purpose}
          onChangeText={setPurpose}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View className="flex-row gap-3 mb-4">
        <View className="flex-1">
          <Text className="text-slate-400 text-sm mb-2 ml-1">Start Date/Time</Text>
          <TextInput
            className="bg-slate-800 text-white rounded-xl px-4 py-3.5 border border-slate-700 text-sm"
            placeholder="YYYY-MM-DDTHH:MM"
            placeholderTextColor="#64748b"
            value={validFrom}
            onChangeText={setValidFrom}
          />
        </View>
        <View className="flex-1">
          <Text className="text-slate-400 text-sm mb-2 ml-1">End Date/Time</Text>
          <TextInput
            className="bg-slate-800 text-white rounded-xl px-4 py-3.5 border border-slate-700 text-sm"
            placeholder="YYYY-MM-DDTHH:MM"
            placeholderTextColor="#64748b"
            value={validUntil}
            onChangeText={setValidUntil}
          />
        </View>
      </View>

      {!isOnline && (
        <View className="bg-amber-900/30 rounded-xl p-3 mb-4 border border-amber-700/50">
          <Text className="text-amber-400 text-sm">
            📴 You're offline. Pass will be saved locally and synced when connected.
          </Text>
        </View>
      )}

      <TouchableOpacity
        className={`rounded-xl py-4 items-center ${loading ? 'bg-primary-700' : 'bg-primary-500'}`}
        onPress={handleCreate}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white text-base font-semibold">Create Gate Pass</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  const colors: Record<string, string> = {
    green: 'text-green-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
  };

  return (
    <View className="flex-row justify-between py-2 border-b border-slate-700/50">
      <Text className="text-slate-400 text-sm">{label}</Text>
      <Text className={`text-sm font-medium ${highlight ? colors[highlight] : 'text-white'}`}>
        {value}
      </Text>
    </View>
  );
}
