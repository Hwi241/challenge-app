import React, { memo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
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

const ICON_SIZE = 23;

const DockIcon = memo(function DockIcon({
  name,
  active = false,
}) {
  const stroke = active
    ? color.textPrimary
    : color.textSecondary;

  const strokeWidth = active ? 2.2 : 1.8;

  if (name === 'home') {
    return (
      <Svg
        width={ICON_SIZE}
        height={ICON_SIZE}
        viewBox="0 0 24 24"
      >
        <Path
          d="M3.5 10.5L12 3.5l8.5 7v9.5h-5.2v-6.2H8.7V20H3.5z"
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  if (name === 'record') {
    return (
      <Svg
        width={ICON_SIZE}
        height={ICON_SIZE}
        viewBox="0 0 24 24"
      >
        <Circle
          cx="12"
          cy="7.2"
          r="3.2"
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        <Path
          d="M5.2 20c.35-4.25 2.7-6.5 6.8-6.5s6.45 2.25 6.8 6.5"
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
      <Svg
        width={ICON_SIZE}
        height={ICON_SIZE}
        viewBox="0 0 24 24"
      >
        <Path
          d="M4 9.2h16l-1.4-4.4H5.4z"
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
        <Path
          d="M5.2 9.2V20h13.6V9.2"
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
        <Path
          d="M9 20v-5.5h6V20"
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
        <Path
          d="M4 9.2c0 1.5 1 2.4 2.4 2.4S9 10.7 9 9.2c0 1.5 1 2.4 3 2.4s3-0.9 3-2.4c0 1.5 1.2 2.4 2.6 2.4S20 10.7 20 9.2"
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

const DOCK_ITEMS = [
  {
    key: 'home',
    route: 'ChallengeList',
    accessibilityLabel: '홈',
  },
  {
    key: 'record',
    route: 'ProfileInventory',
    accessibilityLabel: '기록실',
  },
  {
    key: 'shop',
    route: 'GraphShop',
    accessibilityLabel: '상점',
  },
];

function MainDock({
  active = null,
}) {
  const navigation = useNavigation();

  return (
    <View style={styles.root}>
      {DOCK_ITEMS.map((item) => {
        const selected = active === item.key;

        return (
          <View
            key={item.key}
            style={styles.slot}
          >
            <TouchableOpacity
              style={styles.iconButton}
              activeOpacity={0.75}
              disabled={selected}
              onPress={() => {
                if (selected) return;
                navigation.navigate(item.route);
              }}
              accessibilityRole="button"
              accessibilityLabel={item.accessibilityLabel}
            >
              <DockIcon
                name={item.key}
                active={selected}
              />
            </TouchableOpacity>
          </View>
        );
      })}

      <View style={styles.slot}>
        <TouchableOpacity
          style={[
            styles.iconButton,
            styles.createButton,
          ]}
          activeOpacity={0.88}
          onPress={() => (
            navigation.navigate('CreateChallengeType')
          )}
          accessibilityRole="button"
          accessibilityLabel="새로 만들기"
        >
          <Text style={styles.createText}>
            +
          </Text>
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
    paddingVertical: 6,
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
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.background,
  },

  createButton: {
    backgroundColor: primitive.black,
  },

  createText: {
    marginTop: -2,
    color: color.textInverse,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '500',
    includeFontPadding: false,
  },
});
