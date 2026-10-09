import React, { memo, useCallback, useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { StackActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { color, primitive, radius, space } from '../styles/common';
import { REWARD_FEEDBACK_KIND } from '../utils/rewardFeedback';

const ICON_SIZE = 28;
const DOCK_ITEMS = [
  { key: 'together', route: 'Together', accessibilityLabel: '함께' },
  { key: 'record', route: 'ProfileInventory', accessibilityLabel: '기록실' },
  { key: 'home', route: 'ChallengeList', accessibilityLabel: '홈' },
  { key: 'shop', route: 'GraphShop', accessibilityLabel: '상점' },
];
const DOCK_INDEX = { together: 0, record: 1, home: 2, shop: 3 };

const DockIcon = memo(function DockIcon({ name, active = false }) {
  const fill = active ? primitive.black : primitive.neutral[300];
  if (name === 'together') return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
      <Circle cx="8.2" cy="8" r="3" fill={fill} />
      <Circle cx="16.2" cy="9" r="2.5" fill={fill} />
      <Path d="M2.8 20c.35-4.25 2.35-6.45 5.4-6.45s5.05 2.2 5.4 6.45z" fill={fill} />
      <Path d="M12.4 20c.18-3.25 1.65-5 4.05-5 2.45 0 3.95 1.75 4.2 5z" fill={fill} />
    </Svg>
  );
  if (name === 'record') return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
      <Circle cx="12" cy="7.6" r="3.5" fill={fill} />
      <Path d="M4.8 20c.45-4.65 3.05-7 7.2-7s6.75 2.35 7.2 7z" fill={fill} />
    </Svg>
  );
  if (name === 'home') return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
      <Path d="M3.5 10.3L12 3.5l8.5 6.8v9.9h-6v-6H9.5v6h-6z" fill={fill} />
    </Svg>
  );
  if (name === 'shop') return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
      <Path d="M8.3 8.5V7.2c0-2.35 1.45-3.7 3.7-3.7s3.7 1.35 3.7 3.7v1.3h-2V7.2c0-1.2-.55-1.75-1.7-1.75s-1.7.55-1.7 1.75v1.3z" fill={fill} />
      <Path d="M6 7.8h12l1.1 12.2H4.9z" fill={fill} />
    </Svg>
  );
  return null;
});

const PulsingDockIcon = memo(function PulsingDockIcon({ name, active, rewardPulse }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const target = rewardPulse?.kind === REWARD_FEEDBACK_KIND.XP
      ? 'record'
      : rewardPulse?.kind === REWARD_FEEDBACK_KIND.STAR ? 'shop' : null;
    if (!rewardPulse?.id || target !== name) return undefined;
    scale.stopAnimation();
    scale.setValue(1);
    const animation = Animated.sequence([
      Animated.timing(scale, { toValue: 1.1, duration: 85, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.97, duration: 70, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 90, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [name, rewardPulse?.id, rewardPulse?.kind, scale]);
  return <Animated.View style={{ transform: [{ scale }] }}><DockIcon name={name} active={active} /></Animated.View>;
});

const PlusIcon = memo(function PlusIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 20 20">
      <Rect x={8.8} y={3.5} width={2.4} height={13} fill={primitive.black} />
      <Rect x={3.5} y={8.8} width={13} height={2.4} fill={primitive.black} />
    </Svg>
  );
});

function MainDock({ active = null, navigationRef, rewardPulse = null }) {
  const insets = useSafeAreaInsets();
  const goDock = useCallback((item) => {
    if (item.key === active || !navigationRef?.isReady?.()) return;
    const fromIndex = DOCK_INDEX[active] ?? DOCK_INDEX.home;
    const toIndex = DOCK_INDEX[item.key];
    const direction = toIndex > fromIndex ? 'forward' : 'backward';
    navigationRef.dispatch(StackActions.replace(item.route, { __dockDirection: direction }));
  }, [active, navigationRef]);
  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, space.xxs) }]}>
      {DOCK_ITEMS.map((item) => {
        const selected = active === item.key;
        return (
          <View key={item.key} style={styles.slot}>
            <TouchableOpacity style={styles.iconButton} activeOpacity={0.68} disabled={selected}
              onPress={() => goDock(item)} accessibilityRole="button"
              accessibilityLabel={item.accessibilityLabel} accessibilityState={{ selected }}>
              <PulsingDockIcon name={item.key} active={selected} rewardPulse={rewardPulse} />
            </TouchableOpacity>
          </View>
        );
      })}
      <View style={styles.slot}>
        <TouchableOpacity style={[styles.iconButton, styles.createButton]} activeOpacity={0.84}
          onPress={() => { if (navigationRef?.isReady?.()) navigationRef.navigate('CreateChallengeType'); }}
          accessibilityRole="button" accessibilityLabel="새로 만들기">
          <PlusIcon />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default memo(MainDock);

const styles = StyleSheet.create({
  root: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: 6, borderTopWidth: 1, borderTopColor: color.border, backgroundColor: color.background, overflow: 'visible', zIndex: 20 },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  iconButton: { width: 48, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: color.background },
  createButton: { width: 44, height: 40, borderRadius: 0, backgroundColor: 'transparent' },
});
