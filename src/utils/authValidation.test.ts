import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapFirebaseAuthError,
  normalizeLoginIdToEmail,
  stripUndefinedDeep,
  validateSignInForm,
  validateSignUpForm,
} from './authValidation';

test('normalizeLoginIdToEmail maps plain IDs to synthetic domain and preserves valid emails', () => {
  const plain = normalizeLoginIdToEmail('  Pineapple_01 ');
  assert.equal(plain.ok, true);
  assert.equal(plain.email, 'pineapple_01@pineapple-studio.app');
  assert.equal(plain.displayId, 'pineapple_01');

  const email = normalizeLoginIdToEmail('Creator@Example.COM');
  assert.equal(email.ok, true);
  assert.equal(email.email, 'creator@example.com');
  assert.equal(email.displayId, 'creator@example.com');

  const invalid = normalizeLoginIdToEmail('ab');
  assert.equal(invalid.ok, false);
});

test('validateSignUpForm enforces password length and confirmation match', () => {
  const shortPw = validateSignUpForm({
    loginId: 'writer01',
    displayName: '작가님',
    password: '123',
    confirmPassword: '123',
  });
  assert.equal(shortPw.ok, false);

  const mismatch = validateSignUpForm({
    loginId: 'writer01',
    displayName: '작가님',
    password: 'password123',
    confirmPassword: 'password456',
  });
  assert.equal(mismatch.ok, false);

  const valid = validateSignUpForm({
    loginId: 'writer01',
    displayName: '',
    password: 'password123',
    confirmPassword: 'password123',
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.displayName, 'writer01');
  assert.equal(valid.email, 'writer01@pineapple-studio.app');
});

test('validateSignInForm checks ID and non-empty password', () => {
  assert.equal(validateSignInForm({ loginId: 'writer01', password: '' }).ok, false);
  const res = validateSignInForm({ loginId: 'writer01', password: 'secret' });
  assert.equal(res.ok, true);
  assert.equal(res.email, 'writer01@pineapple-studio.app');
});

test('mapFirebaseAuthError surfaces email provider setup guidance on operation-not-allowed', () => {
  const mapped = mapFirebaseAuthError({ code: 'auth/operation-not-allowed' });
  assert.equal(mapped.needsEmailProviderSetup, true);
  assert.match(mapped.message, /이메일\/비밀번호/);

  const wrongCred = mapFirebaseAuthError({ code: 'auth/invalid-credential' });
  assert.equal(wrongCred.needsEmailProviderSetup, false);
});

test('stripUndefinedDeep removes undefined keys recursively for Firestore payloads', () => {
  const cleaned = stripUndefinedDeep({
    id: 'bot_1',
    coverImage: undefined,
    nested: { a: 1, b: undefined },
    arr: [{ x: 1, y: undefined }],
  });
  assert.equal('coverImage' in cleaned, false);
  assert.equal('b' in cleaned.nested, false);
  assert.equal('y' in cleaned.arr[0], false);
  assert.equal(cleaned.nested.a, 1);
});
