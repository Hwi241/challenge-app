const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const filename = path.resolve(
  __dirname,
  '../utils/togetherRoomViewIntegrity.js'
);

const source = fs.readFileSync(filename, 'utf8');

const transformed = babel.transformSync(source, {
  filename,
  presets: [
    ['babel-preset-expo', {
      jsxRuntime: 'automatic',
    }],
  ],
  babelrc: false,
  configFile: false,
}).code;

const loaded = { exports: {} };

new Function(
  'module',
  'exports',
  'require',
  transformed
)(
  loaded,
  loaded.exports,
  require
);

const {
  resolveTogetherRoomPresentation,
} = loaded.exports;

const roomA =
  '11111111-1111-4111-8111-111111111111';

const roomB =
  '22222222-2222-4222-8222-222222222222';

const roomC =
  '33333333-3333-4333-8333-333333333333';

// 동일 서버 방이 여러 출처에 존재하는 경우

const merged = resolveTogetherRoomPresentation({
  remoteRows: [
    { room_id: roomA, title: '함께 활동' },
    { room_id: roomB, title: '함께 활동' },
  ],
  acceptedRows: [
    {
      room: {
        serverRoomId: roomA,
        title: '함께 활동',
      },
    },
  ],
  drafts: [
    { id: 'draft-a', title: '함께 활동' },
    { id: 'draft-c', title: '새 활동' },
  ],
  invitations: [
    {
      draftId: 'draft-a',
      serverRoomId: roomA,
    },
  ],
});

assert.equal(merged.remoteRows.length, 2);
assert.equal(merged.acceptedRows.length, 0);
assert.equal(merged.drafts.length, 1);
assert.equal(merged.drafts[0].id, 'draft-c');
assert.equal(merged.suppressedCount, 2);

// 서버 방이 아직 목록에 없더라도
// accepted와 draft는 중복 표시하지 않는다.

const acceptedOnly = resolveTogetherRoomPresentation({
  acceptedRows: [
    { room: { serverRoomId: roomC } },
  ],
  drafts: [
    { id: 'draft-c' },
  ],
  invitations: [
    {
      draftId: 'draft-c',
      serverRoomId: roomC,
    },
  ],
});

assert.equal(acceptedOnly.acceptedRows.length, 1);
assert.equal(acceptedOnly.drafts.length, 0);

// 서로 다른 방은 제목이 같아도 유지한다.

const sameTitle = resolveTogetherRoomPresentation({
  remoteRows: [
    { room_id: roomA, title: '함께 활동' },
    { room_id: roomB, title: '함께 활동' },
  ],
});

assert.equal(sameTitle.remoteRows.length, 2);

// 서버 ID가 동일한 표시만 중복 제거한다.

const repeated = resolveTogetherRoomPresentation({
  remoteRows: [
    { room_id: roomA },
    { room_id: roomA },
  ],
});

assert.equal(repeated.remoteRows.length, 1);

// 식별 불가능한 데이터는 임의 삭제하지 않는다.

const unknown = resolveTogetherRoomPresentation({
  drafts: [
    { id: 'draft-1', title: '함께 활동' },
    { id: 'draft-2', title: '함께 활동' },
  ],
});

assert.equal(unknown.drafts.length, 2);

console.log(
  'Together room view integrity: PASS'
);
