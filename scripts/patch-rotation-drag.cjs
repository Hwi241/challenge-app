'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packagePath = require.resolve(
  'react-native-draggable-flatlist/package.json',
  { paths: [root] },
);
const metadata = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

if (metadata.version !== '4.0.3') {
  throw new Error('드래그 패치는 4.0.3 전용입니다. 버전 변경 후 재검토가 필요합니다.');
}
if (metadata['react-native'] !== 'src/index.tsx') {
  throw new Error('드래그 패키지의 React Native 진입점이 예상과 다릅니다.');
}

const target = path.join(
  path.dirname(packagePath),
  'src/components/CellRendererComponent.tsx',
);
const before = [
  '    if (translate.value && !isWeb) {',
  '      heldTanslate.value = translate.value;',
  '    }',
].join('\n');
const after = [
  '    // challenge-app: cache offsets only while a drag is active.',
  '    if (activeKey && !isWeb) {',
  '      heldTanslate.value = translate.value;',
  '    }',
].join('\n');

const original = fs.readFileSync(target, 'utf8');
const source = original.replace(/\r\n/g, '\n');
const count = (value) => source.split(value).length - 1;
const beforeCount = count(before);
const afterCount = count(after);
const checkOnly = process.argv.includes('--check');

if (afterCount === 1 && beforeCount === 0) {
  console.log('ROTATION_DRAG_PATCH_ALREADY_APPLIED');
} else if (beforeCount === 1 && afterCount === 0) {
  if (checkOnly) {
    throw new Error('드래그 이동값 패치가 아직 적용되지 않았습니다.');
  }
  const newline = original.includes('\r\n') ? '\r\n' : '\n';
  const patched = source.replace(before, after);
  fs.writeFileSync(target, patched.replace(/\n/g, newline), 'utf8');
  console.log('ROTATION_DRAG_PATCH_APPLIED');
} else {
  throw new Error('드래그 패치 문맥이 예상과 다릅니다. 자동 보정하지 않습니다.');
}

require('./patch-rotation-reset.cjs');

// 018-4: compare zero translation after drag completion.
(() => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  const packagePath = require.resolve(
    'react-native-draggable-flatlist/package.json',
    { paths: [root] }
  );
  const metadata = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  if (metadata.version !== '4.0.3') {
    throw new Error('ROTATION_ZERO_PATCH_VERSION_MISMATCH');
  }
  if (metadata['react-native'] !== 'src/index.tsx') {
    throw new Error('ROTATION_ZERO_PATCH_ENTRY_MISMATCH');
  }

  const target = path.join(
    path.dirname(packagePath),
    'src/components/CellRendererComponent.tsx'
  );
  const original = fs.readFileSync(target, 'utf8');
  const source = original.replace(/\r\n/g, '\n');
  const before = '    const t = activeKey ? translate.value : heldTanslate.value;';
  const after = '    const t = activeKey ? translate.value : 0;';
  const count = (value) => source.split(value).length - 1;
  const beforeCount = count(before);
  const afterCount = count(after);

  if (beforeCount === 0 && afterCount === 1) {
    console.log('ROTATION_ZERO_PATCH_ALREADY_APPLIED');
    return;
  }

  if (beforeCount !== 1) {
    throw new Error('ROTATION_ZERO_PATCH_CONTEXT_MISMATCH');
  }
  if (afterCount !== 0) {
    throw new Error('ROTATION_ZERO_PATCH_CONTEXT_MISMATCH');
  }
  if (process.argv.includes('--check')) {
    throw new Error('ROTATION_ZERO_PATCH_NOT_APPLIED');
  }

  const patched = source.replace(before, after);
  const output = original.includes('\r\n')
    ? patched.replace(/\n/g, '\r\n')
    : patched;

  fs.writeFileSync(target, output, 'utf8');
  console.log('ROTATION_ZERO_PATCH_APPLIED');
})();
