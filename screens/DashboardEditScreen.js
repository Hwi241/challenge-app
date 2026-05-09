import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
 Alert,
 Modal,
 ScrollView,
 StyleSheet,
 Text,
 TouchableOpacity,
 View,
} from 'react-native';

import {
 DASHBOARD_TARGETS,
 GRID_COLUMNS,
 DEFAULT_WIDGET_IDS,
 getDefaultDashboardLayout,
 getShopWidgets,
 getWidgetById,
 supportsWidgetTarget,
} from '../constants/widgetCatalog';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
 getDashboardLayoutStateForChallenge,
 saveDashboardLayoutForChallenge,
} from '../utils/dashboardLayout';

function resolveTarget(params) {
 const rawType = params?.type || params?.challengeType || params?.item?.type || params?.challenge?.type;
 const isHabit = rawType === 'habit' || params?.isHabit === true || params?.habitId;
 return isHabit ? DASHBOARD_TARGETS.HABIT : DASHBOARD_TARGETS.CHALLENGE;
}

function normalizeLayoutItem(item, index) {
 const widgetId = item?.widgetId || item?.id || item?.i || DEFAULT_WIDGET_IDS[index] || `graph_${index}`;
 const catalog = getWidgetById(widgetId) || {};
 return {
 ...catalog,
 ...item,
 id: widgetId,
 widgetId,
 x: Number.isFinite(Number(item?.x)) ? Number(item.x) : 0,
 y: Number.isFinite(Number(item?.y)) ? Number(item.y) : index,
 w: Math.max(1, Math.min(GRID_COLUMNS, Number(item?.w || catalog?.defaultSize?.w || GRID_COLUMNS))),
 h: Math.max(1, Number(item?.h || catalog?.defaultSize?.h || 1)),
 };
}

function normalizeLayout(layout, target) {
 const source = Array.isArray(layout) ? layout : getDefaultDashboardLayout(target);
 return source.map(normalizeLayoutItem).sort((a, b) => {
 if (a.y !== b.y) return a.y - b.y;
 return a.x - b.x;
 });
}

export default function DashboardEditScreen({ route, navigation }) {
 const insets = useSafeAreaInsets();
 const params = route?.params || {};
 const challengeId = params.challengeId || params.id || params.challenge?.id || params.item?.id;
 const title = params.title || params.challengeTitle || params.item?.title || params.challenge?.title || '대시보드';
 const dashboardTarget = useMemo(() => resolveTarget(params), [params]);

 const [layout, setLayout] = useState([]);
 const [pickerVisible, setPickerVisible] = useState(false);
 const [loading, setLoading] = useState(true);

 const loadLayout = useCallback(async () => {
 if (!challengeId) {
 setLayout(normalizeLayout([], dashboardTarget));
 setLoading(false);
 return;
 }

 try {
 const state = await getDashboardLayoutStateForChallenge(challengeId, dashboardTarget);
 const nextLayout = state?.hasStoredLayout
 ? normalizeLayout(state.layout, dashboardTarget)
 : normalizeLayout(getDefaultDashboardLayout(dashboardTarget), dashboardTarget);
 setLayout(nextLayout);
 } catch (error) {
 console.log('대시보드 레이아웃 로드 실패:', error?.message || error);
 setLayout(normalizeLayout(getDefaultDashboardLayout(dashboardTarget), dashboardTarget));
 } finally {
 setLoading(false);
 }
 }, [challengeId, dashboardTarget]);

 useEffect(() => {
 loadLayout();
 }, [loadLayout]);

 const placedIds = useMemo(() => new Set(layout.map(item => item.widgetId || item.id)), [layout]);

 const layoutRows = useMemo(() => {
 const rows = new Map();
 (Array.isArray(layout) ? layout : []).forEach((item, index) => {
 const safeW = Math.max(1, Math.min(GRID_COLUMNS, Number(item?.w || GRID_COLUMNS)));
 const safeX = Math.max(0, Math.min(GRID_COLUMNS - safeW, Number(item?.x || 0)));
 const safeY = Number.isFinite(Number(item?.y)) ? Math.max(0, Number(item.y)) : index;
 const normalized = { ...item, x: safeX, y: safeY, w: safeW };
 if (!rows.has(safeY)) rows.set(safeY, []);
 rows.get(safeY).push(normalized);
 });

 return Array.from(rows.entries())
 .sort((a, b) => a[0] - b[0])
 .map(([rowY, items]) => {
 const sortedItems = items.sort((a, b) => {
 if (a.x !== b.x) return a.x - b.x;
 return String(a.widgetId || a.id || '').localeCompare(String(b.widgetId || b.id || ''));
 });
 const slots = [];
 let cursor = 0;

 sortedItems.forEach((item, index) => {
 const itemX = Math.max(cursor, Number(item.x || 0));
 if (itemX > cursor) {
 slots.push({ type: 'spacer', key: `spacer-${rowY}-${index}`, w: itemX - cursor });
 }
 const itemW = Math.max(1, Math.min(GRID_COLUMNS - itemX, Number(item.w || GRID_COLUMNS)));
 slots.push({ type: 'item', key: `item-${rowY}-${item.widgetId || item.id || index}`, item: { ...item, x: itemX, w: itemW }, w: itemW });
 cursor = Math.min(GRID_COLUMNS, itemX + itemW);
 });

 if (cursor < GRID_COLUMNS) {
 slots.push({ type: 'spacer', key: `spacer-${rowY}-end`, w: GRID_COLUMNS - cursor });
 }

 return { rowY, slots };
 });
 }, [layout]);

 const pickerWidgets = useMemo(() => {
 const byId = new Map();

 DEFAULT_WIDGET_IDS.forEach((id) => {
 const widget = getWidgetById(id);
 if (widget) byId.set(id, widget);
 });

 getShopWidgets().forEach((widget) => {
 const id = widget?.id || widget?.widgetId;
 if (id) byId.set(id, widget);
 });

 return Array.from(byId.values()).filter((widget) => {
 const id = widget?.id || widget?.widgetId;
 if (!id || placedIds.has(id)) return false;
 if (typeof supportsWidgetTarget === 'function' && !supportsWidgetTarget(widget, dashboardTarget)) return false;
 return true;
 });
 }, [dashboardTarget, placedIds]);

 const addGraph = useCallback((widget) => {
 const widgetId = widget?.id || widget?.widgetId;
 if (!widgetId) return;

 setLayout((current) => {
 if (current.some(item => (item.widgetId || item.id) === widgetId)) return current;
 const maxY = current.reduce((max, item) => Math.max(max, Number(item.y || 0)), -1);
 return normalizeLayout([
 ...current,
 {
 ...widget,
 id: widgetId,
 widgetId,
 x: 0,
 y: maxY + 1,
 w: Math.max(1, Math.min(GRID_COLUMNS, Number(widget?.defaultSize?.w || GRID_COLUMNS))),
 h: Math.max(1, Number(widget?.defaultSize?.h || 1)),
 },
 ], dashboardTarget);
 });

 setPickerVisible(false);
 }, [dashboardTarget]);

 const removeGraph = useCallback((widgetId) => {
 setLayout((current) => {
 if (current.length <= 1) {
 Alert.alert('안내', '대시보드에는 그래프가 1개 이상 있어야 합니다.');
 return current;
 }
 return current.filter(item => (item.widgetId || item.id) !== widgetId);
 });
 }, []);

 const saveLayout = useCallback(async () => {
 if (!challengeId) {
 Alert.alert('오류', '대시보드 대상을 찾지 못했습니다.');
 return;
 }

 try {
 await saveDashboardLayoutForChallenge(challengeId, layout, dashboardTarget);
 navigation.goBack();
 } catch (error) {
 console.log('대시보드 저장 실패:', error?.message || error);
 Alert.alert('오류', '대시보드를 저장하지 못했습니다.');
 }
 }, [challengeId, dashboardTarget, layout, navigation]);

 const renderGraphCard = (item, index) => {
 const widgetId = item.widgetId || item.id || `graph_${index}`;
 const titleText = item.title || item.name || widgetId;
 const safeW = Math.max(1, Math.min(GRID_COLUMNS, Number(item.w || GRID_COLUMNS)));
 const safeX = Math.max(0, Math.min(GRID_COLUMNS - safeW, Number(item.x || 0)));
 const safeY = Number.isFinite(Number(item.y)) ? Math.max(0, Number(item.y)) : index;
 const safeH = Math.max(1, Number(item.h || 1));
 
 const gridCells = Array.from({ length: GRID_COLUMNS }, (_, cellIndex) => cellIndex >= safeX && cellIndex < safeX + safeW);

 return (
 <View key={`${widgetId}-${index}`} style={[styles.graphCell, { width: '100%' }]}>
 <View style={styles.graphCard}>
 <View style={styles.graphHeader}>
 <Text style={styles.graphTitle} numberOfLines={1}>{titleText}</Text>
 <TouchableOpacity style={styles.removeBtn} onPress={() => removeGraph(widgetId)}>
 <Text style={styles.removeText}>×</Text>
 </TouchableOpacity>
 </View>
 <Text style={styles.graphMeta}>{'위치 ' + safeX + ',' + safeY + ' · 크기 ' + safeW + 'x' + safeH}</Text>
 <View style={styles.gridPreview}>
 {gridCells.map((active, cellIndex) => (
 <View
 key={cellIndex}
 style={[styles.gridPreviewCell, active && styles.gridPreviewCellActive]}
 />
 ))}
 </View>
 <Text style={styles.graphCode} numberOfLines={1}>{widgetId}</Text>
 </View>
 </View>
 );
 };
 const renderGridSlot = (slot, index) => {
 const widthPct = ((Math.max(0, Number(slot.w || 0)) / GRID_COLUMNS) * 100) + '%';
 if (slot.type === 'spacer') {
 return <View key={slot.key || index} style={[styles.gridSpacer, { width: widthPct }]} />;
 }
 return (
 <View key={slot.key || index} style={{ width: widthPct }}>
 {renderGraphCard(slot.item, index)}
 </View>
 );
 };

 return (
 <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
 <View style={styles.header}>
 <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
 <Text style={styles.backText}>‹</Text>
 </TouchableOpacity>
 <Text style={styles.screenTitle}>대시보드 수정</Text>
 <View style={styles.headerSpacer} />
 </View>

 <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 112 + insets.bottom }]}>
 <View style={styles.contentHeader}>
 <Text style={styles.challengeTitle} numberOfLines={1}>{title}</Text>
 <TouchableOpacity style={styles.addBtn} onPress={() => setPickerVisible(true)}>
 <Text style={styles.addText}>그래프 추가</Text>
 </TouchableOpacity>
 </View>

 {loading ? (
 <Text style={styles.emptyText}>불러오는 중...</Text>
 ) : (
 <View style={styles.grid}>
 {layoutRows.map((row) => (
 <View key={row.rowY} style={styles.gridRow}>
 {row.slots.map(renderGridSlot)}
 </View>
 ))}
 </View>
 )}
 </ScrollView>

 <View style={[styles.footer, { paddingBottom: Math.max(18, insets.bottom + 12) }]}>
 <TouchableOpacity style={[styles.footerButton, styles.cancelButton]} onPress={() => navigation.goBack()}>
 <Text style={styles.cancelButtonText}>취소</Text>
 </TouchableOpacity>
 <TouchableOpacity style={[styles.footerButton, styles.saveButton]} onPress={saveLayout}>
 <Text style={styles.saveButtonText}>저장</Text>
 </TouchableOpacity>
 </View>

 <Modal
 visible={pickerVisible}
 transparent
 animationType="fade"
 onRequestClose={() => setPickerVisible(false)}
 >
 <View style={styles.modalOverlay}>
 <View style={styles.modalSheet}>
 <View style={styles.modalHeader}>
 <Text style={styles.modalTitle}>그래프 추가</Text>
 <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setPickerVisible(false)}>
 <Text style={styles.modalCloseText}>×</Text>
 </TouchableOpacity>
 </View>

 {pickerWidgets.length === 0 ? (
 <Text style={styles.emptyText}>추가할 수 있는 그래프가 없습니다.</Text>
 ) : (
 <ScrollView style={styles.pickerList}>
 {pickerWidgets.map((widget) => {
 const widgetId = widget.id || widget.widgetId;
 return (
 <TouchableOpacity
 key={widgetId}
 style={styles.pickerItem}
 onPress={() => addGraph(widget)}
 >
 <Text style={styles.pickerTitle}>{widget.title || widget.name || widgetId}</Text>
 <Text style={styles.pickerMeta}>{widget.description || widgetId}</Text>
 </TouchableOpacity>
 );
 })}
 </ScrollView>
 )}
 </View>
 </View>
 </Modal>
 </SafeAreaView>
 );
}

const styles = StyleSheet.create({
 safe: {
 flex: 1,
 backgroundColor: '#fff',
 },
 header: {
 minHeight: 58,
 paddingHorizontal: 18,
 paddingTop: 8,
 paddingBottom: 10,
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 borderBottomWidth: StyleSheet.hairlineWidth,
 borderBottomColor: '#e6e6e6',
 },
 backBtn: {
 width: 38,
 height: 38,
 alignItems: 'center',
 justifyContent: 'center',
 zIndex: 2,
 },
 backText: {
 fontSize: 36,
 color: '#111',
 lineHeight: 38,
 },
 headerSpacer: {
 width: 38,
 height: 38,
 },
 screenTitle: {
 position: 'absolute',
 left: 0,
 right: 0,
 textAlign: 'center',
 fontSize: 18,
 fontWeight: '800',
 color: '#111',
 zIndex: 1,
 },
 challengeTitle: {
 flex: 1,
 marginRight: 12,
 fontSize: 14,
 fontWeight: '700',
 color: '#444',
 },
  content: {
 paddingHorizontal: 18,
 paddingTop: 14,
 },
 contentHeader: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 marginBottom: 14,
 },
 addBtn: {
 height: 34,
 paddingHorizontal: 12,
 borderRadius: 8,
 borderWidth: 1,
 borderColor: '#111',
 backgroundColor: '#fff',
 alignItems: 'center',
 justifyContent: 'center',
 },
 addText: {
 color: '#111',
 fontSize: 13,
 fontWeight: '800',
 },
 grid: {
 gap: 10,
 },
 gridRow: {
 width: '100%',
 flexDirection: 'row',
 },
 graphCell: {
 paddingHorizontal: 5,
 },
 graphCard: {
 minHeight: 132,
 borderRadius: 8,
 borderWidth: 1,
 borderColor: '#d8d8d8',
 backgroundColor: '#fff',
 padding: 12,
 },
 graphHeader: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: 8,
 },
 graphTitle: {
 flex: 1,
 fontSize: 15,
 fontWeight: '800',
 color: '#111',
 },
 removeBtn: {
 width: 28,
 height: 28,
 borderRadius: 14,
 borderWidth: 1,
 borderColor: '#ccc',
 alignItems: 'center',
 justifyContent: 'center',
 backgroundColor: '#fff',
 },
 removeText: {
 fontSize: 18,
 fontWeight: '800',
 color: '#444',
 lineHeight: 22,
 },
 graphMeta: {
 marginTop: 10,
 fontSize: 12,
 color: '#777',
 },
 gridPreview: {
 flexDirection: 'row',
 gap: 3,
 marginTop: 12,
 },
 gridPreviewCell: {
 flex: 1,
 height: 6,
 borderRadius: 3,
 backgroundColor: '#e5e5e5',
 },
 gridPreviewCellActive: {
 backgroundColor: '#111',
 },
 graphCode: {
 marginTop: 10,
 fontSize: 11,
 color: '#999',
 },
 emptyText: {
 paddingVertical: 24,
 textAlign: 'center',
 fontSize: 14,
 color: '#777',
 },
 footer: {
 position: 'absolute',
 left: 0,
 right: 0,
 bottom: 0,
 flexDirection: 'row',
 gap: 10,
 paddingHorizontal: 18,
 paddingTop: 12,
 borderTopWidth: StyleSheet.hairlineWidth,
 borderTopColor: '#e6e6e6',
 backgroundColor: '#fff',
 },
 footerButton: {
 flex: 1,
 height: 48,
 borderRadius: 8,
 alignItems: 'center',
 justifyContent: 'center',
 },
 cancelButton: {
 borderWidth: 1,
 borderColor: '#bbb',
 backgroundColor: '#fff',
 },
 saveButton: {
 backgroundColor: '#111',
 },
 cancelButtonText: {
 fontSize: 15,
 fontWeight: '800',
 color: '#111',
 },
 saveButtonText: {
 fontSize: 15,
 fontWeight: '800',
 color: '#fff',
 },
 modalOverlay: {
 flex: 1,
 padding: 20,
 backgroundColor: 'rgba(0,0,0,0.38)',
 alignItems: 'center',
 justifyContent: 'center',
 },
 modalSheet: {
 width: '100%',
 maxHeight: '75%',
 borderRadius: 12,
 backgroundColor: '#fff',
 padding: 16,
 },
 modalHeader: {
 flexDirection: 'row',
 alignItems: 'center',
 marginBottom: 12,
 },
 modalTitle: {
 flex: 1,
 fontSize: 18,
 fontWeight: '800',color: '#111',
 },
 modalCloseBtn: {
 width: 32,
 height: 32,
 borderRadius: 16,
 alignItems: 'center',
 justifyContent: 'center',
 backgroundColor: '#f1f1f1',
 },
 modalCloseText: {
 fontSize: 20,
 fontWeight: '800',
 color: '#333',
 lineHeight: 24,
 },
 pickerList: {
 maxHeight: 420,
 },
 pickerItem: {
 paddingVertical: 13,
 borderBottomWidth: StyleSheet.hairlineWidth,
 borderBottomColor: '#e5e5e5',
 },
 pickerTitle: {
 fontSize: 15,
 fontWeight: '800',
 color: '#111',
 },
 pickerMeta: {
 marginTop: 4,
 fontSize: 12,
 color: '#777',
 },
});
