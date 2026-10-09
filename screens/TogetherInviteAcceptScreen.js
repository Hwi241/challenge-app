import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  useFocusEffect,
} from '@react-navigation/native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

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
  acceptTogetherInvitation,
  loadTogetherAcceptableChallenges,
  loadTogetherAcceptedRoomByInvitationId,
  parseTogetherInvitationData,
} from '../utils/togetherIncomingInvitations';

const SHARE_DESCRIPTION =
  '완료 여부만 공유';

const getInvitationFromRoute = (
  route
) => (
  parseTogetherInvitationData(
    route?.params?.data
  )
);

export default function TogetherInviteAcceptScreen({
  navigation,
  route,
}) {
  const invitation =
    getInvitationFromRoute(
      route
    );

  const [
    challenges,
    setChallenges,
  ] = useState([]);

  const [
    selectedChallengeId,
    setSelectedChallengeId,
  ] = useState(null);

  const [
    acceptedRoom,
    setAcceptedRoom,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    accepting,
    setAccepting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const load = useCallback(
    async () => {
      setLoading(true);
      setErrorMessage('');

      try {
        if (!invitation) {
          setChallenges([]);
          setAcceptedRoom(null);

          return;
        }

        const [
          nextChallenges,
          existingRoom,
        ] = await Promise.all([
          loadTogetherAcceptableChallenges(),

          loadTogetherAcceptedRoomByInvitationId(
            invitation.invitationId
          ),
        ]);

        setChallenges(
          nextChallenges
        );

        setAcceptedRoom(
          existingRoom
          || null
        );

        if (
          existingRoom?.challengeId
          && nextChallenges.some(
            (challenge) =>
              challenge.id
              === existingRoom.challengeId
          )
        ) {
          setSelectedChallengeId(
            existingRoom.challengeId
          );
        } else {
          setSelectedChallengeId(
            null
          );
        }
      } catch {
        setErrorMessage(
          '초대 정보를 불러오지 못했어요.'
        );
      } finally {
        setLoading(false);
      }
    },
    [
      invitation?.invitationId,
    ]
  );

  useFocusEffect(
    useCallback(
      () => {
        load();
      },
      [
        load,
      ]
    )
  );

  const goTogether =
    useCallback(
      () => {
        navigation.navigate(
          'Together'
        );
      },
      [
        navigation,
      ]
    );

  const handleAccept =
    useCallback(
      async () => {
        if (
          !invitation
          || !selectedChallengeId
          || accepting
        ) {
          return;
        }

        setAccepting(true);
        setErrorMessage('');

        try {
          const next =
            await acceptTogetherInvitation({
              invitation,
              challengeId:
                selectedChallengeId,
            });

          setAcceptedRoom(
            next
          );
        } catch (
          error
        ) {
          const code =
            String(
              error?.message
              ?? ''
            );

          if (
            code
              === 'CHALLENGE_NOT_AVAILABLE'
          ) {
            setErrorMessage(
              '선택한 활동을 다시 확인해주세요.'
            );

            await load();
          } else {
            setErrorMessage(
              '초대를 수락하지 못했어요.'
            );
          }
        } finally {
          setAccepting(false);
        }
      },
      [
        accepting,
        invitation,
        load,
        selectedChallengeId,
      ]
    );

  if (!invitation) {
    return (
      <SafeAreaView
        style={
          surface.screen
        }
      >
        <BackButton
          title="함께 초대"
        />

        <View
          style={
            styles.centerState
          }
        >
          <Text
            style={
              styles.stateTitle
            }
          >
            유효하지 않은 초대예요.
          </Text>

          <Text
            style={
              styles.stateDescription
            }
          >
            초대 링크가 잘렸거나
            만료된 형식일 수 있어요.
          </Text>

          <TouchableOpacity
            style={
              styles.primaryButton
            }
            onPress={
              goTogether
            }
            activeOpacity={0.84}
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              함께로 돌아가기
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (
    acceptedRoom
    && !loading
  ) {
    return (
      <SafeAreaView
        style={
          surface.screen
        }
      >
        <BackButton
          title="함께 초대"
        />

        <View
          style={
            styles.centerState
          }
        >
          <View
            style={
              styles.doneMark
            }
          >
            <Text
              style={
                styles.doneMarkText
              }
            >
              ✓
            </Text>
          </View>

          <Text
            style={
              styles.stateTitle
            }
          >
            초대를 수락했어요.
          </Text>

          <Text
            style={
              styles.stateDescription
            }
          >
            {acceptedRoom.challengeTitle}
            {'\n'}
            활동과 연결해 두었어요.
          </Text>

          <Text
            style={
              styles.localNotice
            }
          >
            현재는 이 기기에
            수락 상태만 저장됩니다.
            상대 기록 연결은
            다음 단계에서 이어집니다.
          </Text>

          <TouchableOpacity
            style={
              styles.primaryButton
            }
            onPress={
              goTogether
            }
            activeOpacity={0.84}
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              함께로 가기
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={
        surface.screen
      }
    >
      <BackButton
        title="함께 초대"
      />

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <Text
          style={
            styles.eyebrow
          }
        >
          받은 초대
        </Text>

        <Text
          style={
            styles.title
          }
        >
          {invitation.title}
        </Text>

        <View
          style={
            styles.metaRow
          }
        >
          <View
            style={
              styles.metaBadge
            }
          >
            <Text
              style={
                styles.metaBadgeText
              }
            >
              {invitation.typeLabel}
            </Text>
          </View>

          <Text
            style={
              styles.shareText
            }
          >
            {SHARE_DESCRIPTION}
          </Text>
        </View>

        <View
          style={
            styles.divider
          }
        />

        <Text
          style={
            styles.sectionTitle
          }
        >
          내 활동 연결
        </Text>

        <Text
          style={
            styles.sectionDescription
          }
        >
          함께 이어갈
          내 활동 하나를 선택하세요.
        </Text>

        {loading ? (
          <View
            style={
              styles.loadingWrap
            }
          >
            <ActivityIndicator
              color={
                primitive.black
              }
            />
          </View>
        ) : challenges.length ? (
          <View
            style={
              styles.challengeList
            }
          >
            {challenges.map(
              (
                challenge
              ) => {
                const selected =
                  selectedChallengeId
                  === challenge.id;

                return (
                  <TouchableOpacity
                    key={
                      challenge.id
                    }
                    style={[
                      styles.challengeCard,

                      selected
                      && styles.challengeCardSelected,
                    ]}
                    onPress={
                      () =>
                        setSelectedChallengeId(
                          challenge.id
                        )
                    }
                    activeOpacity={
                      0.84
                    }
                  >
                    <View
                      style={
                        styles.challengeTextWrap
                      }
                    >
                      <Text
                        style={[
                          styles.challengeType,

                          selected
                          && styles.challengeTypeSelected,
                        ]}
                      >
                        {challenge.typeLabel}
                      </Text>

                      <Text
                        style={[
                          styles.challengeTitle,

                          selected
                          && styles.challengeTitleSelected,
                        ]}
                        numberOfLines={
                          2
                        }
                      >
                        {challenge.title}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.selectionCircle,

                        selected
                        && styles.selectionCircleSelected,
                      ]}
                    >
                      {selected && (
                        <View
                          style={
                            styles.selectionDot
                          }
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }
            )}
          </View>
        ) : (
          <View
            style={
              styles.emptyCard
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              연결할 활동이 없어요.
            </Text>

            <Text
              style={
                styles.emptyDescription
              }
            >
              먼저 활동을 만든 뒤
              이 초대 링크를 다시 열어주세요.
            </Text>

            <TouchableOpacity
              style={
                styles.secondaryButton
              }
              onPress={
                () =>
                  navigation.navigate(
                    'CreateChallengeType'
                  )
              }
              activeOpacity={0.84}
            >
              <Text
                style={
                  styles.secondaryButtonText
                }
              >
                활동 만들기
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!!errorMessage && (
          <Text
            style={
              styles.errorText
            }
          >
            {errorMessage}
          </Text>
        )}

        {!!challenges.length && (
          <TouchableOpacity
            style={[
              styles.primaryButton,

              (
                !selectedChallengeId
                || accepting
              )
              && styles.primaryButtonDisabled,
            ]}
            onPress={
              handleAccept
            }
            disabled={
              !selectedChallengeId
              || accepting
            }
            activeOpacity={0.84}
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              {accepting
                ? '수락하는 중...'
                : '이 활동으로 함께하기'}
            </Text>
          </TouchableOpacity>
        )}

        <Text
          style={
            styles.privacyNotice
          }
        >
          기록 내용이나 사진은
          초대 정보에 포함되지 않아요.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    content: {
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
      paddingHorizontal:
        space.lg,
      paddingTop:
        space.lg,
      paddingBottom: 48,
    },

    eyebrow: {
      color:
        color.textSecondary,
      fontSize:
        font.size.caption,
      fontWeight:
        font.weight.bold,
    },

    title: {
      marginTop:
        space.xs,
      color:
        color.textPrimary,
      fontSize:
        font.size.screenTitle,
      fontWeight:
        font.weight.heavy,
      lineHeight: 32,
    },

    metaRow: {
      marginTop:
        space.md,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        space.sm,
    },

    metaBadge: {
      borderRadius: 999,
      backgroundColor:
        primitive.black,
      paddingHorizontal:
        space.sm,
      paddingVertical: 5,
    },

    metaBadgeText: {
      color:
        primitive.white,
      fontSize:
        font.size.caption,
      fontWeight:
        font.weight.bold,
    },

    shareText: {
      color:
        color.textSecondary,
      fontSize:
        font.size.caption,
    },

    divider: {
      height: 1,
      marginVertical:
        space.xl,
      backgroundColor:
        color.border,
    },

    sectionTitle: {
      color:
        color.textPrimary,
      fontSize:
        font.size.bodyLarge,
      fontWeight:
        font.weight.bold,
    },

    sectionDescription: {
      marginTop:
        space.xs,
      color:
        color.textSecondary,
      lineHeight: 20,
    },

    loadingWrap: {
      minHeight: 160,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    challengeList: {
      marginTop:
        space.lg,
      gap:
        space.sm,
    },

    challengeCard: {
      minHeight: 78,
      borderWidth: 1,
      borderColor:
        color.border,
      borderRadius:
        radius.card,
      padding:
        space.md,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      gap:
        space.md,
      backgroundColor:
        color.background,
    },

    challengeCardSelected: {
      backgroundColor:
        primitive.black,
      borderColor:
        primitive.black,
    },

    challengeTextWrap: {
      flex: 1,
      minWidth: 0,
    },

    challengeType: {
      color:
        color.textSecondary,
      fontSize:
        font.size.caption,
      fontWeight:
        font.weight.bold,
    },

    challengeTypeSelected: {
      color:
        primitive.neutral[400],
    },

    challengeTitle: {
      marginTop: 4,
      color:
        color.textPrimary,
      fontSize:
        font.size.body,
      fontWeight:
        font.weight.bold,
      lineHeight: 21,
    },

    challengeTitleSelected: {
      color:
        primitive.white,
    },

    selectionCircle: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor:
        primitive.neutral[400],
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    selectionCircleSelected: {
      borderColor:
        primitive.white,
    },

    selectionDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor:
        primitive.white,
    },

    emptyCard: {
      marginTop:
        space.lg,
      borderWidth: 1,
      borderColor:
        color.border,
      borderRadius:
        radius.card,
      padding:
        space.lg,
    },

    emptyTitle: {
      color:
        color.textPrimary,
      fontSize:
        font.size.body,
      fontWeight:
        font.weight.bold,
    },

    emptyDescription: {
      marginTop:
        space.xs,
      color:
        color.textSecondary,
      lineHeight: 20,
    },

    primaryButton: {
      minHeight: 52,
      marginTop:
        space.xl,
      borderRadius:
        radius.button,
      backgroundColor:
        primitive.black,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        space.lg,
    },

    primaryButtonDisabled: {
      opacity: 0.35,
    },

    primaryButtonText: {
      color:
        primitive.white,
      fontSize:
        font.size.body,
      fontWeight:
        font.weight.bold,
    },

    secondaryButton: {
      minHeight: 44,
      marginTop:
        space.lg,
      borderRadius:
        radius.button,
      borderWidth: 1,
      borderColor:
        primitive.black,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        space.lg,
    },

    secondaryButtonText: {
      color:
        primitive.black,
      fontSize:
        font.size.body,
      fontWeight:
        font.weight.bold,
    },

    privacyNotice: {
      marginTop:
        space.lg,
      color:
        color.textSecondary,
      fontSize:
        font.size.caption,
      lineHeight: 18,
      textAlign:
        'center',
    },

    errorText: {
      marginTop:
        space.md,
      color:
        color.textPrimary,
      fontSize:
        font.size.caption,
      textAlign:
        'center',
    },

    centerState: {
      flex: 1,
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
      alignItems:
        'center',
      justifyContent:
        'center',
      padding:
        space.xl,
    },

    stateTitle: {
      marginTop:
        space.md,
      color:
        color.textPrimary,
      fontSize:
        font.size.screenTitle,
      fontWeight:
        font.weight.heavy,
      textAlign:
        'center',
    },

    stateDescription: {
      marginTop:
        space.sm,
      color:
        color.textSecondary,
      lineHeight: 21,
      textAlign:
        'center',
    },

    localNotice: {
      marginTop:
        space.lg,
      color:
        color.textSecondary,
      fontSize:
        font.size.caption,
      lineHeight: 18,
      textAlign:
        'center',
    },

    doneMark: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor:
        primitive.black,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    doneMarkText: {
      color:
        primitive.white,
      fontSize: 24,
      fontWeight:
        font.weight.heavy,
    },
  });
