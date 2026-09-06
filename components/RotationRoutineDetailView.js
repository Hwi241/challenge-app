import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { sanitizeNumber } from '../utils/number';
import { buttonStyles, card, color, font, input, layout, radius, space, text } from '../styles/common';

const formatMinutes = (seconds) => {
  const value = Math.round((Number(seconds) || 0) / 6) / 10;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

const ActionButton = ({ label, onPress, disabled }) => (
  <TouchableOpacity
    style={[buttonStyles.secondary.container, styles.actionButton, disabled && styles.disabled]}
    onPress={onPress}
    disabled={disabled}
  >
    <Text style={buttonStyles.secondary.label}>{label}</Text>
  </TouchableOpacity>
);

export default function RotationRoutineDetailView({
  summary,
  minutes,
  busy,
  onMinutesChange,
  onRecord,
  onDefer,
  onUndo,
  onTogglePaused,
}) {
  const current = summary.currentItem;
  const orderedItems = useMemo(() => [
    ...summary.cycleItems.filter((item) => item.completed),
    ...summary.remainingItems,
  ], [summary.cycleItems, summary.remainingItems]);
  const locked = busy || summary.paused;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={card.form}>
        <View style={layout.rowBetween}>
          <Text style={text.sectionTitle}>{summary.currentCycleNumber}번째 회전</Text>
          <Text style={styles.percent}>{summary.progressPct}%</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: String(summary.progressPct) + '%' }]} />
        </View>
        <Text style={styles.overviewMeta}>
          완료 {summary.completedItemsCount}/{summary.cycleItems.length} · 총 활동 {formatMinutes(summary.totalActualSeconds)}분
        </Text>
      </View>

      <View style={[card.form, styles.section]}>
        <Text style={styles.eyebrow}>{summary.paused ? '일시정지됨' : '현재 차례'}</Text>
        <Text style={styles.currentTitle}>{current?.name || '현재 활동 없음'}</Text>
        {current && (
          <>
            <View style={styles.currentValueRow}>
              <Text style={styles.currentValue}>{formatMinutes(current.progressSeconds)} / {formatMinutes(current.targetSeconds)}분</Text>
              <Text style={text.meta}>남은 시간 {formatMinutes(current.remainingSeconds)}분</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: String(current.progressPct) + '%' }]} />
            </View>
          </>
        )}

        <View style={styles.recordRow}>
          <TextInput
            value={minutes}
            onChangeText={(value) => onMinutesChange(sanitizeNumber(value))}
            placeholder="진행한 시간"
            keyboardType="numeric"
            inputMode="numeric"
            maxLength={5}
            editable={!locked}
            style={[input.compact, styles.timeInput, locked && styles.disabled]}
          />
          <Text style={styles.minuteLabel}>분</Text>
          <TouchableOpacity
            style={[buttonStyles.primary.container, styles.recordButton, locked && styles.disabled]}
            onPress={onRecord}
            disabled={locked}
          >
            <Text style={buttonStyles.primary.label}>기록</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.help}>목표를 넘긴 시간은 다음 활동으로 넘어가지 않습니다.</Text>

        {summary.nextItem && (
          <View style={styles.nextBox}>
            <Text style={text.meta}>다음</Text>
            <Text style={styles.nextText}>{summary.nextItem.name} · {formatMinutes(summary.nextItem.targetSeconds)}분</Text>
          </View>
        )}
      </View>

      <View style={styles.actionRow}>
        <ActionButton label="뒤로 미루기" onPress={onDefer} disabled={locked || !summary.canDefer} />
        <ActionButton label="마지막 취소" onPress={onUndo} disabled={busy || !summary.canUndo} />
      </View>
      <TouchableOpacity
        style={[buttonStyles.secondary.container, styles.pauseButton, busy && styles.disabled]}
        onPress={onTogglePaused}
        disabled={busy}
      >
        <Text style={buttonStyles.secondary.label}>{summary.paused ? '루틴 다시 시작' : '루틴 일시정지'}</Text>
      </TouchableOpacity>

      <View style={[card.form, styles.section]}>
        <Text style={text.sectionTitleSpaced}>이번 회전</Text>
        {orderedItems.map((item, index) => (
          <View key={item.id} style={[styles.itemRow, index > 0 && styles.itemBorder]}>
            <View style={[styles.number, item.current && styles.numberCurrent, item.completed && styles.numberDone]}>
              <Text style={[styles.numberText, (item.current || item.completed) && styles.numberTextActive]}>{index + 1}</Text>
            </View>
            <View style={styles.itemBody}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={text.meta}>{formatMinutes(item.progressSeconds)} / {formatMinutes(item.targetSeconds)}분</Text>
            </View>
            <Text style={styles.itemStatus}>{item.completed ? '완료' : item.current ? '현재' : '대기'}</Text>
          </View>
        ))}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { ...layout.screenContentMuted, paddingBottom: space.xxxl },
  section: { marginTop: space.md },
  percent: { color: color.textPrimary, fontSize: font.size.title, fontWeight: font.weight.heavy },
  track: { height: 8, marginTop: space.sm, overflow: 'hidden', borderRadius: radius.pill, backgroundColor: color.surfacePressed },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: color.primary },
  overviewMeta: { ...text.meta, marginTop: space.sm },
  eyebrow: { color: color.textSecondary, fontSize: font.size.bodySmall, fontWeight: font.weight.bold },
  currentTitle: { marginTop: space.xs, color: color.textPrimary, fontSize: font.size.screenTitle, fontWeight: font.weight.heavy },
  currentValueRow: { ...layout.rowBetween, marginTop: space.md },
  currentValue: { color: color.textPrimary, fontSize: font.size.bodyLarge, fontWeight: font.weight.heavy },
  recordRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.lg },
  timeInput: { flex: 1 },
  minuteLabel: { marginHorizontal: space.sm, color: color.textPrimary, fontWeight: font.weight.bold },
  recordButton: { minHeight: 42, minWidth: 72 },
  help: { ...text.help, marginTop: space.xs },
  nextBox: { marginTop: space.lg, padding: space.md, borderRadius: radius.md, backgroundColor: color.backgroundMuted },
  nextText: { marginTop: space.xxs, color: color.textPrimary, fontSize: font.size.body, fontWeight: font.weight.bold },
  actionRow: { flexDirection: 'row', marginTop: space.md, gap: space.sm },
  actionButton: { flex: 1 },
  pauseButton: { marginTop: space.sm },
  disabled: { opacity: 0.45 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm },
  itemBorder: { borderTopWidth: 1, borderTopColor: color.divider },
  number: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.surfaceMuted },
  numberCurrent: { backgroundColor: color.primary },
  numberDone: { backgroundColor: color.textSecondary },
  numberText: { color: color.textSecondary, fontSize: font.size.meta, fontWeight: font.weight.bold },
  numberTextActive: { color: color.textInverse },
  itemBody: { flex: 1, marginLeft: space.sm },
  itemName: { color: color.textPrimary, fontSize: font.size.body, fontWeight: font.weight.bold },
  itemStatus: { color: color.textSecondary, fontSize: font.size.meta, fontWeight: font.weight.bold },
});
