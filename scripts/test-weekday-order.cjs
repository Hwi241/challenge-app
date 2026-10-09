const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const weekdaysFile = path.join(root, 'utils', 'weekdays.js');
const transformed = babel.transformFileSync(
  weekdaysFile,
  {
    presets: [['babel-preset-expo', { jsxRuntime: 'automatic' }]],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
    babelrc: false,
    configFile: false,
  }
).code;

const moduleObject = { exports: {} };

vm.runInNewContext(
  transformed,
  {
    module: moduleObject,
    exports: moduleObject.exports,
    require,
    console,
    Date,
    Map,
    Set,
    String,
    Number,
    Object,
    Array,
  },
  { filename: weekdaysFile }
);

const weekdays = moduleObject.exports;
const expected = ['일', '월', '화', '수', '목', '금', '토'];

assert.equal(
  JSON.stringify(Array.from(weekdays.KOREAN_WEEKDAYS)),
  JSON.stringify(expected)
);

assert.equal(
  JSON.stringify(
    weekdays.normalizeKoreanWeekdays([
      '월',
      '일',
      '수',
      '월',
      '토',
      '잘못된요일',
    ])
  ),
  JSON.stringify(['일', '월', '수', '토'])
);

for (const day of expected) {
  assert.equal(weekdays.normalizeKoreanWeekdays([day])[0], day);
}

const sunday = new Date(2026, 10, 1);
assert.equal(sunday.getDay(), 0);
assert.equal(weekdays.koreanWeekdayFromDate(sunday), '일');

const monday = new Date(2026, 10, 2);
assert.equal(weekdays.koreanWeekdayFromDate(monday), '월');

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const monthly = read('components/MonthlyNotificationPreview.js');
assert.match(monthly, /KOREAN_WEEKDAYS/);
assert.match(monthly, /const firstDow\s*=\s*first\.getDay\(\)/);
assert.match(monthly, /i\s*-\s*firstDow\s*\+\s*1/);
assert.doesNotMatch(monthly, /firstDowMonStart/);

const simple = read('screens/SimpleNotificationScreen.js');
assert.match(simple, /normalizeKoreanWeekdays/);
assert.match(simple, /days:\s*normalizeKoreanWeekdays/);

const weekly = read('screens/WeeklyNotificationScreen.js');
assert.match(weekly, /const WEEK\s*=\s*KOREAN_WEEKDAYS/);
assert.match(weekly, /const byWeekDays\s*=\s*WEEK\.map/);

const addChallenge = read('screens/AddChallengeScreen.js');
assert.match(addChallenge, /normalizeKoreanWeekdays/);
assert.match(addChallenge, /days:\s*normalizeKoreanWeekdays/);

const editChallenge = read('screens/EditChallengeScreen.js');
assert.match(editChallenge, /normalizeKoreanWeekdays/);
assert.match(editChallenge, /days:\s*normalizeKoreanWeekdays/);

const settingWidgets = read('components/ChallengeSettingWidgets.js');
assert.match(settingWidgets, /normalizeKoreanWeekdays\(\s*cycle\.days\s*\)/);

const entryList = read('screens/EntryListScreen.js');
assert.match(entryList, /const DAY_LABELS\s*=\s*KOREAN_WEEKDAYS/);
assert.match(entryList, /const WEEK_DAYS_KO\s*=\s*KOREAN_WEEKDAYS/);
assert.match(entryList, /const HEALTH_STEPS_WEEKLY_LABELS\s*=\s*KOREAN_WEEKDAYS/);
assert.match(entryList, /start\.setDate\(start\.getDate\(\) - sd\)/);
assert.match(entryList, /todayMid\.getDate\(\) \+ \(6 - td\)/);

const challengeList = read('screens/ChallengeListScreen.js');
assert.match(
  challengeList,
  /const WEEK_DAY_LABELS\s*=\s*\[\s*['"]일['"]\s*,\s*['"]월['"]\s*,\s*['"]화['"]\s*,\s*['"]수['"]\s*,\s*['"]목['"]\s*,\s*['"]금['"]\s*,\s*['"]토['"]\s*\]/
);
assert.match(challengeList, /WEEK_DAY_LABELS\[\s*date\.getDay\(\)\s*\]/);

const growthPreview = read('components/GrowthToolPreview.js');
const recordPages = read('components/RecordRoomAnalysisPages.js');
const profileAnalysis = read('screens/ProfileAnalysisScreen.js');
const recordAnalysis = read('utils/recordRoomAnalysis.js');

assert.match(growthPreview, /KOREAN_WEEKDAYS/);
assert.match(recordPages, /const weekdays\s*=\s*KOREAN_WEEKDAYS/);
assert.match(profileAnalysis, /KOREAN_WEEKDAYS\.map/);
assert.match(recordAnalysis, /const WEEKDAY_LABELS\s*=\s*KOREAN_WEEKDAYS/);
assert.match(recordAnalysis, /const getSundayFirstWeekday/);
assert.match(recordAnalysis, /date\.getDay\(\)/);
assert.match(recordAnalysis, /weekday === 0/);
assert.match(recordAnalysis, /weekday === 6/);
assert.doesNotMatch(recordAnalysis, /getMondayFirstWeekday/);
assert.doesNotMatch(recordAnalysis, /\(\s*date\.getDay\(\)\s*\+\s*6\s*\)\s*%\s*7/);

const sourceDirs = ['components', 'screens', 'utils'];
const mondayFirstSeven = /\[\s*['"]월['"]\s*,\s*['"]화['"]\s*,\s*['"]수['"]\s*,\s*['"]목['"]\s*,\s*['"]금['"]\s*,\s*['"]토['"]\s*,\s*['"]일['"]\s*\]/g;
const violations = [];

const scan = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      scan(full);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    const source = fs.readFileSync(full, 'utf8');
    if (mondayFirstSeven.test(source)) {
      violations.push(path.relative(root, full));
    }
    mondayFirstSeven.lastIndex = 0;
  }
};

for (const sourceDir of sourceDirs) {
  scan(path.join(root, sourceDir));
}

assert.deepEqual(violations, []);

console.log('Sunday-first weekday order tests: PASS');
