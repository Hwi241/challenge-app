import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { colors, radius, spacing } from '../styles/common';
import { ensureInitialStars, getStarBalance } from '../utils/starWallet';
import { getOwnedWidgets } from '../utils/widgetOwnership';

const TierBadge = ({ tier }) => (
  <View style={styles.tierBadge}>
    <Text style={styles.tierBadgeText}>{tier === 0 ? '기본' : `T${tier}`}</Text>
  </View>
);

const WidgetCard = ({ item }) => (
  <View style={styles.widgetCard}>
    <View style={styles.previewBox}>
      <Text style={styles.previewText}>{item.placeholder ? '준비중' : '보유'}</Text>
    </View>
    <View style={styles.widgetInfo}>
      <View style={styles.widgetTitleRow}>
        <Text style={styles.widgetTitle} numberOfLines={1}>{item.title}</Text>
        <TierBadge tier={item.tier} />
      </View>
      <Text style={styles.widgetMeta}>
        {item.supports?.includes('challenge') ? '도전' : ''}
        {item.supports?.includes('challenge') && item.supports?.includes('habit') ? ' / ' : ''}
        {item.supports?.includes('habit') ? '습관' : ''}
      </Text>
      <Text style={styles.widgetMeta}>기본 크기 {item.defaultSize?.w}x{item.defaultSize?.h}</Text>
    </View>
  </View>
);

export default function ProfileInventoryScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [stars, setStars] = useState(0);
  const [ownedWidgets, setOwnedWidgets] = useState([]);

  const reload = useCallback(async () => {
    await ensureInitialStars();
    const [balance, widgets] = await Promise.all([
      getStarBalance(),
      getOwnedWidgets(),
    ]);
    setStars(balance);
    setOwnedWidgets(widgets);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerSideBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.starPill}>
          <Text style={styles.starIcon}>★</Text>
          <Text style={styles.starText}>{stars}</Text>
        </View>

        <TouchableOpacity
          style={styles.shopBtn}
          onPress={() => navigation.navigate('WidgetShop')}
          activeOpacity={0.9}
        >
          <Text style={styles.shopBtnText}>상점</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.screenTitle}>내 기록실</Text>

      <FlatList
        data={ownedWidgets}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <WidgetCard item={item} />}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: Math.max(insets.bottom, 16) + 24 }}
        ListHeaderComponent={<Text style={styles.sectionTitle}>보유 그래프</Text>}
        ListEmptyComponent={<Text style={styles.emptyText}>보유한 그래프가 없습니다.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSideBtn: {
    width: 44,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backText: { fontSize: 34, color: colors.gray800, fontWeight: '300', lineHeight: 34 },
  starPill: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignSelf: 'center',
    marginHorizontal: 110,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#111',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 7,
  },
  starIcon: { color: '#fff', fontSize: 15, fontWeight: '900' },
  starText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  shopBtn: {
    minWidth: 58,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  shopBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  screenTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.gray800,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    color: colors.gray600,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  widgetCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  previewBox: {
    width: 78,
    height: 58,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  previewText: { fontSize: 12, color: colors.gray600, fontWeight: '800' },
  widgetInfo: { flex: 1 },
  widgetTitleRow: { flexDirection: 'row', alignItems: 'center' },
  widgetTitle: { flex: 1, fontSize: 15, color: colors.gray800, fontWeight: '900', marginRight: 8 },
  widgetMeta: { fontSize: 12, color: colors.gray600, marginTop: 3, fontWeight: '600' },
  tierBadge: {
    minWidth: 40,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  tierBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  emptyText: { textAlign: 'center', color: colors.gray400, marginTop: 60 },
});
