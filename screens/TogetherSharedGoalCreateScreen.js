import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, font, radius, space, surface as surfaceStyles } from '../styles/common';
import { createTogetherRoomDraftV2 } from '../utils/togetherRoomDrafts';

const dateKey = () => new Date().toISOString().slice(0, 10);
export default function TogetherSharedGoalCreateScreen({ navigation, route }) {
  const card = route?.params?.selectedCard;
  const [title, setTitle] = useState(String(card?.title || ''));
  const [target, setTarget] = useState('');
  const [unit, setUnit] = useState('회');
  const [endsAt, setEndsAt] = useState('');
  const submit = async () => {
    const amount = Number(target);
    if (!card?.id || !Number.isFinite(amount) || amount <= 0 || !unit.trim()) {
      Alert.alert('공동 목표 확인', '0보다 큰 목표량과 단위를 입력해주세요.'); return;
    }
    const sharedGoal = { target: amount, unit: unit.trim().slice(0, 16), startsAt: dateKey(), endsAt: endsAt.trim() || null };
    const draft = await createTogetherRoomDraftV2({ mode: 'shared_goal', card: { ...card, title: title.trim() || card.title }, sharedGoal });
    navigation.replace('TogetherInviteDraft', { draft, draftId: draft.id });
  };
  return <SafeAreaView style={surfaceStyles.screen}>
    <View style={styles.header}><TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹</Text></TouchableOpacity><Text style={styles.headerTitle}>공동 목표 설정</Text><View style={styles.side} /></View>
    <View style={styles.content}>
      <Text style={styles.label}>공동 목표명</Text><TextInput style={styles.input} value={title} onChangeText={setTitle} maxLength={120} />
      <Text style={styles.label}>목표량</Text><TextInput style={styles.input} value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="예: 30" />
      <Text style={styles.label}>단위</Text><TextInput style={styles.input} value={unit} onChangeText={setUnit} maxLength={16} />
      <Text style={styles.label}>종료일 (선택)</Text><TextInput style={styles.input} value={endsAt} onChangeText={setEndsAt} placeholder="YYYY-MM-DD" />
      <TouchableOpacity style={styles.button} onPress={submit}><Text style={styles.buttonText}>초대 준비하기</Text></TouchableOpacity>
    </View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, borderBottomWidth: 1, borderColor: color.border },
  back: { fontSize: 34, color: color.textPrimary }, headerTitle: { fontSize: 16, fontWeight: font.weight.heavy }, side: { width: 24 },
  content: { padding: space.lg }, label: { marginTop: 16, marginBottom: 7, color: color.textSecondary, fontSize: 12, fontWeight: font.weight.bold },
  input: { minHeight: 48, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, paddingHorizontal: 14, color: color.textPrimary },
  button: { marginTop: 28, minHeight: 50, borderRadius: radius.md, backgroundColor: color.textPrimary, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: color.background, fontWeight: font.weight.bold },
});
