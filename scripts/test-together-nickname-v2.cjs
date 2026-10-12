const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
const filename = path.join(
  root,
  'utils/togetherNicknameV2.js'
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

let response = {
  data: '새 닉네임',
  error: null,
};
const calls = [];
const client = {
  rpc: async (name, args) => {
    calls.push({ name, args });
    return response;
  },
};
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
        getSupabaseClient: () => client,
      };
    }

    if (name === './togetherRemoteAuth') {
      return {
        ensureTogetherAnonymousSession:
          async () => ({
            ok: true,
            userId: 'user-a',
          }),
      };
    }

    return require(name);
  }
);

const {
  loadOfficialTogetherNicknameV2,
  saveTogetherNicknameV2,
} = moduleRef.exports;

(async () => {
  assert.equal(
    await saveTogetherNicknameV2(
      '  새 닉네임  '
    ),
    '새 닉네임'
  );
  assert.deepEqual(calls.at(-1), {
    name: 'set_my_together_nickname_v2',
    args: {
      p_nickname: '새 닉네임',
    },
  });

  response = {
    data: '',
    error: null,
  };
  assert.equal(
    await saveTogetherNicknameV2('   '),
    ''
  );

  const callsBeforeLengthFailure = calls.length;
  await assert.rejects(
    () => saveTogetherNicknameV2('가'.repeat(41)),
    /TOGETHER_NICKNAME_TOO_LONG/
  );
  assert.equal(
    calls.length,
    callsBeforeLengthFailure
  );

  response = {
    data: null,
    error: {
      message: 'TOGETHER_NICKNAME_TAKEN',
    },
  };
  await assert.rejects(
    () => saveTogetherNicknameV2('중복'),
    /TOGETHER_NICKNAME_TAKEN/
  );

  response = {
    data: null,
    error: {
      code: '23505',
      message: 'duplicate key',
    },
  };
  await assert.rejects(
    () => saveTogetherNicknameV2('DUPLICATE'),
    /TOGETHER_NICKNAME_TAKEN/
  );

  response = {
    data: '공식 이름',
    error: null,
  };
  assert.equal(
    await loadOfficialTogetherNicknameV2(),
    '공식 이름'
  );
  assert.equal(
    calls.at(-1).name,
    'get_my_together_nickname_v2'
  );

  const sql = fs.readFileSync(
    path.join(
      root,
      'supabase/migrations/036_unique_profile_nickname.sql'
    ),
    'utf8'
  );
  const profile = fs.readFileSync(
    path.join(
      root,
      'screens/ProfileInventoryScreen.js'
    ),
    'utf8'
  );

  assert.match(
    sql,
    /unique index[\s\S]*lower\(nickname\)[\s\S]*where nickname is not null/i
  );
  assert.match(
    sql,
    /user_id uuid primary key[\s\S]*references auth\.users\(id\)/
  );
  assert.match(
    sql,
    /enable row level security/
  );
  assert.match(
    sql,
    /revoke all on public\.together_user_nicknames[\s\S]*from public, anon, authenticated/
  );
  assert.match(
    sql,
    /new\.display_name := coalesce\(v_name, '멤버'\)/
  );
  assert.match(
    sql,
    /update public\.together_room_members[\s\S]*update public\.together_join_requests/
  );
  assert.match(
    sql,
    /update_together_member_display_name_v2\([\s\S]*p_display_name text/
  );
  assert.match(
    profile,
    /saveTogetherNicknameV2/
  );
  assert.match(
    profile,
    /maxLength=\{40\}/
  );
  assert.match(
    profile,
    /const previousName = normalizeProfileDraft\(profileInfo\)\.name;/
  );
  assert.match(
    profile,
    /const nicknameChanged = nextProfile\.name !== previousName;/
  );
  assert.match(
    profile,
    /if \(nicknameNeedsServer\) \{[\s\S]*?saveTogetherNicknameV2\([\s\S]*?\n      \}/
  );
  assert.match(
    profile,
    /nicknameNeedsServer[\s\S]*서버 닉네임은 저장됐지만[\s\S]*기기 내 정보를 저장하지 못했어요/
  );
  assert.match(
    profile,
    /officialNicknameStatus[\s\S]*\]\);/
  );
  assert.match(
    profile,
    /loadOfficialTogetherNicknameV2\(\)[\s\S]*officialNicknameCheckSeqRef\.current !== sequence/
  );
  assert.match(
    profile,
    /닉네임 최초 등록/
  );
  assert.match(
    profile,
    /닉네임 변경/
  );
  assert.match(
    profile,
    /닉네임 등록 해제/
  );
  assert.match(
    profile,
    /text: '취소',[\s\S]*style: 'cancel'/
  );
  const nicknameSaveIndex =
    profile.indexOf('saveTogetherNicknameV2(');
  const localProfileSaveIndex =
    profile.indexOf(
      'AsyncStorage.setItem(',
      nicknameSaveIndex
    );
  assert.ok(nicknameSaveIndex >= 0);
  assert.ok(localProfileSaveIndex > nicknameSaveIndex);

  const nicknameChanged = (
    draft,
    previous
  ) => String(draft?.name ?? '').trim()
    !== String(previous?.name ?? '').trim();

  assert.equal(
    nicknameChanged(
      { name: '같은 이름', headline: '새 소개' },
      { name: '같은 이름', headline: '이전 소개' }
    ),
    false
  );
  assert.equal(
    nicknameChanged(
      { name: '같은 이름', bio: '새 소개글' },
      { name: '같은 이름', bio: '이전 소개글' }
    ),
    false
  );
  assert.equal(
    nicknameChanged(
      { name: '  같은 이름  ' },
      { name: '같은 이름' }
    ),
    false
  );
  assert.equal(
    nicknameChanged(
      { name: 'Nickname' },
      { name: 'nickname' }
    ),
    true
  );

  const decideNicknameSave = ({
    nextName,
    previousName,
    status,
  }) => {
    const next = String(nextName ?? '').trim();
    const previous = String(previousName ?? '').trim();
    const serverLoaded = status.kind === 'loaded';
    const serverName = serverLoaded
      ? String(status.name ?? '').trim()
      : '';
    const needsServer =
      next !== previous ||
      (serverLoaded && next !== serverName);

    if (!needsServer) return 'general';
    if (!next) return 'unregister';
    if (
      serverLoaded
        ? serverName === ''
        : previous === ''
    ) {
      return 'initial';
    }
    return 'change';
  };

  assert.equal(
    decideNicknameSave({
      nextName: '같은 이름',
      previousName: '같은 이름',
      status: {
        kind: 'loaded',
        name: '같은 이름',
      },
    }),
    'general'
  );
  assert.equal(
    decideNicknameSave({
      nextName: '기존 이름',
      previousName: '기존 이름',
      status: {
        kind: 'loaded',
        name: '',
      },
    }),
    'initial'
  );
  assert.equal(
    decideNicknameSave({
      nextName: '같은 이름',
      previousName: '같은 이름',
      status: { kind: 'unavailable', name: '' },
    }),
    'general'
  );
  assert.equal(
    decideNicknameSave({
      nextName: '같은 이름',
      previousName: '같은 이름',
      status: { kind: 'checking', name: '' },
    }),
    'general'
  );
  assert.equal(
    decideNicknameSave({
      nextName: '새 이름',
      previousName: '이전 이름',
      status: { kind: 'unavailable', name: '' },
    }),
    'change'
  );
  assert.equal(
    decideNicknameSave({
      nextName: '',
      previousName: '기존 이름',
      status: {
        kind: 'loaded',
        name: '기존 이름',
      },
    }),
    'unregister'
  );
  assert.equal(
    decideNicknameSave({
      nextName: '로컬 이름',
      previousName: '로컬 이름',
      status: {
        kind: 'loaded',
        name: '서버 이름',
      },
    }),
    'change'
  );

  console.log(
    'Together nickname v2: PASS'
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
