import { useCallback, useEffect, useMemo, useState } from 'react';
import { NativeModules, Platform } from 'react-native';

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

export const isFoldExpandedLayoutState = (state) => Boolean(state?.isFoldExpanded);

export const useFoldableLayoutState = (refreshKey = '') => {
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

 const isFoldExpanded = useMemo(() => isFoldExpandedLayoutState(state), [state]);

 return {
 state,
 loading,
 refresh,
 isFoldExpanded,
 };
};
