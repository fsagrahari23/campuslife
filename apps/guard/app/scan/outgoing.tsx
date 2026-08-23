import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Platform, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useSync } from '../../src/contexts/SyncContext';

export default function OutgoingScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [manualQR, setManualQR] = useState('');
  const { processScan } = useSync();

  const handleScan = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    try {
      const scanResult = await processScan(data, 'OUTGOING');
      setResult(scanResult);
    } catch (error) {
      setResult({ valid: false, errorMessage: error instanceof Error ? error.message : 'Scan failed' });
    }
  };

  const handleManualScan = () => {
    if (!manualQR.trim()) return;
    handleScan({ data: manualQR.trim() });
  };

  if (!permission || !permission.granted) {
    return (
      <ScrollView className="flex-1 bg-slate-900 p-6">
        <View className="items-center mt-12 mb-6">
          <Text className="text-4xl mb-3">📷</Text>
          <Text className="text-white text-xl font-bold text-center">Camera Access / Manual Scan</Text>
          <Text className="text-slate-400 text-center text-sm mt-2">
            {Platform.OS === 'web' && typeof window !== 'undefined' && !window.isSecureContext
              ? 'Note: Mobile browsers require HTTPS for camera access. You can paste QR data below.'
              : 'Grant camera access to scan QR codes or enter QR data manually.'}
          </Text>
        </View>

        <TouchableOpacity className="bg-primary-500 py-3.5 rounded-xl items-center mb-6" onPress={requestPermission}>
          <Text className="text-white font-semibold">Try Camera Permission</Text>
        </TouchableOpacity>

        <View className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
          <Text className="text-slate-300 font-semibold mb-2">Manual QR Verification</Text>
          <Text className="text-slate-400 text-xs mb-3">Paste the signed QR payload or pass ID:</Text>
          <TextInput
            className="bg-slate-900 text-white rounded-xl p-3 border border-slate-700 text-sm mb-4 min-h-[80px]"
            placeholder="Paste QR payload JSON or string..."
            placeholderTextColor="#64748b"
            value={manualQR}
            onChangeText={setManualQR}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity
            className="bg-red-600 rounded-xl py-3 items-center"
            onPress={handleManualScan}
            disabled={!manualQR.trim()}
          >
            <Text className="text-white font-semibold">Verify Outgoing Pass</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity className="mt-6 items-center" onPress={() => router.back()}>
          <Text className="text-slate-400">← Back to Dashboard</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (result) {
    return (
      <View className="flex-1 bg-slate-900 items-center justify-center p-6">
        <View className={`rounded-3xl p-8 items-center w-full ${result.valid ? 'bg-green-900/40 border-2 border-green-500' : 'bg-red-900/40 border-2 border-red-500'}`}>
          <Text className="text-6xl mb-4">{result.valid ? '✅' : '❌'}</Text>
          <Text className={`text-2xl font-bold mb-4 ${result.valid ? 'text-green-400' : 'text-red-400'}`}>
            {result.valid ? 'VALID PASS' : 'INVALID'}
          </Text>

          {result.valid && (
            <View className="w-full gap-2 mb-4">
              <DetailRow label="Student" value={result.studentName || 'Unknown'} />
              <DetailRow label="Roll No" value={result.rollNumber || 'N/A'} />
              <DetailRow label="Destination" value={result.destination || 'N/A'} />
              <DetailRow label="Status" value="APPROVED → OUT" highlight />
            </View>
          )}

          {!result.valid && (
            <Text className="text-red-300 text-center mb-4">{result.errorMessage}</Text>
          )}

          <View className="flex-row gap-3 w-full mt-2">
            <TouchableOpacity
              className="flex-1 bg-slate-700 rounded-xl py-3 items-center"
              onPress={() => { setScanned(false); setResult(null); }}
            >
              <Text className="text-white font-semibold">Scan Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-slate-600 rounded-xl py-3 items-center"
              onPress={() => router.back()}
            >
              <Text className="text-white font-semibold">Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* Header */}
      <View className="absolute top-0 left-0 right-0 z-10 bg-red-900/80 px-4 py-3 pt-14">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-white text-base">← Back</Text>
          </TouchableOpacity>
          <Text className="text-red-300 text-lg font-bold">OUTGOING SCAN</Text>
          <View style={{ width: 50 }} />
        </View>
        <Text className="text-red-200/70 text-center text-sm mt-1">Student leaving campus</Text>
      </View>

      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        autofocus="on"
        onBarcodeScanned={scanned ? undefined : handleScan}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Scan overlay */}
      <View className="absolute inset-0 items-center justify-center">
        <View className="w-64 h-64 border-2 border-white/50 rounded-3xl" />
        <Text className="text-white/70 mt-4 text-sm">Point camera at student's QR code</Text>
      </View>
    </View>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View className="flex-row justify-between py-1.5">
      <Text className="text-slate-400 text-sm">{label}</Text>
      <Text className={`text-sm font-medium ${highlight ? 'text-green-400' : 'text-white'}`}>{value}</Text>
    </View>
  );
}
