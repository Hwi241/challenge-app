// components/BackButton.js
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { colors, spacing, font } from '../styles/common';

export default function BackButton({ onPress, color = colors.primary, title }) {
 const navigation = useNavigation();

 return (
 <View style={styles.wrap}>
 <TouchableOpacity
 onPress={onPress ?? (() => navigation.goBack())}
 style={styles.btn}
 hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
 activeOpacity={0.7}
 >
 <Text style={[styles.arrow, { color }]}>‹</Text>
 </TouchableOpacity>
 {!!title && (
 <Text style={[styles.title, { color }]} numberOfLines={1}>{title}</Text>
 )}
 </View>
 );
}

const styles = StyleSheet.create({
 wrap: {
 flexDirection: 'row',
 alignItems: 'center',
 paddingHorizontal: spacing.lg,
 paddingVertical: spacing.md,
 backgroundColor: 'transparent',
 },
 btn: {
 padding: spacing.xxs,
 marginRight: spacing.xxs,
 },
 arrow: {
 fontSize: 32,
 fontWeight: '300',
 lineHeight: 32,
 includeFontPadding: false,
 marginTop: -8,
 },
 title: {
 fontSize: font.size.title,
 fontWeight: font.weight.heavy,
 color: colors.primary,
 position: 'absolute',
 left: 0,
 right: 0,
 textAlign: 'center',
 zIndex: -1,
 },
});
