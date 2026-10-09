const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const polyfillRequire = "require('./utils/textEncodingPolyfill');";
const expoRequire = "require('expo')";
const appRequire = "require('./App')";
const polyfillIndex = indexSource.indexOf(polyfillRequire);
const expoIndex = indexSource.indexOf(expoRequire);
const appIndex = indexSource.indexOf(appRequire);

assert.ok(polyfillIndex >= 0, 'text encoding polyfill require missing');
assert.ok(expoIndex >= 0, 'expo require missing');
assert.ok(appIndex >= 0, 'App require missing');
assert.ok(polyfillIndex < expoIndex, 'polyfill must execute before expo');
assert.ok(polyfillIndex < appIndex, 'polyfill must execute before App');
assert.doesNotMatch(indexSource, /^import\s/m, 'index.js must not rely on static import ordering');

const polyfillPath = path.join(root, 'utils/textEncodingPolyfill.js');
const savedEncoder = globalThis.TextEncoder;
const savedDecoder = globalThis.TextDecoder;

try {
  globalThis.TextEncoder = undefined;
  globalThis.TextDecoder = undefined;
  if (typeof global !== 'undefined') {
    global.TextEncoder = undefined;
    global.TextDecoder = undefined;
  }
  delete require.cache[require.resolve(polyfillPath)];
  require(polyfillPath);
  assert.equal(typeof globalThis.TextEncoder, 'function');
  assert.equal(typeof global.TextEncoder, 'function');
  assert.equal(globalThis.TextEncoder, global.TextEncoder);

  const text = 'THE PUSH 함께 QR';
  const encoded = new globalThis.TextEncoder().encode(text);
  assert.deepEqual(Array.from(encoded), Array.from(Buffer.from(text, 'utf8')));
  if (typeof globalThis.TextDecoder === 'function') {
    const decoded = new globalThis.TextDecoder('utf-8').decode(encoded);
    assert.equal(decoded, text);
  }

  const qrcodePath = require.resolve('qrcode/lib/core/qrcode.js');
  const QRCodeCore = require(qrcodePath);
  const qr = QRCodeCore.create(text, { errorCorrectionLevel: 'M' });
  assert.ok(qr);
  assert.ok(qr.modules);
  assert.ok(qr.modules.data);
  assert.ok(qr.modules.data.length > 0);
  console.log('text encoding + qrcode runtime test: PASS');
} finally {
  globalThis.TextEncoder = savedEncoder;
  globalThis.TextDecoder = savedDecoder;
  if (typeof global !== 'undefined') {
    global.TextEncoder = savedEncoder;
    global.TextDecoder = savedDecoder;
  }
}

const sentinelEncoder = function SentinelEncoder() {};
const sentinelDecoder = function SentinelDecoder() {};
globalThis.TextEncoder = sentinelEncoder;
globalThis.TextDecoder = sentinelDecoder;
if (typeof global !== 'undefined') {
  global.TextEncoder = sentinelEncoder;
  global.TextDecoder = sentinelDecoder;
}
delete require.cache[require.resolve(polyfillPath)];
require(polyfillPath);
assert.equal(globalThis.TextEncoder, sentinelEncoder);
assert.equal(globalThis.TextDecoder, sentinelDecoder);
assert.equal(global.TextEncoder, sentinelEncoder);
assert.equal(global.TextDecoder, sentinelDecoder);
globalThis.TextEncoder = savedEncoder;
globalThis.TextDecoder = savedDecoder;
if (typeof global !== 'undefined') {
  global.TextEncoder = savedEncoder;
  global.TextDecoder = savedDecoder;
}
console.log('existing encoding globals preserved: PASS');
console.log('index require order: PASS');
