const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const read = (filename) =>
  fs.readFileSync(
    path.join(root, filename),
    'utf8'
  );

const together = read(
  'screens/TogetherScreen.js'
);

const typeScreen = read(
  'screens/CreateChallengeTypeScreen.js'
);

const addChallenge = read(
  'screens/AddChallengeScreen.js'
);

const addRotation = read(
  'screens/AddRotationRoutineScreen.js'
);

assert.match(
  together,
  /togetherCreatedPushId/
);

assert.match(
  together,
  /resumeTogetherCreation/
);

assert.match(
  together,
  /selectActivity\(createdPush\)/
);

assert.match(
  together,
  /fromTogether:\s*true/
);

assert.match(
  typeScreen,
  /fromTogether/
);

assert.match(
  addChallenge,
  /togetherCreatedPushId:\s*id/
);

assert.match(
  addChallenge,
  /popTo\(['"]Together['"]/
);

assert.match(
  addRotation,
  /created\?\.routine\?\.id/
);

assert.match(
  addRotation,
  /togetherCreatedPushId:\s*createdId/
);

assert.match(
  addChallenge,
  /popTo\(['"]ChallengeList['"]/
);

assert.match(
  addRotation,
  /popTo\(['"]ChallengeList['"]/
);

console.log(
  'Together create return flow: PASS'
);
