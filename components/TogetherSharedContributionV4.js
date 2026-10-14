import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import uuid from 'react-native-uuid';
import { color, font, primitive, radius, space } from '../styles/common';
import { addTogetherSharedContributionV4, deleteTogetherSharedContributionV4 } from '../utils/togetherRemoteV2';

const amountValue = (value) => {
  const text = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,3})?$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) && number > 0 && number <= 1000000000000 ? number : null;
};

export default function TogetherSharedContributionV4({ roomId, sharedGoal, summary, loading, error, onReload }) {
  const unit = String(sharedGoal?.unit ?? '').trim();
  const [value, setValue] = useState(unit === '회' ? '1' : '');
  const [saving, setSaving] = useState(false);
  const requestRef = useRef(null);
  useEffect(() => { setValue(unit === '회' ? '1' : ''); requestRef.current = null; }, [roomId, unit]);
  const submit = async () => {
    if (saving) return;
    const amount = amountValue(value);
    if (amount === null) { Alert.alert('기여량 확인', '0보다 크고 소수점 셋째 자리 이내의 수치를 입력해주세요.'); return; }
    const requestId = requestRef.current || uuid.v4();
    requestRef.current = requestId; setSaving(true);
    try {
      await addTogetherSharedContributionV4({ roomId, amount, requestId });
      requestRef.current = null; setValue(unit === '회' ? '1' : ''); await onReload?.();
    } catch { Alert.alert('기여 기록 실패', '같은 요청으로 다시 시도할 수 있어요.'); }
    finally { setSaving(false); }
  };
  const remove = (id) => Alert.alert('기여 기록 삭제', '이 기록을 삭제할까요?', [
    { text: '취소', style: 'cancel' },
    { text: '삭제', style: 'destructive', onPress: async () => {
      try { await deleteTogetherSharedContributionV4({ contributionId: id }); await onReload?.(); }
      catch { Alert.alert('삭제 실패', '기여 기록을 삭제하지 못했어요.'); }
    } },
  ]);
  return <View style={styles.container}>
    <Text style={styles.title}>공동 PUSH에 기여하기</Text>
    <Text style={styles.unit}>현재 단위 · {unit}</Text>
    <View style={styles.row}><TextInput style={styles.input} value={value} onChangeText={setValue} keyboardType="decimal-pad" placeholder="기여량" /><TouchableOpacity style={styles.button} onPress={submit} disabled={saving}><Text style={styles.buttonText}>{saving ? '기록 중...' : '기여 기록하기'}</Text></TouchableOpacity></View>
    {loading && !summary ? <Text style={styles.meta}>기여 기록 확인 중...</Text> : null}
    {error ? <TouchableOpacity onPress={onReload}><Text style={styles.error}>기여 기록을 불러오지 못했어요. 다시 시도</Text></TouchableOpacity> : null}
    {Array.isArray(summary?.mine) && summary.mine.length ? <><Text style={styles.section}>최근 내 기여</Text>{summary.mine.slice(0, 20).map((item) => <View key={String(item.id)} style={styles.item}><Text>{Number(item.amount).toLocaleString('ko-KR')} {unit} · {String(item.createdAt ?? '').slice(0, 10)}</Text><TouchableOpacity onPress={() => remove(item.id)}><Text style={styles.delete}>삭제</Text></TouchableOpacity></View>)}</> : null}
  </View>;
}
const styles = StyleSheet.create({
  container: { marginTop: space.lg, padding: space.md, borderWidth: 1, borderColor: color.border, borderRadius: radius.card },
  title: { color: color.textPrimary, fontSize: 17, fontWeight: font.weight.heavy }, unit: { marginTop: 5, color: color.textSecondary, fontSize: 12 },
  row: { marginTop: space.sm, gap: space.xs }, input: { minHeight: 46, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, paddingHorizontal: 12 },
  button: { minHeight: 46, backgroundColor: primitive.black, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: primitive.white, fontWeight: font.weight.bold },
  meta: { marginTop: space.sm, color: color.textSecondary }, error: { marginTop: space.sm, color: color.danger }, section: { marginTop: space.md, fontWeight: font.weight.bold },
  item: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: color.border }, delete: { color: color.danger, fontWeight: font.weight.bold },
});
