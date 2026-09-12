import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { sanitizeNumber } from '../utils/number';
import { buttonStyles, card, color, font, input, layout, radius, space, text } from '../styles/common';

function MiniButton({ label, onPress, disabled, danger }) {
  return (
    <TouchableOpacity
      style={[styles.miniButton, danger && styles.dangerButton, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.miniText, danger && styles.dangerText]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function RotationRoutineForm({
  title,
  description,
  items,
  busy,
  locked = false,
  notice = '',
  onTitleChange,
  onDescriptionChange,
  onUpdateItem,
  onMoveItem,
  onRemoveItem,
  onAddItem,
  onSave,
}) {
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!!notice && <Text style={styles.help}>{notice}</Text>}
      <View style={card.form}>
        <Text style={text.sectionTitleSpaced}>기본 정보</Text>
        <Text style={text.label}>루틴 이름</Text>
        <TextInput value={title} onChangeText={onTitleChange} placeholder="예: 나의 취미 순환" maxLength={50} style={styles.input} editable={!locked} />
        <Text style={styles.label}>설명</Text>
        <TextInput value={description} onChangeText={onDescriptionChange} placeholder="루틴의 목적이나 진행 방법" maxLength={500} multiline style={[styles.input, input.multilineCompact]} editable={!locked} />
      </View>

      <View style={[card.form, styles.section]}>
        <View style={layout.rowBetween}>
          <Text style={text.sectionTitle}>활동 순서</Text>
          <Text style={text.meta}>{items.length}개</Text>
        </View>
        <Text style={styles.help}>위에서부터 진행하며 목표 시간은 나누어 채울 수 있습니다.</Text>
        {items.map((item, index) => (
          <View key={item.id} style={styles.item}>
            <View style={layout.rowBetween}>
              <Text style={styles.itemTitle}>{index + 1}번째 활동</Text>
              <View style={styles.actions}>
                <MiniButton label="↑" disabled={locked || index === 0} onPress={() => onMoveItem(index, -1)} />
                <MiniButton label="↓" disabled={locked || index === items.length - 1} onPress={() => onMoveItem(index, 1)} />
                <MiniButton label="삭제" danger disabled={locked} onPress={() => onRemoveItem(index)} />
              </View>
            </View>
            <TextInput value={item.name} onChangeText={(value) => onUpdateItem(index, 'name', value)} placeholder="활동 이름" maxLength={50} style={styles.itemInput} editable={!locked} />
            <View style={styles.timeRow}>
              <TextInput
                value={item.minutes}
                editable={!locked}
                onChangeText={(value) => onUpdateItem(index, 'minutes', sanitizeNumber(value))}
                placeholder="목표 시간"
                keyboardType="numeric"
                inputMode="numeric"
                maxLength={5}
                style={[input.compact, styles.timeInput]}
              />
              <Text style={styles.minute}>분</Text>
            </View>
          </View>
        ))}
        <TouchableOpacity style={buttonStyles.secondary.container} onPress={onAddItem} disabled={locked}>
          <Text style={buttonStyles.secondary.label}>+ 활동 추가</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[buttonStyles.primary.container, styles.save, busy && styles.disabled]} onPress={onSave} disabled={busy}>
        <Text style={buttonStyles.primary.label}>{busy ? '저장 중...' : '저장하기'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { ...layout.screenContentMuted, paddingBottom: space.xxxl },
  input: { ...input.compact, marginTop: space.xs },
  label: { ...text.label, marginTop: space.md },
  section: { marginTop: space.md },
  help: { ...text.help, marginVertical: space.sm, lineHeight: 18 },
  item: { marginBottom: space.md, padding: space.md, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, backgroundColor: color.backgroundMuted },
  itemTitle: { color: color.textPrimary, fontSize: font.size.body, fontWeight: font.weight.bold },
  actions: { flexDirection: 'row' },
  miniButton: { minWidth: 34, height: 34, marginLeft: space.xs, paddingHorizontal: space.xs, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.border, borderRadius: radius.sm, backgroundColor: color.surface },
  miniText: { color: color.textPrimary, fontSize: font.size.bodySmall, fontWeight: font.weight.bold },
  dangerButton: { borderColor: color.dangerBorder, backgroundColor: color.dangerBg },
  dangerText: { color: color.danger },
  itemInput: { ...input.compact, marginTop: space.sm },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm },
  timeInput: { flex: 1 },
  minute: { width: 30, marginLeft: space.sm, color: color.textPrimary, fontWeight: font.weight.bold },
  save: { marginTop: space.lg },
  disabled: { opacity: 0.45 },
});
