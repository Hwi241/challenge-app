const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require(path.resolve(__dirname, '..', 'utils', 'textEncodingPolyfill.js'));

const root = path.resolve(__dirname, '..');
const componentSource = fs.readFileSync(path.join(root, 'components', 'TogetherQrCode.js'), 'utf8');
const screenSource = fs.readFileSync(path.join(root, 'screens', 'TogetherInviteDraftScreen.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

assert.equal(packageJson.dependencies?.qrcode, '1.5.4');
assert.equal(packageJson.dependencies?.['react-native-qrcode-svg'], undefined);
assert.match(componentSource, /qrcode\/lib\/core\/qrcode\.js/);
assert.doesNotMatch(componentSource, /require\(['"]qrcode['"]\)/);
assert.match(screenSource, /TogetherQrCode/);
assert.doesNotMatch(screenSource, /react-native-qrcode-svg/);
assert.doesNotMatch(screenSource, /<QRCode/);

const QRCodeCore = require('qrcode/lib/core/qrcode.js');
const values = ['THE PUSH 함께 QR', 'thepush://together/invite?data=test', '매일 30분 걷기'];
for (const value of values) {
  const result = QRCodeCore.create(value, { errorCorrectionLevel: 'M' });
  assert.ok(result);
  assert.ok(result.modules);
  assert.ok(Number(result.modules.size) > 0);
  assert.ok(result.modules.data);
  assert.equal(result.modules.data.length, result.modules.size * result.modules.size);
}

console.log('Together QR direct-core tests: PASS');
