// components/BackButton.js
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function BackButton({ onPress, color = '#111', title }) {
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
 paddingHorizontal: 16,
 paddingVertical: 12,
 backgroundColor: 'transparent',
 },
 btn: {
 padding: 4,
 marginRight: 4,
 },
 arrow: {
 fontSize: 32,
 fontWeight: '300',
 lineHeight: 32,
 includeFontPadding: false,
 },
 title: {
 fontSize: 20,
 fontWeight: '800',
 color: '#111',
 position: 'absolute',
 left: 0,
 right: 0,
 textAlign: 'center',
 zIndex: -1,
 },
});
