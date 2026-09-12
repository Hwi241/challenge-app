import React, {
  createContext, useContext, useMemo, useState,
} from 'react';
import { ScrollView } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedRef, useAnimatedScrollHandler, useSharedValue,
} from 'react-native-reanimated';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const DragScrollContext = createContext(null);

export function useRotationDragScrollContext() {
  const context = useContext(DragScrollContext);
  if (!context) throw new Error('순서 목록의 스크롤 컨테이너가 없습니다.');
  return context;
}

export function RotationDragScrollContainer({ children, ...props }) {
  const scrollRef = useAnimatedRef();
  const offset = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const [dragging, setDragging] = useState(false);
  const scrollGesture = useMemo(() => Gesture.Native(), []);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      offset.value = event.contentOffset.y;
    },
  });

  const context = useMemo(() => ({
    scrollRef, offset, contentHeight, scrollGesture, setDragging,
  }), [scrollRef, offset, contentHeight, scrollGesture]);

  return (
    <DragScrollContext.Provider value={context}>
      <GestureDetector gesture={scrollGesture}>
        <AnimatedScrollView
          {...props}
          ref={scrollRef}
          scrollEnabled={props.scrollEnabled !== false && !dragging}
          scrollEventThrottle={16}
          onScroll={onScroll}
          onContentSizeChange={(width, height) => {
            contentHeight.value = height;
            props.onContentSizeChange?.(width, height);
          }}
        >
          {children}
        </AnimatedScrollView>
      </GestureDetector>
    </DragScrollContext.Provider>
  );
}
