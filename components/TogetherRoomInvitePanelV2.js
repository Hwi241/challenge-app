import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import TogetherQrCode from './TogetherQrCode';
import { buildTogetherInviteLink } from '../utils/togetherV2';
import { color, font, primitive, radius, space } from '../styles/common';

export default function TogetherRoomInvitePanelV2({ activeInvite, memberCount = 0, onManage }) {
  const [expanded, setExpanded] = useState(false);
  const waiting = memberCount <= 1;
  const visible = waiting || expanded;
  const code = String(activeInvite?.code ?? '').trim();
  const link = buildTogetherInviteLink(code);

  const copyLink = async () => {
    if (!link) return;
    try {
      await Clipboard.setStringAsync(link);
      Alert.alert('복사 완료', '초대 링크를 복사했어요.');
    } catch {
      Alert.alert('복사 실패', '초대 링크를 복사하지 못했어요.');
    }
  };

  if (!visible) {
    return <TouchableOpacity style={styles.collapsedButton} onPress={() => setExpanded(true)} activeOpacity={0.84} accessibilityRole="button" accessibilityLabel="추가 초대하기"><Text style={styles.collapsedButtonText}>+ 추가 초대하기</Text></TouchableOpacity>;
  }

  return <View style={styles.panel}>
    <View style={styles.header}><Text style={styles.title}>{waiting ? '친구 초대하기' : '추가 초대하기'}</Text>{!waiting ? <TouchableOpacity onPress={() => setExpanded(false)} accessibilityRole="button" accessibilityLabel="초대 영역 접기"><Text style={styles.foldText}>접기</Text></TouchableOpacity> : null}</View>
    {link ? <><Text style={styles.description}>QR을 스캔하거나 링크를 보내 친구를 초대하세요.</Text><View style={styles.qr}><TogetherQrCode value={link} size={186} color={primitive.black} backgroundColor={primitive.white} /></View><Text style={styles.label}>초대 코드</Text><Text style={styles.code} selectable>{code}</Text><TouchableOpacity style={styles.copyButton} onPress={() => { void copyLink(); }} activeOpacity={0.84} accessibilityRole="button" accessibilityLabel="초대 링크 복사"><Text style={styles.copyText}>초대 링크 복사</Text></TouchableOpacity></> : <><Text style={styles.description}>현재 사용 가능한 초대 링크가 없습니다.</Text><TouchableOpacity style={styles.copyButton} onPress={onManage} activeOpacity={0.84} accessibilityRole="button" accessibilityLabel="초대 링크 재발급 관리"><Text style={styles.copyText}>초대 링크 재발급</Text></TouchableOpacity></>}
  </View>;
}

const styles = StyleSheet.create({
  panel: { marginTop: space.lg, padding: space.md, borderWidth: 1, borderColor: color.border, borderRadius: radius.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: color.textPrimary, fontSize: 16, fontWeight: font.weight.heavy },
  foldText: { color: color.textSecondary, fontSize: 12 },
  description: { marginTop: 9, color: color.textSecondary, fontSize: 12, lineHeight: 19 },
  qr: { alignSelf: 'center', marginTop: 16, padding: 12, backgroundColor: primitive.white, borderRadius: radius.md },
  label: { marginTop: 16, color: color.textSecondary, fontSize: 12, textAlign: 'center' },
  code: { marginTop: 6, color: color.textPrimary, fontSize: 20, fontWeight: font.weight.heavy, letterSpacing: 2, textAlign: 'center' },
  copyButton: { minHeight: 46, marginTop: 18, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: primitive.black, borderRadius: radius.md },
  copyText: { color: primitive.white, fontSize: 14, fontWeight: font.weight.bold },
  collapsedButton: { minHeight: 44, marginTop: space.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: primitive.black, borderRadius: radius.md },
  collapsedButtonText: { color: primitive.black, fontSize: 13, fontWeight: font.weight.bold },
});
