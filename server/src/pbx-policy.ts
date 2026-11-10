/** Pure PBX input rules; shared by HTTP handlers and offline tests. */
export const MAX_PBX_SELECTIONS_PER_NUMBER_PER_DAY = 100;
export const MAX_PBX_RING_SECONDS = 25;
export const MAX_PBX_CALL_SECONDS = 600;
export function validCallSid(sid: string): boolean {
  return /^CA[a-f0-9]{32}$/i.test(sid);
}
export function validE164(number: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(number);
}
export function canDialPbx(input: {
  to: string;
  callSid: string;
  digit: string;
  allowedDigits: readonly string[];
}): 'invalid-number' | 'invalid-call' | 'invalid-selection' | 'dial' {
  if (!validE164(input.to)) return 'invalid-number';
  if (!validCallSid(input.callSid)) return 'invalid-call';
  if (!input.allowedDigits.includes(input.digit)) return 'invalid-selection';
  return 'dial';
}
