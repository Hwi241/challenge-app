import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { numericInputProps } from '../utils/number';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RotationDragScrollContainer } from './RotationDragScroll';
import RotationCycleOrderEditor from './RotationCycleOrderEditor';
import {
  buttonStyles, card, color, input, layout, primitive, radius, space, text,
} from '../styles/common';

function minutesOf(seconds) {
  const number = Number(seconds);
  const value = Number.isFinite(number) ? Math.round(number / 6) / 10 : 0;
  return String(value);
}

export default function RotationRoutineRecordForm({
  summary, minutes, content, imageUri, error, busy,
  onMinutesChange, onContentChange, onPickImage, onRemoveImage,
  onRecord, onTogglePaused,
  orderEditing, onOrderEditingChange, onApplyOrder,
}) {
  const [textHeight, setTextHeight] = useState(140);
  const current = summary.currentItem;
  const blocked = busy ? true : orderEditing ? true : Boolean(error);
  const locked = blocked ? true : summary.paused;
  const cannotRecord = locked ? true : !current;
  return (
    <GestureHandlerRootView style={styles.flex}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
        <RotationDragScrollContainer
        contentContainerStyle={layout.screenContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[card.form, styles.cardSpacing]}>
          <Text style={text.bodyMuted}>{summary.paused ? '일시정지됨' : '현재 차례'}</Text>
          <Text style={text.sectionTitle}>{current?.name ?? '현재 활동 없음'}</Text>
          {current && (
            <>
              <Text style={text.body}>
                {minutesOf(current.progressSeconds)} / {minutesOf(current.targetSeconds)}분
              </Text>
              <Text style={text.bodyMuted}>
                남은 시간 {minutesOf(current.remainingSeconds)}분
              </Text>
            </>
          )}
        </View>

        {Boolean(error) && <Text style={text.bodyMuted}>{error}</Text>}

        <View style={[card.form, styles.cardSpacing]}>
          <View style={[layout.rowBetween, styles.cardHeaderSpacing]}>
            <Text style={text.sectionTitle}>내용</Text>
            <TouchableOpacity
              style={[buttonStyles.compactRight, blocked && styles.busy]}
              onPress={onPickImage}
              activeOpacity={0.9}
              disabled={blocked}
            >
              <Text style={buttonStyles.compactRightText}>사진 넣기</Text>
            </TouchableOpacity>
          </View>
          {Boolean(imageUri) && (
            <View style={styles.previewWrap}>
              <Image source={{ uri: imageUri }} style={styles.preview} />
              <TouchableOpacity
                accessibilityLabel="사진 삭제"
                onPress={onRemoveImage}
                activeOpacity={0.8}
                disabled={blocked}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                style={styles.previewDeleteBtn}
              >
                <Text allowFontScaling={false} style={styles.previewDeleteX}>×</Text>
              </TouchableOpacity>
            </View>
          )}
          <TextInput
            value={content}
            onChangeText={(value) => onContentChange(value.slice(0, 500))}
            placeholder="인증 내용을 입력하세요"
            style={[input.compact, styles.entryTextInput, { height: textHeight }, blocked && styles.busyInput]}
            multiline
            editable={!blocked}
            placeholderTextColor={color.textDisabled}
            maxLength={500}
            onContentSizeChange={(event) => {
              const height = event.nativeEvent.contentSize.height;
              if (height > 0) setTextHeight(Math.max(120, Math.min(height, 240)));
            }}
          />
          <Text style={[text.label, styles.durationLabel]}>소요 시간(분)</Text>
          <TextInput
            value={minutes}
            onChangeText={onMinutesChange}
            placeholder="숫자만 입력"
            style={[input.compact, blocked && styles.busyInput]}
            editable={!blocked}
            placeholderTextColor={color.textDisabled}
            {...numericInputProps}
          />
          <Text style={styles.help}>시간만 입력해도 기록할 수 있습니다.</Text>
          <Text style={styles.help}>목표를 넘긴 시간은 다음 활동으로 넘어가지 않습니다.</Text>
        </View>

        <TouchableOpacity
          style={[buttonStyles.primary.container, styles.submitButton, cannotRecord && styles.busy]}
          onPress={onRecord}
          activeOpacity={0.9}
          disabled={cannotRecord}
        >
          <Text style={buttonStyles.primary.label}>제출하기</Text>
        </TouchableOpacity>
          {summary.paused && (
            <TouchableOpacity
              style={[buttonStyles.secondary.container, styles.pauseButton, blocked && styles.busy]}
              onPress={onTogglePaused}
              disabled={blocked}
            >
              <Text style={buttonStyles.secondary.label}>루틴 다시 시작</Text>
            </TouchableOpacity>
          )}
        <RotationCycleOrderEditor
          summary={summary}
          editing={orderEditing}
          disabled={busy ? true : Boolean(error)}
          onEditingChange={onOrderEditingChange}
          onApply={onApplyOrder}
        />
        </RotationDragScrollContainer>
    </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  orderSection: { marginBottom: space.xl },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  itemBorder: { borderTopWidth: 1, borderTopColor: color.divider },
  orderNumber: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: color.surfaceMuted,
  },
  numberCurrent: { backgroundColor: color.primary },
  numberDone: { backgroundColor: color.textSecondary },
  orderNumberText: { color: color.textSecondary },
  numberTextActive: { color: color.textInverse },
  itemBody: { flex: 1, marginLeft: space.sm, marginRight: space.sm },
  currentItemText: { color: color.textPrimary, fontWeight: '700' },
  flex: { flex: 1 },
  cardSpacing: { marginBottom: space.md },
  cardHeaderSpacing: { marginBottom: space.xs },
  entryTextInput: { minHeight: 120, textAlignVertical: 'top' },
  durationLabel: { marginTop: space.sm, marginBottom: space.xxs + 2 },
  busy: { opacity: 0.6 },
  busyInput: { opacity: 0.75 },
  submitButton: { marginTop: space.xl },
  previewWrap: { position: 'relative', marginBottom: space.sm },
  preview: { width: '100%', height: 200, borderRadius: radius.md, backgroundColor: color.surfaceMuted },
  previewDeleteBtn: {
    position: 'absolute', top: space.xs, right: space.xs,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: color.imageDeleteOverlay,
  },
  previewDeleteX: {
    fontSize: 18, lineHeight: 18, color: primitive.black,
    fontWeight: '900', includeFontPadding: false,
  },
  help: { ...text.help, marginTop: space.xs },
  actionRow: { flexDirection: 'row', marginTop: space.md, gap: space.sm },
  actionButton: { flex: 1 },
  pauseButton: { marginTop: space.sm, marginBottom: space.xl },
});
