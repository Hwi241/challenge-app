const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const filename = path.resolve(
  __dirname,
  '../utils/togetherInviteAcceptanceGuardV2.js'
);

const transformed = babel.transformSync(
  fs.readFileSync(filename, 'utf8'),
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
  findLocalOwnerInviteV2,
  isVerifiedOwnerInviteV2,
  resolveTogetherAcceptOutcomeV2,
} = moduleRef.exports;

const candidate = findLocalOwnerInviteV2({
  code: 'ABC123',
  drafts: [
    {
      id: 'draft-a',
      roomId: 'room-a',
      inviteCode: 'abc123',
    },
  ],
});

assert.equal(candidate.roomId, 'room-a');

assert.equal(
  findLocalOwnerInviteV2({
    code: 'OTHER',
    drafts: [
      { inviteCode: 'ABC123', roomId: 'room-a' },
    ],
  }),
  null
);

const ownerSnapshot = {
  room: {
    id: 'room-a',
    ownerUserId: 'user-a',
    myRole: 'owner',
  },
};

assert.equal(
  isVerifiedOwnerInviteV2({
    snapshot: ownerSnapshot,
    sessionUserId: 'user-a',
    expectedRoomId: 'room-a',
  }),
  true
);

assert.equal(
  isVerifiedOwnerInviteV2({
    snapshot: ownerSnapshot,
    sessionUserId: 'user-b',
    expectedRoomId: 'room-a',
  }),
  false
);

assert.equal(
  isVerifiedOwnerInviteV2({
    snapshot: ownerSnapshot,
    sessionUserId: 'user-a',
    expectedRoomId: 'room-b',
  }),
  false
);

assert.equal(
  resolveTogetherAcceptOutcomeV2({
    joinStatus: 'pending',
    roomId: 'room-a',
    bindingComplete: true,
  }).state,
  'pending'
);

assert.equal(
  resolveTogetherAcceptOutcomeV2({
    joinStatus: 'active',
    roomId: 'room-a',
    bindingComplete: false,
  }).state,
  'incomplete'
);

assert.deepEqual(
  resolveTogetherAcceptOutcomeV2({
    joinStatus: 'active',
    roomId: 'room-a',
    bindingComplete: true,
  }),
  {
    state: 'complete',
    roomId: 'room-a',
  }
);

assert.equal(
  resolveTogetherAcceptOutcomeV2({
    joinStatus: 'unknown',
    roomId: 'room-a',
    bindingComplete: true,
  }).state,
  'unknown'
);

console.log(
  'Together invite acceptance guard v2: PASS'
);
