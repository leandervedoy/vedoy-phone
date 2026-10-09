import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';

const baseURL=process.env.EXPO_PUBLIC_NEON_AUTH_BASE_URL||'https://ep-spring-sound-b1nnydrd.neonauth.c-5.eu-central-1.aws.neon.tech/neondb/auth';
export const authClient=createAuthClient({baseURL,fetchOptions:{headers:{Origin:'https://vedoy-phone.vercel.app'}},plugins:[expoClient({scheme:'vedoyphone',storagePrefix:'vedoy-phone',storage:SecureStore})]});
export async function signOut(){await authClient.signOut();}
export async function getAuthCookie(){return await authClient.getCookie();}
