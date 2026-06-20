import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import BackButton from '../components/BackButton';
import { colors, radius, spacing } from '../styles/common';

const HEALTH_CONNECT_ITEMS = [
  'Samsung Health, Google Fit 등 Health Connect에 연결된 건강 데이터를 사용할 수 있어요.',
  '현재 1차 대상 데이터는 걸음 수입니다.',
  '권한 요청과 실제 데이터 불러오기는 다음 단계에서 활성화됩니다.',
];

const FUTURE_INTEGRATIONS = [
  { name: 'Strava', description: '달리기, 자전거 등 운동 기록 연동을 위한 예정 항목입니다.' },
  { name: 'Garmin', description: '운동 기록과 활동 데이터를 위한 예정 항목입니다.' },
];

export default function DataIntegrationsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <BackButton title="데이터 출처 관리" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>데이터 연동</Text>
          <Text style={styles.title}>데이터 출처 관리</Text>
          <Text style={styles.description}>
            인증/기록하기에서 사용할 외부 데이터 출처를 관리합니다. 연결된 출처의 데이터만 인증에 첨부할 수 있습니다.
          </Text>
        </View>

        <View style={styles.providerCard}>
          <View style={styles.providerHeader}>
            <View style={styles.providerTitleWrap}>
              <Text style={styles.providerName}>Health Connect</Text>
              <Text style={styles.providerDescription}>Android 건강 데이터 연결</Text>
            </View>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>준비됨</Text>
            </View>
          </View>
          <View style={styles.divider} />
          {HEALTH_CONNECT_ITEMS.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
          <View style={styles.nextBox}>
            <Text style={styles.nextTitle}>다음 단계 예정</Text>
            <Text style={styles.nextText}>
              다음 단계에서 Health Connect 사용 가능 여부 확인과 걸음 수 읽기 권한 요청 버튼을 추가합니다.
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>추가 예정 데이터 출처</Text>
          <Text style={styles.sectionHint}>이후 필요한 서비스는 이 목록에 같은 구조로 추가합니다.</Text>
        </View>

        {FUTURE_INTEGRATIONS.map((item) => (
          <View key={item.name} style={styles.futureCard}>
            <View style={styles.providerHeader}>
              <View style={styles.providerTitleWrap}>
                <Text style={styles.futureName}>{item.name}</Text>
                <Text style={styles.providerDescription}>{item.description}</Text>
              </View>
              <View style={styles.futurePill}>
                <Text style={styles.futurePillText}>준비 예정</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  heroCard: { backgroundColor: colors.surface, borderColor: colors.borderSoft, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  eyebrow: { color: colors.gray600, fontSize: 12, fontWeight: '800', marginBottom: 6 },
  title: { color: colors.gray800, fontSize: 24, fontWeight: '900', marginBottom: spacing.sm },
  description: { color: colors.gray600, fontSize: 14, lineHeight: 21 },
  providerCard: { marginTop: spacing.lg, backgroundColor: colors.surface, borderColor: colors.borderSoft, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  providerHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  providerTitleWrap: { flex: 1 },
  providerName: { color: colors.gray800, fontSize: 18, fontWeight: '900' },
  providerDescription: { color: colors.gray600, fontSize: 13, lineHeight: 19, marginTop: 5 },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F3F4F6' },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 7, backgroundColor: colors.black },
  statusText: { color: colors.gray800, fontSize: 12, fontWeight: '800' },
  divider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: spacing.md },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
  bulletDot: { width: 5, height: 5, borderRadius: 3, marginTop: 7, marginRight: 8, backgroundColor: colors.black },
  bulletText: { flex: 1, color: colors.gray600, fontSize: 14, lineHeight: 20 },
  nextBox: { marginTop: spacing.lg, backgroundColor: '#F9FAFB', borderColor: colors.borderSoft, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  nextTitle: { color: colors.gray800, fontSize: 14, fontWeight: '800', marginBottom: 5 },
  nextText: { color: colors.gray600, fontSize: 13, lineHeight: 19 },
  sectionHeader: { marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionTitle: { color: colors.gray800, fontSize: 16, fontWeight: '900' },
  sectionHint: { color: colors.gray600, fontSize: 13, lineHeight: 19, marginTop: 4 },
  futureCard: { marginTop: spacing.sm, backgroundColor: '#F9FAFB', borderColor: colors.borderSoft, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  futureName: { color: colors.gray800, fontSize: 16, fontWeight: '900' },
  futurePill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: '#EEF0F3' },
  futurePillText: { color: colors.gray600, fontSize: 12, fontWeight: '800' },
});
