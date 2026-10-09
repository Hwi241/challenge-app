import React, {
  memo,
} from 'react';

import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  color,
  font,
  primitive,
  radius,
  space,
} from '../styles/common';

const getTodayLabel = (
  snapshot
) => {
  if (
    snapshot?.todayState
    === 'done'
  ) {
    return '오늘 완료';
  }

  if (
    snapshot?.todayState
    === 'off'
  ) {
    return '오늘 없음';
  }

  return '오늘 아직';
};

const TogetherAcceptedRoomCard =
  memo(
    function TogetherAcceptedRoomCard({
      room,
      snapshot,
      sourceAvailable = true,
      onPress,
    }) {
      const streak =
        Math.max(
          0,
          Number(
            snapshot?.streak
          ) || 0
        );

      return (
        <TouchableOpacity
          style={
            styles.card
          }
          onPress={
            onPress
          }
          activeOpacity={
            0.84
          }
          accessibilityRole="button"
          accessibilityLabel={
            `${room?.invitationTitle || '함께 활동'} 상세`
          }
        >
          <View
            style={
              styles.topRow
            }
          >
            <Text
              style={
                styles.type
              }
            >
              {room?.invitationTypeLabel
                || snapshot?.typeLabel
                || '함께'}
            </Text>

            <View
              style={
                styles.waitBadge
              }
            >
              <Text
                style={
                  styles.waitBadgeText
                }
              >
                {sourceAvailable
                  ? '연결 대기'
                  : '활동 확인'}
              </Text>
            </View>
          </View>

          <Text
            style={
              styles.title
            }
            numberOfLines={
              2
            }
          >
            {room?.invitationTitle
              || snapshot?.title
              || room?.challengeTitle
              || '함께 활동'}
          </Text>

          <Text
            style={
              styles.linkedActivity
            }
            numberOfLines={
              1
            }
          >
            내 활동 · {snapshot?.title
              || room?.challengeTitle
              || '연결된 활동'}
          </Text>

          <View
            style={
              styles.divider
            }
          />

          <View
            style={
              styles.statusRow
            }
          >
            <View
              style={
                styles.statusItem
              }
            >
              <Text
                style={
                  styles.statusLabel
                }
              >
                내 기록
              </Text>

              <Text
                style={
                  styles.statusValue
                }
              >
                {sourceAvailable
                  ? getTodayLabel(
                      snapshot
                    )
                  : '활동 확인 필요'}
              </Text>
            </View>

            <View
              style={
                styles.statusItem
              }
            >
              <Text
                style={
                  styles.statusLabel
                }
              >
                연속
              </Text>

              <Text
                style={
                  styles.statusValue
                }
              >
                {sourceAvailable
                  ? (
                      streak > 0
                        ? `${streak}일`
                        : '-'
                    )
                  : '-'}
              </Text>
            </View>

            <View
              style={
                styles.statusItem
              }
            >
              <Text
                style={
                  styles.statusLabel
                }
              >
                상대
              </Text>

              <Text
                style={
                  styles.statusValueMuted
                }
              >
                연결 대기
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }
  );

export default TogetherAcceptedRoomCard;

const styles =
  StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor:
        color.border,
      borderRadius:
        radius.card,
      padding:
        space.lg,
      backgroundColor:
        color.background,
    },

    topRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      gap:
        space.sm,
    },

    type: {
      color:
        color.textSecondary,
      fontSize:
        font.size.caption,
      fontWeight:
        font.weight.bold,
    },

    waitBadge: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor:
        primitive.neutral[300],
      paddingHorizontal:
        space.sm,
      paddingVertical: 4,
    },

    waitBadgeText: {
      color:
        color.textSecondary,
      fontSize:
        font.size.caption,
      fontWeight:
        font.weight.bold,
    },

    title: {
      marginTop:
        space.sm,
      color:
        color.textPrimary,
      fontSize:
        font.size.bodyLarge,
      fontWeight:
        font.weight.heavy,
      lineHeight: 24,
    },

    linkedActivity: {
      marginTop: 6,
      color:
        color.textSecondary,
      fontSize:
        font.size.caption,
    },

    divider: {
      height: 1,
      marginVertical:
        space.md,
      backgroundColor:
        color.border,
    },

    statusRow: {
      flexDirection:
        'row',
      gap:
        space.lg,
    },

    statusItem: {
      flex: 1,
      minWidth: 0,
    },

    statusLabel: {
      color:
        color.textSecondary,
      fontSize:
        font.size.caption,
    },

    statusValue: {
      marginTop: 3,
      color:
        color.textPrimary,
      fontSize:
        font.size.body,
      fontWeight:
        font.weight.bold,
    },

    statusValueMuted: {
      marginTop: 3,
      color:
        color.textSecondary,
      fontSize:
        font.size.body,
      fontWeight:
        font.weight.bold,
    },
  });
