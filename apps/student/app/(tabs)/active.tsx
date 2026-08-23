import { View, Text, ScrollView } from 'react-native';
import { useSync } from '../../src/contexts/SyncContext';

import QRCode from 'react-native-qrcode-svg';

export default function ActivePassScreen() {
  const { activePass } = useSync();

  if (!activePass) {
    return (
      <View className="flex-1 bg-slate-900 items-center justify-center p-6">
        <Text className="text-5xl mb-4">🎫</Text>
        <Text className="text-white text-xl font-bold mb-2">No Active Pass</Text>
        <Text className="text-slate-400 text-center">
          You don't have an approved or active gate pass right now. Create one from the dashboard.
        </Text>
      </View>
    );
  }

  const statusColors: Record<string, string> = {
    PENDING: 'bg-amber-500',
    APPROVED: 'bg-green-500',
    OUT: 'bg-blue-500',
    REJECTED: 'bg-red-500',
    CANCELLED: 'bg-slate-500',
    EXPIRED: 'bg-slate-500',
    IN: 'bg-slate-500',
  };

  return (
    <ScrollView className="flex-1 bg-slate-900 p-4">
      <View className="bg-slate-800 rounded-2xl p-6 border border-slate-700 mt-2">
        {/* Status Badge */}
        <View className="items-center mb-6">
          <View className={`${statusColors[activePass.status] || 'bg-slate-500'} px-4 py-1.5 rounded-full mb-3`}>
            <Text className="text-white font-bold text-sm">{activePass.status}</Text>
          </View>
          <Text className="text-white text-xl font-bold">{activePass.destination}</Text>
          <Text className="text-slate-400 mt-1">{activePass.purpose}</Text>
        </View>

        {/* QR Code or Status Card */}
        {activePass.status === 'PENDING' ? (
          <View className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 items-center mb-6">
            <Text className="text-3xl mb-2">⏳</Text>
            <Text className="text-amber-400 font-bold text-base mb-1">Awaiting Admin Approval</Text>
            <Text className="text-slate-400 text-xs text-center leading-5">
              Your gate pass request has been submitted. Once an administrator approves your request, your cryptographically signed QR code will appear here for gate verification.
            </Text>
          </View>
        ) : (activePass.status === 'APPROVED' || activePass.status === 'OUT') ? (
          <View className="bg-white rounded-2xl p-6 items-center mb-6">
            <Text className="text-slate-900 text-sm font-semibold mb-3">Show this QR at the gate</Text>
            <View className="p-4 bg-white rounded-2xl shadow-sm">
              <QRCode
                value={activePass.signature || JSON.stringify({ id: activePass.id, rollNumber: activePass.rollNumber })}
                size={240}
                color="#0f172a"
                backgroundColor="#ffffff"
              />
            </View>
            <Text className="text-slate-500 text-xs mt-3">
              {activePass.signature ? 'Cryptographically signed by Admin' : 'Pass ID: ' + activePass.id?.slice(0, 8)}
            </Text>
          </View>
        ) : null}

        {/* Pass Details */}
        <View className="gap-3">
          <DetailRow label="Roll Number" value={activePass.rollNumber} />
          <DetailRow label="Student" value={activePass.studentName} />
          <DetailRow label="Valid From" value={new Date(activePass.validFrom).toLocaleString()} />
          <DetailRow label="Valid Until" value={new Date(activePass.validUntil).toLocaleString()} />
          <DetailRow label="Sync" value={activePass.syncStatus === 'SYNCED' ? '✅ Synced' : '⏳ Pending'} />
        </View>
      </View>
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2 border-b border-slate-700/50">
      <Text className="text-slate-400 text-sm">{label}</Text>
      <Text className="text-white text-sm font-medium">{value}</Text>
    </View>
  );
}
