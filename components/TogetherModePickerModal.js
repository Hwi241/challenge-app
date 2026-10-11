import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { color, font, primitive, radius, space } from '../styles/common';
import { TOGETHER_MODE_OPTIONS } from '../utils/togetherV2';

export default function TogetherModePickerModal({ visible, onClose, onSelect }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>어떻게 함께할까요?</Text>
          <Text style={styles.description}>원하는 함께 방식을 선택하세요.</Text>
          <View style={styles.options}>
            {TOGETHER_MODE_OPTIONS.map((option) => (
              <TouchableOpacity key={option.value} style={styles.option} onPress={() => onSelect?.(option.value)} activeOpacity={0.78}>
                <Text style={styles.optionTitle}>{option.label}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.36)' },
  card: { width: '100%', maxWidth: 520, borderRadius: 20, borderWidth: 1, borderColor: primitive.black, backgroundColor: color.background, padding: space.lg },
  title: { color: color.textPrimary, fontSize: 20, fontWeight: font.weight.heavy },
  description: { marginTop: 6, color: color.textSecondary, fontSize: 13 },
  options: { marginTop: 18, gap: 10 },
  option: { borderWidth: 1, borderColor: color.border, borderRadius: radius.md, padding: 14 },
  optionTitle: { color: color.textPrimary, fontSize: 14, fontWeight: font.weight.bold },
  optionDescription: { marginTop: 4, color: color.textSecondary, fontSize: 11, lineHeight: 16 },
});
