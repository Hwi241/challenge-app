import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, font, radius, space, surface as surfaceStyles } from '../styles/common';
import { parseTogetherInviteCode } from '../utils/togetherV2';

export default function TogetherQrScanScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState('QR 코드를 화면 안에 맞춰주세요.');
  const scan = ({ data }) => {
    if (locked) return;
    const code = parseTogetherInviteCode(data);
    if (!code) { setLocked(true); setMessage('THE PUSH 초대 QR이 아니에요.'); setTimeout(() => { setLocked(false); setMessage('QR 코드를 화면 안에 맞춰주세요.'); }, 1200); return; }
    setLocked(true);
    navigation.replace('TogetherInviteAccept', { code });
  };
  return <SafeAreaView style={surfaceStyles.screen}>
    <View style={styles.header}><TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹</Text></TouchableOpacity><Text style={styles.title}>QR로 참여</Text><View style={styles.side} /></View>
    {!permission?.granted ? <View style={styles.center}><Text style={styles.help}>Together 초대 QR을 스캔하려면 카메라 권한이 필요합니다.</Text><TouchableOpacity style={styles.button} onPress={requestPermission}><Text style={styles.buttonText}>카메라 권한 허용</Text></TouchableOpacity></View> : <View style={styles.cameraWrap}><CameraView style={styles.camera} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={scan} /><Text style={styles.message}>{message}</Text></View>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md }, back: { fontSize: 34 }, title: { fontSize: 16, fontWeight: font.weight.heavy }, side: { width: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }, help: { textAlign: 'center', color: color.textSecondary, lineHeight: 20 },
  button: { marginTop: 18, minHeight: 46, paddingHorizontal: 20, borderRadius: radius.md, backgroundColor: color.textPrimary, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: color.background, fontWeight: font.weight.bold },
  cameraWrap: { flex: 1, padding: space.md }, camera: { flex: 1, borderRadius: radius.md, overflow: 'hidden' }, message: { paddingVertical: 18, textAlign: 'center', color: color.textPrimary, fontWeight: font.weight.bold },
});
