import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Alert, Modal, PixelRatio, ScrollView, StyleSheet, Text,
  TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Gesture, GestureDetector, GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation, measure, runOnJS, runOnUI, scrollTo,
  useAnimatedReaction, useAnimatedRef, useAnimatedScrollHandler,
  useAnimatedStyle, useFrameCallback, useSharedValue, withSpring,
} from 'react-native-reanimated';
import {
  previewOrderAtTop, previewOrderHeight, previewOrderTop,
} from '../utils/rotationPreviewOrder';
import { buttonStyles, color, space, text } from '../styles/common';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const SPRING = {
  damping: 28, mass: 0.2, stiffness: 1000, overshootClamping: true,
};

function minutesOf(seconds) {
  const value = Number(seconds);
  return String(Number.isFinite(value) ? Math.round(value / 6) / 10 : 0);
}

function moveDragged(state) {
  'worklet';
  if (state.phase.value !== 1) return;
  const id = state.active.value;
  const heights = state.heights.value;
  const total = previewOrderHeight(state.order.value, heights);
  const limit = Math.max(0, total - (heights[id] ?? 0));
  const top = Math.min(limit, Math.max(
    0,
    state.startTop.value + state.travel.value +
      state.offset.value - state.startOffset.value,
  ));
  state.dragTop.value = top;
  const next = previewOrderAtTop(state.order.value, heights, id, top);
  if (next !== state.order.value) state.order.value = next;
}

const PreviewRow = memo(function PreviewRow({
  item, state, scrollGesture, ready, onMeasure, onBegin, onSettled,
}) {
  const id = item.id;
  const y = useSharedValue(0);
  const placed = useSharedValue(false);

  useAnimatedReaction(
    () => {
      const ownsDrag = state.active.value === id;
      const followsFinger = ownsDrag && state.phase.value === 1;
      return {
        ready: state.ready.value,
        settling: ownsDrag && state.phase.value === 2,
        followsFinger,
        top: followsFinger
          ? state.dragTop.value
          : previewOrderTop(state.order.value, state.heights.value, id),
      };
    },
    (next, previous) => {
      if (!next.ready) return;
      if (!placed.value) {
        y.value = next.top;
        placed.value = true;
        return;
      }
      if (next.settling) return;
      if (next.followsFinger) {
        y.value = next.top;
      } else if (
        previous === null ||
        previous.followsFinger ||
        next.top !== previous.top
      ) {
        y.value = withSpring(next.top, SPRING);
      }
    },
  );

  const finish = useCallback((cancelled) => {
    'worklet';
    if (state.active.value !== id || state.phase.value !== 1) return;
    if (cancelled) state.order.value = state.before.value.slice();
    state.phase.value = 2;
    const target = previewOrderTop(
      state.order.value, state.heights.value, id,
    );
    y.value = withSpring(target, SPRING, (finished) => {
      if (!finished || state.active.value !== id) return;
      // 최종 좌표를 유지한다. 행을 재배치하거나 이동값을 초기화하지 않는다.
      state.active.value = '';
      state.phase.value = 0;
      runOnJS(onSettled)();
    });
  }, [id, state, y, onSettled]);

  const pan = useMemo(() => Gesture.Pan()
    .enabled(ready)
    .maxPointers(1)
    .minDistance(0)
    .activateAfterLongPress(180)
    .shouldCancelWhenOutside(false)
    .blocksExternalGesture(scrollGesture)
    .onStart((event) => {
      if (!state.ready.value || state.phase.value !== 0) return;
      cancelAnimation(y);
      scrollTo(state.scrollRef, 0, state.offset.value, false);
      state.before.value = state.order.value.slice();
      state.startTop.value = y.value;
      state.startOffset.value = state.offset.value;
      state.originTravel.value = event.translationY;
      state.travel.value = 0;
      state.dragTop.value = y.value;
      state.active.value = id;
      state.phase.value = 1;
      runOnJS(onBegin)();
    })
    .onUpdate((event) => {
      if (state.active.value !== id || state.phase.value !== 1) return;
      state.travel.value = event.translationY - state.originTravel.value;
      moveDragged(state);
    })
    .onEnd((event, success) => {
      if (state.active.value !== id || state.phase.value !== 1) return;
      if (success) {
        state.travel.value = event.translationY - state.originTravel.value;
        moveDragged(state);
      }
      finish(!success);
    })
    .onFinalize(() => {
      if (state.active.value === id && state.phase.value === 1) {
        finish(true);
      }
    }), [ready, scrollGesture, state, y, id, onBegin, finish]);

  useEffect(() => () => cancelAnimation(y), [y]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: placed.value ? 1 : 0,
    zIndex: state.active.value === id ? 2 : 1,
    // y is the persistent display coordinate before and after every drop.
    transform: [{ translateY: y.value }],
  }));

  const handleLayout = useCallback((event) => {
    onMeasure(id, event.nativeEvent.layout.height);
  }, [id, onMeasure]);

  return (
    <Animated.View
      collapsable={false}
      onLayout={handleLayout}
      style={[styles.movingRow, animatedStyle]}
    >
      <View style={styles.rowBody}>
        <Text style={text.body}>{item.name}</Text>
        <Text style={text.meta}>
          {minutesOf(item.progressSeconds)} / {minutesOf(item.targetSeconds)}분
        </Text>
      </View>
      <GestureDetector gesture={pan}>
        <View
          collapsable={false}
          style={styles.handle}
          accessibilityLabel={item.name + ' 순서 이동 손잡이'}
        >
          <Text style={text.sectionTitle}>≡</Text>
        </View>
      </GestureDetector>
    </Animated.View>
  );
});

const PreviewSlot = memo(function PreviewSlot({ index, state }) {
  const animatedStyle = useAnimatedStyle(() => {
    const id = state.order.value[index];
    return {
      opacity: state.ready.value ? 1 : 0,
      height: state.heights.value[id] ?? 0,
      transform: [{
        translateY: previewOrderTop(
          state.order.value, state.heights.value, id,
        ),
      }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      style={[styles.slot, animatedStyle]}
    >
      <Text style={styles.number}>{index + 1}</Text>
      <View style={styles.separator} />
    </Animated.View>
  );
});

function PreviewSession({ source, busy, onBusyChange, onClose }) {
  // This array defines native child identity/order for the entire session.
  const [items] = useState(() => source.map((item) => ({ ...item })));
  const ids = useMemo(() => items.map((item) => item.id), [items]);
  const [measured, setMeasured] = useState({});
  const alive = useRef(true);
  const order = useSharedValue(ids);
  const heights = useSharedValue({});
  const readyValue = useSharedValue(false);
  const phase = useSharedValue(0);
  const active = useSharedValue('');
  const before = useSharedValue(ids);
  const dragTop = useSharedValue(0);
  const startTop = useSharedValue(0);
  const startOffset = useSharedValue(0);
  const originTravel = useSharedValue(0);
  const travel = useSharedValue(0);
  const offset = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const scrollRef = useAnimatedRef();
  const listRef = useAnimatedRef();
  const scrollGesture = useMemo(() => Gesture.Native(), []);
  const ready = ids.every((id) => measured[id] > 0);
  const totalHeight = ready ? previewOrderHeight(ids, measured) : ids.length * 72;

  const state = useMemo(() => ({
    order, heights, ready: readyValue, phase, active, before,
    dragTop, startTop, startOffset, originTravel, travel,
    offset, contentHeight, scrollRef, listRef,
  }), [
    order, heights, readyValue, phase, active, before,
    dragTop, startTop, startOffset, originTravel, travel,
    offset, contentHeight, scrollRef, listRef,
  ]);

  useEffect(() => {
    alive.current = true;
    onBusyChange(false);
    return () => { alive.current = false; };
  }, [onBusyChange]);

  useEffect(() => {
    heights.value = measured;
    readyValue.value = ready;
  }, [heights, readyValue, measured, ready]);

  const onMeasure = useCallback((id, rawHeight) => {
    if (!Number.isFinite(rawHeight) || rawHeight <= 0) return;
    const height = PixelRatio.roundToNearestPixel(rawHeight);
    setMeasured((previous) => (
      previous[id] === height
        ? previous
        : { ...previous, [id]: height }
    ));
  }, []);

  const begin = useCallback(() => {
    if (alive.current) onBusyChange(true);
  }, [onBusyChange]);

  const settled = useCallback(() => {
    if (alive.current) onBusyChange(false);
  }, [onBusyChange]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => { offset.value = event.contentOffset.y; },
  });

  const frame = useFrameCallback((info) => {
    'worklet';
    if (phase.value !== 1) return;
    moveDragged(state);
    const viewport = measure(scrollRef);
    const list = measure(listRef);
    if (viewport === null || list === null || viewport.height <= 0) return;
    const center = list.pageY + dragTop.value +
      (heights.value[active.value] ?? 0) / 2 - viewport.pageY;
    const edge = Math.min(48, viewport.height / 4);
    let speed = 0;
    if (center < edge) {
      speed = -180 * Math.min(1, (edge - center) / edge);
    } else if (center > viewport.height - edge) {
      speed = 180 * Math.min(1, (center - viewport.height + edge) / edge);
    }
    const elapsed = Math.min(32, Math.max(0, info.timeSincePreviousFrame ?? 0));
    const limit = Math.max(0, contentHeight.value - viewport.height);
    const next = Math.min(limit, Math.max(0, offset.value + speed * elapsed / 1000));
    if (Math.abs(next - offset.value) >= 0.01) {
      scrollTo(scrollRef, 0, next, false);
    }
  }, false);

  useEffect(() => {
    frame.setActive(busy);
    return () => frame.setActive(false);
  }, [frame, busy]);

  const showResult = useCallback((nextIds) => {
    if (!alive.current) return;
    const names = nextIds.map((id, index) => {
      const item = items.find((candidate) => candidate.id === id);
      return String(index + 1) + '. ' + (item?.name ?? id);
    });
    Alert.alert(
      '검증용 적용',
      names.join('\n') + '\n\n실제 루틴에는 저장하지 않았습니다.',
      [{ text: '확인', onPress: onClose }],
      { cancelable: false },
    );
  }, [items, onClose]);

  const apply = useCallback(() => {
    runOnUI(() => {
      'worklet';
      if (!readyValue.value || phase.value !== 0) return;
      phase.value = 3;
      runOnJS(showResult)(order.value.slice());
    })();
  }, [readyValue, phase, order, showResult]);

  return (
    <GestureDetector gesture={scrollGesture}>
      <AnimatedScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.content}
        scrollEnabled={!busy}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onContentSizeChange={(_width, height) => { contentHeight.value = height; }}
      >
        <Text style={styles.help}>
          손잡이를 길게 눌러 이동하세요. 놓을 때 겹침이 생기는지 확인합니다.
        </Text>
        <Animated.View
          ref={listRef}
          collapsable={false}
          style={[styles.list, { height: totalHeight }]}
        >
          {items.map((_item, index) => (
            <PreviewSlot key={'slot-' + index} index={index} state={state} />
          ))}
          {items.map((item) => (
            <PreviewRow
              key={item.id}
              item={item}
              state={state}
              scrollGesture={scrollGesture}
              ready={ready}
              onMeasure={onMeasure}
              onBegin={begin}
              onSettled={settled}
            />
          ))}
        </Animated.View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[buttonStyles.secondary.container, styles.action]}
            disabled={busy}
            onPress={onClose}
          >
            <Text style={buttonStyles.secondary.label}>취소</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[buttonStyles.primary.container, styles.action]}
            disabled={!ready || busy}
            onPress={apply}
          >
            <Text style={buttonStyles.primary.label}>적용</Text>
          </TouchableOpacity>
        </View>
      </AnimatedScrollView>
    </GestureDetector>
  );
}

export default function RotationOrderPreview({ items, onClose }) {
  const [examples, setExamples] = useState(false);
  const [busy, setBusy] = useState(false);
  const { width, height, fontScale } = useWindowDimensions();
  const source = useMemo(() => examples
    ? Array.from({ length: 12 }, (_unused, index) => ({
      id: 'preview-example-' + index,
      name: index % 3 === 1
        ? '예시 활동 ' + (index + 1) + ' — 긴 활동 이름이 여러 줄로 표시되는 경우 확인'
        : '예시 활동 ' + (index + 1),
      progressSeconds: index * 60,
      targetSeconds: 7200,
    }))
    : items, [examples, items]);
  const valid = source.length >= 2 &&
    source.every((item) => typeof item.id === 'string' && item.id.length > 0) &&
    new Set(source.map((item) => item.id)).size === source.length;

  return (
    <Modal visible animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.flex}>
        <SafeAreaView style={styles.screen}>
          <View style={styles.header}>
            <Text style={text.sectionTitle}>새 드래그 확인</Text>
            <TouchableOpacity disabled={busy} onPress={onClose}>
              <Text style={text.body}>닫기</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.notice}>
            <Text style={text.help}>
              검증용 화면입니다. 실제 루틴과 기록은 변경하지 않습니다.
              화면 크기가 바뀌면 검증 순서를 초기화합니다.
            </Text>
            <TouchableOpacity
              disabled={busy}
              style={styles.modeButton}
              onPress={() => setExamples((previous) => !previous)}
            >
              <Text style={text.body}>
                {examples ? '내 활동으로 확인' : '긴 목록 예시로 확인'}
              </Text>
            </TouchableOpacity>
          </View>
          {valid ? (
            <PreviewSession
              key={[examples, width, height, fontScale].join(':')}
              source={source}
              busy={busy}
              onBusyChange={setBusy}
              onClose={onClose}
            />
          ) : (
            <Text style={styles.help}>서로 다른 ID를 가진 활동이 2개 이상 필요합니다.</Text>
          )}
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: color.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: space.md,
  },
  notice: { paddingHorizontal: space.md, paddingBottom: space.sm },
  modeButton: { alignSelf: 'flex-start', paddingVertical: space.sm },
  content: { padding: space.md, paddingBottom: space.xxxl },
  help: { ...text.help, marginBottom: space.md },
  list: { position: 'relative' },
  movingRow: {
    position: 'absolute', top: 0, left: 28, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  rowBody: { flex: 1, minWidth: 0, marginHorizontal: space.sm },
  handle: {
    width: 44, minHeight: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  slot: {
    position: 'absolute', top: 0, left: 0, right: 0,
    justifyContent: 'center',
  },
  number: { ...text.meta, width: 28, textAlign: 'center' },
  separator: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: StyleSheet.hairlineWidth, backgroundColor: color.divider,
  },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  action: { flex: 1 },
});
