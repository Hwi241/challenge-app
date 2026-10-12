import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, font, radius, space, surface as surfaceStyles } from '../styles/common';
import { getTogetherModeLabel } from '../utils/togetherV2';
import { loadTogetherRoomSnapshotV2, subscribeTogetherRoomV2, renameTogetherRoomV2, setTogetherRoomLockedV2, setTogetherJoinPolicyV2, reissueTogetherInviteV2, revokeTogetherInvitesV2, setTogetherMemberRoleV2, removeTogetherMemberV2, unblockTogetherMemberV2, transferTogetherOwnershipV2, leaveTogetherRoomV2, closeTogetherRoomV2, resolveTogetherJoinRequestV2 } from '../utils/togetherRemoteV2';
import { getExistingTogetherSession } from '../utils/togetherRemoteAuth';
import { syncTogetherMemberDisplayNameV2 } from '../utils/togetherMemberDisplayNameSyncV2';

const Button = ({ title, onPress, destructive }) => <TouchableOpacity style={styles.action} onPress={onPress}><Text style={[styles.actionText, destructive && styles.destructive]}>{title}</Text></TouchableOpacity>;
export default function TogetherRoomManageScreen({ navigation, route }) {
  const roomId = String(route?.params?.roomId || ''); const [snapshot, setSnapshot] = useState(null); const [title, setTitle] = useState(''); const [loadError, setLoadError] = useState(''); const [myUserId, setMyUserId] = useState('');
  const load = useCallback(async () => {
    try {
      let [value, session] = await Promise.all([
        loadTogetherRoomSnapshotV2({ roomId }),
        getExistingTogetherSession(),
      ]);

      if (!value || typeof value !== 'object' || !value.room || typeof value.room !== 'object' || !String(value.room.id ?? '').trim()) {
        throw new Error('TOGETHER_MANAGE_SNAPSHOT_INVALID');
      }

      try {
        const displayNameChanged =
          await syncTogetherMemberDisplayNameV2({
            roomId,
          });

        if (displayNameChanged) {
          const refreshed =
            await loadTogetherRoomSnapshotV2({
              roomId,
            });

          if (
            refreshed?.room &&
            String(refreshed.room.id ?? '').trim()
          ) {
            value = refreshed;
          }
        }
      } catch (error) {
        console.warn(
          '[TogetherRoomManage] display name sync failed',
          String(error?.message || 'unknown')
        );
      }

      setSnapshot(value);
      setTitle(String(value.room.title ?? ''));
      setMyUserId(String(session?.user?.id ?? ''));
      setLoadError('');
      return value;
    } catch (error) {
      console.warn('[TogetherRoomManage] snapshot load failed', String(error?.message || 'unknown'));
      setLoadError('관리 정보를 불러오지 못했어요.');
      return null;
    }
  }, [roomId]);
  useEffect(() => {
    void load();
    return subscribeTogetherRoomV2({ roomId, onChange: () => { void load(); } });
  }, [load, roomId]);
  if (!snapshot) {
    return <SafeAreaView style={surfaceStyles.screen}><Text style={styles.loading}>{loadError ? '관리 정보를 불러오지 못했어요.' : '관리 정보를 불러오는 중...'}</Text>{loadError ? <Text style={styles.loading} accessibilityRole="button" onPress={() => { setLoadError(''); void load(); }}>다시 시도</Text> : null}</SafeAreaView>;
  }
  const { room, members = [], joinRequests = [], blockedMembers = [], activeInvite } = snapshot; const myRole = room.myRole; const isOwner = myRole === 'owner'; const admin = ['owner', 'admin'].includes(myRole);
  const reportManageActionError = (error) => {
    console.warn('[TogetherRoomManage] action failed', String(error?.message || 'unknown'));
    Alert.alert('관리 작업 실패', '요청을 완료하지 못했어요. 잠시 후 다시 시도해주세요.');
  };
  const runManageAction = async (action) => {
    try {
      await action();
      const refreshed = await load();
      if (!refreshed) {
        Alert.alert('관리 정보 갱신 실패', '작업 후 최신 정보를 확인하지 못했어요. 다시 시도해주세요.');
      }
      return refreshed;
    } catch (error) {
      reportManageActionError(error);
      return null;
    }
  };
  const confirm = (titleText, action) => Alert.alert(titleText, '계속할까요?', [{ text: '취소', style: 'cancel' }, { text: '확인', style: 'destructive', onPress: () => { void runManageAction(action); } }]);
  const runExitAction = async (action) => {
    try {
      await action();
      navigation.navigate('Together');
    } catch (error) {
      reportManageActionError(error);
    }
  };
  const confirmExit = (titleText, action) => Alert.alert(titleText, '계속할까요?', [{ text: '취소', style: 'cancel' }, { text: '확인', style: 'destructive', onPress: () => { void runExitAction(action); } }]);
  return <SafeAreaView style={surfaceStyles.screen}><View style={styles.header}><TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹</Text></TouchableOpacity><Text style={styles.headerTitle}>함께 PUSH 관리</Text><View style={styles.side} /></View><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.section}>방 정보</Text><TextInput style={styles.input} value={title} onChangeText={setTitle} editable={admin} /><Text style={styles.meta}>{getTogetherModeLabel(room.mode)} · {members.length}/{room.memberLimit}명 · {myRole}</Text>{admin ? <Button title="방 이름 저장" onPress={() => { void runManageAction(() => renameTogetherRoomV2({ roomId, title })); }} /> : null}
    {admin ? <><Text style={styles.section}>참가 설정</Text><View style={styles.row}><Text style={styles.lockLabel}>새 멤버 참여 일시 중지</Text><Switch value={room.locked} onValueChange={(locked) => { void runManageAction(() => setTogetherRoomLockedV2({ roomId, locked })); }} /></View><Text style={styles.help}>켜면 새로운 초대 수락과 참가 신청이 차단됩니다. 기존 멤버의 활동은 유지되며, 이미 접수된 참가 신청은 별도로 승인할 수 있습니다.</Text>{[['invite','초대로 참여'],['approval','참가 승인 필요'],['closed','신규 참여 닫기']].map(([value,label]) => <Button key={value} title={`${room.joinPolicy === value ? '✓ ' : ''}${label}`} onPress={() => { void runManageAction(() => setTogetherJoinPolicyV2({ roomId, joinPolicy: value })); }} />)}</> : null}
    {admin ? <><Text style={styles.section}>초대 관리</Text><Text style={styles.help}>초대 QR과 코드는 함께 PUSH 상세에서 확인할 수 있어요.</Text><Button title="초대 링크 재발급" onPress={() => { void runManageAction(() => reissueTogetherInviteV2({ roomId })); }} />{activeInvite ? <Button title="초대 비활성화" destructive onPress={() => confirm('초대 비활성화', () => revokeTogetherInvitesV2({ roomId }))} /> : null}</> : null}
    {admin && joinRequests.length ? <><Text style={styles.section}>참가 요청</Text>{joinRequests.map((item) => <View key={item.userId} style={styles.item}><Text>{item.displayName}</Text><View><Button title="승인" onPress={() => { void runManageAction(() => resolveTogetherJoinRequestV2({ roomId, userId: item.userId, approve: true })); }} /><Button title="거절" onPress={() => { void runManageAction(() => resolveTogetherJoinRequestV2({ roomId, userId: item.userId, approve: false })); }} /></View></View>)}</> : null}
    <Text style={styles.section}>멤버</Text>{members.map((member) => <View key={member.userId} style={styles.member}><Text style={styles.memberName}>{member.displayName} · {member.role}</Text>{Boolean(myUserId) && member.userId !== myUserId && member.userId !== room.ownerUserId && admin ? <View>{isOwner && member.role === 'member' ? <Button title="관리자로 지정" onPress={() => { void runManageAction(() => setTogetherMemberRoleV2({ roomId, userId: member.userId, role: 'admin' })); }} /> : null}{isOwner && member.role === 'admin' ? <Button title="관리자 해제" onPress={() => { void runManageAction(() => setTogetherMemberRoleV2({ roomId, userId: member.userId, role: 'member' })); }} /> : null}{isOwner ? <Button title="방장 위임" onPress={() => confirm('방장 위임', () => transferTogetherOwnershipV2({ roomId, userId: member.userId }))} /> : null}{member.role === 'member' ? <><Button title="강퇴" destructive onPress={() => confirm('멤버 강퇴', () => removeTogetherMemberV2({ roomId, userId: member.userId, block: false }))} /><Button title="강퇴 후 차단" destructive onPress={() => confirm('멤버 차단', () => removeTogetherMemberV2({ roomId, userId: member.userId, block: true }))} /></> : null}</View> : null}</View>)}
    {admin && blockedMembers.length ? <><Text style={styles.section}>차단</Text>{blockedMembers.map((item) => <View key={item.userId} style={styles.item}><Text>{item.displayName}</Text><Button title="차단 해제" onPress={() => { void runManageAction(() => unblockTogetherMemberV2({ roomId, userId: item.userId })); }} /></View>)}</> : null}
    <Text style={styles.section}>나가기 / 종료</Text>{isOwner ? <><Text style={styles.help}>방장을 다른 멤버에게 위임하면 방을 나갈 수 있어요. 방을 종료하면 모든 멤버의 함께 활동이 종료됩니다.</Text><Button title="방 종료" destructive onPress={() => confirmExit('방 종료', () => closeTogetherRoomV2({ roomId }))} /></> : <Button title="방 나가기" destructive onPress={() => confirmExit('방 나가기', () => leaveTogetherRoomV2({ roomId }))} />}
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, borderBottomWidth: 1, borderColor: color.border }, back: { fontSize: 34 }, headerTitle: { fontSize: 16, fontWeight: font.weight.heavy }, side: { width: 24 }, loading: { marginTop: 100, textAlign: 'center' }, content: { padding: space.lg, paddingBottom: 80 }, section: { marginTop: 26, marginBottom: 10, fontSize: 17, fontWeight: font.weight.heavy }, input: { minHeight: 46, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, paddingHorizontal: 12 }, meta: { marginTop: 7, color: color.textSecondary }, action: { minHeight: 40, justifyContent: 'center', borderBottomWidth: 1, borderColor: color.border }, actionText: { color: color.textPrimary, fontWeight: font.weight.bold }, destructive: { color: '#B42318' }, row: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, lockLabel: { flex: 1, marginRight: 12, color: color.textPrimary, fontWeight: font.weight.bold }, code: { fontSize: 22, letterSpacing: 2, fontWeight: font.weight.heavy, marginBottom: 12 }, item: { paddingVertical: 10, borderBottomWidth: 1, borderColor: color.border }, member: { paddingVertical: 12, borderBottomWidth: 1, borderColor: color.border }, memberName: { fontWeight: font.weight.bold }, help: { marginTop: 6, color: color.textSecondary, fontSize: 12, lineHeight: 19 } });
