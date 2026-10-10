const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const path =
  require('node:path');

const root =
  path.resolve(
    __dirname,
    '..'
  );

const utilitySource =
  fs.readFileSync(
    path.join(
      root,
      'utils',
      'togetherIncomingInvitations.js'
    ),
    'utf8'
  );

const screenSource =
  fs.readFileSync(
    path.join(
      root,
      'screens',
      'TogetherInviteAcceptScreen.js'
    ),
    'utf8'
  );

const appSource =
  fs.readFileSync(
    path.join(
      root,
      'App.js'
    ),
    'utf8'
  );

assert.match(
  utilitySource,
  /together_accepted_rooms_v1/
);

assert.match(
  utilitySource,
  /accepted_local/
);

assert.match(
  utilitySource,
  /completion_only/
);

assert.match(
  utilitySource,
  /parseTogetherInvitationData/
);

assert.match(
  utilitySource,
  /parseTogetherInvitationUrl/
);

assert.match(
  utilitySource,
  /loadTogetherAcceptableChallenges/
);

assert.match(
  utilitySource,
  /acceptTogetherInvitation/
);

assert.match(
  utilitySource,
  /SUPPORTED_VERSION\s*=\s*2/
);

assert.match(
  utilitySource,
  /acceptTogetherRemoteInvite/
);

assert.match(
  utilitySource,
  /remoteAccept/
);

assert.match(
  utilitySource,
  /serverRoomId/
);

assert.match(
  utilitySource,
  /loadTogetherAcceptedRoomByInvitationId/
);

assert.match(
  screenSource,
  /TogetherInviteAcceptScreen/
);

assert.match(
  screenSource,
  /내 활동 연결/
);

assert.match(
  screenSource,
  /이 활동으로 함께하기/
);

assert.match(
  screenSource,
  /초대를 수락했어요/
);

assert.match(
  screenSource,
  /같은 함께 방에 연결되었습니다/
);

assert.match(
  screenSource,
  /활동 만들기/
);

assert.doesNotMatch(
  screenSource,
  /상대가 오늘 완료/
);

assert.doesNotMatch(
  screenSource,
  /연속 \d+일/
);

assert.match(
  appSource,
  /TogetherInviteAcceptScreen/
);

assert.match(
  appSource,
  /TogetherInviteAccept/
);

assert.match(
  appSource,
  /together\/invite/
);

const dockMapMatch =
  appSource.match(
    /const DOCK_ROUTE_TO_KEY\s*=\s*\{([\s\S]*?)\};/
  );

assert.ok(
  dockMapMatch,
  'DOCK_ROUTE_TO_KEY missing'
);

assert.doesNotMatch(
  dockMapMatch[1],
  /TogetherInviteAccept/
);

const allowedPayloadFields = [
  'version',
  'invitationId',
  'title',
  'typeLabel',
  'sharePolicy',
  'createdAt',
];

for (
  const field
  of allowedPayloadFields
) {
  assert.match(
    utilitySource,
    new RegExp(field)
  );
}

for (
  const forbidden
  of [
    'senderChallengeId',
    'senderDraftId',
    'entryText',
    'photoUri',
    'senderStreak',
    'senderToday',
  ]
) {
  assert.doesNotMatch(
    utilitySource,
    new RegExp(
      forbidden
    )
  );
}

console.log(
  'Together incoming invitation source tests: PASS'
);
