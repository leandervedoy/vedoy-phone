import { createAuthClient } from 'better-auth/react';
import { emailOTPClient, jwtClient } from 'better-auth/client/plugins';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';

const baseURL = process.env.EXPO_PUBLIC_NEON_AUTH_URL;
export const authConfigured = !!baseURL;

export const authClient = createAuthClient({
  baseURL: baseURL ?? 'https://missing.neonauth.invalid',
  plugins: [
    expoClient({
      scheme: 'vedoyconnect',
      storagePrefix: 'vedoy-connect',
      storage: SecureStore,
    }),
    emailOTPClient(),
    jwtClient(),
  ],
});

const listeners = new Set<(signedIn: boolean) => void>();

export function subscribeToAuthChanges(listener: (signedIn: boolean) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyAuthChanged(signedIn: boolean) {
  for (const listener of listeners) listener(signedIn);
}

export async function signOut() {
  const { error } = await authClient.signOut();
  if (error) throw new Error(error.message);
  notifyAuthChanged(false);
}

export async function getAuthToken(): Promise<string> {
  if (!authConfigured) throw new Error('Neon Auth er ikke konfigurert ennå.');
  const { data, error } = await authClient.token();
  if (error) throw new Error(error.message);
  if (!data?.token) throw new Error('Logg inn for å fortsette.');
  return data.token;
}
