import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, Platform, Pressable, Text, View } from 'react-native';
import { Call, CallInvite, Voice } from '@twilio/voice-react-native-sdk';
import { authClient, authConfigured, subscribeToAuthChanges } from '../lib/auth';
import { api } from '../lib/api';
import { theme as t } from '../theme';

type VoiceState = {
  client: Voice;
  token: string;
  incoming: CallInvite | null;
  activeCall: Call | null;
  callState: string;
  error: string;
  answer: () => Promise<void>;
  reject: () => Promise<void>;
  hangup: () => Promise<void>;
  mute: () => Promise<void>;
  dial: (to: string, callerId: string) => Promise<void>;
};

const Context = createContext<VoiceState | null>(null);

export function useVoice() {
  const state = useContext(Context);
  if (!state) throw new Error('VoiceProvider is not mounted');
  return state;
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new Voice());
  const [token, setToken] = useState('');
  const [incoming, setIncoming] = useState<CallInvite | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [callState, setCallState] = useState('');
  const [error, setError] = useState('');
  const tokenRef = useRef('');
  const currentInvite = useRef<CallInvite | null>(null);
  const registered = useRef(false);

  const clearSession = useCallback(() => {
    if (tokenRef.current && registered.current) {
      void client.unregister(tokenRef.current).catch(() => {});
    }
    tokenRef.current = '';
    registered.current = false;
    setToken('');
    setIncoming(null);
    setActiveCall(null);
  }, [client]);

  const refreshToken = useCallback(async () => {
    const response = await api<{ token: string; incomingConfigured: boolean }>('/v1/voice/token', {
      method: 'POST',
      body: JSON.stringify({ platform: Platform.OS }),
    });
    const previousToken = tokenRef.current;
    tokenRef.current = response.token;
    setToken(response.token);

    if (response.incomingConfigured) {
      if (registered.current && previousToken) await client.unregister(previousToken);
      await client.register(response.token);
      registered.current = true;
    } else if (registered.current && previousToken) {
      await client.unregister(previousToken);
      registered.current = false;
    }
  }, [client]);

  const track = useCallback((call: Call) => {
    setActiveCall(call);
    setIncoming(null);
    setCallState('Tilkobler');
    call.on(Call.Event.Connected, () => setCallState('Tilkoblet'));
    call.on(Call.Event.Reconnecting, () => setCallState('Gjenoppretter forbindelsen'));
    call.on(Call.Event.Reconnected, () => setCallState('Tilkoblet'));
    call.on(Call.Event.Disconnected, () => {
      setActiveCall(null);
      setCallState('');
    });
  }, []);

  useEffect(() => {
    const onInvite = (invite: CallInvite) => {
      currentInvite.current = invite;
      setIncoming(invite);
      setError('');
      invite.on(CallInvite.Event.Cancelled, () => {
        currentInvite.current = null;
        setIncoming(null);
      });
    };
    const onError = (voiceError: Error) => setError(voiceError.message);
    client.on(Voice.Event.CallInvite, onInvite);
    client.on(Voice.Event.Error, onError);

    const unsubscribe = subscribeToAuthChanges(signedIn => {
      if (signedIn) {
        void refreshToken().catch(cause => setError(
          cause instanceof Error ? cause.message : 'Kunne ikke registrere anropslinjen',
        ));
      } else {
        clearSession();
      }
    });

    const refreshForSession = async () => {
      if (!authConfigured) return;
      try {
        const { data, error: sessionError } = await authClient.getSession();
        if (sessionError) throw new Error(sessionError.message);
        if (data?.session) {
          await refreshToken();
        } else {
          clearSession();
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Kunne ikke oppdatere anropslinjen');
      }
    };

    void refreshForSession();
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') void refreshForSession();
    });
    const refresh = setInterval(() => {
      if (tokenRef.current) void refreshForSession();
    }, 12 * 60 * 1000);

    return () => {
      clearInterval(refresh);
      appState.remove();
      unsubscribe();
      client.off(Voice.Event.CallInvite, onInvite);
      client.off(Voice.Event.Error, onError);
      if (tokenRef.current && registered.current) {
        void client.unregister(tokenRef.current).catch(() => {});
      }
    };
  }, [client, clearSession, refreshToken]);

  const answer = useCallback(async () => {
    const invite = currentInvite.current;
    if (!invite) return;
    try {
      track(await invite.accept());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kunne ikke svare på anropet');
      setIncoming(null);
      currentInvite.current = null;
    }
  }, [track]);

  const reject = useCallback(async () => {
    const invite = currentInvite.current;
    if (!invite) return;
    try {
      await invite.reject();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kunne ikke avslå anropet');
    } finally {
      setIncoming(null);
      currentInvite.current = null;
    }
  }, []);

  const hangup = useCallback(async () => {
    try {
      if (activeCall) await activeCall.disconnect();
      else await reject();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kunne ikke avslutte samtalen');
    } finally {
      setActiveCall(null);
      setIncoming(null);
    }
  }, [activeCall, reject]);

  const mute = useCallback(async () => {
    if (activeCall) await activeCall.mute(!activeCall.isMuted());
  }, [activeCall]);

  const dial = useCallback(async (to: string, callerId: string) => {
    if (!tokenRef.current) await refreshToken();
    const call = await client.connect(tokenRef.current, { params: { To: to.replace(/\s/g, ''), CallerId: callerId } });
    track(call);
  }, [client, refreshToken, track]);

  const value = useMemo(() => ({
    client,
    token,
    incoming,
    activeCall,
    callState,
    error,
    answer,
    reject,
    hangup,
    mute,
    dial,
  }), [client, token, incoming, activeCall, callState, error, answer, reject, hangup, mute, dial]);

  return (
    <Context.Provider value={value}>
      {children}
      <Modal
        visible={!!incoming || !!activeCall}
        transparent
        animationType="fade"
        onRequestClose={() => { if (incoming) void reject(); }}
      >
        <View style={{ flex: 1, backgroundColor: '#000B', justifyContent: 'center', padding: 24 }}>
          <View style={{
            backgroundColor: t.color.surface,
            borderColor: t.color.border,
            borderWidth: 1,
            borderRadius: 28,
            padding: 24,
            gap: 15,
          }}>
            <Text style={{ color: t.color.green, fontSize: 12, fontWeight: '800', letterSpacing: 1.3 }}>
              {incoming ? 'INNKOMMENDE ANROP' : 'VEDOY VOICE'}
            </Text>
            <Text style={{ color: t.color.text, fontSize: 25, fontWeight: '800' }}>
              {incoming?.getFrom() ?? activeCall?.getFrom() ?? callState}
            </Text>
            {error ? <Text style={{ color: t.color.danger }}>{error}</Text> : null}
            {incoming ? (
              <>
                <Pressable
                  onPress={() => void answer()}
                  style={{ backgroundColor: t.color.green, padding: 16, borderRadius: 14, alignItems: 'center' }}
                >
                  <Text style={{ color: t.color.bg, fontWeight: '800' }}>Svar</Text>
                </Pressable>
                <Pressable
                  onPress={() => void reject()}
                  style={{ padding: 15, borderRadius: 14, alignItems: 'center', backgroundColor: t.color.raised }}
                >
                  <Text style={{ color: t.color.text, fontWeight: '700' }}>Avslå</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={{ color: t.color.muted }}>{callState}</Text>
                <Pressable
                  onPress={() => void mute()}
                  style={{ padding: 15, borderRadius: 14, alignItems: 'center', backgroundColor: t.color.raised }}
                >
                  <Text style={{ color: t.color.text, fontWeight: '700' }}>Demp / åpne mikrofon</Text>
                </Pressable>
                <Pressable
                  onPress={() => void hangup()}
                  style={{ backgroundColor: t.color.danger, padding: 16, borderRadius: 14, alignItems: 'center' }}
                >
                  <Text style={{ color: t.color.bg, fontWeight: '800' }}>Avslutt samtale</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </Context.Provider>
  );
}
