import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
const rulesText = fs.readFileSync(rulesPath, 'utf8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8')) as {
  firestore: Record<string, unknown>;
};

test('firestore.rules enforces rules_version 2 and default-deny catch-all', () => {
  assert.match(rulesText, /rules_version\s*=\s*'2';/);
  assert.match(rulesText, /match\s+\/\{document=\*\*\}\s*\{\s*allow read, write:\s*if false;\s*\}/);
});

test('firestore.rules covers every collection defined in firebase-blueprint.json', () => {
  const expectedMatches = [
    'match /users/{userId}',
    'match /settings/{settingId}',
    'match /bots/{botId}',
    'match /goals/{goalId}',
    'match /calendarEvents/{eventId}',
    'match /presets/{presetId}',
  ];
  assert.equal(Object.keys(blueprint.firestore).length, expectedMatches.length);
  for (const segment of expectedMatches) {
    assert.ok(rulesText.includes(segment), `Missing match block: ${segment}`);
  }
});

test('firestore.rules blocks blanket reads/lists and enforces owner checks and server timestamps', () => {
  assert.equal(/allow\s+read:\s*if\s+isSignedIn\(\)/.test(rulesText), false);
  assert.equal(/allow\s+list:\s*if\s+isSignedIn\(\)\s*;/.test(rulesText), false);
  assert.match(rulesText, /allow list:\s*if false;/);
  assert.match(rulesText, /incoming\(\)\.syncedAt == request\.time/);
  assert.match(rulesText, /hasParentUser\(userId\)/);
  assert.match(rulesText, /affectedKeys\(\)\.hasOnly/);
});
