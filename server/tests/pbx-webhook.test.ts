import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import twilio from 'twilio';
import { db } from '../src/clients.js';
import { env } from '../src/config.js';
import { pbxWebhook, maybeHandlePbxInbound } from '../src/pbx.js';
import { MAX_PBX_SELECTIONS_PER_NUMBER_PER_DAY } from '../src/pbx-policy.js';

/** HTTP integration tests: no Twilio account, live numbers, or database required. */
const destination = '+4712345678';
const sid = 'CA' + 'a'.repeat(32);
const owner = 'test-owner';
const menu = {
  user_id: owner, phone_number: destination, enabled: true,
  greeting: 'Velkommen til Vedoy',
  departments: [
    { digit: '1', label: 'Vedoy Studio' },
    { digit: '2', label: 'Vedoy Collective' },
    { digit: '3', label: 'Vedoy Assist' },
  ],
};
const dbOriginalQuery = db.query.bind(db);
const dbOriginalConnect = db.connect.bind(db);
let enabled = true;
let stored = new Set<string>();
let total = 0;
let failTransaction = false;
let migrationMissing = false;
let insertedDigits: string[] = [];

function mockDatabase() {
  // Never connect to a real database. Each fake client serializes the scenario.
  (db as any).query = async (sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM phone.pbx_menus')) {
      if (migrationMissing) throw Object.assign(new Error('relation missing'), {code:'42P01'});
      const active = enabled && sql.includes('p.phone_number=$1') && params[0] === destination;
      return { rows: active ? [menu] : [], rowCount: active ? 1 : 0 };
    }
    throw new Error('Unexpected pool query: ' + sql);
  };
  (db as any).connect = async () => ({
    query: async (sql: string, params: unknown[] = []) => {
      if (failTransaction && sql.includes('SELECT count(*)')) throw new Error('Mock DB failure');
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK' || sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT call_sid FROM phone.pbx_call_selections')) return { rows: stored.has(String(params[0])) ? [{call_sid: params[0]}] : [], rowCount: stored.has(String(params[0])) ? 1 : 0 };
      if (sql.includes('SELECT count(*)')) return { rows: [{total}], rowCount: 1 };
      if (sql.includes('INSERT INTO phone.pbx_call_selections')) {
        const callSid = String(params[0]);
        if (stored.has(callSid)) return { rows: [], rowCount: 0 };
        stored.add(callSid); total++; insertedDigits.push(String(params[3]));
        return { rows: [{call_sid:callSid}], rowCount: 1 };
      }
      throw new Error('Unexpected transaction query: ' + sql);
    },
    release: () => {},
  });
}
mockDatabase();
const local = express();
local.use(express.urlencoded({ extended: false }));
local.use('/webhooks/twilio/voice', pbxWebhook);
const server = local.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const port = (server.address() as {port:number}).port;
const targetPath = '/webhooks/twilio/voice/pbx-menu';
// Middleware reconstructs the externally configured URL, not the local test port.
const signatureUrl = env.PUBLIC_BASE_URL.replace(/\/$/, '') + targetPath;
function reset() { enabled = true; stored = new Set(); total = 0; failTransaction = false; migrationMissing = false; insertedDigits = []; }
async function send(params: Record<string,string>, signed = true, signatureOverride?: string) {
  const body = new URLSearchParams(params).toString();
  const sig = signatureOverride ?? twilio.getExpectedTwilioSignature(env.TWILIO_AUTH_TOKEN, signatureUrl, params);
  const response = await fetch('http://127.0.0.1:' + port + targetPath, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...(signed ? {'X-Twilio-Signature':sig} : {}) },
    body,
  });
  return {status: response.status, xml: await response.text()};
}
const valid = { To: destination, CallSid: sid, Digits: '1' };
test.after(() => {
  server.close();
  (db as any).query = dbOriginalQuery;
  (db as any).connect = dbOriginalConnect;
});

for (const digit of ['1', '2', '3']) test('signed Twilio callback routes digit ' + digit, async () => {
  reset();
  const {status, xml} = await send({...valid, Digits:digit});
  assert.equal(status, 200);
  assert.match(xml, /<Dial/);
  assert.match(xml, /<Client>v_/);
  assert.deepEqual(insertedDigits, [digit]);
});
for (const digit of ['0','4','']) test('invalid or missing selection does not dial ' + JSON.stringify(digit), async () => {
  reset();
  const {status, xml} = await send({...valid, Digits: digit});
  assert.equal(status, 200);
  assert.doesNotMatch(xml, /<Dial/);
  assert.equal(total, 0);
});
test('missing signature rejected', async () => {
  reset(); const r = await send(valid,false);
  assert.equal(r.status,403); assert.equal(total,0);
});
test('tampered signed payload rejected', async () => {
  reset();
  const sig = twilio.getExpectedTwilioSignature(env.TWILIO_AUTH_TOKEN,signatureUrl,valid);
  const r = await send({...valid, Digits:'2'},true,sig);
  assert.equal(r.status,403); assert.equal(total,0);
});
test('invalid and missing CallSid rejected', async () => {
  for (const bad of ['','not-a-valid-sid']) {
    reset(); const r = await send({...valid,CallSid:bad});
    assert.equal(r.status,400); assert.equal(total,0);
  }
});
test('deactivated PBX does not dial', async () => {
  reset(); enabled=false;
  const r = await send(valid);
  assert.equal(r.status,200); assert.doesNotMatch(r.xml,/<Dial/);
  assert.equal(total,0);
});
test('replayed signed webhook never dials twice', async () => {
  reset();
  const first = await send(valid); const second=await send(valid);
  assert.match(first.xml,/<Dial/); assert.doesNotMatch(second.xml,/<Dial/);
  assert.equal(total,1);
});
test('daily forwarding cap produces safe hangup', async () => {
  reset(); total=MAX_PBX_SELECTIONS_PER_NUMBER_PER_DAY;
  const r = await send(valid);
  assert.equal(r.status,200);assert.doesNotMatch(r.xml,/<Dial/);assert.equal(insertedDigits.length,0);
});
test('DB failure does not forward an unrecorded call', async () => {
  reset(); failTransaction=true;
  const r = await send(valid);
  assert.equal(r.status,500); assert.doesNotMatch(r.xml,/<Dial/);
});
test('inactive PBX preserves original flow dispatch condition', async () => {
  reset(); enabled=false;
  const res = {type(){return this;},send(){return this;}} as any;
  assert.equal(await maybeHandlePbxInbound(destination,res),false);
});

test('missing PBX migration preserves legacy inbound routing', async () => {
  reset(); migrationMissing=true;
  const res = {type(){return this;},send(){return this;}} as any;
  assert.equal(await maybeHandlePbxInbound(destination,res), false);
});

test('unowned destination has no active PBX menu', async () => {
  reset();
  const r=await send({...valid,To:'+4798765432'});
  assert.equal(r.status,200); assert.doesNotMatch(r.xml,/<Dial/);
  assert.equal(total,0);
});
