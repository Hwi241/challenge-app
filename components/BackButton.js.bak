// components/BackButton.js
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function BackButton({ onPress, color = '#111' }) {
  const navigation = useNavigation();
  return (
    <TouchableOpacity
      onPress={onPress ?? (() => navigation.goBack())}
      style={styles.btn}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      activeOpacity={0.7}
    >
      <Text style={[styles.arrow, { color }]}>‹</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    left: 16,
    top: 16,
    zIndex: 10,
    padding: 4,
  },
  arrow: {
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 32,
    includeFontPadding: false,
  },
});
