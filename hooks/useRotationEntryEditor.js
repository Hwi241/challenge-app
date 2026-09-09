import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  loadRotationRoutineSnapshot,
  editRotationEntryAndSave,
  deleteRotationEntryAndSave,
  cancelRotationCompletionEntryAndSave,
} from '../utils/rotationRoutineStore';
import {
  editRotationEntry,
  getRotationEntryEditPolicy,
  getRotationEntryEditRevision,
} from '../utils/rotationRoutineEntryEditing';

function confirmAction(title, message, label, destructive = false) {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: '취소', style: 'cancel', onPress: () => resolve(false) },
      {
        text: label,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ], { cancelable: false });
  });
}

function dateLabel(value) {
  if (value == null) return '기록 날짜 정보 없음';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '기록 날짜 정보 없음'
    : date.toLocaleString();
}

export default function useRotationEntryEditor({
  enabled,
  challengeId,
  entryId,
  navigation,
  text,
  duration,
  imageUri,
  busy,
  setBusy,
  setLoading,
  setText,
  setDuration,
  setImageUri,
  setTimestamp,
  setChallengeTitle,
  originalRef,
  markAsSaved,
}) {
  const [view, setView] = useState(null);
  const revisionRef = useRef(null);
  const flightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setView(null);
    revisionRef.current = null;
    setLoading(true);
    async function load() {
      try {
        const snapshot = await loadRotationRoutineSnapshot(challengeId);
        const entry = snapshot.entries.find(
          (candidate) => String(candidate.id) === String(entryId),
        );
        if (!entry) throw new Error('기록이 존재하지 않습니다.');
        const policy = getRotationEntryEditPolicy(
          snapshot.routine, snapshot.entries, entryId,
        );
        const revision = getRotationEntryEditRevision(
          snapshot.routine, snapshot.entries, entryId,
        );
        if (!active) return;
        const loadedText = String(entry.text ?? '');
        const loadedDuration = entry.duration == null ? '' : String(entry.duration);
        const loadedImage = entry.imageUri ?? null;
        setText(loadedText);
        setDuration(loadedDuration);
        setImageUri(loadedImage);
        setTimestamp(entry.timestamp);
        setChallengeTitle(snapshot.routine.title);
        originalRef.current = {
          text: loadedText,
          duration: loadedDuration,
          imageUri: loadedImage,
        };
        revisionRef.current = revision;
        setView({ entry, policy });
      } catch (error) {
        if (active) {
          Alert.alert('오류', error?.message ?? '기록을 불러오지 못했습니다.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [
    enabled, challengeId, entryId, setLoading, setText, setDuration,
    setImageUri, setTimestamp, setChallengeTitle, originalRef,
  ]);

  async function perform(kind) {
    if (!enabled) return;
    if (!view) return;
    if (busy) return;
    if (flightRef.current) return;
    flightRef.current = true;
    setBusy(true);
    try {
      const snapshot = await loadRotationRoutineSnapshot(challengeId);
      if (!mountedRef.current) return;
      const expectedRevision = revisionRef.current;
      const actualRevision = getRotationEntryEditRevision(
        snapshot.routine, snapshot.entries, entryId,
      );
      if (expectedRevision !== actualRevision) {
        throw new Error('기록이나 진행 상태가 변경되었습니다. 뒤로 갔다가 기록을 다시 열어주세요.');
      }
      const options = { expectedRevision };
      let mutation;
      let title;
      let message;
      let label;
      let success;
      if (kind === 'save') {
        const changes = { text, imageUri };
        if (duration !== originalRef.current.duration) {
          const minutes = Number(duration);
          if (!Number.isSafeInteger(minutes)) {
            throw new Error('수정할 시간은 분 단위 숫자로 입력해주세요.');
          }
          if (minutes < 1) throw new Error('시간은 0보다 커야 합니다.');
          if (minutes > 1440) throw new Error('시간은 1440분 이내로 입력해주세요.');
          changes.durationSeconds = minutes * 60;
        }
        const preview = editRotationEntry(
          snapshot.routine, snapshot.entries, entryId, changes, options,
        );
        title = '저장하시겠습니까?';
        message = '이 기록 수정을 저장할까요?';
        if (preview.result.completedCycle) {
          message = '저장하면 현재 활동과 이번 회전이 완료되고 새 회전이 시작됩니다. 저장할까요?';
        } else if (preview.result.completedItem) {
          message = '저장하면 현재 활동이 완료되고 다음 활동으로 넘어갑니다. 저장할까요?';
        }
        label = '저장';
        success = '기록이 수정되었습니다.';
        mutation = () => editRotationEntryAndSave(
          challengeId, entryId, changes, options,
        );
      } else if (kind === 'delete') {
        if (!view.policy.canDelete) throw new Error(view.policy.reason);
        title = '삭제 확인';
        message = '이 기록을 삭제하고 해당 시간을 현재 활동의 진행량에서 뺄까요?';
        label = '삭제';
        success = '기록이 삭제되었습니다.';
        mutation = () => deleteRotationEntryAndSave(challengeId, entryId, options);
      } else {
        if (!view.policy.canCancelCompletion) {
          throw new Error('후속 진행이 있어 이 완료 기록을 취소할 수 없습니다.');
        }
        title = '방금 기록 취소';
        message = '이 완료 기록을 삭제하고 기록 직전의 활동과 회전 상태로 돌아갈까요? 수정 중인 내용은 저장되지 않습니다.';
        label = '기록 취소';
        success = '완료 기록을 취소했습니다.';
        mutation = () => cancelRotationCompletionEntryAndSave(
          challengeId, entryId, options,
        );
      }
      const confirmed = await confirmAction(title, message, label, kind !== 'save');
      if (!confirmed) return;
      if (!mountedRef.current) return;
      await mutation();
      if (!mountedRef.current) return;
      markAsSaved();
      Alert.alert('완료', success, [
        { text: '확인', onPress: () => navigation.goBack() },
      ], { cancelable: false });
    } catch (error) {
      if (mountedRef.current) {
        Alert.alert('확인', error?.message ?? '기록을 처리하지 못했습니다.');
      }
    } finally {
      flightRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }

  return {
    ready: Boolean(view),
    entry: view?.entry,
    dateText: dateLabel(view?.entry?.timestamp),
    canEditTime: Boolean(view?.policy.canEditTime),
    canDelete: Boolean(view?.policy.canDelete),
    canCancelCompletion: Boolean(view?.policy.canCancelCompletion),
    reason: view?.policy.reason ?? '',
    onSave: () => perform('save'),
    onDelete: () => perform('delete'),
    onCancelCompletion: () => perform('cancelCompletion'),
  };
}
