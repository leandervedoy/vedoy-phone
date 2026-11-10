import assert from 'node:assert/strict';
import test from 'node:test';
import { canDialPbx, validCallSid, validE164, MAX_PBX_SELECTIONS_PER_NUMBER_PER_DAY } from '../src/pbx-policy.js';
const sid = 'CA' + 'a'.repeat(32);
const base = { to: '+4712345678', callSid: sid, digit: '1', allowedDigits: ['1', '2', '3'] };
for (const digit of ['1','2','3']) test('policy: selection ' + digit + ' accepted', () => {
  assert.equal(canDialPbx({...base,digit}), 'dial');
});
for (const digit of ['0','4','9','','12']) test('policy: selection ' + JSON.stringify(digit) + ' rejected', () => {
  assert.equal(canDialPbx({...base,digit}), 'invalid-selection');
});
test('policy: invalid sid does not dial',()=>assert.equal(canDialPbx({...base,callSid:'bad'}),'invalid-call'));
test('policy: missing sid does not dial',()=>assert.equal(canDialPbx({...base,callSid:''}),'invalid-call'));
test('policy: invalid destination does not dial',()=>assert.equal(canDialPbx({...base,to:'invalid'}),'invalid-number'));
test('policy: sid and E164 requirements',()=>{
  assert.equal(validCallSid(sid),true);
  assert.equal(validCallSid('CA'+'x'.repeat(32)),false);
  assert.equal(validE164('+4712345678'),true);
});
test('policy: finite daily cap',()=>assert.equal(MAX_PBX_SELECTIONS_PER_NUMBER_PER_DAY,100));
