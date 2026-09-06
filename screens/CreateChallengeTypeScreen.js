import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackButton from '../components/BackButton';
import { color, font, radius, space, surface } from '../styles/common';

const TYPES = [
  ['challenge', '도전', '기간과 목표를 정하고 인증합니다.'],
  ['habit', '습관', '정한 주기에 맞춰 반복 인증합니다.'],
  ['rotation', '순환 루틴', '목표 시간을 채우며 차례대로 진행합니다.'],
];

export default function CreateChallengeTypeScreen({ navigation }) {
  const select = (type) => {
    if (type === 'rotation') return navigation.navigate('AddRotationRoutine');
    navigation.navigate('AddChallenge', { initialType: type, resetNonce: Date.now() });
  };

  return (
    <SafeAreaView style={surface.screen}>
      <BackButton title="추가할 유형 선택" />
      <View style={styles.content}>
        <Text style={styles.title}>무엇을 추가할까요?</Text>
        <Text style={styles.guide}>진행 방식에 맞는 유형을 선택하세요.</Text>
        {TYPES.map(([type, label, description]) => (
          <TouchableOpacity key={type} style={styles.card} onPress={() => select(type)}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.description}>{description}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: space.lg },
  title: { color: color.textPrimary, fontSize: font.size.screenTitle, fontWeight: font.weight.heavy },
  guide: { marginTop: space.xs, marginBottom: space.lg, color: color.textSecondary },
  card: { marginBottom: space.md, padding: space.lg, borderWidth: 1, borderColor: color.border, borderRadius: radius.card },
  label: { color: color.textPrimary, fontSize: font.size.bodyLarge, fontWeight: font.weight.bold },
  description: { marginTop: space.xs, color: color.textSecondary },
});
