import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { colors, radius, spacing } from '../styles/common';
import { getStarBalance, spendStars } from '../utils/starWallet';
import { getShopWidgets } from '../constants/widgetCatalog';
import { addPurchasedWidgetId, getTierUnlockState } from '../utils/widgetOwnership';

const TierTab = ({ tierState, selected, onPress }) => (
  <TouchableOpacity
    style={[styles.tierTab, selected && styles.tierTabOn]}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <Text style={[styles.tierTabText, selected && styles.tierTabTextOn]}>Tier {tierState.tier}</Text>
    <Text style={[styles.tierTabMeta, selected && styles.tierTabMetaOn]}>
      {tierState.unlocked ? `${tierState.purchasedCount}/${tierState.totalCount}` : '미리보기'}
    </Text>
  </TouchableOpacity>
);

const ShopItem = ({ item, locked, owned, onBuy }) => (
  <View style={[styles.shopCard, locked && styles.lockedCard]}>
    <View style={styles.previewBox}>
      <Text style={styles.previewText}>{item.placeholder ? '준비중' : '그래프'}</Text>
    </View>
    <View style={styles.shopInfo}>
      <Text style={styles.shopTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.shopMeta}>{item.supports?.includes('challenge') ? '도전' : ''}{item.supports?.includes('challenge') && item.supports?.includes('habit') ? ' / ' : ''}{item.supports?.includes('habit') ? '습관' : ''}</Text>
      <Text style={styles.shopMeta}>크기 {item.defaultSize?.w}x{item.defaultSize?.h}</Text>
    </View>
    <TouchableOpacity
      style={[styles.buyBtn, (locked || owned) && styles.buyBtnDisabled]}
      disabled={locked || owned}
      activeOpacity={0.9}
      onPress={() => onBuy?.(item)}
    >
      <Text style={styles.buyBtnText}>{owned ? '보유중' : locked ? '잠김' : `${item.price}★`}</Text>
    </TouchableOpacity>
  </View>
);

export default function WidgetShopScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [stars, setStars] = useState(0);
  const [tierState, setTierState] = useState(null);
  const [selectedTier, setSelectedTier] = useState(1);

  const reload = useCallback(async () => {
    const [balance, state] = await Promise.all([
      getStarBalance(),
      getTierUnlockState(),
    ]);
    setStars(balance);
    setTierState(state);

    const visible = state.visibleTiers || [];
    if (!visible.some((item) => item.tier === selectedTier)) {
      setSelectedTier(visible[0]?.tier || 1);
    }
  }, [selectedTier]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const visibleTiers = tierState?.visibleTiers || [{ tier: 1, unlocked: true, previewOnly: false, purchasedCount: 0, totalCount: 0 }];
  const selectedTierState = visibleTiers.find((item) => item.tier === selectedTier) || visibleTiers[0];

  const tierWidgets = useMemo(
    () => getShopWidgets().filter((item) => item.tier === selectedTierState?.tier),
    [selectedTierState?.tier]
  );

  const purchasedIds = tierState?.purchasedIds || [];

  const handleBuy = useCallback(async (item) => {
    if (!item || !item.id) return;
    if (!selectedTierState?.unlocked) {
      Alert.alert('잠김', '이 티어는 아직 해금되지 않았습니다.');
      return;
    }
    if (purchasedIds.includes(item.id)) {
      Alert.alert('보유중', '이미 보유한 그래프입니다.');
      return;
    }

    const price = Number(item.price || 0);
    Alert.alert(
      '구매 확인',
      `${item.title} 그래프를 ${price}★로 구매할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '구매',
          onPress: async () => {
            try {
              const spendResult = await spendStars(price, 'buy_widget', {
                widgetId: item.id,
                title: item.title,
                tier: item.tier,
              });

              if (!spendResult.ok) {
                Alert.alert(
                  '스타 부족',
                  `스타가 부족합니다. 필요: ${price}★ / 보유: ${spendResult.balance ?? 0}★`
                );
                return;
              }

              const ownResult = await addPurchasedWidgetId(item.id);
              if (!ownResult.ok) {
                Alert.alert('구매 실패', '그래프 보유 처리 중 문제가 발생했습니다.');
                return;
              }

              await reload();
              Alert.alert('구매 완료', `${item.title} 그래프를 보유했습니다.`);
            } catch (e) {
              console.warn('[WidgetShop] buy failed', e);
              Alert.alert('구매 실패', '구매 처리 중 문제가 발생했습니다.');
            }
          },
        },
      ]
    );
  }, [selectedTierState?.unlocked, purchasedIds, reload]);

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

        <View style={styles.headerSideBtn} />
      </View>

      <Text style={styles.screenTitle}>그래프 상점</Text>

      <View style={styles.tierWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tierScroll}>
          {visibleTiers.map((item) => (
            <TierTab
              key={item.tier}
              tierState={item}
              selected={selectedTierState?.tier === item.tier}
              onPress={() => setSelectedTier(item.tier)}
            />
          ))}
        </ScrollView>
      </View>

      {!selectedTierState?.unlocked && (
        <View style={styles.lockNotice}>
          <Text style={styles.lockNoticeText}>이 티어는 미리보기입니다. 이전 티어에서 3개 이상 구매하면 해금됩니다.</Text>
        </View>
      )}

      <FlatList
        data={tierWidgets}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ShopItem
            item={item}
            locked={!selectedTierState?.unlocked}
            owned={purchasedIds.includes(item.id)}
            onBuy={handleBuy}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: Math.max(insets.bottom, 16) + 24 }}
        ListEmptyComponent={<Text style={styles.emptyText}>표시할 상품이 없습니다.</Text>}
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
  screenTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.gray800,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.md,
  },
  tierWrap: { marginBottom: spacing.sm },
  tierScroll: { paddingHorizontal: spacing.lg, columnGap: 8 },
  tierTab: {
    minWidth: 86,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
  },
  tierTabOn: { backgroundColor: '#111', borderColor: '#111' },
  tierTabText: { fontSize: 13, fontWeight: '900', color: colors.gray800 },
  tierTabTextOn: { color: '#fff' },
  tierTabMeta: { fontSize: 11, color: colors.gray500, fontWeight: '700', marginTop: 2 },
  tierTabMetaOn: { color: '#fff' },
  lockNotice: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    padding: spacing.md,
  },
  lockNoticeText: { color: colors.gray600, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  shopCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  lockedCard: { opacity: 0.65 },
  previewBox: {
    width: 76,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  previewText: { fontSize: 12, color: colors.gray600, fontWeight: '800' },
  shopInfo: { flex: 1, minWidth: 0 },
  shopTitle: { fontSize: 15, color: colors.gray800, fontWeight: '900' },
  shopMeta: { fontSize: 12, color: colors.gray600, marginTop: 3, fontWeight: '600' },
  buyBtn: {
    minWidth: 64,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginLeft: spacing.sm,
  },
  buyBtnDisabled: { backgroundColor: '#9CA3AF' },
  buyBtnText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  emptyText: { textAlign: 'center', color: colors.gray400, marginTop: 60 },
});
