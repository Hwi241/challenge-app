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

function CreateRotationRoutineForm({
  title,
  description,
  items,
  busy,
  locked,
  onTitleChange,
  onDescriptionChange,
  onUpdateItem,
  onMoveItem,
  onRemoveItem,
  onAddItem,
  onSave,
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.createContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.createBasicSection}>
        <Text style={styles.createFieldLabel}>루틴 이름</Text>
        <TextInput
          value={title}
          onChangeText={onTitleChange}
          placeholder="예: 나의 취미 순환"
          maxLength={50}
          style={styles.createTitleInput}
          editable={!locked}
          returnKeyType="next"
        />

        <View style={styles.createDescriptionLabelRow}>
          <Text style={styles.createFieldLabel}>설명</Text>
          <Text style={styles.createOptional}>선택</Text>
        </View>
        <TextInput
          value={description}
          onChangeText={onDescriptionChange}
          placeholder="루틴의 목적이나 진행 방법"
          maxLength={500}
          multiline
          style={[styles.createDescriptionInput, input.multilineCompact]}
          editable={!locked}
        />
      </View>

      <View style={styles.createActivitiesSection}>
        <View style={styles.createActivitiesHeader}>
          <View style={styles.createActivitiesHeaderText}>
            <Text style={styles.createSectionTitle}>활동 순서</Text>
            <Text style={styles.createSectionHelp}>
              위에서부터 차례대로 진행합니다.
            </Text>
          </View>
          <Text style={styles.createCount}>{items.length}개</Text>
        </View>

        <View style={styles.createActivityList}>
          {items.map((item, index) => (
            <View key={item.id} style={styles.createActivityRow}>
              <View style={styles.createActivityTopRow}>
                <View style={styles.createActivityNumber}>
                  <Text style={styles.createActivityNumberText}>{index + 1}</Text>
                </View>
                <TextInput
                  value={item.name}
                  onChangeText={(value) => onUpdateItem(index, 'name', value)}
                  placeholder={`${index + 1}번째 활동 이름`}
                  maxLength={50}
                  style={styles.createActivityNameInput}
                  editable={!locked}
                  returnKeyType="next"
                />
                <TouchableOpacity
                  style={styles.createDeleteButton}
                  onPress={() => onRemoveItem(index)}
                  disabled={locked || items.length <= 2}
                  activeOpacity={0.65}
                  accessibilityRole="button"
                  accessibilityLabel={`${index + 1}번째 활동 삭제`}
                  accessibilityState={{
                    disabled: locked || items.length <= 2,
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text
                    style={[
                      styles.createDeleteText,
                      (locked || items.length <= 2)
                        && styles.createDeleteTextDisabled,
                    ]}
                  >
                    ×
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.createActivityBottomRow}>
                <View style={styles.createTimeGroup}>
                  <Text style={styles.createTimeLabel}>목표시간</Text>
                  <TextInput
                    value={item.minutes}
                    editable={!locked}
                    onChangeText={(value) => onUpdateItem(
                      index,
                      'minutes',
                      sanitizeNumber(value),
                    )}
                    placeholder="30"
                    keyboardType="numeric"
                    inputMode="numeric"
                    maxLength={5}
                    selectTextOnFocus
                    style={styles.createTimeInput}
                  />
                  <Text style={styles.createMinuteText}>분</Text>
                </View>

                <View style={styles.createOrderGroup}>
                  <MiniButton
                    label="↑"
                    disabled={locked || index === 0}
                    onPress={() => onMoveItem(index, -1)}
                  />
                  <MiniButton
                    label="↓"
                    disabled={locked || index === items.length - 1}
                    onPress={() => onMoveItem(index, 1)}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.createAddButton, locked && styles.disabled]}
          onPress={onAddItem}
          disabled={locked}
          activeOpacity={0.85}
        >
          <Text style={styles.createAddButtonText}>+ 활동 추가</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[
          buttonStyles.primary.container,
          styles.createSaveButton,
          busy && styles.disabled,
        ]}
        onPress={onSave}
        disabled={busy}
        activeOpacity={0.9}
      >
        <Text style={buttonStyles.primary.label}>
          {busy ? '저장 중...' : '루틴 만들기'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

export default function RotationRoutineForm({
  createMode = false,
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
  if (createMode) {
    return (
      <CreateRotationRoutineForm
        title={title}
        description={description}
        items={items}
        busy={busy}
        locked={locked}
        onTitleChange={onTitleChange}
        onDescriptionChange={onDescriptionChange}
        onUpdateItem={onUpdateItem}
        onMoveItem={onMoveItem}
        onRemoveItem={onRemoveItem}
        onAddItem={onAddItem}
        onSave={onSave}
      />
    );
  }

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
  createContent: {
    ...layout.screenContentMuted,
    paddingTop: space.md,
    paddingBottom: space.xxxl,
  },
  createBasicSection: { marginBottom: space.xl },
  createFieldLabel: {
    color: color.textPrimary,
    fontSize: font.size.body,
    fontWeight: font.weight.bold,
  },
  createTitleInput: { ...input.compact, marginTop: space.xs },
  createDescriptionLabelRow: {
    marginTop: space.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  createOptional: {
    marginLeft: space.xs,
    color: color.textTertiary,
    fontSize: font.size.meta,
    fontWeight: font.weight.medium,
  },
  createDescriptionInput: { ...input.compact, marginTop: space.xs },
  createActivitiesSection: { marginBottom: space.xl },
  createActivitiesHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  createActivitiesHeaderText: { flex: 1, minWidth: 0 },
  createSectionTitle: {
    color: color.textPrimary,
    fontSize: font.size.bodyLarge,
    fontWeight: font.weight.heavy,
  },
  createSectionHelp: {
    marginTop: space.xxs,
    color: color.textSecondary,
    fontSize: font.size.meta,
    lineHeight: 17,
  },
  createCount: {
    marginLeft: space.sm,
    color: color.textSecondary,
    fontSize: font.size.meta,
    fontWeight: font.weight.bold,
  },
  createActivityList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.divider,
  },
  createActivityRow: {
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.divider,
  },
  createActivityTopRow: { flexDirection: 'row', alignItems: 'center' },
  createActivityNumber: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.primary,
  },
  createActivityNumberText: {
    color: color.textInverse,
    fontSize: font.size.meta,
    fontWeight: font.weight.heavy,
  },
  createActivityNameInput: {
    ...input.compact,
    flex: 1,
    minWidth: 0,
    marginLeft: space.sm,
  },
  createDeleteButton: {
    width: 40,
    height: 40,
    marginLeft: space.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createDeleteText: {
    color: color.textPrimary,
    fontSize: 24,
    lineHeight: 26,
    fontWeight: font.weight.regular,
  },
  createDeleteTextDisabled: {
    color: color.textDisabled,
  },
  createActivityBottomRow: {
    marginTop: space.xs,
    marginLeft: 28 + space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  createTimeGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  createTimeLabel: {
    marginRight: space.xs,
    color: color.textSecondary,
    fontSize: font.size.meta,
    fontWeight: font.weight.semibold,
  },
  createTimeInput: {
    width: 64,
    height: 36,
    marginLeft: space.xs,
    paddingHorizontal: space.xs,
    paddingVertical: 0,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
    color: color.textPrimary,
    fontSize: font.size.body,
    fontWeight: font.weight.bold,
  },
  createMinuteText: {
    marginHorizontal: space.xxs,
    color: color.textPrimary,
    fontSize: font.size.meta,
    fontWeight: font.weight.bold,
  },
  createOrderGroup: {
    marginLeft: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  createAddButton: {
    minHeight: 44,
    marginTop: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.surface,
  },
  createAddButtonText: {
    color: color.textPrimary,
    fontSize: font.size.body,
    fontWeight: font.weight.bold,
  },
  createSaveButton: { marginTop: space.xs },
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
