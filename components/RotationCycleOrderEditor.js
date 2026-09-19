import React, { memo, useCallback, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import RotationStableOrderList from './RotationStableOrderList';
import {
  buttonStyles, card, color, layout, space, text,
} from '../styles/common';

const minutesOf = (seconds) => String(Math.round(Number(seconds) / 6) / 10);

const RotationOrderRow = memo(function RotationOrderRow({
  item,
  position,
  current = false,
  done = false,
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.number}>{position}</Text>
      <View style={styles.body}>
        <Text style={[text.body, current && styles.current]}>{item.name}</Text>
        <Text style={text.meta}>
          {minutesOf(item.progressSeconds)} / {minutesOf(item.targetSeconds)}분
        </Text>
      </View>
      <Text style={text.meta}>{done ? '완료' : current ? '현재' : '대기'}</Text>
    </View>
  );
});

export default function RotationCycleOrderEditor({
  summary,
  editing,
  disabled,
  currentReorderLocked = false,
  onEditingChange,
  onApply,
}) {
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [editingIncludesCurrent, setEditingIncludesCurrent] = useState(false);
  const engineRef = useRef(null);
  const baselineRef = useRef(null);
  const savingRef = useRef(false);
  const draggingRef = useRef(false);

  const pending = summary.remainingItems;
  const current = pending[0] ?? null;
  const completed = summary.cycleItems.filter((item) => item.completed);
  const currentProgressSeconds = Math.max(0, Number(current?.progressSeconds) || 0);
  const canMoveCurrent = Boolean(
    current
    && currentProgressSeconds === 0
    && !currentReorderLocked
  );
  const normalUpcoming = pending.slice(1);
  const editableItems = canMoveCurrent ? pending : normalUpcoming;

  const editingFixedItems = [
    ...completed.map((item) => ({ item, done: true, current: false })),
    ...(current && !editingIncludesCurrent
      ? [{ item: current, done: false, current: true }]
      : []),
  ];

  const normalVisibleItems = [
    ...completed.map((item) => ({ item, done: true, current: false })),
    ...(current ? [{ item: current, done: false, current: true }] : []),
    ...normalUpcoming.map((item) => ({ item, done: false, current: false })),
  ];

  const locked = disabled ? true : saving;

  const close = () => {
    if (draggingRef.current) return;
    setDraft([]);
    setEditingIncludesCurrent(false);
    baselineRef.current = null;
    setDragging(false);
    draggingRef.current = false;
    onEditingChange(false);
  };

  const begin = () => {
    if (locked) return;
    if (!current) return;
    if (editableItems.length < 2) return;
    Keyboard.dismiss();
    baselineRef.current = {
      expectedCycleNumber: summary.currentCycleNumber,
      expectedQueue: pending.map((item) => item.id),
    };
    setEditingIncludesCurrent(canMoveCurrent);
    setDraft(editableItems.map((item) => ({ ...item })));
    onEditingChange(true);
  };

  const apply = async () => {
    if (locked) return;
    if (savingRef.current) return;
    if (draggingRef.current) return;
    if (!current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const orderedIds = await engineRef.current?.lockOrder();
      if (!orderedIds || !engineRef.current) return;
      const nextQueue = editingIncludesCurrent
        ? orderedIds
        : [current.id, ...orderedIds];
      const result = await onApply(nextQueue, baselineRef.current);
      if (result === true || result === 'stale') close();
    } finally {
      engineRef.current?.unlock();
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleDragBegin = useCallback(() => {
    draggingRef.current = true;
    setDragging(true);
  }, []);

  const handleDragEnd = useCallback(({ data }) => {
    setDraft(data);
    draggingRef.current = false;
    setDragging(false);
  }, []);

  const canBeginEditing = editableItems.length >= 2;

  return (
    <View style={[card.form, styles.section]}>
      <View style={layout.rowBetween}>
        <Text style={text.sectionTitle}>이번 회차 순서</Text>
        {editing ? (
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[buttonStyles.compactRight, (locked || dragging) && styles.disabled]}
              onPress={close}
              disabled={locked || dragging}
            >
              <Text style={buttonStyles.compactRightText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[buttonStyles.compactRight, (locked || dragging) && styles.disabled]}
              onPress={apply}
              disabled={locked || dragging}
            >
              <Text style={buttonStyles.compactRightText}>
                {saving ? '적용 중…' : '적용'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[buttonStyles.compactRight, (locked || !canBeginEditing) && styles.disabled]}
            onPress={begin}
            disabled={locked || !canBeginEditing}
          >
            <Text style={buttonStyles.compactRightText}>이번 회차만 순서 변경</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.help}>
        {editing
          ? editingIncludesCurrent
            ? '아직 시작하지 않은 현재 활동도 함께 순서를 바꿀 수 있습니다.'
            : '현재 활동은 고정하고 다음 활동만 순서를 바꿀 수 있습니다.'
          : `${summary.currentCycleNumber}번째 회차 · 다음 회차는 기본 순서로 시작합니다.`}
      </Text>

      {editing ? (
        <>
          {editingFixedItems.map(({ item, done, current: isCurrent }, index) => (
            <RotationOrderRow
              key={item.id}
              item={item}
              position={index + 1}
              done={done}
              current={isCurrent}
            />
          ))}
          <RotationStableOrderList
            ref={engineRef}
            source={draft}
            indexOffset={editingFixedItems.length}
            disabled={locked}
            onDragBegin={handleDragBegin}
            onDragEnd={handleDragEnd}
          />
        </>
      ) : (
        normalVisibleItems.map(({ item, done, current: isCurrent }, index) => (
          <RotationOrderRow
            key={item.id}
            item={item}
            position={index + 1}
            done={done}
            current={isCurrent}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.md, marginBottom: space.xl },
  help: { ...text.help, marginTop: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.divider,
  },
  number: { ...text.meta, width: 28, textAlign: 'center' },
  body: { flex: 1, minWidth: 0, marginHorizontal: space.sm },
  current: { fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  disabled: { opacity: 0.45 },
});
