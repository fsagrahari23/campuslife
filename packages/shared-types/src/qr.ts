// QR payload (the data that gets signed)
export interface QRPayload {
  passId: string;
  studentId: string;
  rollNumber: string;
  studentName: string;
  destination: string;
  validFrom: string;
  validUntil: string;
  version: number;
}

// Signed QR payload (what's encoded in the QR code)
export interface SignedQRPayload extends QRPayload {
  signature: string;
}

// Device info
export interface DeviceInfo {
  deviceId: string;
  deviceType: 'student' | 'guard';
  platform: string;
  appVersion: string;
}

// Device registration
export interface DeviceRegistration {
  deviceId: string;
  userId: string;
  deviceType: string;
}
