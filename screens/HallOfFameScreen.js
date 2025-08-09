// screens/HallOfFameScreen.js
// 완료(보상 수령)된 도전들을 모아 보여주는 화면

import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, FlatList, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { colors, spacing, radius, cardStyles } from '../styles/common';

export default function HallOfFameScreen() {
  const isFocused = useIsFocused();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!isFocused) return;
    (async () => {
      const raw = await AsyncStorage.getItem('hallOfFame');
      const list = raw ? JSON.parse(raw) : [];
      // 완료일 최신순 정렬
      list.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
      setItems(list);
    })().catch(console.error);
  }, [isFocused]);

  const renderItem = ({ item }) => (
    <View style={[styles.card, cardStyles.container]}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.meta}>
        기간 {item.startDate ?? '-'} ~ {item.endDate ?? '-'}
      </Text>
      <Text style={styles.meta}>
        보상 {item.rewardTitle ?? item.reward ?? '-'}
      </Text>
      <Text style={styles.meta}>
        달성 점수 {item.currentScore ?? 0} / {item.goalScore ?? 0}
      </Text>
      <Text style={styles.meta}>
        완료일 {item.completedAt ? new Date(item.completedAt).toLocaleString() : '-'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {items.length === 0 ? (
        <Text style={styles.empty}>아직 ‘명예의 전당’에 기록된 도전이 없습니다.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.lg }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  card: { marginBottom: spacing.md },
  title: { fontSize: 16, fontWeight: '800', color: colors.gray800, marginBottom: 6 },
  meta: { fontSize: 12, color: colors.gray600, marginTop: 2 },
  empty: {
    textAlign: 'center',
    color: colors.gray400,
    marginTop: 60,
    fontSize: 13,
  },
});
