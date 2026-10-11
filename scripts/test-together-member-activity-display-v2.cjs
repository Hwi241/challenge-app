const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
const filename = path.join(
  root,
  'utils/togetherMemberActivityDisplayV2.js'
);
const source = fs.readFileSync(filename, 'utf8');
const transformed = babel.transformSync(
  source,
  {
    filename,
    presets: [
      ['babel-preset-expo', {
        jsxRuntime: 'automatic',
      }],
    ],
    babelrc: false,
    configFile: false,
  }
).code;
const moduleRef = { exports: {} };
new Function(
  'module',
  'exports',
  'require',
  transformed
)(
  moduleRef,
  moduleRef.exports,
  require
);
const {
  formatTogetherStateDateV2,
  formatTogetherStateSyncTimeV2,
  getTogetherMemberActivityDisplayV2,
} = moduleRef.exports;

assert.equal(
  formatTogetherStateDateV2('2026-10-11'),
  '2026.10.11'
);
assert.equal(
  formatTogetherStateDateV2('2026-02-30'),
  ''
);
assert.equal(
  formatTogetherStateDateV2('invalid'),
  ''
);
assert.equal(
  formatTogetherStateSyncTimeV2('invalid'),
  ''
);

const completed =
  getTogetherMemberActivityDisplayV2({
    status: 'active',
    state: {
      localDate: '2026-10-11',
      completed: true,
      updatedAt: '2026-10-11T12:34:00Z',
    },
  });

assert.equal(
  completed.completionLabel,
  '기준일 완료'
);
assert.equal(
  completed.dateLabel,
  '활동 기준 2026.10.11'
);
assert.match(
  completed.syncedLabel,
  /^마지막 상태 동기화 /
);

const incomplete =
  getTogetherMemberActivityDisplayV2({
    status: 'active',
    state: {
      localDate: '2026-10-10',
      completed: false,
    },
  });

assert.equal(
  incomplete.completionLabel,
  '기준일 미완료'
);

const missing =
  getTogetherMemberActivityDisplayV2({
    status: 'active',
    state: null,
  });

assert.equal(
  missing.completionLabel,
  '활동 상태 미수신'
);
assert.equal(missing.hasCompletion, false);

const pending =
  getTogetherMemberActivityDisplayV2({
    status: 'pending',
    state: {
      localDate: '2026-10-11',
      completed: true,
    },
  });

assert.equal(
  pending.completionLabel,
  '참가 상태 확인 필요'
);
assert.equal(pending.hasCompletion, false);

const component = fs.readFileSync(
  path.join(
    root,
    'components/TogetherMemberSyncMetaV2.js'
  ),
  'utf8'
);
const detail = fs.readFileSync(
  path.join(
    root,
    'screens/TogetherRoomDetailScreen.js'
  ),
  'utf8'
);

assert.match(
  component,
  /getTogetherMemberActivityDisplayV2/
);
assert.match(
  detail,
  /TogetherMemberSyncMetaV2/
);
assert.match(
  detail,
  /getTogetherMemberActivityDisplayV2/
);

console.log(
  'Together member activity display v2: PASS'
);
