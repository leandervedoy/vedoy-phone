/** Shared Twilio client identity between access tokens and inbound routing. */
export function clientIdentity(userId: string): string {
  return 'v_' + Buffer.from(userId, 'utf8').toString('base64url');
}
