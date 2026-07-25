// screens/MyGraphScreen.js
// Owned graph inventory screen. Shows only purchased graphs with no purchase UI.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import GraphPreviewIcon from '../components/GraphPreviewIcon';
import BackButton from '../components/BackButton';
import {
  color,
  input as canonicalInputStyles,
  primitive,
  radius,
  space,
  surface as canonicalSurfaceStyles,
} from '../styles/common';
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
      <View style={canonicalInputStyles.searchContainer}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="보유 그래프 이름, 설명, 입력값, Tier 검색"
          placeholderTextColor={color.textTertiary}
          style={[
            canonicalInputStyles.searchField,
            styles.searchInputText,
          ]}
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
    <SafeAreaView style={canonicalSurfaceStyles.screen}>
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
          { paddingBottom: Math.max(insets.bottom, 12) + (space.xxl + space.xxs) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

export default MyGraphScreen;

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: space.md,
  },
  listHeader: {
    paddingTop: space.xs,
  },
  searchIcon: {
    fontSize: 20,
    color: primitive.black,
    marginRight: 8,
  },
  searchInputText: {
    fontSize: 16,
  },
  categoryScroll: {
    paddingRight: space.md,
    paddingBottom: space.xs,
  },
  categoryTab: {
    paddingHorizontal: 7,
    paddingVertical: 8,
    marginRight: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  categoryTabActive: {
    borderBottomColor: primitive.black,
  },
  categoryTabText: {
    color: color.textTertiary,
    fontSize: 15,
    fontWeight: '800',
  },
  categoryTabTextActive: {
    color: primitive.black,
  },
  resultCount: {
    marginTop: 2,
    marginBottom: space.xs,
    fontSize: 15,
    color: color.textTertiary,
  },
  filterSortWrap: {
    position: 'relative',
    zIndex: 9999,
    elevation: 999,
    marginLeft: 0,
    marginRight: 0,
    marginBottom: (space.xxs + 2),
    overflow: 'visible',
  },
  filterSortRow: {
    flexDirection: 'row',
  },
  filterSortLineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 0,
    paddingTop: space.xs,
    paddingBottom: (space.xxs + 2),
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
    paddingTop: space.xs,
    paddingBottom: (space.xxs + 2),
    paddingLeft: 6,
    justifyContent: 'flex-end',
    marginLeft: 'auto',
  },
  filterSortText: {
    fontSize: 14,
    color: color.textTertiary,
  },
  filterSortArrow: {
    fontSize: 12,
    color: color.textTertiary,
    marginLeft: space.xxs,
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 40,
    zIndex: 10000,
    elevation: 1000,
    backgroundColor: color.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingVertical: (space.xxs + 2),
    minWidth: 160,
    shadowColor: primitive.black,
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
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
  },
  dropdownOverlayOptionOn: {
    backgroundColor: color.surfaceMuted,
  },
  dropdownOverlayText: {
    fontSize: 15,
    color: color.textSecondary,
    flex: 1,
  },
  dropdownOverlayTextOn: {
    fontWeight: '700',
    color: primitive.black,
  },
  dropdownOverlayCheck: {
    fontSize: 15,
    fontWeight: '700',
    color: primitive.black,
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
    paddingHorizontal: space.xxs,
    paddingBottom: space.sm,
  },
  graphCardOuterWide: {
    maxWidth: '50%',
  },
  graphCardOuterWideLeft: {
    paddingRight: (space.xxs + 2),
  },
  graphCardOuterWideRight: {
    paddingLeft: (space.xxs + 2),
  },
  graphCard: {
    backgroundColor: color.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: space.xs,
  },
  priceBadge: {
    backgroundColor: primitive.black,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: space.xxs,
  },
  priceBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: color.background,
  },
  tierBadge: {
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: space.xxs,
  },
  tierBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: color.textTertiary,
  },
  previewWrap: {
    alignItems: 'center',
    marginVertical: space.xs,
  },
  graphTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
    marginTop: space.xs,
    color: color.textPrimary,
  },
  graphDescription: {
    fontSize: 14,
    color: color.textTertiary,
    marginBottom: space.xs,
  },
  infoBlock: {
    marginBottom: space.xs,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: primitive.black,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  infoText: {
    fontSize: 14,
    color: color.textSecondary,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: space.md,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: primitive.black,
    marginBottom: space.xs,
  },
  emptySubText: {
    fontSize: 14,
    color: primitive.black,
    textAlign: 'center',
  },
  mediumGraphCardOuter: {
    width: '100%',
    marginBottom: space.sm,
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
    borderColor: color.border,
    backgroundColor: color.surface,
    paddingHorizontal: space.xs,
    paddingVertical: space.xs,
  },
  mediumGraphTopRow: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: (space.xxs + 2),
  },
  mediumTierBadge: {
    minHeight: 24,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.backgroundMuted,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediumTierBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: primitive.neutral[700],
  },
  mediumGraphPreviewWrap: {
    height: 76,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  mediumGraphTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: primitive.black,
    marginBottom: 4,
  },
  mediumGraphDescription: {
    minHeight: 34,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '600',
    color: color.textSecondary,
    marginBottom: (space.xxs + 2),
  },
  mediumGraphMeta: {
    fontSize: 10,
    fontWeight: '800',
    color: color.textSecondary,
    marginBottom: space.xs,
  },

  smallGraphCardOuter: {
    width: '100%',
    marginBottom: space.sm,
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
    borderColor: color.border,
    backgroundColor: color.surface,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallGraphPreviewWrap: {
    width: 54,
    height: 54,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.sm,
  },
  smallGraphInfo: {
    flex: 1,
    minWidth: 0,
  },
  smallGraphTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: color.textPrimary,
    marginBottom: 4,
  },
  smallGraphMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: color.textSecondary,
  },

});
