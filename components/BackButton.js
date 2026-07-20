// components/BackButton.js
import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import {
 appHeader as canonicalAppHeaderStyles,
 color as canonicalColor,
} from '../styles/common';

export default function BackButton({
 onPress,
 color = canonicalColor.primary,
 title,
}) {
 const navigation = useNavigation();

 return (
 <View style={canonicalAppHeaderStyles.standardContainer}>
 <TouchableOpacity
 onPress={onPress ?? (() => navigation.goBack())}
 style={canonicalAppHeaderStyles.standardBackButton}
 hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
 activeOpacity={0.7}
 >
 <Text style={[canonicalAppHeaderStyles.backIcon, { color }]}>‹</Text>
 </TouchableOpacity>

 {!!title && (
 <Text
 style={[canonicalAppHeaderStyles.title, { color }]}
 numberOfLines={1}
 >
 {title}
 </Text>
 )}
 </View>
 );
}
