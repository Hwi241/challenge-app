import React from 'react';
import {
  Modal,
  Pressable,
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

export default function TogetherEntryMenuModal({
  visible,
  onClose,
  onStart,
  onJoin,
}) {
  const choose = (action) => {
    onClose?.();
    action?.();
  };

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
          accessibilityRole="button"
          accessibilityLabel="닫기"
        />

        <View style={styles.card}>
          <Text style={styles.title}>
            함께 추가하기
          </Text>

          <Text style={styles.description}>
            새로운 활동을 시작하거나
            친구의 초대에 참여하세요.
          </Text>

          <TouchableOpacity
            style={styles.startButton}
            onPress={() => choose(onStart)}
            activeOpacity={0.84}
            accessibilityRole="button"
            accessibilityLabel="함께 시작하기"
          >
            <Text style={styles.startText}>
              + 함께 시작하기
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.joinButton}
            onPress={() => choose(onJoin)}
            activeOpacity={0.84}
            accessibilityRole="button"
            accessibilityLabel="초대 참여하기"
          >
            <Text style={styles.joinText}>
              초대 참여하기
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelText}>
              취소
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.36)',
  },

  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: primitive.white,
    borderWidth: 1,
    borderColor: primitive.black,
    borderRadius: 20,
    padding: space.lg,
    elevation: 12,
    shadowColor: primitive.black,
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 8,
    },
  },

  title: {
    color: color.textPrimary,
    fontSize: 20,
    fontWeight: font.weight.heavy,
    textAlign: 'center',
  },

  description: {
    color: color.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 22,
  },

  startButton: {
    minHeight: 50,
    backgroundColor: primitive.black,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  startText: {
    color: primitive.white,
    fontSize: 14,
    fontWeight: font.weight.bold,
  },

  joinButton: {
    minHeight: 50,
    backgroundColor: primitive.white,
    borderWidth: 1,
    borderColor: primitive.black,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  joinText: {
    color: primitive.black,
    fontSize: 14,
    fontWeight: font.weight.bold,
  },

  cancelButton: {
    minHeight: 42,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelText: {
    color: color.textSecondary,
    fontSize: 13,
  },
});
