import React, { memo, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { color, radius, space, text } from '../styles/common';

function durationOf(seconds) {
  const value = Number(seconds);
  const total = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return remaining ? minutes + '분 ' + remaining + '초' : minutes + '분';
}

function progressOf(item) {
  const progress = Number(item.progressSeconds) || 0;
  const target = Number(item.targetSeconds) || 0;
  if (progress % 60 === 0 && target % 60 === 0) {
    return String(progress / 60) + ' / ' + String(target / 60) + '분';
  }
  return durationOf(progress) + ' / ' + durationOf(target);
}

const ActivityRow = memo(function ActivityRow({ item, index }) {
  const status = item.completed ? '✓ 완료' : item.current ? '현재' : '대기';
  return (
    <View
      style={[styles.row, item.current && styles.currentRow]}
      accessible
      accessibilityLabel={
        item.name + ', ' + progressOf(item) + ', ' + status
      }
    >
      <Text style={styles.number}>{index + 1}</Text>
      <View style={styles.body}>
        <Text style={[text.body, item.current && styles.currentName]}>
          {item.name}
        </Text>
        <Text style={styles.time}>{progressOf(item)}</Text>
      </View>
      <Text style={[styles.status, item.current && styles.currentName]}>
        {status}
      </Text>
    </View>
  );
});

export default memo(function RotationActivityListWidget({
  summary,
  interactive = true,
}) {
  const items = useMemo(() => {
    if (!summary) return [];
    return [
      ...summary.cycleItems.filter((item) => item.completed),
      ...summary.remainingItems,
    ];
  }, [summary]);

  if (!summary) {
    return <Text style={text.bodyMuted}>활동 정보를 불러오는 중입니다.</Text>;
  }

  return (
    <View style={styles.root}>
      <Text style={styles.cycle}>
        {summary.currentCycleNumber}번째 회전 · 완료 {summary.completedItemsCount}/{items.length}
      </Text>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.content}
        nestedScrollEnabled
        scrollEnabled={interactive}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        {items.map((item, index) => (
          <ActivityRow key={item.id} item={item} index={index} />
        ))}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  cycle: { ...text.meta, marginBottom: space.sm },
  list: { flex: 1, minHeight: 0 },
  content: { paddingBottom: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.divider,
  },
  currentRow: {
    backgroundColor: color.backgroundMuted,
    borderRadius: radius.sm,
  },
  number: { ...text.meta, width: 24, textAlign: 'center' },
  body: { flex: 1, minWidth: 0, marginHorizontal: space.sm },
  time: { ...text.meta, marginTop: space.xxs },
  status: { ...text.meta, flexShrink: 0 },
  currentName: { color: color.textPrimary, fontWeight: '700' },
});
