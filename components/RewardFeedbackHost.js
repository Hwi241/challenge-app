import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, primitive } from '../styles/common';
import { REWARD_FEEDBACK_KIND, subscribeRewardFeedback } from '../utils/rewardFeedback';

const PARTICLES = [
  { dx: -20, dy: -14 }, { dx: 20, dy: -13 },
  { dx: -25, dy: 2 }, { dx: 25, dy: 1 },
  { dx: -15, dy: 17 }, { dx: 16, dy: 18 },
];

let lastVibrationAt = 0;

const isMajorReward = (feedback) => {
  if (feedback?.kind === REWARD_FEEDBACK_KIND.XP) return Number(feedback?.amount || 0) >= 20;
  if (feedback?.kind === REWARD_FEEDBACK_KIND.STAR) return Number(feedback?.amount || 0) >= 3;
  return false;
};

function useRewardChannel() {
  const queueRef = useRef([]);
  const currentRef = useRef(null);
  const [current, setCurrent] = useState(null);
  const push = useCallback((event) => {
    if (!event) return;
    if (currentRef.current) {
      queueRef.current.push(event);
      return;
    }
    currentRef.current = event;
    setCurrent(event);
  }, []);
  const complete = useCallback(() => {
    const next = queueRef.current.shift() || null;
    currentRef.current = next;
    setCurrent(next);
  }, []);
  return { current, push, complete };
}

const RewardToken = memo(function RewardToken({ feedback, onDone, onDockPulse }) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.82)).current;
  const translateY = useRef(new Animated.Value(5)).current;
  const particleProgress = useRef(new Animated.Value(0)).current;
  const pulseTimerRef = useRef(null);
  const isXp = feedback.kind === REWARD_FEEDBACK_KIND.XP;
  const dockVisible = feedback.dockVisible === true;
  const major = isMajorReward(feedback);

  useEffect(() => {
    opacity.setValue(0);
    scale.setValue(major ? 0.74 : 0.82);
    translateY.setValue(5);
    particleProgress.setValue(0);
    const now = Date.now();
    if (Platform.OS === 'android' && now - lastVibrationAt >= 250) {
      lastVibrationAt = now;
      Vibration.vibrate(major ? 18 : 10);
    }
    if (dockVisible && typeof onDockPulse === 'function') {
      pulseTimerRef.current = setTimeout(() => {
        onDockPulse({ kind: feedback.kind, id: feedback.id });
      }, major ? 470 : 430);
    }
    const intro = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.timing(scale, { toValue: major ? 1.16 : 1.08, duration: major ? 150 : 125, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 125, useNativeDriver: true }),
      Animated.timing(particleProgress, { toValue: 1, duration: major ? 380 : 320, useNativeDriver: true }),
    ]);
    const animation = Animated.sequence([
      intro,
      Animated.timing(scale, { toValue: 1, duration: 95, useNativeDriver: true }),
      Animated.delay(major ? 520 : 430),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: dockVisible ? 260 : 390, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: dockVisible ? 19 : -20, duration: dockVisible ? 260 : 390, useNativeDriver: true }),
        Animated.timing(scale, { toValue: dockVisible ? 0.58 : 0.96, duration: dockVisible ? 260 : 390, useNativeDriver: true }),
      ]),
    ]);
    animation.start(({ finished }) => { if (finished) onDone?.(); });
    return () => {
      animation.stop();
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = null;
    };
  }, [dockVisible, feedback.id, feedback.kind, major, onDockPulse, onDone, opacity, particleProgress, scale, translateY]);

  const rewardLabel = isXp ? `+${feedback.amount} XP` : feedback.amount === 1 ? '+★' : `+${feedback.amount}★`;
  const particleCount = major ? 6 : 4;
  const dockLeft = isXp ? '30%' : '70%';
  const floatingBottom = isXp ? Math.max(insets.bottom + 96, 96) : Math.max(insets.bottom + 58, 58);
  const dockBottom = Math.max(insets.bottom + 42, 42);

  return (
    <Animated.View pointerEvents="none" style={[
      styles.feedback,
      dockVisible
        ? { left: dockLeft, bottom: dockBottom, width: 118, marginLeft: -59 }
        : { left: '50%', bottom: floatingBottom, width: 160, marginLeft: -80 },
      { opacity, transform: [{ translateY }, { scale }] },
    ]}>
      <View pointerEvents="none" style={styles.particleLayer}>
        {PARTICLES.slice(0, particleCount).map((particle, index) => {
          const particleOpacity = particleProgress.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 1, 0] });
          const particleScale = particleProgress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.4, 1, 0.35] });
          const particleX = particleProgress.interpolate({ inputRange: [0, 1], outputRange: [0, particle.dx] });
          const particleY = particleProgress.interpolate({ inputRange: [0, 1], outputRange: [0, particle.dy] });
          return (
            <Animated.View key={`${feedback.id}_particle_${index}`} style={[
              styles.particle,
              major ? styles.particleMajor : null,
              { opacity: particleOpacity, transform: [{ translateX: particleX }, { translateY: particleY }, { scale: particleScale }] },
            ]} />
          );
        })}
      </View>
      <View style={styles.rewardRow}>
        {isXp ? (
          <View style={[styles.xpToken, major ? styles.xpTokenMajor : null]}>
            <Text style={[styles.xpTokenText, major ? styles.xpTokenTextMajor : null]}>XP</Text>
          </View>
        ) : (
          <Text style={[styles.starToken, major ? styles.starTokenMajor : null]}>★</Text>
        )}
        <Text style={[styles.rewardText, major ? styles.rewardTextMajor : null]}>{rewardLabel}</Text>
      </View>
    </Animated.View>
  );
});

function RewardFeedbackHost({ dockVisible = false, onDockPulse }) {
  const xpChannel = useRewardChannel();
  const starChannel = useRewardChannel();
  const dockVisibleRef = useRef(dockVisible);
  const lastXpStartedAtRef = useRef(0);
  const delayedStarTimersRef = useRef(new Set());
  useEffect(() => { dockVisibleRef.current = dockVisible; }, [dockVisible]);
  useEffect(() => {
    const unsubscribe = subscribeRewardFeedback((event) => {
      const eventWithContext = { ...event, dockVisible: dockVisibleRef.current };
      if (event.kind === REWARD_FEEDBACK_KIND.XP) {
        lastXpStartedAtRef.current = Date.now();
        xpChannel.push(eventWithContext);
        return;
      }
      if (event.kind !== REWARD_FEEDBACK_KIND.STAR) return;
      const elapsed = Date.now() - lastXpStartedAtRef.current;
      const delay = elapsed >= 0 && elapsed < 220 ? 220 - elapsed : 0;
      if (delay <= 0) {
        starChannel.push(eventWithContext);
        return;
      }
      const timer = setTimeout(() => {
        delayedStarTimersRef.current.delete(timer);
        starChannel.push(eventWithContext);
      }, delay);
      delayedStarTimersRef.current.add(timer);
    });
    return () => {
      unsubscribe();
      delayedStarTimersRef.current.forEach((timer) => clearTimeout(timer));
      delayedStarTimersRef.current.clear();
    };
  }, [starChannel.push, xpChannel.push]);
  return (
    <View pointerEvents="none" style={styles.host}>
      {!!xpChannel.current && <RewardToken key={xpChannel.current.id} feedback={xpChannel.current} onDone={xpChannel.complete} onDockPulse={onDockPulse} />}
      {!!starChannel.current && <RewardToken key={starChannel.current.id} feedback={starChannel.current} onDone={starChannel.complete} onDockPulse={onDockPulse} />}
    </View>
  );
}

export default memo(RewardFeedbackHost);

const styles = StyleSheet.create({
  host: { ...StyleSheet.absoluteFillObject, zIndex: 80, elevation: 80, pointerEvents: 'none' },
  feedback: { position: 'absolute', alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  rewardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 34 },
  xpToken: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: primitive.black },
  xpTokenMajor: { width: 32, height: 32, borderRadius: 16 },
  xpTokenText: { color: primitive.white, fontSize: 9, lineHeight: 11, fontWeight: font.weight.heavy, includeFontPadding: false },
  xpTokenTextMajor: { fontSize: 10, lineHeight: 12 },
  starToken: { color: primitive.black, fontSize: 29, lineHeight: 32, fontWeight: font.weight.heavy, includeFontPadding: false },
  starTokenMajor: { fontSize: 34, lineHeight: 36 },
  rewardText: { marginLeft: 7, color: color.textPrimary, fontSize: 14, lineHeight: 18, fontWeight: font.weight.heavy, includeFontPadding: false },
  rewardTextMajor: { marginLeft: 8, fontSize: 16, lineHeight: 20 },
  particleLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  particle: { position: 'absolute', width: 3, height: 3, borderRadius: 2, backgroundColor: primitive.black },
  particleMajor: { width: 4, height: 4, borderRadius: 2 },
});
