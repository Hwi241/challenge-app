import { useCallback, useEffect, useMemo, useState } from 'react';
import { NativeModules, Platform, useWindowDimensions } from 'react-native';
import * as Device from 'expo-device';

const DEFAULT_FOLDABLE_LAYOUT_STATE = Object.freeze({
 isAvailable: false,
 isFoldExpanded: false,
 hasFoldingFeature: false,
 state: 'UNKNOWN',
 orientation: 'UNKNOWN',
 occlusionType: 'UNKNOWN',
 isSeparating: false,
 reason: 'NOT_LOADED',
 bounds: {
 left: 0,
 top: 0,
 right: 0,
 bottom: 0,
 width: 0,
 height: 0,
 },
 screenWidthDp: 0,
 screenHeightDp: 0,
 smallestScreenWidthDp: 0,
});

const FOLD_UNFOLDED_MIN_WINDOW_WIDTH = 600;

const getDeviceSearchText = () => [
 Device.brand,
 Device.manufacturer,
 Device.modelName,
 Device.deviceName,
 Device.modelId,
 Device.designName,
 Device.productName,
]
 .filter(Boolean)
 .map((value) => String(value).toLowerCase())
 .join(' ');

const isLikelySamsungFoldDevice = () => {
 if (Platform.OS !== 'android') return false;

 const text = getDeviceSearchText();
 const isSamsung = text.includes('samsung') || text.includes('galaxy');

 // Galaxy Z Fold models are commonly exposed as names containing "fold"
 // or Samsung model codes such as SM-F9xx.
 const looksLikeFold = (
 text.includes('fold') ||
 /\bsm-f9\d{2}/.test(text) ||
 /\bf9\d{2}/.test(text)
 );

 return isSamsung && looksLikeFold;
};

const isFoldExpandedByWindowFallback = ({ windowWidth } = {}) => {
 const width = Number(windowWidth || 0);

 return (
 isLikelySamsungFoldDevice() &&
 width >= FOLD_UNFOLDED_MIN_WINDOW_WIDTH
 );
};

const normalizeBounds = (value) => ({
 left: Number(value?.left || 0),
 top: Number(value?.top || 0),
 right: Number(value?.right || 0),
 bottom: Number(value?.bottom || 0),
 width: Number(value?.width || 0),
 height: Number(value?.height || 0),
});

const normalizeFoldableLayoutState = (value, fallbackReason = 'INVALID_STATE') => {
 if (!value || typeof value !== 'object') {
 return {
 ...DEFAULT_FOLDABLE_LAYOUT_STATE,
 reason: fallbackReason,
 };
 }

 return {
 isAvailable: Boolean(value.isAvailable),
 isFoldExpanded: Boolean(value.isFoldExpanded),
 hasFoldingFeature: Boolean(value.hasFoldingFeature),
 state: typeof value.state === 'string' ? value.state : 'UNKNOWN',
 orientation: typeof value.orientation === 'string' ? value.orientation : 'UNKNOWN',
 occlusionType: typeof value.occlusionType === 'string' ? value.occlusionType : 'UNKNOWN',
 isSeparating: Boolean(value.isSeparating),
 reason: value.reason == null ? null : String(value.reason),
 bounds: normalizeBounds(value.bounds),
 screenWidthDp: Number(value.screenWidthDp || 0),
 screenHeightDp: Number(value.screenHeightDp || 0),
 smallestScreenWidthDp: Number(value.smallestScreenWidthDp || 0),
 };
};

const getNativeFoldableLayoutModule = () => {
 if (Platform.OS !== 'android') return null;
 return NativeModules?.FoldableLayout || null;
};

export const getDefaultFoldableLayoutState = () => ({
 ...DEFAULT_FOLDABLE_LAYOUT_STATE,
 bounds: { ...DEFAULT_FOLDABLE_LAYOUT_STATE.bounds },
});

export const getFoldableLayoutState = async () => {
 const nativeModule = getNativeFoldableLayoutModule();

 if (!nativeModule || typeof nativeModule.getFoldableLayoutState !== 'function') {
 return normalizeFoldableLayoutState(null, 'NATIVE_MODULE_UNAVAILABLE');
 }

 try {
 const state = await nativeModule.getFoldableLayoutState();
 return normalizeFoldableLayoutState(state, 'NATIVE_STATE_UNAVAILABLE');
 } catch (error) {
 return normalizeFoldableLayoutState(null, error?.message || 'NATIVE_CALL_FAILED');
 }
};

export const isFoldExpandedLayoutState = (state, metrics = {}) => (
 Boolean(state?.isFoldExpanded) ||
 isFoldExpandedByWindowFallback(metrics)
);

export const useFoldableLayoutState = (refreshKey = '') => {
 const { width: windowWidth, height: windowHeight } = useWindowDimensions();
 const [state, setState] = useState(() => getDefaultFoldableLayoutState());
 const [loading, setLoading] = useState(false);

 const refresh = useCallback(async () => {
 setLoading(true);

 try {
 const nextState = await getFoldableLayoutState();
 setState(nextState);
 return nextState;
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => {
 let alive = true;

 setLoading(true);

 getFoldableLayoutState()
 .then((nextState) => {
 if (alive) {
 setState(nextState);
 }
 })
 .finally(() => {
 if (alive) {
 setLoading(false);
 }
 });

 return () => {
 alive = false;
 };
 }, [refreshKey]);

 const isFoldExpanded = useMemo(() => (
  isFoldExpandedLayoutState(state, { windowWidth, windowHeight })
 ), [state, windowWidth, windowHeight]);

 return {
 state,
 loading,
 refresh,
 isFoldExpanded,
 foldableLayoutMetrics: {
 windowWidth,
 windowHeight,
 isLikelySamsungFoldDevice: isLikelySamsungFoldDevice(),
 fallbackMinWindowWidth: FOLD_UNFOLDED_MIN_WINDOW_WIDTH,
 fallbackMatched: isFoldExpandedByWindowFallback({ windowWidth, windowHeight }),
 nativeIsFoldExpanded: Boolean(state?.isFoldExpanded),
 },
 };
};
