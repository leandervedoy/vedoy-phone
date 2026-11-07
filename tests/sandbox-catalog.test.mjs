import assert from 'node:assert/strict';
import test from 'node:test';
import {getSandboxOffers, validateSandboxPurchase, SANDBOX_NUMBER_PRICE} from '../public/sandbox-catalog.mjs';

test('shows exactly five unique fake choices for each supported category', () => {
  for (const country of ['NO', 'US', 'CA']) {
    for (const type of ['local', 'mobile', 'tollFree']) {
      const offers = getSandboxOffers(country, type);
      assert.equal(offers.length, 5);
      assert.equal(new Set(offers.map(o => o.label)).size, 5);
      assert.ok(offers.every(o => o.label.startsWith('TEST-')));
      assert.ok(offers.every(o => !o.label.startsWith('+')));
      assert.ok(offers.every(o => o.priceCredits === SANDBOX_NUMBER_PRICE));
    }
  }
});
test('rejects unknown country or type', () => {
  assert.deepEqual(getSandboxOffers('UK', 'local'), []);
  assert.deepEqual(getSandboxOffers('NO', 'premium'), []);
});
test('owned numbers disappear from the same pool', () => {
  const [first] = getSandboxOffers('NO', 'local');
  const left = getSandboxOffers('NO', 'local', [{label:first.label}]);
  assert.equal(left.length, 4);
  assert.ok(!left.some(o => o.label === first.label));
  assert.equal(getSandboxOffers('US', 'local').length, 5);
});
test('sandbox purchase requires mock identity and enough demo credits', () => {
  const [offer] = getSandboxOffers('NO', 'local');
  const base = {country:'NO', type:'local', offerLabel:offer.label, ownedNumbers:[], credits:100};
  assert.equal(validateSandboxPurchase({...base, verified:false}).ok, false);
  assert.equal(validateSandboxPurchase({...base, verified:true, credits:9}).ok, false);
  assert.equal(validateSandboxPurchase({...base, verified:true, credits:10}).ok, true);
  assert.equal(validateSandboxPurchase({...base, verified:true, credits:0}).ok, false);
});
test('purchase rejects arbitrary IDs and already-owned choices', () => {
  const [offer] = getSandboxOffers('NO', 'local');
  const base = {country:'NO', type:'local', verified:true, credits:100, ownedNumbers:[]};
  assert.equal(validateSandboxPurchase({...base, offerLabel:'REAL+4712345678'}).ok, false);
  assert.equal(validateSandboxPurchase({...base, offerLabel:offer.label, ownedNumbers:[{label:offer.label}]}).ok, false);
});
