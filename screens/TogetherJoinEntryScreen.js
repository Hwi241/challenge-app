import React, {
  useCallback,
  useRef,
  useState,
} from 'react';

import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  useFocusEffect,
} from '@react-navigation/native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import * as Clipboard from 'expo-clipboard';

import BackButton from '../components/BackButton';

import {
  color,
  font,
  primitive,
  radius,
  space,
  surface,
} from '../styles/common';

import {
  parseTogetherInviteCode,
} from '../utils/togetherV2';

export default function TogetherJoinEntryScreen({
  navigation,
}) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [pasting, setPasting] = useState(false);

  const navigationLocked = useRef(false);

  useFocusEffect(
    useCallback(() => {
      navigationLocked.current = false;
    }, [])
  );

  const openInvitation = useCallback(() => {
    if (navigationLocked.current) return;

    const code = parseTogetherInviteCode(input);

    if (
      typeof code !== 'string' ||
      !code.trim()
    ) {
      setError(
        '올바른 THE PUSH 초대 코드 또는 링크를 입력해주세요.'
      );
      return;
    }

    setError('');
    navigationLocked.current = true;

    navigation.navigate(
      'TogetherInviteAccept',
      { code }
    );
  }, [input, navigation]);

  const pasteInvitation = useCallback(async () => {
    if (pasting) return;

    setPasting(true);

    try {
      const raw = await Clipboard.getStringAsync();

      if (!String(raw ?? '').trim()) {
        setError(
          '복사된 초대 링크나 코드가 없어요.'
        );
        return;
      }

      setInput(String(raw).trim());
      setError('');
    } catch {
      setError(
        '클립보드를 읽지 못했어요. 직접 입력해주세요.'
      );
    } finally {
      setPasting(false);
    }
  }, [pasting]);

  const openQrScanner = useCallback(() => {
    if (navigationLocked.current) return;

    navigationLocked.current = true;

    navigation.navigate('TogetherQrScan');
  }, [navigation]);

  return (
    <SafeAreaView style={surface.screen}>
      <BackButton title="초대 참여하기" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>
            친구의 함께 방에 참여하기
          </Text>

          <Text style={styles.description}>
            전달받은 초대 코드를 입력하거나,
            초대 링크를 붙여넣으세요.
          </Text>

          <Text style={styles.sectionTitle}>
            초대 코드 또는 링크
          </Text>

          <View style={styles.inputCard}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={(value) => {
                setInput(value);
                setError('');
              }}
              placeholder="초대 코드 또는 링크 입력"
              placeholderTextColor={color.textTertiary}
              autoCapitalize="characters"
              autoCorrect={false}
              multiline
              maxLength={2048}
              textAlignVertical="top"
              accessibilityLabel="초대 코드 또는 링크"
            />

            <TouchableOpacity
              style={styles.pasteButton}
              onPress={pasteInvitation}
              disabled={pasting}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="복사한 초대 링크 붙여넣기"
            >
              <Text style={styles.pasteText}>
                {pasting ? '확인 중...' : '붙여넣기'}
              </Text>
            </TouchableOpacity>
          </View>

          {error ? (
            <Text
              style={styles.error}
              accessibilityRole="alert"
            >
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={openInvitation}
            activeOpacity={0.84}
            accessibilityRole="button"
            accessibilityLabel="초대 확인하기"
          >
            <Text style={styles.primaryText}>
              초대 확인하기
            </Text>
          </TouchableOpacity>

          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>
              또는
            </Text>
            <View style={styles.separatorLine} />
          </View>

          <TouchableOpacity
            style={styles.qrButton}
            onPress={openQrScanner}
            activeOpacity={0.84}
            accessibilityRole="button"
            accessibilityLabel="QR코드 스캔"
          >
            <Text style={styles.qrButtonText}>
              QR코드 스캔
            </Text>
          </TouchableOpacity>

          <Text style={styles.footer}>
            초대를 확인한 뒤 참여할 PUSH를 선택하거나
            함께 방에 참가할 수 있어요.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    flexGrow: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.xxl,
  },

  title: {
    color: color.textPrimary,
    fontSize: font.size.screenTitle,
    fontWeight: font.weight.heavy,
  },

  description: {
    marginTop: space.sm,
    color: color.textSecondary,
    fontSize: font.size.body,
    lineHeight: 22,
  },

  sectionTitle: {
    marginTop: space.xxl,
    marginBottom: space.sm,
    color: color.textPrimary,
    fontSize: font.size.body,
    fontWeight: font.weight.bold,
  },

  inputCard: {
    borderWidth: 1,
    borderColor: primitive.black,
    borderRadius: radius.md,
    backgroundColor: primitive.white,
    padding: space.md,
  },

  input: {
    minHeight: 72,
    maxHeight: 140,
    color: color.textPrimary,
    fontSize: font.size.body,
    lineHeight: 21,
    padding: 0,
  },

  pasteButton: {
    minHeight: 38,
    alignSelf: 'flex-end',
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    marginTop: space.sm,
  },

  pasteText: {
    color: color.textPrimary,
    fontSize: 12,
    fontWeight: font.weight.bold,
  },

  error: {
    color: color.textPrimary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: space.sm,
  },

  primaryButton: {
    minHeight: 50,
    marginTop: space.lg,
    borderRadius: radius.md,
    backgroundColor: primitive.black,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryText: {
    color: primitive.white,
    fontSize: font.size.body,
    fontWeight: font.weight.bold,
  },

  separator: {
    marginVertical: space.xxl,
    flexDirection: 'row',
    alignItems: 'center',
  },

  separatorLine: {
    height: 1,
    flex: 1,
    backgroundColor: color.border,
  },

  separatorText: {
    marginHorizontal: space.md,
    color: color.textSecondary,
    fontSize: 12,
  },

  qrButton: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: primitive.black,
    borderRadius: radius.md,
    backgroundColor: primitive.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  qrButtonText: {
    color: primitive.black,
    fontSize: font.size.body,
    fontWeight: font.weight.bold,
  },

  footer: {
    marginTop: space.xl,
    color: color.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
  },
});
