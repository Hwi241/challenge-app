import React, {
  createContext, useContext, useEffect, useMemo, useState,
} from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import DraggableFlatList from 'react-native-draggable-flatlist';
import Animated, {
  measure,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const DragScrollContext = createContext(null);

export function RotationDragScrollContainer({ children, ...props }) {
  const scrollRef = useAnimatedRef();
  const offset = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const [dragging, setDragging] = useState(false);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      offset.value = event.contentOffset.y;
    },
  });

  const context = useMemo(() => ({
    scrollRef,
    offset,
    viewportHeight,
    contentHeight,
    setDragging,
  }), [scrollRef, offset, viewportHeight, contentHeight]);

  return (
    <DragScrollContext.Provider value={context}>
      <AnimatedScrollView
        {...props}
        ref={scrollRef}
        scrollEnabled={!dragging}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onLayout={(event) => {
          viewportHeight.value = event.nativeEvent.layout.height;
          props.onLayout?.(event);
        }}
        onContentSizeChange={(width, height) => {
          contentHeight.value = height;
          props.onContentSizeChange?.(width, height);
        }}
      >
        {children}
      </AnimatedScrollView>
    </DragScrollContext.Provider>
  );
}

function EdgeAutoScroll({ context, listRef, values }) {
  const { scrollRef, offset, viewportHeight, contentHeight } = context;
  const { hoverOffset, activeCellSize, isDraggingCell, isTouchActiveNative } = values;

  const frame = useFrameCallback((info) => {
    'worklet';
    if (!isDraggingCell.value) return;
    if (!isTouchActiveNative.value) return;
    if (viewportHeight.value <= 0) return;

    const viewport = measure(scrollRef);
    const list = measure(listRef);
    if (viewport === null) return;
    if (list === null) return;

    const height = Math.min(viewport.height, viewportHeight.value);
    if (height <= 0) return;

    const center = list.pageY + hoverOffset.value
      + activeCellSize.value / 2 - viewport.pageY;
    if (!Number.isFinite(center)) return;

    const edge = Math.min(48, height / 4);
    let direction = 0;
    let strength = 0;
    if (center < edge) {
      direction = -1;
      strength = Math.min(1, Math.max(0, (edge - center) / edge));
    } else if (center > height - edge) {
      direction = 1;
      strength = Math.min(1, Math.max(0, (center - height + edge) / edge));
    }
    if (direction === 0) return;

    const elapsed = Math.min(32, Math.max(0, info.timeSincePreviousFrame ?? 0));
    if (elapsed === 0) return;
    const maxOffset = Math.max(0, contentHeight.value - height);
    const next = Math.min(
      maxOffset,
      Math.max(0, offset.value + direction * strength * 180 * elapsed / 1000),
    );
    if (Math.abs(next - offset.value) < 0.01) return;
    scrollTo(scrollRef, 0, next, false);
  }, false);

  useEffect(() => {
    frame.setActive(true);
    return () => frame.setActive(false);
  }, [frame]);

  return null;
}

export function RotationDraggableList({
  onDragBegin, onDragEnd, onRelease, onAnimValInit, ...props
}) {
  const context = useContext(DragScrollContext);
  const listRef = useAnimatedRef();
  const [values, setValues] = useState(null);
  const [dragging, setDragging] = useState(false);
  if (!context) throw new Error('순서 목록의 스크롤 컨테이너가 없습니다.');
  const { setDragging: setOuterDragging, offset } = context;

  useEffect(() => () => {
    setOuterDragging(false);
  }, [setOuterDragging]);

  const release = () => {
    setDragging(false);
    setOuterDragging(false);
  };

  const valuesReady = values
    ? Boolean(
      values.hoverOffset
      && values.activeCellSize
      && values.isDraggingCell
      && values.isTouchActiveNative
    )
    : false;

  return (
    <Animated.View ref={listRef} collapsable={false}>
      <DraggableFlatList
        {...props}
        scrollEnabled={false}
        outerScrollOffset={offset}
        activationDistance={20}
        autoscrollSpeed={0}
        onAnimValInit={(next) => {
          setValues(next);
          onAnimValInit?.(next);
        }}
        onDragBegin={(index) => {
          setOuterDragging(true);
          setDragging(true);
          onDragBegin?.(index);
        }}
        onRelease={(index) => {
          setDragging(false);
          onRelease?.(index);
        }}
        onDragEnd={(result) => {
          release();
          onDragEnd?.(result);
        }}
      />
      {dragging && valuesReady && (
        <EdgeAutoScroll context={context} listRef={listRef} values={values} />
      )}
    </Animated.View>
  );
}
