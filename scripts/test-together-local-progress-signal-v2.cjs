const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');

const filename = path.join(
  root,
  'utils/togetherLocalProgressSignalV2.js'
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
  emitTogetherLocalProgressChangedV2,
  subscribeTogetherLocalProgressV2,
} = moduleRef.exports;

let calls = 0;

const unsubscribe =
  subscribeTogetherLocalProgressV2(() => {
    calls += 1;
  });

emitTogetherLocalProgressChangedV2();

assert.equal(calls, 1);

unsubscribe();

emitTogetherLocalProgressChangedV2();

assert.equal(calls, 1);

const read = (file) =>
  fs.readFileSync(
    path.join(root, file),
    'utf8'
  );

assert.match(
  read('components/TogetherSyncController.js'),
  /subscribeTogetherLocalProgressV2/
);

assert.match(
  read('utils/togetherImmediateSyncV2.js'),
  /rerunRequested/
);

assert.match(
  read('screens/UploadScreen.js'),
  /emitTogetherLocalProgressChangedV2/
);

assert.match(
  read('screens/EntryDetailScreen.js'),
  /emitTogetherLocalProgressChangedV2/
);

assert.match(
  read('utils/rotationRoutineStore.js'),
  /emitTogetherLocalProgressChangedV2/
);

console.log('Together local progress signal v2: PASS');
