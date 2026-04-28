// screens/TrashScreen.js
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Alert, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import BackButton from '../components/BackButton';
import { colors, spacing, radius, buttonStyles } from '../styles/common';
import {
  loadTrash, restoreFromTrash, permanentDelete, emptyTrash,
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

  useFocusEffect(useCallback(() => {
    load();
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.navigate('Settings');
      return true;
    });
    return () => sub.remove();
  }, [load, navigation]));

  const onRestore = useCallback((item) => {
    Alert.alert('복구', '이 도전을 복구할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '복구', onPress: async () => {
          try {
            await restoreFromTrash(item);
            Alert.alert('완료', `"${item.title}" 도전이 복구되었습니다.`);
            load();
          } catch {
            Alert.alert('오류', '복구에 실패했습니다.');
          }
        },
      },
    ]);
  }, [load]);

  const onPermanentDelete = useCallback((item) => {
    Alert.alert(
      '영구 삭제',
      '이 도전을 영구 삭제할까요? 인증 기록도 함께 삭제되며 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '영구 삭제', style: 'destructive', onPress: async () => {
            await permanentDelete(item.id);
            load();
          },
        },
      ],
    );
  }, [load]);

  const onEmptyTrash = useCallback(() => {
    if (!items.length) return;
    Alert.alert(
      '휴지통 비우기',
      '휴지통을 비울까요? 모든 도전과 인증 기록이 영구 삭제됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '모두 삭제', style: 'destructive', onPress: async () => {
            await emptyTrash(items);
            load();
          },
        },
      ],
    );
  }, [items, load]);

  const renderItem = useCallback(({ item }) => {
    const pct = calcPct(item);
    const reward = item.rewardTitle ?? item.reward ?? null;
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title || '(제목 없음)'}</Text>

        <View style={styles.metaWrap}>
          <Text style={styles.meta}>진행률: {pct}%</Text>
          {!!(item.startDate || item.endDate) && (
            <Text style={styles.meta}>기간: {item.startDate ?? '-'} ~ {item.endDate ?? '-'}</Text>
          )}
          <Text style={styles.meta}>
            달성: {item.currentScore ?? 0} / {item.goalScore ?? 0}회
          </Text>
          {!!reward && (
            <Text style={styles.meta}>보상: {reward}</Text>
          )}
          <Text style={styles.meta}>삭제일: {fmtDeletedAt(item._deletedAt)}</Text>
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.restoreBtn, { flex: 1 }]}
            onPress={() => onRestore(item)}
            activeOpacity={0.9}
          >
            <Text style={styles.restoreBtnText}>복구</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deleteBtn, { flex: 1 }]}
            onPress={() => onPermanentDelete(item)}
            activeOpacity={0.9}
          >
            <Text style={styles.deleteBtnText}>영구 삭제</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [onRestore, onPermanentDelete]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>휴지통</Text>
        {items.length > 0 ? (
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={onEmptyTrash}
            activeOpacity={0.9}
          >
            <Text style={styles.emptyBtnText}>휴지통 비우기</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>휴지통이 비어있어요</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: spacing.lg,
  },
  headerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    color: colors.gray800,
    zIndex: -1,
  },
  emptyBtn: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: radius.md,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  emptyBtnText: { color: '#111', fontWeight: '700', fontSize: 13 },

  listContent: { padding: spacing.lg, paddingBottom: 60 },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.gray800, marginBottom: spacing.sm },

  metaWrap: { gap: 2 },
  meta: { fontSize: 12, color: colors.gray600, marginTop: 2 },

  btnRow: { flexDirection: 'row', gap: 8, marginTop: spacing.md },

  restoreBtn: {
    backgroundColor: '#111',
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  deleteBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { color: '#111', fontWeight: '800', fontSize: 14 },

  empty: {
    textAlign: 'center',
    color: colors.gray400,
    marginTop: 80,
    fontSize: 15,
  },
});
