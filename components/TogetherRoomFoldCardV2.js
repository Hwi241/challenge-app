import React, { memo } from 'react';

import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  font,
  primitive,
  radius,
  space,
} from '../styles/common';

const CARD_COMPACT_HEIGHT = 64;
const CARD_EXPANDED_HEIGHT = 224;

const FoldChevronIcon = ({ collapsed }) => (
  <Svg width={8} height={5} viewBox="0 0 8 5">
    <Path
      d={
        collapsed
          ? 'M0.8 0.8L4 4.2L7.2 0.8'
          : 'M0.8 4.2L4 0.8L7.2 4.2'
      }
      fill="none"
      stroke={primitive.neutral[400]}
      strokeWidth={1.15}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

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

  const rawStatus = asText(
    room?.status ??
    room?.roomStatus ??
    room?.room_status
  );
  const role = asText(
    room?.myRole ??
    room?.memberRole ??
    room?.member_role
  );
  const memberCount = getMemberCount(room);
  const status =
    rawStatus === 'active' &&
    memberCount !== null &&
    memberCount <= 1 &&
    role === 'owner'
      ? '초대 수락 대기 중'
      : STATUS_LABELS[rawStatus] || '';

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
      '함께 PUSH';

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

    const headerMeta = [
      statusLabel,
      roleLabel,
    ].filter(Boolean).join(' · ');

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
        <TouchableOpacity
          style={styles.header}
          onPress={onOpen}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel={`${title} 열기`}
        >
          <View style={styles.identity}>
            <Text
              style={styles.title}
              numberOfLines={1}
            >
              {title}
            </Text>

            {headerMeta ? (
              <Text
                style={styles.subtitle}
                numberOfLines={1}
              >
                {headerMeta}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>

        {!collapsed ? (
          <TouchableOpacity
            style={styles.expandedContent}
            onPress={onOpen}
            activeOpacity={0.84}
            accessibilityRole="button"
            accessibilityLabel={`${title} 열기`}
          >
            <View style={styles.divider} />

            <View style={styles.detailRows}>
              {modeLabel ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailValue}>
                    {modeLabel}
                  </Text>
                </View>
              ) : null}

              {memberCount !== null ? (
                <View style={styles.detailRow}>
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

          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.foldButton}
          onPress={onToggleCollapsed}
          activeOpacity={0.65}
          hitSlop={{ top: 5, bottom: 5, left: 18, right: 18 }}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? '함께 카드 펼치기' : '함께 카드 접기'}
        >
          <FoldChevronIcon collapsed={collapsed} />
        </TouchableOpacity>
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
    justifyContent: 'center',
    paddingLeft: 12,
    paddingRight: 12,
  },

  identity: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    color: primitive.white,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: font.weight.heavy,
    textAlign: 'center',
  },

  subtitle: {
    marginTop: 2,
    color: primitive.neutral[400],
    fontSize: 11,
    lineHeight: 15,
    fontWeight: font.weight.medium,
    textAlign: 'center',
  },

  foldButton: {
    position: 'absolute',
    left: '50%',
    bottom: 7,
    width: 28,
    height: 18,
    marginLeft: -14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },

  expandedContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 28,
  },

  divider: {
    height: 1,
    backgroundColor: primitive.neutral[700],
  },

  detailRows: {
    flex: 1,
    paddingTop: space.sm,
    gap: space.xs,
    alignItems: 'center',
  },

  detailRow: {
    width: '100%',
    minHeight: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  detailValue: {
    color: primitive.white,
    fontSize: 12,
    fontWeight: font.weight.bold,
    textAlign: 'center',
  },

  notice: {
    marginTop: space.sm,
    color: primitive.neutral[400],
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },

});
