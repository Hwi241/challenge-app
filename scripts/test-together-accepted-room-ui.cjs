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

const screen =
  fs.readFileSync(
    path.join(
      root,
      'screens',
      'TogetherScreen.js'
    ),
    'utf8'
  );

const detailScreen =
  fs.readFileSync(
    path.join(
      root,
      'screens',
      'TogetherRoomDetailScreen.js'
    ),
    'utf8'
  );

const card =
  fs.readFileSync(
    path.join(
      root,
      'components',
      'TogetherAcceptedRoomCard.js'
    ),
    'utf8'
  );

const detail =
  fs.readFileSync(
    path.join(
      root,
      'components',
      'TogetherAcceptedRoomDetail.js'
    ),
    'utf8'
  );

assert.match(
  screen,
  /reconcileTogetherAcceptedRooms/
);

assert.doesNotMatch(
  screen,
  /\bloadTogetherAcceptedRooms\b/
);

assert.match(
  screen,
  /loadTogetherCardSnapshot/
);

assert.match(
  screen,
  /acceptedRoomRows/
);

assert.match(
  screen,
  /TogetherAcceptedRoomCard/
);

assert.match(
  screen,
  /acceptedRoomId/
);

assert.match(
  screen,
  /함께하는 활동/
);

assert.match(
  detailScreen,
  /TogetherAcceptedRoomDetail/
);

assert.match(
  detailScreen,
  /acceptedRoomId/
);

assert.match(
  detailScreen,
  /ExistingTogetherRoomDetailScreen/
);

assert.match(
  card,
  /연결 대기/
);

assert.match(
  card,
  /오늘 완료/
);

assert.match(
  card,
  /오늘 아직/
);

assert.match(
  card,
  /오늘 없음/
);

assert.match(
  detail,
  /loadTogetherAcceptedRoomByInvitationId/
);

assert.match(
  detail,
  /loadTogetherCardSnapshot/
);

assert.match(
  detail,
  /상대 기록 연결 대기/
);

assert.match(
  detail,
  /최근 내 기록/
);

assert.match(
  detail,
  /기록 내용이나 사진은 공유하지 않습니다/
);

for (
  const forbidden
  of [
    '민수',
    'partnerDone',
    'partnerStreak',
    'partnerRecentRecords',
    '상대가 오늘 완료',
  ]
) {
  assert.doesNotMatch(
    card,
    new RegExp(
      forbidden
    )
  );

  assert.doesNotMatch(
    detail,
    new RegExp(
      forbidden
    )
  );
}

console.log(
  'Together accepted-room UI tests: PASS'
);
