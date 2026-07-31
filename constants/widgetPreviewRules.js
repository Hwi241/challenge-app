// constants/widgetPreviewRules.js
// Code-level contract for non-graph dashboard widget previews.
// Existing graph preview metadata, rules, and renderers are intentionally independent.

export const WIDGET_PREVIEW_CONTRACT_VERSION = 1;
export const WIDGET_PREVIEW_METADATA_KEY = 'widgetPreview';

export const WIDGET_PREVIEW_FAMILIES = Object.freeze({
 KPI: 'kpi',
 PROFILE: 'profile',
 GOAL: 'goal',
 STATUS: 'status',
 MEMO: 'memo',
 LIST: 'list',
 PLACEHOLDER: 'placeholder',
});

export const WIDGET_PREVIEW_VARIANTS = Object.freeze({
 COUNT_WITH_NOTE: 'countWithNote',
 COUNT_WITH_ICON: 'countWithIcon',
 DUAL_COUNT: 'dualCount',
 AVATAR: 'avatar',
 PROFILE_SUMMARY: 'profileSummary',
 BATTERY: 'battery',
 CONNECTION_LIST: 'connectionList',
 MEMO_LINES: 'memoLines',
 TABBED_LIST: 'tabbedList',
 PLUS_BOX: 'plusBox',
});

export const WIDGET_PREVIEW_SIZE_MODES = Object.freeze({
 TINY: 'tiny',
 COMPACT: 'compact',
 REGULAR: 'regular',
});

export const WIDGET_PREVIEW_ALLOWED_VARIANTS = Object.freeze({
 [WIDGET_PREVIEW_FAMILIES.KPI]: Object.freeze([
 WIDGET_PREVIEW_VARIANTS.COUNT_WITH_NOTE,
 WIDGET_PREVIEW_VARIANTS.COUNT_WITH_ICON,
 WIDGET_PREVIEW_VARIANTS.DUAL_COUNT,
 ]),
 [WIDGET_PREVIEW_FAMILIES.PROFILE]: Object.freeze([
 WIDGET_PREVIEW_VARIANTS.AVATAR,
 WIDGET_PREVIEW_VARIANTS.PROFILE_SUMMARY,
 ]),
 [WIDGET_PREVIEW_FAMILIES.GOAL]: Object.freeze([
 WIDGET_PREVIEW_VARIANTS.BATTERY,
 ]),
 [WIDGET_PREVIEW_FAMILIES.STATUS]: Object.freeze([
 WIDGET_PREVIEW_VARIANTS.CONNECTION_LIST,
 ]),
 [WIDGET_PREVIEW_FAMILIES.MEMO]: Object.freeze([
 WIDGET_PREVIEW_VARIANTS.MEMO_LINES,
 ]),
 [WIDGET_PREVIEW_FAMILIES.LIST]: Object.freeze([
 WIDGET_PREVIEW_VARIANTS.TABBED_LIST,
 ]),
 [WIDGET_PREVIEW_FAMILIES.PLACEHOLDER]: Object.freeze([
 WIDGET_PREVIEW_VARIANTS.PLUS_BOX,
 ]),
});

export const WIDGET_PREVIEW_SIZE_RULES = Object.freeze({
 [WIDGET_PREVIEW_SIZE_MODES.TINY]: Object.freeze({
 maxListRows: 1,
 maxTextLines: 1,
 showSecondary: false,
 }),
 [WIDGET_PREVIEW_SIZE_MODES.COMPACT]: Object.freeze({
 maxListRows: 2,
 maxTextLines: 2,
 showSecondary: true,
 }),
 [WIDGET_PREVIEW_SIZE_MODES.REGULAR]: Object.freeze({
 maxListRows: 3,
 maxTextLines: 3,
 showSecondary: true,
 }),
});

export const WIDGET_PREVIEW_COLORS = Object.freeze({
 primary: '#111111',
 secondary: '#525252',
 muted: '#8A8A8A',
 border: '#E5E7EB',
 surface: '#F3F4F6',
 track: '#D1D5DB',
 white: '#FFFFFF',
});

export const WIDGET_PREVIEW_KPI_LAYOUT = Object.freeze({
 [WIDGET_PREVIEW_SIZE_MODES.TINY]: Object.freeze({
 maxWidth: 144,
 height: 28,
 radius: 8,
 paddingHorizontal: 8,
 paddingVertical: 4,
 labelFontSize: 8,
 labelLineHeight: 10,
 valueFontSize: 14,
 valueLineHeight: 16,
 iconFontSize: 11,
 iconLineHeight: 13,
 noteHeight: 3,
 noteWidth: 30,
 gap: 4,
 }),
 [WIDGET_PREVIEW_SIZE_MODES.COMPACT]: Object.freeze({
 maxWidth: 144,
 height: 54,
 radius: 11,
 paddingHorizontal: 10,
 paddingVertical: 7,
 labelFontSize: 9,
 labelLineHeight: 11,
 valueFontSize: 22,
 valueLineHeight: 25,
 iconFontSize: 13,
 iconLineHeight: 16,
 noteHeight: 4,
 noteWidth: 46,
 gap: 4,
 }),
 [WIDGET_PREVIEW_SIZE_MODES.REGULAR]: Object.freeze({
 maxWidth: 156,
 height: 72,
 radius: 14,
 paddingHorizontal: 12,
 paddingVertical: 9,
 labelFontSize: 10,
 labelLineHeight: 12,
 valueFontSize: 29,
 valueLineHeight: 32,
 iconFontSize: 16,
 iconLineHeight: 19,
 noteHeight: 5,
 noteWidth: 56,
 gap: 5,
 }),
});

export const getWidgetPreviewKpiLayout = (sizeMode) => (
 WIDGET_PREVIEW_KPI_LAYOUT[sizeMode] ||
 WIDGET_PREVIEW_KPI_LAYOUT[WIDGET_PREVIEW_SIZE_MODES.REGULAR]
);

export const getWidgetPreviewSampleData = (preview = {}) => {
 const seed = Number.isInteger(preview?.seed)
 ? preview.seed
 : 0;

 const first = 2 + ((seed * 7 + 3) % 8);
 const second = 2 + ((seed * 11 + 5) % 8);
 const value = 8 + ((seed * 17 + 11) % 35);

 return Object.freeze({
 value,
 first,
 second,
 total: first + second,
 });
};

const EMPTY_VARIANTS = Object.freeze([]);
const VALID_FAMILIES = Object.freeze(Object.values(WIDGET_PREVIEW_FAMILIES));
const VALID_SIZE_MODES = Object.freeze(Object.values(WIDGET_PREVIEW_SIZE_MODES));
const ALLOWED_METADATA_KEYS = Object.freeze([
 'family',
 'variant',
 'seed',
 'features',
 'unitLabel',
]);

const isPlainObject = (value) => (
 value !== null &&
 typeof value === 'object' &&
 !Array.isArray(value)
);

const clampGridInteger = (value, min, max, fallback) => {
 const numeric = Number(value);
 if (!Number.isFinite(numeric)) return fallback;
 return Math.max(min, Math.min(max, Math.round(numeric)));
};

const normalizeContext = (context) => {
 const value = String(context || '').trim();
 return value || WIDGET_PREVIEW_METADATA_KEY;
};

export const getAllowedWidgetPreviewVariants = (family) => (
 WIDGET_PREVIEW_ALLOWED_VARIANTS[family] || EMPTY_VARIANTS
);

export const isWidgetPreviewFamily = (family) => (
 VALID_FAMILIES.includes(family)
);

export const isWidgetPreviewVariant = (family, variant) => (
 getAllowedWidgetPreviewVariants(family).includes(variant)
);

export const resolveWidgetPreviewSizeMode = ({ w = 1, h = 1 } = {}) => {
 const safeW = clampGridInteger(w, 1, 6, 1);
 const safeH = clampGridInteger(h, 1, 12, 1);

 if (safeH <= 1) {
 return WIDGET_PREVIEW_SIZE_MODES.TINY;
 }

 if (safeW <= 2 || safeH <= 2) {
 return WIDGET_PREVIEW_SIZE_MODES.COMPACT;
 }

 return WIDGET_PREVIEW_SIZE_MODES.REGULAR;
};

export const getWidgetPreviewSizeRule = (sizeMode) => {
 const safeMode = VALID_SIZE_MODES.includes(sizeMode)
 ? sizeMode
 : WIDGET_PREVIEW_SIZE_MODES.REGULAR;

 return WIDGET_PREVIEW_SIZE_RULES[safeMode];
};

export const getWidgetPreviewValidationErrors = (
 preview,
 context = WIDGET_PREVIEW_METADATA_KEY,
) => {
 const label = normalizeContext(context);
 const errors = [];

 if (!isPlainObject(preview)) {
 return [`${label} must be a plain object.`];
 }

 const unknownKeys = Object.keys(preview).filter(
 (key) => !ALLOWED_METADATA_KEYS.includes(key),
 );

 if (unknownKeys.length > 0) {
 errors.push(
 `${label} has unsupported fields: ${unknownKeys.join(', ')}.`,
 );
 }

 const { family, variant, seed, features, unitLabel } = preview;

 if (!isWidgetPreviewFamily(family)) {
 errors.push(`${label}.family is not supported: ${String(family)}.`);
 }

 if (
 isWidgetPreviewFamily(family) &&
 !isWidgetPreviewVariant(family, variant)
 ) {
 const allowed = getAllowedWidgetPreviewVariants(family);
 errors.push(
 `${label}.variant "${String(variant)}" is not allowed for family ` +
 `"${family}". Allowed: ${allowed.join(', ')}.`,
 );
 }

 if (!Number.isInteger(seed) || seed < 0) {
 errors.push(`${label}.seed must be a non-negative integer.`);
 }

 if (!Array.isArray(features) || features.length === 0) {
 errors.push(`${label}.features must be a non-empty string array.`);
 } else {
 const normalizedFeatures = features.map((feature) => (
 typeof feature === 'string' ? feature.trim() : ''
 ));

 if (normalizedFeatures.some((feature) => !feature)) {
 errors.push(`${label}.features must contain only non-empty strings.`);
 }

 if (new Set(normalizedFeatures).size !== normalizedFeatures.length) {
 errors.push(`${label}.features must not contain duplicates.`);
 }
 }

 if (
 unitLabel !== undefined &&
 (typeof unitLabel !== 'string' || !unitLabel.trim())
 ) {
 errors.push(
 `${label}.unitLabel must be a non-empty string when provided.`,
 );
 }

 return errors;
};

export const isValidWidgetPreviewDefinition = (preview) => (
 getWidgetPreviewValidationErrors(preview).length === 0
);

export const assertValidWidgetPreviewDefinition = (
 preview,
 context = WIDGET_PREVIEW_METADATA_KEY,
) => {
 const errors = getWidgetPreviewValidationErrors(preview, context);

 if (errors.length > 0) {
 throw new TypeError(
 `Invalid non-graph widget preview definition:\n- ${errors.join('\n- ')}`,
 );
 }

 return preview;
};
