// screens/GraphShopScreen.js
// Graph-only shop screen. App.js navigation will be connected in a later step.

import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View,  } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import GraphPreviewIcon from '../components/GraphPreviewIcon';
import BackButton from '../components/BackButton';
import { colors, radius, spacing } from '../styles/common';
import {
  GRAPH_CATALOG,
  GRAPH_CATEGORIES,
  GRAPH_FILTER_OPTIONS,
  GRAPH_SORT_OPTIONS,
  getGraphInputSummary,
  getGraphSearchText,
  getGraphSizeSummary,
  getGraphTierLabel,
  getGraphsByCategory,
  searchGraphs,
  sortGraphs,
} from '../constants/graphCatalog';
import {
  addPurchasedGraphId,
  filterGraphsByPurchaseState,
  getGraphPurchaseState,
  getPurchasedGraphIds,
} from '../utils/graphOwnership';
import {
  getStarBalance,
  spendStars,
} from '../utils/starWallet';

const GRAPH_SHOP_TWO_COLUMN_WIDTH = 600;
const DEFAULT_CATEGORY = 'all';
const DEFAULT_FILTER = 'all';
const DEFAULT_SORT = 'default';

function formatSize(size) {
  if (!size) return '-';
  return `${size.w}x${size.h}`;
}

function findOptionLabel(options, key, fallback) {
  return options.find((option) => option.key === key)?.label || fallback;
}

function buildInputLines(graph) {
  return (graph?.inputs || []).map((input) => {
    const unit = input.unit ? `· ${input.unit}` : '';
    const description = input.description ? `— ${input.description}` : '';
    return `${input.label}${unit}${description}`;
  });
}

function buildFeatureText(graph) {
  const features = graph?.preview?.features || [];
  return features.length ? features.join(', ') : '-';
}

function GraphShopScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const [starBalance, setStarBalance] = useState(0);
  const [purchasedGraphIds, setPurchasedGraphIds] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_CATEGORY);
  const [filterKey, setFilterKey] = useState(DEFAULT_FILTER);
  const [sortKey, setSortKey] = useState(DEFAULT_SORT);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [submittingGraphId, setSubmittingGraphId] = useState(null);

  const isWide = windowWidth >= GRAPH_SHOP_TWO_COLUMN_WIDTH;
  const numColumns = isWide ? 2 : 1;

  const reloadShopState = useCallback(async () => {
    const [balance, ownedIds] = await Promise.all([
      getStarBalance(),
      getPurchasedGraphIds(),
    ]);
    setStarBalance(Number(balance || 0));
    setPurchasedGraphIds(Array.isArray(ownedIds) ? ownedIds : []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const load = async () => {
        try {
          const [balance, ownedIds] = await Promise.all([
            getStarBalance(),
            getPurchasedGraphIds(),
          ]);
          if (!alive) return;
          setStarBalance(Number(balance || 0));
          setPurchasedGraphIds(Array.isArray(ownedIds) ? ownedIds : []);
        } catch (error) {
          console.warn('[GraphShop] load failed', error);
        }
      };
      load();
      return () => { alive = false; };
    }, [])
  );

  const filteredGraphs = useMemo(() => {
    const byCategory = getGraphsByCategory(selectedCategory);
    const bySearch = searchGraphs(byCategory, searchQuery);
    const byFilter = filterGraphsByPurchaseState(bySearch, filterKey, {
      starBalance,
      purchasedGraphIds,
    });
    return sortGraphs(byFilter, sortKey);
  }, [selectedCategory, searchQuery, filterKey, sortKey, starBalance, purchasedGraphIds]);

  const showFilterMenu = useCallback(() => {
    setOpenDropdown((current) => (current === 'filter' ? null : 'filter'));
  }, []);

  const showSortMenu = useCallback(() => {
    setOpenDropdown((current) => (current === 'sort' ? null : 'sort'));
  }, []);

  const handlePurchasePress = useCallback((graph) => {
    setOpenDropdown(null);

    const purchaseState = getGraphPurchaseState({
      graph,
      starBalance,
      purchasedGraphIds,
    });

    if (!purchaseState.canPurchase) {
      Alert.alert(
        purchaseState.reasonTitle || '구매 불가',
        purchaseState.reasonMessage || '지금은 이 그래프를 구매할 수 없어요.',
        [{ text: '확인' }]
      );
      return;
    }

    Alert.alert(
      purchaseState.reasonTitle || '그래프 구매',
      purchaseState.reasonMessage || `별 ${graph.price}개를 사용해 이 그래프를 구매할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '구매',
          onPress: async () => {
            try {
              setSubmittingGraphId(graph.id);

              const spendResult = await spendStars(
                graph.price,
                'graph_purchase',
                {
                  graphId: graph.id,
                  title: graph.title,
                  tier: graph.tier,
                  price: graph.price,
                }
              );

              if (!spendResult?.ok) {
                const nextBalance = Number(spendResult?.balance ?? starBalance);
                setStarBalance(nextBalance);
                Alert.alert(
                  '별 부족',
                  `별이 부족해요. 필요한 별: ${graph.price}개 / 보유 별: ${nextBalance}개`,
                  [{ text: '확인' }]
                );
                return;
              }

              const nextPurchasedIds = await addPurchasedGraphId(graph.id);
              setPurchasedGraphIds(nextPurchasedIds);
              setStarBalance(Number(spendResult.balance || 0));

              Alert.alert(
                '구매 완료',
                `${graph.title} 그래프를 구매했어요.`,
                [{ text: '확인' }]
              );
            } catch (error) {
              console.warn('[GraphShop] purchase failed', error);
              Alert.alert('구매 실패', '그래프 구매 중 문제가 발생했어요.', [{ text: '확인' }]);
              await reloadShopState();
            } finally {
              setSubmittingGraphId(null);
            }
          },
        },
      ]
    );
  }, [purchasedGraphIds, reloadShopState, starBalance]);

  const renderCategoryTab = useCallback((category) => {
    const active = selectedCategory === category.key;
    return (
      <TouchableOpacity
        key={category.key}
        style={[styles.categoryTab, active && styles.categoryTabActive]}
        activeOpacity={0.85}
        onPress={() => {
            setSelectedCategory(category.key);
            setOpenDropdown(null);
          }}
      >
        <Text style={[styles.categoryTabText, active && styles.categoryTabTextActive]}>
          {category.label}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedCategory]);

  const renderGraphCard = useCallback(({ item, index }) => {
    const purchaseState = getGraphPurchaseState({
      graph: item,
      starBalance,
      purchasedGraphIds,
    });
    const owned = purchaseState.state === 'owned';
    const disabledButton = purchaseState.state !== 'available';
    const tierLocked = purchaseState.state === 'locked';
    const insufficient = purchaseState.state === 'insufficient';
    const inputLines = buildInputLines(item);

    return (
      <View
        style={[
          styles.graphCardOuter,
          isWide && styles.graphCardOuterWide,
          isWide && index % 2 === 0 && styles.graphCardOuterWideLeft,
          isWide && index % 2 === 1 && styles.graphCardOuterWideRight,
        ]}
      >
        <View style={[styles.graphCard, owned && styles.graphCardOwned]}>
          {/* 상단: 가격 + 티어 */}
          <View style={styles.cardTopRow}>
            <View style={styles.priceBadge}>
              <Text style={styles.priceBadgeText}>★ {item.price}</Text>
            </View>
            <View style={styles.tierBadge}>
              <Text style={styles.tierBadgeText}>{getGraphTierLabel(item.tier)}</Text>
            </View>
          </View>

          {/* 미리보기 */}
          <View style={styles.previewWrap}>
            <GraphPreviewIcon
              graph={item}
              size={isWide ? 132 : 148}
              muted={owned}
            />
          </View>

          <Text style={[styles.graphTitle, owned && styles.mutedText]}>
            {item.title}
          </Text>

          <Text style={[styles.graphDescription, owned && styles.mutedText]}>
            {item.description}
          </Text>

          {/* 입력값 */}
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>입력값</Text>
            {inputLines.map((line) => (
              <Text key={`${item.id}-${line}`} style={[styles.infoText, owned && styles.mutedText]}>
                • {line}
              </Text>
            ))}
          </View>

          {/* 크기 */}
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>크기</Text>
            <Text style={[styles.infoText, owned && styles.mutedText]}>
              최소 {formatSize(item.minSize)} / 최대 {formatSize(item.maxSize)} / 추천 {formatSize(item.recommendedSize)}
            </Text>
          </View>

          {/* 지원 타입 */}
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>지원 타입</Text>
            <Text style={[styles.infoText, owned && styles.mutedText]}>
              {(item.supports || []).join(', ') || '-'}
            </Text>
          </View>


          {tierLocked && (
            <Text style={styles.lockHint}>
              {purchaseState?.tierState?.message || purchaseState.reasonMessage}
            </Text>
          )}

          {/* 구매 버튼 */}
          <TouchableOpacity
            style={[
              styles.purchaseButton,
              disabledButton && styles.purchaseButtonDisabled,
              owned && styles.purchaseButtonOwned,
              insufficient && styles.purchaseButtonDisabled,
              tierLocked && styles.purchaseButtonDisabled,
            ]}
            activeOpacity={0.86}
            disabled={submittingGraphId === item.id}
            onPress={() => handlePurchasePress(item)}
          >
            <Text style={[
              styles.purchaseButtonText,
              disabledButton && styles.purchaseButtonTextDisabled,
              owned && styles.purchaseButtonTextOwned,
            ]}>
              {submittingGraphId === item.id ? '처리중' : purchaseState.buttonLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [handlePurchasePress, isWide, purchasedGraphIds, starBalance, submittingGraphId]);



  const renderInlineDropdown = useCallback((type, options, selectedKey, onSelect, align = 'left') => {
    if (openDropdown !== type) return null;

    return (
      <View
        pointerEvents="box-none"
        style={[
          styles.dropdownOverlay,
          align === 'right' ? styles.dropdownOverlayRight : styles.dropdownOverlayLeft,
        ]}
      >
        {options.map((option) => {
          const active = selectedKey === option.key;
          return (
            <TouchableOpacity
              key={`${type}-${option.key}`}
              style={[
                styles.dropdownOverlayOption,
                active && styles.dropdownOverlayOptionOn,
              ]}
              activeOpacity={0.85}
              onPress={() => {
                onSelect(option.key);
                setOpenDropdown(null);
              }}
            >
              <Text style={[styles.dropdownOverlayText, active && styles.dropdownOverlayTextOn]}>
                {option.label}
              </Text>
              {active && <Text style={styles.dropdownOverlayCheck}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }, [openDropdown]);



  const listHeader = (
    <View style={styles.listHeader}>
      {/* 내 별 박스 */}
      <View style={styles.walletBox}>
        <Text style={styles.walletValue}>★ {starBalance}</Text>
      </View>

      {/* 검색창 */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="그래프 이름, 설명, 입력값, Tier 검색"
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {/* 가로 스크롤 카테고리 탭 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
      >
        {GRAPH_CATEGORIES.map(renderCategoryTab)}
      </ScrollView>

      {/* 필터 / 가격순 */}
      <View style={styles.filterSortWrap}>
        <View style={styles.filterSortRow}>
          <TouchableOpacity
            style={styles.filterSortLineLeft}
            activeOpacity={0.8}
            onPress={showFilterMenu}
          >
            <Text style={styles.filterSortText}>필터: {findOptionLabel(GRAPH_FILTER_OPTIONS, filterKey, '전체')}</Text>
            <Text style={styles.filterSortArrow}>▾</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.filterSortLineRight}
            activeOpacity={0.8}
            onPress={showSortMenu}
          >
            <Text style={styles.filterSortText}>정렬: {findOptionLabel(GRAPH_SORT_OPTIONS, sortKey, '기본순')}</Text>
            <Text style={styles.filterSortArrow}>▾</Text>
          </TouchableOpacity>
        </View>

        {renderInlineDropdown('filter', GRAPH_FILTER_OPTIONS, filterKey, setFilterKey, 'left')}

        {renderInlineDropdown('sort', GRAPH_SORT_OPTIONS, sortKey, setSortKey, 'right')}
      </View>

      <Text style={styles.resultCount}>
        그래프 {filteredGraphs.length}개
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <BackButton title="그래프 상점" />

      <FlatList
        key={numColumns === 2 ? 'graph-shop-two' : 'graph-shop-one'}
        data={filteredGraphs}
        renderItem={renderGraphCard}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        ListHeaderComponent={listHeader}
        ListHeaderComponentStyle={styles.listHeaderOverlayLayer}
        removeClippedSubviews={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>조건에 맞는 그래프가 없어요.</Text>
          </View>
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 12) + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

    </SafeAreaView>
  );
}

export default GraphShopScreen;

const styles = StyleSheet.create({



  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
  },
  listHeader: {
    paddingTop: spacing.sm,
  },
  walletBox: {
    minHeight: 82,
    borderRadius: 22,
    backgroundColor: colors.black,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletValue: {
    color: colors.background,
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
  },
  searchBox: {
    height: 48,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  searchIcon: {
    fontSize: 22,
    color: '#9CA3AF',
    marginRight: 8,
    fontWeight: '800',
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: colors.gray800,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
  },
  categoryScroll: {
    paddingRight: spacing.lg,
    paddingBottom: spacing.sm,
  },
  categoryTab: {
    paddingHorizontal: 7,
    paddingVertical: 8,
    marginRight: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  categoryTabActive: {
    borderBottomColor: colors.black,
  },
  categoryTabText: {
    color: colors.gray500,
    fontSize: 15,
    fontWeight: '800',
  },
  categoryTabTextActive: {
    color: colors.gray900,
  },
  resultCount: {
    marginTop: 2,
    marginBottom: spacing.sm,
    color: colors.gray400,
    fontSize: 12,
    fontWeight: '700',
  },
  graphCardOuter: {
    width: '100%',
    marginBottom: spacing.md,
  },
  graphCardOuterWide: {
    width: '50%',
  },
  graphCardOuterWideLeft: {
    paddingRight: 6,
  },
  graphCardOuterWideRight: {
    paddingLeft: 6,
  },
  graphCard: {
    zIndex: 0,
    elevation: 0,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: spacing.md,
  },
  graphCardOwned: {
    backgroundColor: '#E5E7EB',
    opacity: 0.62,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceBadge: {
    minHeight: 28,
    borderRadius: 14,
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceBadgeText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '900',
  },
  tierBadge: {
    minHeight: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierBadgeText: {
    color: colors.gray800,
    fontSize: 12,
    fontWeight: '900',
  },
  previewWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  graphTitle: {
    color: colors.gray900,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 5,
  },
  graphDescription: {
    color: colors.gray600,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  mutedText: {
    color: colors.gray500,
  },
  infoBlock: {
    marginTop: spacing.sm,
  },
  infoLabel: {
    color: colors.gray900,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 3,
  },
  infoText: {
    color: colors.gray600,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },
  lockHint: {
    marginTop: spacing.sm,
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  purchaseButton: {
    marginTop: spacing.md,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  purchaseButtonOwned: {
    backgroundColor: '#9CA3AF',
  },
  purchaseButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '900',
  },
  purchaseButtonTextDisabled: {
    color: '#6B7280',
  },
  purchaseButtonTextOwned: {
    color: '#F9FAFB',
  },
  emptyWrap: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.gray400,
    fontSize: 14,
    fontWeight: '700',
  },
  listHeaderOverlayLayer: {
    zIndex: 9000,
    elevation: 900,
  },
  filterSortWrap: {
    position: 'relative',
    zIndex: 9999,
    elevation: 999,
    marginLeft: 0,
    marginRight: 0,
    marginBottom: 6,
    overflow: 'visible',
  },
  filterSortRow: {
    width: '100%',
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'visible',
  },
  filterSortLineLeft: {
    flex: 1,
    minHeight: 28,
    paddingVertical: 4,
    paddingLeft: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  filterSortLineRight: {
    flex: 1,
    minHeight: 28,
    paddingVertical: 4,
    paddingRight: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  filterSortText: {
    fontSize: 12,
    color: colors.gray600,
    fontWeight: '700',
  },
  filterSortArrow: {
    fontSize: 10,
    color: colors.gray400,
    marginLeft: 4,
    fontWeight: '700',
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 32,
    width: 188,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 20000,
    elevation: 2000,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
  },
  dropdownOverlayLeft: {
    left: 0,
  },
  dropdownOverlayRight: {
    right: 0,
  },
  dropdownOverlayOption: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownOverlayOptionOn: {
    backgroundColor: '#F3F4F6',
  },
  dropdownOverlayOptionLast: {
    borderBottomWidth: 0,
  },
  dropdownOverlayText: {
    fontSize: 12,
    color: colors.gray700,
    fontWeight: '700',
  },
  dropdownOverlayTextOn: {
    color: colors.gray900,
    fontWeight: '900',
  },
  dropdownOverlayCheck: {
    fontSize: 12,
    color: colors.gray900,
    fontWeight: '900',
  },
});
