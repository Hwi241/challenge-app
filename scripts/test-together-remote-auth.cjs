const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'utils', 'togetherRemoteAuth.js');
const source = fs.readFileSync(filename, 'utf8');

const loadAuthModule = ({ client = null, configuration = {
  configured: false,
  missing: ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
} } = {}) => {
  const code = babel.transformSync(source, {
    filename,
    presets: [['babel-preset-expo', { jsxRuntime: 'automatic' }]],
    babelrc: false,
    configFile: false,
  }).code;
  const moduleObject = { exports: {} };
  const localRequire = (request) => request === './supabaseClient'
    ? {
        getSupabaseClient: () => client,
        getSupabaseConfiguration: () => configuration,
      }
    : require(request);
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(
    localRequire,
    moduleObject,
    moduleObject.exports
  );
  return moduleObject.exports;
};

const configured = { configured: true, missing: [] };

(async () => {
  {
    const result = await loadAuthModule().ensureTogetherAnonymousSession();
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'not_configured');
  }

  {
    let getUserCalls = 0;
    let anonymousCalls = 0;
    let signOutCalls = 0;
    const client = { auth: {
      getSession: async () => ({ data: { session: { user: { id: 'existing-local' } } }, error: null }),
      getUser: async () => {
        getUserCalls += 1;
        return { data: { user: { id: 'existing-server' } }, error: null };
      },
      signOut: async () => {
        signOutCalls += 1;
        return { error: null };
      },
      signInAnonymously: async () => {
        anonymousCalls += 1;
        return { data: {}, error: null };
      },
    } };
    const result = await loadAuthModule({ client, configuration: configured }).ensureTogetherAnonymousSession();
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'existing_session');
    assert.equal(result.userId, 'existing-server');
    assert.equal(result.created, false);
    assert.equal(getUserCalls, 1);
    assert.equal(signOutCalls, 0);
    assert.equal(anonymousCalls, 0);
  }

  {
    let signOutCalls = 0;
    let anonymousCalls = 0;
    let signOutScope = null;
    const client = { auth: {
      getSession: async () => ({ data: { session: { user: { id: 'stale-local' } } }, error: null }),
      getUser: async () => ({ data: { user: null }, error: { message: 'invalid session' } }),
      signOut: async (options) => {
        signOutCalls += 1;
        signOutScope = options?.scope;
        return { error: null };
      },
      signInAnonymously: async () => {
        anonymousCalls += 1;
        return { data: { user: { id: 'new-anonymous' } }, error: null };
      },
    } };
    const result = await loadAuthModule({ client, configuration: configured }).ensureTogetherAnonymousSession();
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'anonymous_session_created');
    assert.equal(result.userId, 'new-anonymous');
    assert.equal(result.created, true);
    assert.equal(signOutCalls, 1);
    assert.equal(signOutScope, 'local');
    assert.equal(anonymousCalls, 1);
  }

  {
    let anonymousCalls = 0;
    let releaseSession;
    const gate = new Promise((resolve) => { releaseSession = resolve; });
    const client = { auth: {
      getSession: async () => {
        await gate;
        return { data: { session: null }, error: null };
      },
      getUser: async () => ({ data: { user: null }, error: null }),
      signOut: async () => ({ error: null }),
      signInAnonymously: async () => {
        anonymousCalls += 1;
        return { data: { user: { id: 'anonymous-user' } }, error: null };
      },
    } };
    const auth = loadAuthModule({ client, configuration: configured });
    const firstPromise = auth.ensureTogetherAnonymousSession();
    const secondPromise = auth.ensureTogetherAnonymousSession();
    releaseSession();
    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    assert.equal(first.ok, true);
    assert.equal(first.reason, 'anonymous_session_created');
    assert.equal(second.userId, 'anonymous-user');
    assert.equal(anonymousCalls, 1);
  }

  {
    let anonymousCalls = 0;
    const client = { auth: {
      getSession: async () => ({ data: { session: { user: { id: 'stale-local' } } }, error: null }),
      getUser: async () => ({ data: { user: null }, error: { message: 'invalid session' } }),
      signOut: async () => ({ error: { message: 'local clear failed' } }),
      signInAnonymously: async () => {
        anonymousCalls += 1;
        return { data: { user: { id: 'replacement-user' } }, error: null };
      },
    } };
    const result = await loadAuthModule({ client, configuration: configured }).ensureTogetherAnonymousSession();
    assert.equal(result.ok, true);
    assert.equal(result.userId, 'replacement-user');
    assert.equal(anonymousCalls, 1);
  }

  {
    const client = { auth: {
      getSession: async () => ({ data: { session: null }, error: { message: 'read failed' } }),
      getUser: async () => ({ data: {}, error: null }),
      signOut: async () => ({ error: null }),
      signInAnonymously: async () => ({ data: {}, error: null }),
    } };
    const result = await loadAuthModule({ client, configuration: configured }).ensureTogetherAnonymousSession();
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'session_read_failed');
  }

  {
    const client = { auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: {}, error: null }),
      signOut: async () => ({ error: null }),
      signInAnonymously: async () => ({ data: {}, error: { message: 'anonymous disabled' } }),
    } };
    const result = await loadAuthModule({ client, configuration: configured }).ensureTogetherAnonymousSession();
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'anonymous_sign_in_failed');
  }

  console.log('Together remote auth tests: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
