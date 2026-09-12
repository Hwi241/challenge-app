import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, BackHandler, KeyboardAvoidingView,
  Platform, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackButton from '../components/BackButton';
import RotationRoutineForm from '../components/RotationRoutineForm';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';
import {
  loadRotationRoutine,
  updateRotationRoutineSettingsAndSave,
} from '../utils/rotationRoutineStore';
import { getRotationSettingsRevision } from '../utils/rotationRoutineSettings';
import { buttonStyles, layout, surface, text } from '../styles/common';

let draftSequence = 0;

function toDraft(routine) {
  return {
    title: routine.title,
    description: routine.description,
    items: routine.rotation.items.map((item) => {
      const minutes = String(item.targetSeconds / 60);
      return {
        id: 'existing:' + item.id,
        savedId: item.id,
        name: item.name,
        minutes,
        originalMinutes: minutes,
        originalSeconds: item.targetSeconds,
      };
    }),
  };
}

export default function EditRotationRoutineScreen({ navigation, route }) {
  const routineId = String(route.params?.routineId ?? '').trim();
  const [draft, setDraft] = useState(null);
  const [baseline, setBaseline] = useState('');
  const [revision, setRevision] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(false);
  const requestNumber = useRef(0);
  const flight = useRef(false);
  const submitted = useRef(false);
  const dirty = draft !== null && JSON.stringify(draft) !== baseline;
  const guard = useUnsavedChangesGuard({
    navigation,
    enabled: !busy,
    hasUnsavedChanges: dirty,
  });

  const load = useCallback(async () => {
    const request = ++requestNumber.current;
    setLoading(true);
    setError('');
    try {
      if (!routineId) throw new Error('수정할 순환 루틴 정보가 없습니다.');
      const routine = await loadRotationRoutine(routineId);
      if (!alive.current || request !== requestNumber.current) return;
      const next = toDraft(routine);
      setDraft(next);
      setBaseline(JSON.stringify(next));
      setRevision(getRotationSettingsRevision(routine));
    } catch (loadError) {
      if (alive.current && request === requestNumber.current) {
        setError(loadError?.message || '루틴 설정을 불러오지 못했습니다.');
      }
    } finally {
      if (alive.current && request === requestNumber.current) setLoading(false);
    }
  }, [routineId]);

  useEffect(() => {
    alive.current = true;
    load();
    return () => {
      alive.current = false;
      requestNumber.current += 1;
    };
  }, [load]);

  useEffect(() => {
    const remove = navigation.addListener('beforeRemove', (event) => {
      if (flight.current) event.preventDefault();
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () =>
      navigation.isFocused() && flight.current);
    return () => {
      remove();
      back.remove();
    };
  }, [navigation]);

  const change = (update) => {
    if (flight.current || submitted.current || loading) return;
    setDraft((current) => current ? update(current) : current);
  };
  const updateItem = (index, field, value) => {
    if (!['name', 'minutes'].includes(field)) return;
    change((current) => ({
      ...current,
      items: current.items.map((item, position) =>
        position === index ? { ...item, [field]: value } : item),
    }));
  };
  const moveItem = (index, offset) => change((current) => {
    const destination = index + offset;
    if (destination < 0 || destination >= current.items.length) return current;
    const items = [...current.items];
    [items[index], items[destination]] = [items[destination], items[index]];
    return { ...current, items };
  });
  const removeItem = (index) => {
    if (flight.current || loading || !draft) return;
    if (draft.items.length <= 2) {
      Alert.alert('확인', '활동은 최소 2개가 필요합니다.');
      return;
    }
    change((current) => ({
      ...current,
      items: current.items.filter((_, position) => position !== index),
    }));
  };
  const addItem = () => {
    const item = {
      id: 'new:' + ++draftSequence,
      name: '',
      minutes: '',
    };
    change((current) => ({ ...current, items: [...current.items, item] }));
  };

  const persist = async (input, expectedRevision, expectedApplyRevision) => {
    if (!alive.current || flight.current || submitted.current) return;
    flight.current = true;
    setBusy(true);
    try {
      await updateRotationRoutineSettingsAndSave(routineId, input, {
        expectedRevision,
        ...(expectedApplyRevision !== undefined ? { expectedApplyRevision } : {}),
      });
      submitted.current = true;
      if (!alive.current) return;
      guard.markAsSaved();
      flight.current = false;
      navigation.goBack();
    } catch (saveError) {
      if (!alive.current) return;
      if (saveError?.code === 'ROTATION_SETTINGS_CONFIRMATION_REQUIRED') {
        const details = saveError.confirmation;
        if (!details || typeof details.revision !== 'string') {
          Alert.alert('저장 실패', '변경 결과를 확인하지 못했습니다. 다시 시도해주세요.');
          return;
        }
        const messages = [];
        if (details.completedItemNames.length > 0) {
          messages.push(
            '새 목표 시간을 충족한 활동이 완료됩니다: '
              + details.completedItemNames.join(', '),
          );
        }
        if (details.completedCycle) {
          messages.push(
            String(details.cycleNumber)
              + '번째 회전이 완료되고 다음 회전이 시작됩니다.',
          );
        }
        if (details.nextItemName) {
          messages.push('변경 후 현재 활동: ' + details.nextItemName);
        }
        messages.push('이대로 저장할까요?');
        Alert.alert('완료 처리 확인', messages.join('\n\n'), [
          { text: '취소', style: 'cancel' },
          {
            text: '저장',
            onPress: () => persist(input, expectedRevision, details.revision),
          },
        ]);
      } else if (saveError?.code === 'ROTATION_SETTINGS_CHANGED') {
        Alert.alert(
          '설정이 변경됐어요',
          '다른 변경 사항이 저장되었습니다. 최신 설정을 불러오면 현재 수정 중인 내용은 사라집니다.',
          [
            { text: '현재 입력 유지', style: 'cancel' },
            { text: '최신 설정 불러오기', onPress: () => {
              if (!alive.current || flight.current) return;
              guard.resetGuard();
              load();
            } },
          ],
        );
      } else {
        Alert.alert(
          saveError?.code === 'ROTATION_SETTINGS_APPLY_CHANGED'
            ? '진행 상태가 변경됐어요'
            : '저장 실패',
          saveError?.message || '설정을 저장하지 못했습니다.',
        );
      }
    } finally {
      flight.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const save = () => {
    if (flight.current || submitted.current || loading || !draft) return;
    if (!draft.title.trim()) {
      Alert.alert('확인', '루틴 이름을 입력해주세요.');
      return;
    }
    const items = [];
    for (let index = 0; index < draft.items.length; index += 1) {
      const item = draft.items[index];
      if (!item.name.trim()) {
        Alert.alert('확인', String(index + 1) + '번째 활동 이름을 입력해주세요.');
        return;
      }
      // 수정하지 않은 목표 시간은 표시용 분 변환으로 손실되지 않게 보존한다.
      const targetSeconds = item.savedId && item.minutes === item.originalMinutes
        ? item.originalSeconds
        : Math.round(Number(item.minutes) * 60);
      if (!Number.isSafeInteger(targetSeconds) || targetSeconds <= 0) {
        Alert.alert('확인', String(index + 1) + '번째 목표 시간을 확인해주세요.');
        return;
      }
      items.push({
        ...(item.savedId ? { id: item.savedId } : {}),
        name: item.name.trim(),
        targetSeconds,
      });
    }
    const input = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      items,
    };
    guard.confirmSave({
      message: '변경 내용을 이번 회전에도 반영합니다. 진행한 시간과 과거 기록은 보존됩니다. 저장할까요?',
      onConfirm: () => persist(input, revision),
    });
  };

  return (
    <SafeAreaView style={surface.screen}>
      <KeyboardAvoidingView
        style={surface.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <BackButton
          title="순환 루틴 수정"
          onPress={() => { if (!flight.current) guard.handleBackPress(); }}
        />
        {loading ? (
          <ActivityIndicator />
        ) : error ? (
          <View style={layout.screenContent}>
            <Text style={text.bodyMuted}>{error}</Text>
            <TouchableOpacity style={buttonStyles.secondary.container} onPress={load}>
              <Text style={buttonStyles.secondary.label}>다시 불러오기</Text>
            </TouchableOpacity>
          </View>
        ) : draft ? (
          <RotationRoutineForm
            title={draft.title}
            description={draft.description}
            items={draft.items}
            busy={busy}
            locked={busy}
            notice={'변경 내용은 이번 회전에도 반영됩니다.\n• 진행 중인 현재 활동은 계속 이어갑니다.\n• 완료한 활동의 목표 변경은 다음 회전부터 적용됩니다.\n• 기록이 있는 삭제 활동은 이번 회전까지 유지됩니다.\n• 다음 회전은 수정한 기본 순서로 시작합니다.'}
            onTitleChange={(title) => change((current) => ({ ...current, title }))}
            onDescriptionChange={(description) =>
              change((current) => ({ ...current, description }))}
            onUpdateItem={updateItem}
            onMoveItem={moveItem}
            onRemoveItem={removeItem}
            onAddItem={addItem}
            onSave={save}
          />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
