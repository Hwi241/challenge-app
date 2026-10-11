import React, { memo } from 'react';

import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  font,
  primitive,
  radius,
  space,
} from '../styles/common';

const CARD_COMPACT_HEIGHT = 64;
const CARD_EXPANDED_HEIGHT = 224;

const MODE_LABELS = {
  watch: '서로 지켜보기',
  same_push: '같은 PUSH',
  paired_push: '서로 다른 PUSH',
  shared_goal: '공동 목표',
};

const ROLE_LABELS = {
  owner: '방장',
  admin: '관리자',
  member: '멤버',
};

const STATUS_LABELS = {
  active: '진행 중',
  pending: '승인 대기',
  closed: '종료됨',
  ended: '종료됨',
};

const asText = (value) =>
  String(value ?? '').trim();

const getModeLabel = (room) => {
  const mode = asText(room?.mode);
  return MODE_LABELS[mode] || '';
};

const getStatusLabel = (room, variant) => {
  if (variant === 'draft') {
    return asText(room?.roomId)
      ? '친구 초대 중'
      : '초대 준비 중';
  }

  const status = STATUS_LABELS[
    asText(
      room?.status ??
      room?.roomStatus ??
      room?.room_status
    )
  ] || '';

  return room?.locked
    ? `${status ? `${status} · ` : ''}잠금`
    : status;
};

const getMemberCount = (room) => {
  const raw =
    room?.memberCount ??
    room?.member_count;

  if (
    raw !== null &&
    raw !== undefined &&
    raw !== '' &&
    Number.isInteger(Number(raw)) &&
    Number(raw) >= 0
  ) {
    return Number(raw);
  }

  if (Array.isArray(room?.members)) {
    return room.members.length;
  }

  return null;
};

const getMemberLimit = (room) => {
  const raw =
    room?.memberLimit ??
    room?.member_limit;

  return Number.isInteger(Number(raw)) &&
    Number(raw) > 0
    ? Number(raw)
    : null;
};

const TogetherRoomFoldCardV2 = memo(
  function TogetherRoomFoldCardV2({
    room,
    variant = 'room',
    collapsed = false,
    onOpen,
    onToggleCollapsed,
  }) {
    const isDraft = variant === 'draft';

    const title =
      asText(room?.title) ||
      '함께 방';

    const modeLabel =
      getModeLabel(room);

    const statusLabel =
      getStatusLabel(room, variant);

    const roleLabel =
      ROLE_LABELS[
        asText(
          room?.myRole ??
          room?.memberRole ??
          room?.member_role
        )
      ] || '';

    const memberCount =
      isDraft
        ? null
        : getMemberCount(room);

    const memberLimit =
      isDraft
        ? null
        : getMemberLimit(room);

    return (
      <View
        style={[
          styles.shell,
          collapsed
            ? styles.compact
            : styles.expanded,
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.identity}
            onPress={onOpen}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={`${title} 함께 방 열기`}
          >
            <Text
              style={styles.title}
              numberOfLines={1}
            >
              {title}
            </Text>

            {statusLabel ? (
              <Text
                style={styles.subtitle}
                numberOfLines={1}
              >
                {statusLabel}
              </Text>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.foldButton}
            onPress={onToggleCollapsed}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              collapsed
                ? '함께 카드 펼치기'
                : '함께 카드 접기'
            }
          >
            <Text style={styles.foldIcon}>
              {collapsed ? '⌄' : '⌃'}
            </Text>
          </TouchableOpacity>
        </View>

        {!collapsed ? (
          <TouchableOpacity
            style={styles.expandedContent}
            onPress={onOpen}
            activeOpacity={0.84}
            accessibilityRole="button"
            accessibilityLabel={`${title} 상세 보기`}
          >
            <View style={styles.divider} />

            <View style={styles.detailRows}>
              {modeLabel ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    함께 방식
                  </Text>

                  <Text style={styles.detailValue}>
                    {modeLabel}
                  </Text>
                </View>
              ) : null}

              {roleLabel ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    내 역할
                  </Text>

                  <Text style={styles.detailValue}>
                    {roleLabel}
                  </Text>
                </View>
              ) : null}

              {memberCount !== null ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    참여 인원
                  </Text>

                  <Text style={styles.detailValue}>
                    {memberCount}{memberLimit !== null ? `/${memberLimit}` : ''}명
                  </Text>
                </View>
              ) : null}

              {isDraft ? (
                <Text style={styles.notice}>
                  방을 열어 초대 준비를 이어갈 수 있어요.
                </Text>
              ) : null}
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {isDraft
                  ? '초대 준비 계속하기'
                  : '함께 방 상세 보기'}
              </Text>

              <Text style={styles.footerArrow}>
                ›
              </Text>
            </View>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }
);

export default TogetherRoomFoldCardV2;

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    backgroundColor: primitive.black,
    borderWidth: 1,
    borderColor: primitive.black,
    borderRadius: radius.card,
    overflow: 'hidden',
  },

  compact: {
    height: CARD_COMPACT_HEIGHT,
    minHeight: CARD_COMPACT_HEIGHT,
  },

  expanded: {
    height: CARD_EXPANDED_HEIGHT,
    minHeight: CARD_EXPANDED_HEIGHT,
  },

  header: {
    height: CARD_COMPACT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 8,
  },

  identity: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },

  title: {
    color: primitive.white,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: font.weight.heavy,
  },

  subtitle: {
    marginTop: 2,
    color: primitive.neutral[400],
    fontSize: 11,
    lineHeight: 15,
    fontWeight: font.weight.medium,
  },

  foldButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  foldIcon: {
    color: primitive.white,
    fontSize: 26,
    lineHeight: 30,
  },

  expandedContent: {
    flex: 1,
    paddingHorizontal: 12,
  },

  divider: {
    height: 1,
    backgroundColor: primitive.neutral[700],
  },

  detailRows: {
    flex: 1,
    paddingTop: space.sm,
    gap: space.xs,
  },

  detailRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },

  detailLabel: {
    color: primitive.neutral[400],
    fontSize: 12,
    fontWeight: font.weight.medium,
  },

  detailValue: {
    color: primitive.white,
    fontSize: 12,
    fontWeight: font.weight.bold,
    textAlign: 'right',
  },

  notice: {
    marginTop: space.sm,
    color: primitive.neutral[400],
    fontSize: 12,
    lineHeight: 18,
  },

  footer: {
    height: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: primitive.neutral[700],
  },

  footerText: {
    color: primitive.white,
    fontSize: 12,
    fontWeight: font.weight.bold,
  },

  footerArrow: {
    color: primitive.white,
    fontSize: 22,
    lineHeight: 26,
  },
});
