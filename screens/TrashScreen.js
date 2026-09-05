// screens/TrashScreen.js
import React, { useCallback, useState } from 'react';
import {
 View,
 Text,
 StyleSheet,
 TouchableOpacity,
 FlatList,
 Alert,
 BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
 useFocusEffect,
 useNavigation,
} from '@react-navigation/native';
import BackButton from '../components/BackButton';
import {
 card as canonicalCardStyles,
 color,
 font,
 layout as canonicalLayoutStyles,
 radius,
 space,
 surface as canonicalSurfaceStyles,
 text as canonicalTextStyles,
} from '../styles/common';
import {
 loadTrash,
 restoreFromTrash,
 permanentDelete,
 emptyTrash,
} from '../utils/trash';

function fmtDeletedAt(ts) {
 if (!ts) return '-';
 const d = new Date(ts);
 const y = d.getFullYear();
 const m = String(d.getMonth() + 1).padStart(2, '0');
 const day = String(d.getDate()).padStart(2, '0');
 const hh = String(d.getHours()).padStart(2, '0');
 const mm = String(d.getMinutes()).padStart(2, '0');
 return `${y}-${m}-${day} ${hh}:${mm}`;
}

function calcPct(item) {
 const cur = Number(item.currentScore ?? 0);
 const goal = Number(item.goalScore ?? 0);
 if (!goal) return 0;
 return Math.min(100, Math.round((cur / goal) * 100));
}

export default function TrashScreen() {
 const [items, setItems] = useState([]);

 const navigation = useNavigation();

 const load = useCallback(async () => {
 const list = await loadTrash();
 setItems(list);
 }, []);

 useFocusEffect(
 useCallback(() => {
 load();

 const sub = BackHandler.addEventListener(
 'hardwareBackPress',
 () => {
 navigation.navigateDeprecated('Settings');
 return true;
 }
 );

 return () => sub.remove();
 }, [load, navigation])
 );

 const onRestore = useCallback(
 (item) => {
 Alert.alert('복구', '이 도전을 복구할까요?', [
 { text: '취소', style: 'cancel' },
 {
 text: '복구',
 onPress: async () => {
 try {
 await restoreFromTrash(item);
 Alert.alert(
 '완료',
 `"${item.title}" 도전이 복구되었습니다.`
 );
 load();
 } catch {
 Alert.alert('오류', '복구에 실패했습니다.');
 }
 },
 },
 ]);
 },
 [load]
 );

 const onPermanentDelete = useCallback(
 (item) => {
 Alert.alert(
 '영구 삭제',
 '이 도전을 영구 삭제할까요? 인증 기록도 함께 삭제되며 되돌릴 수 없습니다.',
 [
 { text: '취소', style: 'cancel' },
 {
 text: '영구 삭제',
 style: 'destructive',
 onPress: async () => {
 await permanentDelete(item.id);
 load();
 },
 },
 ]
 );
 },
 [load]
 );

 const onEmptyTrash = useCallback(() => {
 if (!items.length) return;

 Alert.alert(
 '휴지통 비우기',
 '휴지통을 비울까요? 모든 도전과 인증 기록이 영구 삭제됩니다.',
 [
 { text: '취소', style: 'cancel' },
 {
 text: '모두 삭제',
 style: 'destructive',
 onPress: async () => {
 await emptyTrash(items);
 load();
 },
 },
 ]
 );
 }, [items, load]);

 const renderItem = useCallback(
 ({ item }) => {
 const pct = calcPct(item);
 const reward = item.rewardTitle ?? item.reward ?? null;

 return (
 <View
 style={[
 canonicalCardStyles.base,
 styles.cardSpacing,
 ]}
 >
 <Text
 style={[
 canonicalTextStyles.sectionTitle,
 styles.cardTitleSpacing,
 ]}
 numberOfLines={2}
 >
 {item.title || '(제목 없음)'}
 </Text>

 <View style={styles.metaWrap}>
 <Text
 style={[
 canonicalTextStyles.meta,
 styles.metaText,
 ]}
 >
 진행률: {pct}%
 </Text>

 {!!(item.startDate || item.endDate) && (
 <Text
 style={[
 canonicalTextStyles.meta,
 styles.metaText,
 ]}
 >
 기간: {item.startDate ?? '-'} ~ {item.endDate ?? '-'}
 </Text>
 )}

 <Text
 style={[
 canonicalTextStyles.meta,
 styles.metaText,
 ]}
 >
 달성: {item.currentScore ?? 0} / {item.goalScore ?? 0}회
 </Text>

 {!!reward && (
 <Text
 style={[
 canonicalTextStyles.meta,
 styles.metaText,
 ]}
 >
 보상: {reward}
 </Text>
 )}

 <Text
 style={[
 canonicalTextStyles.meta,
 styles.metaText,
 ]}
 >
 삭제일: {fmtDeletedAt(item._deletedAt)}
 </Text>
 </View>

 <View style={styles.actionRow}>
 <TouchableOpacity
 style={[
 styles.actionButton,
 styles.restoreButton,
 styles.actionFlex,
 ]}
 onPress={() => onRestore(item)}
 activeOpacity={0.9}
 >
 <Text
 style={[
 canonicalTextStyles.bodyStrong,
 styles.restoreButtonText,
 ]}
 >
 복구
 </Text>
 </TouchableOpacity>

 <TouchableOpacity
 style={[
 styles.actionButton,
 styles.deleteButton,
 styles.actionFlex,
 ]}
 onPress={() => onPermanentDelete(item)}
 activeOpacity={0.9}
 >
 <Text style={canonicalTextStyles.bodyStrong}>
 영구 삭제
 </Text>
 </TouchableOpacity>
 </View>
 </View>
 );
 },
 [onRestore, onPermanentDelete]
 );

 return (
 <SafeAreaView style={canonicalSurfaceStyles.screen}>
 <View
 style={[
 canonicalLayoutStyles.rowBetween,
 styles.header,
 ]}
 >
 <BackButton />

 <Text
 style={[
 canonicalTextStyles.screenTitleCompact,
 styles.headerTitlePosition,
 ]}
 >
 휴지통
 </Text>

 {items.length > 0 ? (
 <TouchableOpacity
 style={styles.headerActionButton}
 onPress={onEmptyTrash}
 activeOpacity={0.9}
 >
 <Text style={styles.headerActionText}>
 휴지통 비우기
 </Text>
 </TouchableOpacity>
 ) : (
 <View style={styles.headerPlaceholder} />
 )}
 </View>

 <FlatList
 data={items}
 keyExtractor={(it) => String(it.id)}
 renderItem={renderItem}
 contentContainerStyle={styles.listContent}
 ListEmptyComponent={
 <Text
 style={[
 canonicalTextStyles.bodyMuted,
 styles.emptyText,
 ]}
 >
 휴지통이 비어있어요
 </Text>
 }
 />
 </SafeAreaView>
 );
}

const styles = StyleSheet.create({
 header: {
 paddingRight: space.md,
 },

 headerTitlePosition: {
 position: 'absolute',
 left: 0,
 right: 0,
 zIndex: -1,
 },

 headerActionButton: {
 borderWidth: 1,
 borderColor: color.primary,
 borderRadius: radius.md,
 paddingVertical: space.xxs + 2,
 paddingHorizontal: space.sm,
 },

 headerActionText: {
 color: color.primary,
 fontWeight: font.weight.bold,
 fontSize: font.size.bodySmall,
 },

 headerPlaceholder: {
 width: 80,
 },

 listContent: {
 padding: space.md,
 paddingBottom: space.xxxl + space.lg,
 },

 cardSpacing: {
 marginBottom: space.sm,
 },

 cardTitleSpacing: {
 marginBottom: space.xs,
 },

 metaWrap: {
 gap: 2,
 },

 metaText: {
 marginTop: 2,
 },

 actionRow: {
 flexDirection: 'row',
 gap: space.xs,
 marginTop: space.sm,
 },

 actionFlex: {
 flex: 1,
 },

 actionButton: {
 borderRadius: radius.md,
 paddingVertical: 10,
 alignItems: 'center',
 justifyContent: 'center',
 },

 restoreButton: {
 backgroundColor: color.primary,
 },

 restoreButtonText: {
 color: color.textInverse,
 },

 deleteButton: {
 backgroundColor: color.surface,
 borderWidth: 1,
 borderColor: color.primary,
 },

 emptyText: {
 textAlign: 'center',
 color: color.textDisabled,
 marginTop: space.xxxl * 2,
 fontSize: 15,
 },
});
