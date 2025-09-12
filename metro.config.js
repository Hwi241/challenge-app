// metro.config.js (루트)
// Expo 기본 설정을 유지하면서 SVG만 transformer로 추가
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ✅ SVG만 sourceExts로 추가, assetExts에서 'svg'만 제거
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

// ✅ 기존 transformer 옵션 보존 + svg-transformer만 경로 주입
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

module.exports = config;
