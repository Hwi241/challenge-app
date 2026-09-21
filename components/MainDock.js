import React, {
  memo,
} from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  StackActions,
  useNavigation,
} from '@react-navigation/native';
import Svg, {
  Circle,
  Path,
} from 'react-native-svg';

import {
  color,
  primitive,
  radius,
  space,
} from '../styles/common';

const ICON_SIZE = 24;

const DOCK_ITEMS = [
  { key: 'home', route: 'ChallengeList', accessibilityLabel: '홈' },
  { key: 'record', route: 'ProfileInventory', accessibilityLabel: '기록실' },
  { key: 'shop', route: 'GraphShop', accessibilityLabel: '상점' },
];

const DOCK_INDEX = {
  home: 0,
  record: 1,
  shop: 2,
};

const DockIcon = memo(function DockIcon({
  name,
  active = false,
}) {
  const stroke = active ? color.textPrimary : color.textSecondary;
  const strokeWidth = 1.9;

  if (name === 'home') {
    return (
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
        <Path
          d="M4 10.5L12 4l8 6.5V20h-5.2v-5.8H9.2V20H4z"
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (name === 'record') {
    return (
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
        <Circle
          cx="12"
          cy="8"
          r="3.3"
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        <Path
          d="M5.7 20c.4-4 2.7-6 6.3-6s5.9 2 6.3 6"
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  if (name === 'shop') {
    return (
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
        <Path
          d="M6.5 8.5h11l1 11h-13z"
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M9 9V7.3C9 5.5 10.2 4.5 12 4.5s3 1 3 2.8V9"
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  return null;
});

const PlusIcon = memo(function PlusIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path
        d="M10 4v12M4 10h12"
        fill="none"
        stroke={color.textInverse}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
});

function MainDock({
  active = null,
}) {
  const navigation = useNavigation();

  const goDock = (item) => {
    if (item.key === active) return;

    const fromIndex = DOCK_INDEX[active] ?? 0;
    const toIndex = DOCK_INDEX[item.key] ?? 0;
    const direction = toIndex > fromIndex ? 'forward' : 'backward';
    const state = navigation.getState?.();
    const routes = Array.isArray(state?.routes) ? state.routes : [];
    const currentIndex = Number.isFinite(state?.index)
      ? state.index
      : routes.length - 1;

    let existingIndex = -1;
    for (let index = currentIndex - 1; index >= 0; index -= 1) {
      if (routes[index]?.name === item.route) {
        existingIndex = index;
        break;
      }
    }

    if (existingIndex >= 0) {
      navigation.dispatch(StackActions.pop(currentIndex - existingIndex));
      return;
    }

    navigation.navigate(item.route, { __dockDirection: direction });
  };

  return (
    <View style={styles.root}>
      {DOCK_ITEMS.map((item) => {
        const selected = active === item.key;
        return (
          <View key={item.key} style={styles.slot}>
            <TouchableOpacity
              style={styles.iconButton}
              activeOpacity={0.7}
              disabled={selected}
              onPress={() => goDock(item)}
              accessibilityRole="button"
              accessibilityLabel={item.accessibilityLabel}
            >
              <DockIcon name={item.key} active={selected} />
            </TouchableOpacity>
          </View>
        );
      })}

      <View style={styles.slot}>
        <TouchableOpacity
          style={[styles.iconButton, styles.createButton]}
          activeOpacity={0.86}
          onPress={() => navigation.navigate('CreateChallengeType')}
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
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.background,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 48,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.background,
  },
  createButton: {
    width: 58,
    height: 38,
    borderRadius: 19,
    backgroundColor: primitive.black,
  },
});
