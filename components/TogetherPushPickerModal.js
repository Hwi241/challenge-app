import React from 'react';

import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  color,
  font,
  primitive,
  radius,
  space,
} from '../styles/common';

export default function TogetherPushPickerModal({
  visible,
  items = [],
  loading = false,
  onClose,
  onSelect,
  onCreatePush,
}) {
  const insets =
    useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
        />

        <View
          style={[
            styles.sheet,
            {
              paddingBottom:
                Math.max(
                  insets.bottom,
                  space.md
                ),
            },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>
                함께할 PUSH 선택
              </Text>

              <Text style={styles.description}>
                함께 이어갈 활동을 선택하세요.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="닫기"
            >
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={primitive.black} />
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {items.length ? (
                items.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.item}
                    onPress={() => onSelect(item)}
                    activeOpacity={0.82}
                  >
                    <View style={styles.itemText}>
                      <Text style={styles.type}>
                        {item.typeLabel || 'PUSH'}
                      </Text>

                      <Text
                        style={styles.itemTitle}
                        numberOfLines={2}
                      >
                        {item.title}
                      </Text>
                    </View>

                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>
                    함께할 수 있는 PUSH가 없어요.
                  </Text>

                  <Text style={styles.emptyDescription}>
                    이미 초대 준비 중이거나{`\n`}
                    함께 연결된 PUSH는 제외됩니다.
                  </Text>
                </View>
              )}
            </ScrollView>
          )}

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.createButton}
              onPress={onCreatePush}
              activeOpacity={0.82}
            >
              <Text style={styles.createButtonText}>
                +PUSH 만들기
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles =
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.28)',
    },
    sheet: {
      width: '100%',
      maxHeight: '78%',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: color.background,
      paddingTop: space.sm,
      paddingHorizontal: space.lg,
    },
    handle: {
      width: 34,
      height: 4,
      borderRadius: 2,
      alignSelf: 'center',
      backgroundColor: primitive.neutral[300],
      marginBottom: space.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: space.md,
    },
    headerText: { flex: 1, minWidth: 0 },
    title: {
      color: color.textPrimary,
      fontSize: font.size.bodyLarge,
      fontWeight: font.weight.heavy,
    },
    description: {
      marginTop: space.xs,
      color: color.textSecondary,
      fontSize: font.size.body,
    },
    closeButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeText: {
      color: color.textSecondary,
      fontSize: 28,
      lineHeight: 30,
      fontWeight: font.weight.normal,
    },
    divider: {
      height: 1,
      marginTop: space.lg,
      backgroundColor: color.border,
    },
    list: { flexShrink: 1 },
    listContent: { paddingVertical: space.sm },
    loading: {
      minHeight: 180,
      alignItems: 'center',
      justifyContent: 'center',
    },
    item: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.md,
      borderBottomWidth: 1,
      borderBottomColor: color.border,
      paddingVertical: space.md,
    },
    itemText: { flex: 1, minWidth: 0 },
    type: {
      color: color.textSecondary,
      fontSize: font.size.caption,
      fontWeight: font.weight.bold,
    },
    itemTitle: {
      marginTop: 4,
      color: color.textPrimary,
      fontSize: font.size.body,
      fontWeight: font.weight.bold,
      lineHeight: 21,
    },
    chevron: { color: color.textSecondary, fontSize: 24 },
    empty: {
      minHeight: 150,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: space.md,
    },
    emptyTitle: {
      color: color.textPrimary,
      fontSize: font.size.body,
      fontWeight: font.weight.bold,
      textAlign: 'center',
    },
    emptyDescription: {
      marginTop: space.sm,
      color: color.textSecondary,
      fontSize: font.size.caption,
      lineHeight: 19,
      textAlign: 'center',
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: color.border,
      paddingTop: space.md,
    },
    createButton: {
      minHeight: 50,
      borderWidth: 1,
      borderColor: primitive.black,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: space.lg,
    },
    createButtonText: {
      color: primitive.black,
      fontSize: font.size.body,
      fontWeight: font.weight.bold,
    },
  });
