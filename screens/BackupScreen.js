import { SafeAreaView } from 'react-native-safe-area-context';
// screens/BackupScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

import { colors, spacing, radius, buttonStyles } from '../styles/common';
import { exportBackup, importSnapshot, validateSnapshot } from '../utils/backup';
import BackButton from '../components/BackButton';

export default function BackupScreen() {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('replace'); // 'replace' | 'merge'

  const onExport = useCallback(async () => {
    try {
      setLoading(true);
      const { filename } = await exportBackup();
      Alert.alert('완료', `백업 파일이 준비되었습니다.\n(${filename})`);
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '백업에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  const onImport = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;

      const asset = res.assets?.[0];
      if (!asset?.uri) return;

      setLoading(true);
      const content = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });

      let json;
      try {
        json = JSON.parse(content);
      } catch {
        Alert.alert('확인', '유효한 JSON 파일이 아닙니다.');
        return;
      }

      const v = validateSnapshot(json);
      if (!v.ok) {
        Alert.alert('확인', `백업 포맷을 인식하지 못했습니다. (${v.reason})`);
        return;
      }

      // 안전확인
      Alert.alert(
        '가져오기',
        mode === 'replace'
          ? '현재 데이터를 모두 치환합니다. 진행할까요?'
          : '기존 데이터와 병합합니다. 진행할까요?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '진행',
            style: 'destructive',
            onPress: async () => {
              try {
                setLoading(true);
                await importSnapshot(json, mode);
                Alert.alert('완료', '가져오기가 완료되었습니다.');
              } catch (e) {
                console.error(e);
                Alert.alert('오류', '가져오기에 실패했습니다.');
              } finally {
                setLoading(false);
              }
            },
          },
        ]
      );
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '가져오기 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [mode]);

  const toggleMode = useCallback(() => {
    setMode((m) => (m === 'replace' ? 'merge' : 'replace'));
  }, []);

    return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <BackButton title="데이터 백업/복원" />
      <ScrollView contentContainerStyle={styles.container}>
      

      <View style={styles.card}>
        <Text style={styles.cardTitle}>내보내기</Text>
        <Text style={styles.desc}>현재 도전/명예의 전당/인증 기록을 하나의 JSON으로 저장합니다.</Text>
        <TouchableOpacity
          style={[buttonStyles.primary.container, { marginTop: spacing.md }]}
          onPress={onExport}
          activeOpacity={0.9}
          disabled={loading}
        >
          <Text style={buttonStyles.primary.label}>백업 파일 만들기</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>가져오기</Text>
          <TouchableOpacity style={styles.modeBtn} onPress={toggleMode} disabled={loading}>
            <Text style={styles.modeText}>
              모드: {mode === 'replace' ? '치환' : '병합'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.desc}>
          JSON을 선택해 데이터를 {mode === 'replace' ? '완전히 교체' : 'ID 기준 병합'}합니다.
        </Text>
        <TouchableOpacity
          style={[buttonStyles.outlineSoft.container, { marginTop: spacing.md }]}
          onPress={onImport}
          activeOpacity={0.9}
          disabled={loading}
        >
          <Text style={buttonStyles.outlineSoft.label}>백업 파일 선택</Text>
        </TouchableOpacity>
      </View>

            {loading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.black} />
          <Text style={{ marginTop: 8, color: colors.gray600 }}>처리 중…</Text>
        </View>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  title: { fontSize: 20, fontWeight: '800', color: colors.gray800, marginBottom: spacing.lg },

  card: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.gray800, marginBottom: spacing.xs },
  desc: { color: colors.gray600, fontSize: 13 },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modeBtn: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  modeText: { color: colors.gray800, fontWeight: '700' },

  loading: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    paddingBottom: spacing.xl,
  },
});
