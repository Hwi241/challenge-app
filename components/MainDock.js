import React, { memo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { StackActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { color, primitive, radius, space } from '../styles/common';

const ICON_SIZE = 28;
const DOCK_ITEMS = [
  { key: 'home', route: 'ChallengeList', accessibilityLabel: '홈' },
  { key: 'record', route: 'ProfileInventory', accessibilityLabel: '기록실' },
  { key: 'shop', route: 'GraphShop', accessibilityLabel: '상점' },
];
const DOCK_INDEX = { home: 0, record: 1, shop: 2 };

const DockIcon = memo(function DockIcon({ name, active = false }) {
  const fill = active ? primitive.black : primitive.neutral[300];
  if (name === 'home') {
    return (
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
        <Path d="M3.5 10.3L12 3.5l8.5 6.8v9.9h-6v-6H9.5v6h-6z" fill={fill} />
      </Svg>
    );
  }
  if (name === 'record') {
    return (
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
        <Circle cx="12" cy="7.6" r="3.5" fill={fill} />
        <Path d="M4.8 20c.45-4.65 3.05-7 7.2-7s6.75 2.35 7.2 7z" fill={fill} />
      </Svg>
    );
  }
  if (name === 'shop') {
    return (
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
        <Path d="M8.3 8.5V7.2c0-2.35 1.45-3.7 3.7-3.7s3.7 1.35 3.7 3.7v1.3h-2V7.2c0-1.2-.55-1.75-1.7-1.75s-1.7.55-1.7 1.75v1.3z" fill={fill} />
        <Path d="M6 7.8h12l1.1 12.2H4.9z" fill={fill} />
      </Svg>
    );
  }
  return null;
});

const PlusIcon = memo(function PlusIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 20 20">
      <Rect x={8.8} y={3.5} width={2.4} height={13} fill={primitive.black} />
      <Rect x={3.5} y={8.8} width={13} height={2.4} fill={primitive.black} />
    </Svg>
  );
});

function MainDock({ active = null, navigationRef }) {
  const insets = useSafeAreaInsets();

  const goDock = (item) => {
    if (item.key === active || !navigationRef?.isReady?.()) return;
    const fromIndex = DOCK_INDEX[active] ?? 0;
    const toIndex = DOCK_INDEX[item.key] ?? 0;
    const direction = toIndex > fromIndex ? 'forward' : 'backward';
    const state = navigationRef.getRootState?.();
    const routes = Array.isArray(state?.routes) ? state.routes : [];
    const currentIndex = Number.isFinite(state?.index) ? state.index : routes.length - 1;
    let existingIndex = -1;

    for (let index = currentIndex - 1; index >= 0; index -= 1) {
      if (routes[index]?.name === item.route) {
        existingIndex = index;
        break;
      }
    }

    if (existingIndex >= 0) {
      navigationRef.dispatch(StackActions.pop(currentIndex - existingIndex));
      return;
    }
    navigationRef.navigate(item.route, { __dockDirection: direction });
  };

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, space.xxs) }]}>
      {DOCK_ITEMS.map((item) => {
        const selected = active === item.key;
        return (
          <View key={item.key} style={styles.slot}>
            <TouchableOpacity
              style={styles.iconButton}
              activeOpacity={0.68}
              disabled={selected}
              onPress={() => goDock(item)}
              accessibilityRole="button"
              accessibilityLabel={item.accessibilityLabel}
              accessibilityState={{ selected }}
            >
              <DockIcon name={item.key} active={selected} />
            </TouchableOpacity>
          </View>
        );
      })}
      <View style={styles.slot}>
        <TouchableOpacity
          style={[styles.iconButton, styles.createButton]}
          activeOpacity={0.84}
          onPress={() => {
            if (navigationRef?.isReady?.()) navigationRef.navigate('CreateChallengeType');
          }}
          accessibilityRole="button"
          accessibilityLabel="새로 만들기"
        >
          <PlusIcon />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default memo(MainDock);

const styles = StyleSheet.create({
  root: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.background,
  },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconButton: {
    width: 48,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.background,
  },
  createButton: {
    width: 44,
    height: 40,
    borderRadius: 0,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
