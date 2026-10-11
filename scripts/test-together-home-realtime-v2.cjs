const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');

const filename = path.join(
  root,
  'utils/togetherHomeRealtimeV2.js'
);

const source = fs.readFileSync(
  filename,
  'utf8'
);

const transformed = babel.transformSync(
  source,
  {
    filename,
    presets: [
      [
        'babel-preset-expo',
        {
          jsxRuntime: 'automatic',
        },
      ],
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
  (name) => {
    if (name === './supabaseClient') {
      return {
        getSupabaseClient: () => null,
      };
    }

    return require(name);
  }
);

const {
  subscribeTogetherHomeChangesV2,
} = moduleRef.exports;

const handlers = [];
let channels = 0;
let removed = 0;
let changes = 0;

const channel = {
  on(kind, config, handler) {
    assert.equal(
      kind,
      'postgres_changes'
    );

    handlers.push({
      table: config.table,
      handler,
    });

    return this;
  },

  subscribe() {
    return this;
  },
};

const client = {
  channel(name) {
    assert.equal(
      name,
      'together-home-v2'
    );

    channels += 1;
    return channel;
  },

  removeChannel(target) {
    assert.equal(target, channel);

    removed += 1;
    return Promise.resolve();
  },
};

const unsubscribe =
  subscribeTogetherHomeChangesV2({
    client,
    onChange: () => {
      changes += 1;
    },
  });

assert.equal(channels, 1);

assert.deepEqual(
  handlers.map((item) => item.table),
  [
    'together_rooms',
    'together_room_members',
  ]
);

handlers[0].handler();
handlers[1].handler();

assert.equal(changes, 2);

unsubscribe();

assert.equal(removed, 1);

const home = fs.readFileSync(
  path.join(
    root,
    'screens/TogetherScreen.js'
  ),
  'utf8'
);

assert.match(
  home,
  /subscribeTogetherHomeChangesV2/
);

assert.match(
  home,
  /scheduleRealtimeReload/
);

assert.match(
  home,
  /clearTimeout\(refreshTimer\)/
);

assert.match(
  home,
  /reloadSequenceRef/
);

assert.match(
  home,
  /getExistingTogetherSession/
);

assert.match(
  home,
  /unsubscribe\(\)/
);

console.log('Together home realtime v2: PASS');
