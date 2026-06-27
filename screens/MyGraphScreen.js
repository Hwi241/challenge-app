// screens/MyGraphScreen.js
// Owned graph inventory screen. Shows only purchased graphs with no purchase UI.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  getPurchasedGraphIds,
} from '../utils/graphOwnership';

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


const MY_GRAPH_FILTER_OPTIONS = GRAPH_FILTER_OPTIONS.filter((option) => (
  option.key === 'all' || /^tier[1-5]$/.test(option.key)
));

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

function MyGraphScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const [purchasedGraphIds, setPurchasedGraphIds] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_CATEGORY);
  const [filterKey, setFilterKey] = useState(DEFAULT_FILTER);
  const [sortKey, setSortKey] = useState(DEFAULT_SORT);
 const [viewMode, setViewMode] = useState(GRAPH_VIEW_MODE_FULL);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
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
 console.warn('[MyGraph] load graph view mode failed', error);
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
          const ownedIds = await getPurchasedGraphIds();
          if (!alive) return;
          setPurchasedGraphIds(Array.isArray(ownedIds) ? ownedIds : []);
        } catch (error) {
          console.warn('[MyGraph] load failed', error);
        }
      };
      load();
      return () => {
        alive = false;
      };
    }, [])
  );

  const ownedGraphIdSet = useMemo(() => {
    const ids = new Set(purchasedGraphIds);
    GRAPH_CATALOG.forEach((graph) => {
      if (graph?.defaultOwned === true) {
        ids.add(String(graph.id));
      }
    });
    return ids;
  }, [purchasedGraphIds]);

  const filteredGraphs = useMemo(() => {
    const ownedByCategory = getGraphsByCategory(selectedCategory).filter((graph) => (
      ownedGraphIdSet.has(graph.id)
    ));

    const bySearch = searchGraphs(ownedByCategory, searchQuery);

    let byFilter = bySearch;
    if (/^tier[1-5]$/.test(filterKey)) {
      const tier = Number(filterKey.replace('tier', ''));
      byFilter = bySearch.filter((graph) => Number(graph.tier) === tier);
    }

    return sortGraphs(byFilter, sortKey);
  }, [selectedCategory, searchQuery, filterKey, sortKey, ownedGraphIdSet]);

  const selectViewMode = useCallback((nextViewMode) => {
 setViewMode(nextViewMode);
 setOpenDropdown(null);

 AsyncStorage.setItem(GRAPH_VIEW_MODE_STORAGE_KEY, nextViewMode).catch((error) => {
 console.warn('[MyGraph] save graph view mode failed', error);
 });
 }, []);

 const showFilterMenu = useCallback(() => {
    setOpenDropdown((current) => (current === 'filter' ? null : 'filter'));
  }, []);

  const showSortMenu = useCallback(() => {
    setOpenDropdown((current) => (current === 'sort' ? null : 'sort'));
  }, []);

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
 <View style={styles.mediumGraphCard}>
 <View style={styles.mediumGraphTopRow}>
 <View style={styles.mediumTierBadge}>
 <Text style={styles.mediumTierBadgeText}>{getGraphTierLabel(item.tier)}</Text>
 </View>
 </View>

 <View style={styles.mediumGraphPreviewWrap}>
 <GraphPreviewIcon graph={item} size={isWide ? 58 : 68} />
 </View>

 <Text style={styles.mediumGraphTitle} numberOfLines={1}>
 {item.title}
 </Text>

 <Text style={styles.mediumGraphDescription} numberOfLines={2}>
 {item.description}
 </Text>

 <Text style={styles.mediumGraphMeta} numberOfLines={1}>
 입력값 {inputCount}개 · 권장 {sizeText}
 </Text>
 </View>
 </View>
 );
 }, [isWide, numColumns]);

 const renderSmallGraphCard = useCallback(({ item, index }) => {
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
 </View>
 </View>
 );
 }, [isWide]);

 const renderGraphCard = useCallback(({ item, index }) => {
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
        <View style={styles.graphCard}>
          <View style={styles.cardTopRow}>
            <View style={styles.priceBadge}>
              <Text style={styles.priceBadgeText}>★ {item.price}</Text>
            </View>
            <View style={styles.tierBadge}>
              <Text style={styles.tierBadgeText}>{getGraphTierLabel(item.tier)}</Text>
            </View>
          </View>

          <View style={styles.previewWrap}>
            <GraphPreviewIcon
              graph={item}
              size={isWide ? 132 : 148}
            />
          </View>

          <Text style={styles.graphTitle}>{item.title}</Text>
          <Text style={styles.graphDescription}>{item.description}</Text>

          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>입력값</Text>
            {inputLines.length ? (
              inputLines.map((line) => (
                <Text key={line} style={styles.infoText}>• {line}</Text>
              ))
            ) : (
              <Text style={styles.infoText}>{getGraphInputSummary(item)}</Text>
            )}
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>권장 크기</Text>
            <Text style={styles.infoText}>
              최소 {formatSize(item.minSize)} · 권장 {formatSize(item.recommendedSize)}
            </Text>
            <Text style={styles.infoText}>{getGraphSizeSummary(item)}</Text>
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>지원 방식</Text>
            <Text style={styles.infoText}>{(item.supports || []).join(', ')}</Text>
          </View>
        </View>
      </View>
    );
  }, [isWide]);

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
        {options.map((option, index) => {
          const active = selectedKey === option.key;
          const isLast = index === options.length - 1;

          return (
            <TouchableOpacity
              key={`${type}-${option.key}`}
              style={[
                styles.dropdownOverlayOption,
                active && styles.dropdownOverlayOptionOn,
                isLast && styles.dropdownOverlayOptionLast,
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
      {/* 검색창 */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="보유 그래프 이름, 설명, 입력값, Tier 검색"
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

      {/* 필터 / 정렬 */}
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
            <Text style={styles.filterSortText}>필터: {findOptionLabel(MY_GRAPH_FILTER_OPTIONS, filterKey, '전체')}</Text>
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

        {renderInlineDropdown('filter', MY_GRAPH_FILTER_OPTIONS, filterKey, setFilterKey, 'center')}

        {renderInlineDropdown('sort', GRAPH_SORT_OPTIONS, sortKey, setSortKey, 'right')}
      </View>

      <Text style={styles.resultCount}>
        보유 그래프 {filteredGraphs.length}개
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <BackButton title="내 그래프" />

      <FlatList
        key={`my-graph-${layoutWidthKey}-${viewMode}-${numColumns}`}
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
            <Text style={styles.emptyText}>보유한 그래프가 없어요.</Text>
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

export default MyGraphScreen;

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
    fontSize: 20,
    color: colors.textDisabled,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
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
    fontSize: 15,
    color: colors.textTertiary,
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
    flexDirection: 'row',
  },
  filterSortLineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 0,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    paddingRight: 6,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 0,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    paddingLeft: 6,
    justifyContent: 'flex-end',
    marginLeft: 'auto',
  },
  filterSortText: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  filterSortArrow: {
    fontSize: 12,
    color: colors.textTertiary,
    marginLeft: 4,
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 40,
    zIndex: 10000,
    elevation: 1000,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    minWidth: 160,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  dropdownOverlayOptionOn: {
    backgroundColor: colors.surfaceMuted,
  },
  dropdownOverlayText: {
    fontSize: 15,
    color: colors.textSecondary,
    flex: 1,
  },
  dropdownOverlayTextOn: {
    fontWeight: '700',
    color: colors.black,
  },
  dropdownOverlayCheck: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.black,
    marginLeft: 8,
  },
  dropdownOverlayOptionLast: {
    borderBottomWidth: 0,
  },
  listHeaderOverlayLayer: {
    zIndex: 1,
  },
  graphCardOuter: {
    flex: 1,
    paddingHorizontal: 4,
    paddingBottom: spacing.md,
  },
  graphCardOuterWide: {
    maxWidth: '50%',
  },
  graphCardOuterWideLeft: {
    paddingRight: 6,
  },
  graphCardOuterWideRight: {
    paddingLeft: 6,
  },
  graphCard: {
    backgroundColor: colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  priceBadge: {
    backgroundColor: colors.black,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  priceBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.background,
  },
  tierBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tierBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  previewWrap: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  graphTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
    marginTop: spacing.sm,
    color: colors.textPrimary,
  },
  graphDescription: {
    fontSize: 14,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  infoBlock: {
    marginBottom: spacing.sm,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textDisabled,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: spacing.lg,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textDisabled,
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: colors.textDisabled,
    textAlign: 'center',
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
    minHeight: 184,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  mediumGraphTopRow: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: spacing.xs,
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

});
