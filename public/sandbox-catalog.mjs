// Pure, deterministic demo catalog: no provider access, real phone numbers or payments.
export const SANDBOX_NUMBER_PRICE = 10;
const PREFIXES = Object.freeze({NO: '+47', US: '+1', CA: '+1'});
const TYPES = Object.freeze({local: 'Lokalt', mobile: 'Mobil (test)', tollFree: 'Gratisnummer (test)'});
const OFFER_COUNT = 5;

export function getSandboxOffers(country, type, ownedNumbers = []) {
  if (!Object.hasOwn(PREFIXES, country) || !Object.hasOwn(TYPES, type)) return [];
  const owned = new Set(Array.isArray(ownedNumbers) ? ownedNumbers.map(n => n && n.label) : []);
  return Array.from({length: OFFER_COUNT}, (_, i) => ({
    label: 'TEST-' + country + '-' + type.toUpperCase() + '-' + String(i + 1).padStart(4, '0'),
    country,
    type,
    description: TYPES[type] + ' · ' + PREFIXES[country] + ' · ikke et ekte nummer',
    priceCredits: SANDBOX_NUMBER_PRICE
  })).filter(offer => !owned.has(offer.label));
}

export function validateSandboxPurchase({country, type, offerLabel, ownedNumbers, verified, credits}) {
  if (!verified) return {ok: false, error: 'Gjennomfør simulert BankID-kontroll først.'};
  if (!Number.isSafeInteger(credits) || credits < SANDBOX_NUMBER_PRICE) {
    return {ok: false, error: 'Ikke nok test-Credits. Fyll på demokontoen.'};
  }
  const offer = getSandboxOffers(country, type, ownedNumbers).find(o => o.label === offerLabel);
  if (!offer) return {ok: false, error: 'Velg et tilgjengelig testnummer før du kjøper.'};
  return {ok: true, offer};
}
