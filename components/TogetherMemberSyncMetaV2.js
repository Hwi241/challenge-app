import React, { memo } from 'react';

import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  color,
  font,
  space,
} from '../styles/common';

import {
  getTogetherMemberActivityDisplayV2,
} from '../utils/togetherMemberActivityDisplayV2';

const TogetherMemberSyncMetaV2 = memo(
  function TogetherMemberSyncMetaV2({
    member,
  }) {
    const display =
      getTogetherMemberActivityDisplayV2(
        member
      );

    return (
      <View style={styles.container}>
        {display.dateLabel ? (
          <Text style={styles.date}>
            {display.dateLabel}
          </Text>
        ) : (
          <Text style={styles.empty}>
            공유된 활동 기준 날짜가 없어요.
          </Text>
        )}

        {display.syncedLabel ? (
          <Text style={styles.sync}>
            {display.syncedLabel}
          </Text>
        ) : null}
      </View>
    );
  }
);

export default TogetherMemberSyncMetaV2;

const styles = StyleSheet.create({
  container: {
    marginTop: space.xs,
    gap: 3,
    minWidth: 0,
  },
  date: {
    color: color.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: font.weight.medium,
  },
  sync: {
    color: color.textTertiary,
    fontSize: 11,
    lineHeight: 16,
  },
  empty: {
    color: color.textTertiary,
    fontSize: 11,
    lineHeight: 16,
  },
});
