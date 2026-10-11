const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const filename = path.resolve(
  __dirname,
  '../utils/togetherInvitePresenceV2.js'
);

const source = fs.readFileSync(
  filename,
  'utf8'
);

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
  getTogetherInvitePresenceV2,
} = loaded.exports;

const base = {
  room: {
    id: 'room-a',
    ownerUserId: 'owner-a',
    myRole: 'owner',
  },
  members: [
    {
      userId: 'owner-a',
      status: 'active',
      displayName: '나',
    },
  ],
};

assert.equal(
  getTogetherInvitePresenceV2(base).status,
  'waiting'
);

const pending = {
  ...base,
  members: [
    ...base.members,
    {
      userId: 'friend-a',
      status: 'pending',
    },
  ],
};

assert.equal(
  getTogetherInvitePresenceV2(pending).status,
  'waiting'
);

const joined = {
  ...base,
  members: [
    ...base.members,
    {
      userId: 'friend-a',
      status: 'active',
      displayName: '친구',
    },
    {
      userId: 'friend-a',
      status: 'active',
      displayName: '친구',
    },
  ],
};

const result =
  getTogetherInvitePresenceV2(joined);

assert.equal(result.status, 'joined');
assert.equal(result.joinedCount, 1);

assert.equal(
  getTogetherInvitePresenceV2({
    ...joined,
    room: {
      ...joined.room,
      myRole: 'member',
    },
  }).status,
  'unavailable'
);

assert.throws(
  () =>
    getTogetherInvitePresenceV2({
      room: null,
      members: [],
    }),
  /TOGETHER_INVITE_SNAPSHOT_INVALID/
);

console.log(
  'Together invite presence v2: PASS'
);
