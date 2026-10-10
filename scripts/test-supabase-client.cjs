const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const client = read('utils/supabaseClient.js');
const auth = read('utils/togetherRemoteAuth.js');
const together = read('screens/TogetherScreen.js');
const inviteDraft = read('screens/TogetherInviteDraftScreen.js');
const inviteAccept = read('screens/TogetherInviteAcceptScreen.js');
const envExample = read('.env.example');
const gitignore = read('.gitignore');
const packageJson = JSON.parse(read('package.json'));

assert.match(client, /EXPO_PUBLIC_SUPABASE_URL/);
assert.match(client, /EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
assert.match(client, /storage:\s*AsyncStorage/);
assert.match(client, /autoRefreshToken:\s*true/);
assert.match(client, /persistSession:\s*true/);
assert.match(client, /detectSessionInUrl:\s*false/);
assert.match(client, /startAutoRefresh/);
assert.match(client, /stopAutoRefresh/);
assert.match(auth, /signInAnonymously/);
assert.match(auth, /getSession/);
assert.match(auth, /getUser/);
assert.match(auth, /scope:\s*['"]local['"]/);
assert.match(auth, /stale local session detected/);
assert.doesNotMatch(together, /ensureTogetherAnonymousSession/);
assert.match(inviteDraft, /ensureTogetherAnonymousSession/);
assert.match(inviteAccept, /ensureTogetherAnonymousSession/);
assert.match(envExample, /^EXPO_PUBLIC_SUPABASE_URL=\s*$/m);
assert.match(envExample, /^EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=\s*$/m);
assert.match(gitignore, /\.env\*\.local/);
assert.ok(packageJson.dependencies['@supabase/supabase-js'], 'missing @supabase/supabase-js');
assert.ok(packageJson.dependencies['react-native-url-polyfill'], 'missing react-native-url-polyfill');

for (const source of [client, auth, together, envExample]) {
  assert.doesNotMatch(
    source,
    new RegExp(['service', '[_-]?', 'role'].join(''), 'i')
  );
  assert.doesNotMatch(
    source,
    new RegExp(['SUPABASE', 'SECRET'].join('_'), 'i')
  );
}

console.log('Supabase client tests: PASS');
