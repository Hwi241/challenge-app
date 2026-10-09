const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const dock = read('components/MainDock.js');
const host = read('components/RewardFeedbackHost.js');
const app = read('App.js');
const together = read('screens/TogetherScreen.js');
const togetherPushPicker = read('components/TogetherPushPickerModal.js');

const togetherIndex = dock.indexOf("key: 'together'");
const recordIndex = dock.indexOf("key: 'record'");
const homeIndex = dock.indexOf("key: 'home'");
const shopIndex = dock.indexOf("key: 'shop'");

assert.ok(togetherIndex >= 0);
assert.ok(recordIndex > togetherIndex);
assert.ok(homeIndex > recordIndex);
assert.ok(shopIndex > homeIndex);
assert.match(dock, /together:\s*0/);
assert.match(dock, /record:\s*1/);
assert.match(dock, /home:\s*2/);
assert.match(dock, /shop:\s*3/);
assert.match(dock, /StackActions\.replace/);
assert.doesNotMatch(dock, /StackActions\.pop/);
assert.match(dock, /rewardPulse/);
assert.match(dock, /PulsingDockIcon/);
assert.doesNotMatch(dock, /subscribeRewardFeedback/);
assert.doesNotMatch(dock, /RewardBubble/);
assert.match(host, /subscribeRewardFeedback/);
assert.match(host, /REWARD_FEEDBACK_KIND\.XP/);
assert.match(host, /REWARD_FEEDBACK_KIND\.STAR/);
assert.match(host, /Vibration\.vibrate/);
assert.match(host, /particleProgress/);
assert.match(host, /isMajorReward/);
assert.match(host, /\+\$\{feedback\.amount\} XP/);
assert.match(host, /'\+★'/);
assert.match(host, /\+\$\{feedback\.amount\}★/);
assert.match(host, /dockVisible/);
assert.match(host, /left:\s*dockLeft/);
assert.match(host, /left:\s*'50%'/);
assert.match(app, /RewardFeedbackHost/);
assert.match(app, /dockVisible=\{!!dockActive\}/);
assert.match(app, /onDockPulse=\{setDockRewardPulse\}/);
assert.match(app, /rewardPulse=\{dockRewardPulse\}/);
assert.match(app, /Together:\s*'together'/);
assert.match(app, /initialRouteName="ChallengeList"/);
assert.match(app, /slide_from_left/);
assert.match(app, /slide_from_right/);
assert.match(
  together,
  /혼자 하던 일을/
);

assert.match(
  together,
  /함께 이어가보세요/
);

assert.match(
  together,
  /함께 시작하기/
);

assert.match(
  together,
  /활동 선택/
);

assert.match(
  together,
  /친구 초대/
);

assert.match(
  together,
  /함께 기록/
);

assert.match(
  together,
  /공개 피드나 순위 없이/
);

assert.match(
  together,
  /TOGETHER_PREVIEW_ROOMS = \[\]/
);

assert.match(
  together,
  /TogetherRoomCard/
);

assert.match(
  together,
  /TogetherPushPickerModal/
);

assert.match(togetherPushPicker, /함께할 PUSH 선택/);
assert.match(together, /초대 준비 중/);
assert.match(together, /TogetherDraftCard/);

assert.doesNotMatch(
  together,
  /AsyncStorage/
);

console.log('main dock / reward host tests: PASS');
