export const CHALLENGE_TYPE = Object.freeze({
  CHALLENGE: 'challenge',
  HABIT: 'habit',
  ROTATION: 'rotation',
});

export function getChallengeType(challenge) {
  if (challenge?.type === CHALLENGE_TYPE.HABIT) {
    return CHALLENGE_TYPE.HABIT;
  }
  if (challenge?.type === CHALLENGE_TYPE.ROTATION) {
    return CHALLENGE_TYPE.ROTATION;
  }
  if (challenge?.rotation && typeof challenge.rotation === 'object') {
    return CHALLENGE_TYPE.ROTATION;
  }
  return CHALLENGE_TYPE.CHALLENGE;
}

export const isGeneralChallenge = (challenge) =>
  getChallengeType(challenge) === CHALLENGE_TYPE.CHALLENGE;

export const isHabitChallenge = (challenge) =>
  getChallengeType(challenge) === CHALLENGE_TYPE.HABIT;

export const isRotationRoutine = (challenge) =>
  getChallengeType(challenge) === CHALLENGE_TYPE.ROTATION;
