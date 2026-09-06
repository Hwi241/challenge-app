import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackButton from '../components/BackButton';
import RotationRoutineForm from '../components/RotationRoutineForm';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';
import { createAndSaveRotationRoutine } from '../utils/rotationRoutineStore';
import { surface } from '../styles/common';

let draftSequence = 1;
const newItem = () => ({ id: 'rotation_draft_' + draftSequence++, name: '', minutes: '' });

export default function AddRotationRoutineScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState(() => [newItem(), newItem()]);
  const [busy, setBusy] = useState(false);
  const dirty = useMemo(() => Boolean(
    title.trim() || description.trim() || items.some((item) => item.name.trim() || item.minutes)
  ), [description, items, title]);
  const guard = useUnsavedChangesGuard({ navigation, hasUnsavedChanges: dirty });

  const updateItem = (index, field, value) => setItems((current) => current.map(
    (item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item
  ));

  const moveItem = (index, offset) => setItems((current) => {
    const destination = index + offset;
    if (destination < 0 || destination >= current.length) return current;
    const next = [...current];
    [next[index], next[destination]] = [next[destination], next[index]];
    return next;
  });

  const removeItem = (index) => {
    if (items.length === 2) return Alert.alert('확인', '활동은 최소 2개가 필요합니다.');
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const validationMessage = () => {
    if (!title.trim()) return '루틴 이름을 입력해주세요.';
    const emptyName = items.findIndex((item) => !item.name.trim());
    if (emptyName >= 0) return String(emptyName + 1) + '번째 활동 이름을 입력해주세요.';
    const emptyTime = items.findIndex((item) => Number(item.minutes) <= 0);
    if (emptyTime >= 0) return String(emptyTime + 1) + '번째 목표 시간을 입력해주세요.';
    return null;
  };

  const save = () => {
    if (busy) return;
    const message = validationMessage();
    if (message) return Alert.alert('확인', message);
    guard.confirmSave({
      message: '이 순환 루틴을 저장할까요?',
      onConfirm: async () => {
        setBusy(true);
        try {
          await createAndSaveRotationRoutine({
            title: title.trim(),
            description: description.trim(),
            items: items.map((item, order) => ({ name: item.name.trim(), targetMinutes: Number(item.minutes), order })),
          });
          guard.markAsSaved();
          navigation.popTo('ChallengeList');
        } catch (error) {
          Alert.alert('저장 실패', error?.message || '순환 루틴을 저장하지 못했습니다.');
        } finally {
          setBusy(false);
        }
      },
    });
  };

  return (
    <SafeAreaView style={surface.screen}>
      <KeyboardAvoidingView style={surface.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <BackButton title="순환 루틴 추가" onPress={guard.handleBackPress} />
        <RotationRoutineForm
          title={title}
          description={description}
          items={items}
          busy={busy}
          onTitleChange={setTitle}
          onDescriptionChange={setDescription}
          onUpdateItem={updateItem}
          onMoveItem={moveItem}
          onRemoveItem={removeItem}
          onAddItem={() => setItems((current) => [...current, newItem()])}
          onSave={save}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
