// screens/GraphShopScreen.js
// Graph-only shop screen. App.js navigation will be connected in a later step.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View,  } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import GraphPreviewIcon from '../components/GraphPreviewIcon';
import { buttonStyles, colors, radius, spacing } from '../styles/common';
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
const GRAPH_VIEW_MODE_STORAGE_KEY = 'graph_shop_view_mode';
const GRAPH_VIEW_MODE_FULL = 'full';
const GRAPH_VIEW_MODE_MEDIUM = 'medium';
const GRAPH_VIEW_MODE_SMALL = 'small';

const GRAPH_VIEW_OPTIONS = [
 { key: GRAPH_VIEW_MODE_FULL, label: '전체카드' },
 { key: GRAPH_VIEW_MODE_MEDIUM, label: '중간카드' },
 { key: GRAPH_VIEW_MODE_SMALL, label: '작은카드' },
];


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
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const [starBalance, setStarBalance] = useState(0);
  const [purchasedGraphIds, setPurchasedGraphIds] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_CATEGORY);
  const [filterKey, setFilterKey] = useState(DEFAULT_FILTER);
  const [sortKey, setSortKey] = useState(DEFAULT_SORT);
 const [viewMode, setViewMode] = useState(GRAPH_VIEW_MODE_FULL);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [submittingGraphId, setSubmittingGraphId] = useState(null);
 const [listFrameWidth, setListFrameWidth] = useState(0);

  const layoutWidth = listFrameWidth || windowWidth;
  const layoutWidthKey = Math.round(Number(layoutWidth || 0));
  const isWide = layoutWidth >= GRAPH_SHOP_TWO_COLUMN_WIDTH;
  const numColumns = viewMode === GRAPH_VIEW_MODE_MEDIUM
 ? (isWide ? 4 : 2)
 : viewMode === GRAPH_VIEW_MODE_SMALL
 ? (isWide ? 2 : 1)
 : isWide
 ? 2
 : 1;

  const reloadShopState = useCallback(async () => {
    const [balance, ownedIds] = await Promise.all([
      getStarBalance(),
      getPurchasedGraphIds(),
    ]);
    setStarBalance(Number(balance || 0));
    setPurchasedGraphIds(Array.isArray(ownedIds) ? ownedIds : []);
  }, []);

  useEffect(() => {
 let alive = true;

 const loadGraphViewMode = async () => {
 try {
 const saved = await AsyncStorage.getItem(GRAPH_VIEW_MODE_STORAGE_KEY);
 if (!alive) return;
 if (GRAPH_VIEW_OPTIONS.some((option) => option.key === saved)) {
 setViewMode(saved);
 }
 } catch (error) {
 console.warn('[GraphShop] load graph view mode failed', error);
 }
 };

 loadGraphViewMode();

 return () => {
 alive = false;
 };
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
    const excludeDefault = byFilter.filter((graph) => graph?.shop !== false && graph?.defaultOwned !== true);
    return sortGraphs(excludeDefault, sortKey);
  }, [selectedCategory, searchQuery, filterKey, sortKey, starBalance, purchasedGraphIds]);

  const selectViewMode = useCallback((nextViewMode) => {
 setViewMode(nextViewMode);
 setOpenDropdown(null);

 AsyncStorage.setItem(GRAPH_VIEW_MODE_STORAGE_KEY, nextViewMode).catch((error) => {
 console.warn('[GraphShop] save graph view mode failed', error);
 });
 }, []);

 const ownedGraphIdSet = useMemo(() => new Set(purchasedGraphIds), [purchasedGraphIds]);

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

  const renderMediumGraphCard = useCallback(({ item, index }) => {
 const purchaseState = getGraphPurchaseState({
 graph: item,
 starBalance,
 purchasedGraphIds,
 });
 const owned = purchaseState.state === 'owned';
 const disabledButton = purchaseState.state !== 'available';
 const insufficient = purchaseState.state === 'insufficient';
 const tierLocked = purchaseState.state === 'locked';
 const inputCount = Array.isArray(item.inputs) ? item.inputs.length : 0;
 const sizeText = item.recommendedSize ? item.recommendedSize.w + 'x' + item.recommendedSize.h : '-';
 const columnIndex = numColumns > 1 ? index % numColumns : 0;

 return (
 <View
 style={[
 styles.mediumGraphCardOuter,
 numColumns > 1 && styles.mediumGraphCardOuterGrid,
 numColumns === 4 && styles.mediumGraphCardOuterFour,
 numColumns > 1 && columnIndex === 0 && styles.mediumGraphCardOuterFirst,
 numColumns > 1 && columnIndex === numColumns - 1 && styles.mediumGraphCardOuterLast,
 ]}
 >
 <View style={[styles.mediumGraphCard, owned && styles.mediumGraphCardOwned]}>
 <View style={styles.mediumGraphTopRow}>
 <View style={styles.mediumPriceBadge}>
 <Text style={styles.mediumPriceBadgeText}>★ {item.price}</Text>
 </View>
 <View style={styles.mediumTierBadge}>
 <Text style={styles.mediumTierBadgeText}>{getGraphTierLabel(item.tier)}</Text>
 </View>
 </View>

 <View style={styles.mediumGraphPreviewWrap}>
 <GraphPreviewIcon graph={item} size={isWide ? 58 : 68} muted={owned} />
 </View>

 <Text style={[styles.mediumGraphTitle, owned && styles.mutedText]} numberOfLines={1}>
 {item.title}
 </Text>

 <Text style={[styles.mediumGraphDescription, owned && styles.mutedText]} numberOfLines={2}>
 {item.description}
 </Text>

 <Text style={[styles.mediumGraphMeta, owned && styles.mutedText]} numberOfLines={1}>
 입력값 {inputCount}개 · 권장 {sizeText}
 </Text>

 {tierLocked && (
 <Text style={styles.lockHintSmall}>
 {purchaseState?.tierState?.message || purchaseState.reasonMessage}
 </Text>
 )}

 {owned ? (
 <View style={styles.mediumOwnedBadge}>
 <Text style={styles.mediumOwnedBadgeText}>보유</Text>
 </View>
 ) : (
 <TouchableOpacity
 style={[
 styles.mediumBuyButton,
 disabledButton && styles.mediumBuyButtonDisabled,
 insufficient && styles.mediumBuyButtonDisabled,
 tierLocked && styles.mediumBuyButtonDisabled,
 ]}
 activeOpacity={0.86}
 disabled={submittingGraphId === item.id}
 onPress={() => handlePurchasePress(item)}
 >
 <Text style={[
 styles.mediumBuyButtonText,
 disabledButton && styles.mediumBuyButtonTextDisabled,
 ]}>
 {submittingGraphId === item.id ? '처리중' : purchaseState.buttonLabel}
 </Text>
 </TouchableOpacity>
 )}
 </View>
 </View>
 );
 }, [handlePurchasePress, isWide, numColumns, purchasedGraphIds, starBalance, submittingGraphId]);

 const renderSmallGraphCard = useCallback(({ item, index }) => {
 const owned = ownedGraphIdSet.has(item.id);
 const inputCount = Array.isArray(item.inputs) ? item.inputs.length : 0;
 const sizeText = item.recommendedSize ? item.recommendedSize.w + 'x' + item.recommendedSize.h : '-';

 return (
 <View
 style={[
 styles.smallGraphCardOuter,
 isWide && styles.smallGraphCardOuterWide,
 isWide && index % 2 === 0 && styles.smallGraphCardOuterWideLeft,
 isWide && index % 2 === 1 && styles.smallGraphCardOuterWideRight,
 ]}
 >
 <View style={styles.smallGraphCard}>
 <View style={styles.smallGraphPreviewWrap}>
 <GraphPreviewIcon graph={item} size={46} />
 </View>

 <View style={styles.smallGraphInfo}>
 <Text style={styles.smallGraphTitle} numberOfLines={1}>{item.title}</Text>
 <Text style={styles.smallGraphMeta} numberOfLines={1}>
 {getGraphTierLabel(item.tier)} · 입력값 {inputCount}개 · 권장 {sizeText}
 </Text>
 </View>

 <View style={styles.smallGraphRight}>
 <Text style={styles.smallGraphPrice}>★ {item.price}</Text>
 {owned ? (
 <View style={styles.smallOwnedBadge}>
 <Text style={styles.smallOwnedBadgeText}>보유</Text>
 </View>
 ) : (
 <TouchableOpacity
 style={styles.smallBuyButton}
 activeOpacity={0.86}
 onPress={() => handlePurchasePress(item)}
 >
 <Text style={styles.smallBuyButtonText}>구매</Text>
 </TouchableOpacity>
 )}
 </View>
 </View>
 </View>
 );
 }, [handlePurchasePress, isWide, ownedGraphIdSet]);

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
          align === 'right'
 ? styles.dropdownOverlayRight
 : align === 'center'
 ? styles.dropdownOverlayCenter
 : styles.dropdownOverlayLeft,
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
          placeholderTextColor={colors.textTertiary}
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
            onPress={() => setOpenDropdown((current) => (current === 'view' ? null : 'view'))}
          >
            <Text style={styles.filterSortText}>보기: {findOptionLabel(GRAPH_VIEW_OPTIONS, viewMode, '전체카드')}</Text>
            <Text style={styles.filterSortArrow}>▾</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.filterSortLineCenter}
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

        {renderInlineDropdown('view', GRAPH_VIEW_OPTIONS, viewMode, selectViewMode, 'left')}

        {renderInlineDropdown('filter', GRAPH_FILTER_OPTIONS, filterKey, setFilterKey, 'center')}

        {renderInlineDropdown('sort', GRAPH_SORT_OPTIONS, sortKey, setSortKey, 'right')}
      </View>

      <Text style={styles.resultCount}>
        그래프 {filteredGraphs.length}개
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.graphShopHeader}>
        <TouchableOpacity
          style={styles.graphShopBackButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.graphShopBackIcon}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.graphShopHeaderTitle}>그래프 상점</Text>

        <TouchableOpacity
          style={[buttonStyles.compactRight, styles.ownedGraphHeaderButton]}
          onPress={() => navigation.navigate('MyGraphs')}
          activeOpacity={0.9}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={[buttonStyles.compactRightText, styles.ownedGraphHeaderButtonText]}>
            내 그래프
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        key={`graph-shop-${layoutWidthKey}-${viewMode}-${numColumns}`}
        data={filteredGraphs}
        onLayout={(event) => setListFrameWidth(event.nativeEvent.layout.width || 0)}
        renderItem={
 viewMode === GRAPH_VIEW_MODE_SMALL
 ? renderSmallGraphCard
 : viewMode === GRAPH_VIEW_MODE_MEDIUM
 ? renderMediumGraphCard
 : renderGraphCard
 }
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
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  searchIcon: {
    fontSize: 22,
    color: colors.textDisabled,
    marginRight: spacing.sm,
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
    paddingRight: spacing.xs,
  },
  graphCardOuterWideRight: {
    paddingLeft: spacing.xs,
  },
  graphCard: {
    zIndex: 0,
    elevation: 0,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  graphCardOwned: {
    backgroundColor: colors.border,
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
    backgroundColor: colors.primary,
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
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.gray300,
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
    color: colors.textTertiary,
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
    backgroundColor: colors.gray300,
  },
  purchaseButtonOwned: {
    backgroundColor: colors.gray400,
  },
  purchaseButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '900',
  },
  purchaseButtonTextDisabled: {
    color: colors.textTertiary,
  },
  purchaseButtonTextOwned: {
    color: colors.backgroundMuted,
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
  filterSortLineCenter: {
 flex: 1,
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'center',
 paddingHorizontal: 4,
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
    borderColor: colors.gray300,
    borderRadius: radius.md,
    overflow: 'hidden',
    zIndex: 20000,
    elevation: 2000,
    shadowColor: colors.black,
    shadowOpacity: 0.14,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
  },
  dropdownOverlayLeft: {
    left: 0,
  },
  dropdownOverlayCenter: {
 left: '50%',
 transform: [{ translateX: -94 }],
 },
 dropdownOverlayRight: {
    right: 0,
  },
  dropdownOverlayOption: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownOverlayOptionOn: {
    backgroundColor: colors.surfaceMuted,
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
  graphShopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    zIndex: 30,
    elevation: 30,
  },
  graphShopHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.gray800,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: -1,
  },
  graphShopBackButton: {
    padding: spacing.xxs,
    marginRight: spacing.xxs,
  },
  graphShopBackIcon: {
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 32,
    includeFontPadding: false,
    marginTop: -8,
    color: colors.gray800,
  },
  ownedGraphHeaderButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  ownedGraphHeaderButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  mediumGraphCardOuter: {
    width: '100%',
    marginBottom: spacing.md,
    zIndex: 0,
    elevation: 0,
  },
  mediumGraphCardOuterGrid: {
    width: '50%',
    paddingHorizontal: 4,
  },
  mediumGraphCardOuterFour: {
    width: '25%',
  },
  mediumGraphCardOuterFirst: {
    paddingLeft: 0,
  },
  mediumGraphCardOuterLast: {
    paddingRight: 0,
  },
  mediumGraphCard: {
    minHeight: 218,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  mediumGraphCardOwned: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.72,
  },
  mediumGraphTopRow: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    gap: 6,
  },
  mediumPriceBadge: {
    minHeight: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.black,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediumPriceBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.background,
  },
  mediumTierBadge: {
    minHeight: 24,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.gray50,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediumTierBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.gray700,
  },
  mediumGraphPreviewWrap: {
    height: 76,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  mediumGraphTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.gray900,
    marginBottom: 4,
  },
  mediumGraphDescription: {
    minHeight: 34,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '600',
    color: colors.gray600,
    marginBottom: spacing.xs,
  },
  mediumGraphMeta: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.gray600,
    marginBottom: spacing.sm,
  },
  mediumBuyButton: {
    minHeight: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  mediumBuyButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  mediumBuyButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.background,
  },
  mediumBuyButtonTextDisabled: {
    color: colors.textTertiary,
  },
  mediumOwnedBadge: {
    minHeight: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  mediumOwnedBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.gray600,
  },

  smallGraphCardOuter: {
    width: '100%',
    marginBottom: spacing.md,
    zIndex: 0,
    elevation: 0,
  },
  smallGraphCardOuterWide: {
    width: '50%',
    paddingHorizontal: 4,
  },
  smallGraphCardOuterWideLeft: {
    paddingLeft: 0,
  },
  smallGraphCardOuterWideRight: {
    paddingRight: 0,
  },
  smallGraphCard: {
    minHeight: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallGraphPreviewWrap: {
    width: 54,
    height: 54,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  smallGraphInfo: {
    flex: 1,
    minWidth: 0,
  },
  smallGraphTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.gray800,
    marginBottom: 4,
  },
  smallGraphMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray600,
  },
  smallGraphRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  smallGraphPrice: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.gray800,
    marginBottom: 5,
  },
  smallBuyButton: {
    minHeight: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.black,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBuyButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.background,
  },
  smallOwnedBadge: {
    minHeight: 28,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray50,
  },
  smallOwnedBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.gray600,
  },

});
