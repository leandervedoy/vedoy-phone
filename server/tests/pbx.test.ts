import assert from 'node:assert/strict';
import test from 'node:test';
import { menuSchema } from '../src/pbx.js';
import { clientIdentity } from '../src/identity.js';

const valid = {
  number: '+4712345678',
  enabled: true,
  greeting: 'Velkommen til Vedøy.',
  departments: [
    { digit: '1', label: 'Vedoy Studio' },
    { digit: '2', label: 'Vedoy Collective' },
    { digit: '3', label: 'Vedoy Assist' },
  ],
};
test('valid three-department menu is accepted', () => {
  assert.equal(menuSchema.safeParse(valid).success, true);
});
test('repeated DTMF digit is rejected', () => {
  assert.equal(menuSchema.safeParse({
    ...valid,
    departments: [{ digit: '1', label: 'Studio' }, { digit: '1', label: 'Support' }],
  }).success, false);
});
test('invalid phone number cannot be routed', () => {
  assert.equal(menuSchema.safeParse({ ...valid, number: '000' }).success, false);
});
test('SDK identity encoding is stable and reversible', () => {
  const id = 'user-unique-ä-123';
  const encoded = clientIdentity(id);
  assert.equal(Buffer.from(encoded.slice(2), 'base64url').toString('utf8'), id);
});
