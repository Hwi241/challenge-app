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
  throw new Error('드래그 초기화 패치는 4.0.3 전용입니다.');
}
if (metadata['react-native'] !== 'src/index.tsx') {
  throw new Error('React Native 진입점이 예상과 다릅니다.');
}

const target = path.join(
  path.dirname(packagePath),
  'src/components/DraggableFlatList.tsx',
);
const original = fs.readFileSync(target, 'utf8');
const source = original.replace(/\r\n/g, '\n');
const checkOnly = process.argv.includes('--check');
const marker = '  // challenge-app: reset after committed key order changes.';

const scheduledReset = [
  '    InteractionManager.runAfterInteractions(() => {',
  '      reset();',
  '    });',
  '',
].join('\n');

const importLine = '  InteractionManager,\n';
const anchor = [
  '  useEffect(() => {',
  '    if (!propsRef.current.enableLayoutAnimationExperimental) return;',
].join('\n');

const hook = [
  marker,
  '  const committedKeyOrderRef = useRef<string | null>(null);',
  '  useLayoutEffect(() => {',
  '    const nextKeyOrder = JSON.stringify(props.data.map(keyExtractor));',
  '    const previousKeyOrder = committedKeyOrderRef.current;',
  '    committedKeyOrderRef.current = nextKeyOrder;',
  '    if (previousKeyOrder === null) return;',
  '    if (previousKeyOrder === nextKeyOrder) return;',
  '    reset();',
  '  }, [props.data, keyExtractor, reset]);',
  '',
  '',
].join('\n');

const count = (content, value) => content.split(value).length - 1;
const markerCount = count(source, marker);

if (markerCount === 1) {
  if (count(source, hook) !== 1) {
    throw new Error('기존 초기화 패치 내용이 예상과 다릅니다.');
  }
  if (source.includes('InteractionManager')) {
    throw new Error('InteractionManager 참조가 남아 있습니다.');
  }
  console.log('ROTATION_RESET_PATCH_ALREADY_APPLIED');
} else {
  if (markerCount !== 0) {
    throw new Error('초기화 패치가 중복되어 있습니다.');
  }
  for (const [name, fragment] of [
    ['예약 호출', scheduledReset],
    ['import', importLine],
    ['삽입 위치', anchor],
  ]) {
    if (count(source, fragment) !== 1) {
      throw new Error(name + ' 문맥이 예상과 다릅니다.');
    }
  }
  const patched = source
    .replace(scheduledReset, '')
    .replace(importLine, '')
    .replace(anchor, hook + anchor);
  if (patched.includes('InteractionManager')) {
    throw new Error('다른 InteractionManager 참조가 남아 있습니다.');
  }
  if (checkOnly) {
    throw new Error('드래그 초기화 패치가 아직 적용되지 않았습니다.');
  }
  const newline = original.includes('\r\n') ? '\r\n' : '\n';
  fs.writeFileSync(target, patched.replace(/\n/g, newline), 'utf8');
  console.log('ROTATION_RESET_PATCH_APPLIED');
}
