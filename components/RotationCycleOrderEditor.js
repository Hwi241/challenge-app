import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RotationDraggableList } from './RotationDragScroll';
import { buttonStyles, card, color, layout, space, text } from '../styles/common';

const minutesOf = (seconds) => String(Math.round(Number(seconds) / 6) / 10);

const ROTATION_ORDER_SPRING = {
  damping: 28,
  mass: 0.2,
  stiffness: 1000,
  overshootClamping: true,
};

const rotationItemKey = (item) => item.id;

const RotationOrderRow = memo(function RotationOrderRow({
  item, index, drag, active = false, done = false, locked, onMeasure,
}) {
  const handleLayout = useCallback((event) => {
    if (!drag) return;
    onMeasure?.(item.id, event.nativeEvent.layout.height);
  }, [drag, item.id, onMeasure]);

  return (
    <View style={[styles.row, drag && styles.editingRow]} onLayout={handleLayout}>
      {!drag && (
        <Text style={styles.number}>{done ? '✓' : index + 1}</Text>
      )}
      <View style={styles.body}>
        <Text style={[text.body, !drag && !done && index === 0 && styles.current]}>
          {item.name}
        </Text>
        <Text style={text.meta}>
          {minutesOf(item.progressSeconds)} / {minutesOf(item.targetSeconds)}분
        </Text>
      </View>
      {drag ? (
        <TouchableOpacity
          accessibilityLabel={item.name + ' 순서 이동 손잡이'}
          onLongPress={drag}
          delayLongPress={180}
          disabled={locked ? true : active}
          style={styles.handle}
        >
          <Text style={text.sectionTitle}>≡</Text>
        </TouchableOpacity>
      ) : (
        <Text style={text.meta}>{done ? '완료' : index === 0 ? '현재' : '대기'}</Text>
      )}
    </View>
  );
});

export default function RotationCycleOrderEditor({
  summary, editing, disabled, onEditingChange, onApply,
}) {
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [rowHeights, setRowHeights] = useState({});
  const baselineRef = useRef(null);
  const savingRef = useRef(false);
  const draggingRef = useRef(false);
  const pending = summary.remainingItems;
  const completed = summary.cycleItems.filter((item) => item.completed);
  const locked = disabled ? true : saving;

  const separatorOffsets = useMemo(() => {
    const offsets = [];
    let bottom = 0;
    for (const item of draft) {
      const height = rowHeights[item.id];
      if (!Number.isFinite(height)) return [];
      if (height <= 0) return [];
      bottom += height;
      offsets.push(bottom);
    }
    return offsets;
  }, [draft, rowHeights]);

  const close = () => {
    setDraft([]);
    baselineRef.current = null;
    onEditingChange(false);
  };

  const begin = () => {
    if (locked) return;
    Keyboard.dismiss();
    baselineRef.current = {
      expectedCycleNumber: summary.currentCycleNumber,
      expectedQueue: pending.map((item) => item.id),
    };
    setDraft(pending.map((item) => ({ ...item })));
    onEditingChange(true);
  };

  const apply = async () => {
    if (locked) return;
    if (savingRef.current) return;
    if (draggingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const result = await onApply(
        draft.map((item) => item.id),
        baselineRef.current,
      );
      if (result === true) close();
      else if (result === 'stale') close();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleRowMeasure = useCallback((id, height) => {
    if (!Number.isFinite(height)) return;
    if (height <= 0) return;
    setRowHeights((previous) => {
      const oldHeight = previous[id];
      if (typeof oldHeight === 'number') {
        if (Math.abs(oldHeight - height) < 0.5) return previous;
      }
      return { ...previous, [id]: height };
    });
  }, []);

  const row = useCallback(
    (item, index, drag, active = false, done = false) => (
      <RotationOrderRow
        item={item}
        index={index}
        drag={drag}
        active={active}
        done={done}
        locked={locked}
        onMeasure={handleRowMeasure}
      />
    ),
    [locked, handleRowMeasure],
  );

  const renderEditableRow = useCallback(
    ({ item, getIndex, drag, isActive }) =>
      row(item, getIndex() ?? -1, drag, isActive),
    [row],
  );

  const handleDragBegin = useCallback(() => {
    draggingRef.current = true;
    setDragging(true);
  }, []);

  const handleDragEnd = useCallback(({ data }) => {
    setDraft(data);
    draggingRef.current = false;
    setDragging(false);
  }, []);

  return (
    <View style={[card.form, styles.section]}>
      <View style={layout.rowBetween}>
        <Text style={text.sectionTitle}>이번 회전 순서</Text>
        {!editing && (
          <TouchableOpacity
            style={[buttonStyles.compactRight, (locked ? true : pending.length < 2) && styles.disabled]}
            onPress={begin}
            disabled={locked ? true : pending.length < 2}
          >
            <Text style={buttonStyles.compactRightText}>순서 변경</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.help}>
        {summary.currentCycleNumber}번째 회전 · 다음 회전은 기본 순서로 시작합니다.
      </Text>
      {editing ? (
        <>
          <Text style={styles.help}>손잡이를 길게 눌러 이동하세요. 맨 위 활동부터 진행합니다.</Text>
          <View style={styles.editorColumns}>
            <View
              pointerEvents="none"
              style={[
                styles.numberColumn,
                !draft.every((item) => rowHeights[item.id] > 0) && styles.unmeasured,
              ]}
            >
              {draft.map((item, index) => (
                <View
                  key={'slot-' + index}
                  style={[
                    styles.numberSlot,
                    { height: rowHeights[item.id] ?? 0 },
                  ]}
                >
                  <Text style={styles.number}>{index + 1}</Text>
                </View>
              ))}
            </View>
            <View style={styles.activityColumn}>
              <RotationDraggableList
                animationConfig={ROTATION_ORDER_SPRING}
                data={draft}
                keyExtractor={rotationItemKey}
                renderItem={renderEditableRow}
                onDragBegin={handleDragBegin}
                onDragEnd={handleDragEnd}
              />
            </View>
            <View
              pointerEvents="none"
              accessible={false}
              style={styles.separatorOverlay}
            >
              {separatorOffsets.map((bottom, index) => (
                <View
                  key={'separator-' + index}
                  style={[
                    styles.fixedSeparator,
                    { top: Math.max(0, bottom - StyleSheet.hairlineWidth) },
                  ]}
                />
              ))}
            </View>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[buttonStyles.secondary.container, styles.action, (locked ? true : dragging) && styles.disabled]}
              onPress={close}
              disabled={locked ? true : dragging}
            >
              <Text style={buttonStyles.secondary.label}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[buttonStyles.primary.container, styles.action, locked && styles.disabled]}
              onPress={apply}
              disabled={locked ? true : dragging}
            >
              <Text style={buttonStyles.primary.label}>{saving ? '적용 중…' : '적용'}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : pending.map((item, index) => (
        <React.Fragment key={item.id}>{row(item, index)}</React.Fragment>
      ))}
      {completed.length > 0 && (
        <View style={styles.completed}>
          <Text style={text.sectionTitle}>완료한 활동</Text>
          {completed.map((item, index) => (
            <React.Fragment key={item.id}>{row(item, index, null, false, true)}</React.Fragment>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.md, marginBottom: space.xl },
  help: { ...text.help, marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.divider },
  editingRow: { borderBottomColor: 'transparent' },
  editorColumns: { position: 'relative', flexDirection: 'row', alignItems: 'flex-start' },
  numberColumn: { width: 28 },
  numberSlot: {
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  separatorOverlay: { ...StyleSheet.absoluteFillObject },
  fixedSeparator: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.divider,
  },
  activityColumn: { flex: 1, minWidth: 0 },
  unmeasured: { opacity: 0 },
  number: { ...text.meta, width: 28, textAlign: 'center' },
  body: { flex: 1, marginHorizontal: space.sm },
  current: { fontWeight: '700' },
  handle: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  action: { flex: 1 },
  disabled: { opacity: 0.45 },
  completed: { marginTop: space.lg },
});
