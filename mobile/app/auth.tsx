import React, { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { authClient, authConfigured, notifyAuthChanged } from '../lib/auth';
import { Button, Card, Field, PageTitle } from '../components/ui';
import { theme as t } from '../theme';

type AuthMode = 'sign-in' | 'sign-up' | 'verify';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!authConfigured) {
      Alert.alert('Tilkobling mangler', 'Konfigurer Neon Auth URL i appens miljø.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'verify') {
        const verification = await authClient.emailOtp.verifyEmail({ email: email.trim(), otp: otp.trim() });
        if (verification.error) throw new Error(verification.error.message);
        if (!verification.data?.status) throw new Error('Koden kunne ikke bekreftes.');

        const result = await authClient.signIn.email({ email: email.trim(), password });
        if (result.error) throw new Error(result.error.message);
        notifyAuthChanged(true);
        router.replace('/(tabs)');
        return;
      }

      if (mode === 'sign-up') {
        const result = await authClient.signUp.email({
          name: email.trim().split('@')[0] || 'User',
          email: email.trim(),
          password,
        });
        if (result.error) throw new Error(result.error.message);
        setMode('verify');
        Alert.alert('Bekreft e-posten din', 'Skriv inn engangskoden vi har sendt til e-postadressen din.');
        return;
      }

      const result = await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) throw new Error(result.error.message);
      notifyAuthChanged(true);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Kunne ikke logge inn', error instanceof Error ? error.message : 'Prøv igjen senere.');
    } finally {
      setBusy(false);
    }
  }

  async function sendVerificationCode() {
    if (!authConfigured) {
      Alert.alert('Tilkobling mangler', 'Konfigurer Neon Auth URL i appens miljø.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('E-post mangler', 'Skriv inn e-postadressen din først.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim(),
        type: 'email-verification',
      });
      if (error) throw new Error(error.message);
      setMode('verify');
      Alert.alert('Kode sendt', 'Skriv inn engangskoden vi har sendt til e-postadressen din.');
    } catch (error) {
      Alert.alert('Kunne ikke sende kode', error instanceof Error ? error.message : 'Prøv igjen senere.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex:  1, backgroundColor: t.color.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center', gap: 18 }}>
        <PageTitle
          eyebrow="VEDOY CONNECT"
          title={mode === 'verify' ? 'Bekreft e-posten.' : 'Alt på linje.'}
          sub={mode === 'verify'
            ? `Skriv inn koden som ble sendt til ${email}.`
            : 'Logg inn for å koble til numrene og meldingene dine.'}
        />
        <Card style={{ gap: 13 }}>
          {mode !== 'verify' || !email ? (
            <Field
              value={email}
              onChangeText={setEmail}
              placeholder="E-post"
              keyboardType="email-address"
            />
          ) : null}
          {mode === 'verify' ? (
            <Field value={otp} onChangeText={setOtp} placeholder="Engangskode" keyboardType="number-pad" />
          ) : (
            <Field value={password} onChangeText={setPassword} placeholder="Passord" secureTextEntry />
          )}
          <Button
            title={mode === 'verify' ? 'Bekreft og logg inn' : mode === 'sign-up' ? 'Opprett konto' : 'Logg inn'}
            onPress={() => void submit()}
            loading={busy}
          />
          {mode === 'verify' ? (
            <Button title="Send ny kode" onPress={() => void sendVerificationCode()} secondary disabled={busy} />
          ) : (
            <Button
              title={mode === 'sign-up' ? 'Jeg har allerede en konto' : 'Opprett konto'}
              onPress={() => setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')}
              secondary
              disabled={busy}
            />
          )}
          {mode === 'sign-in' ? (
            <Text onPress={() => void sendVerificationCode()} style={{ color: t.color.muted, textAlign: 'center' }}>
              Trenger du en e-postbekreftelseskode?
            </Text>
          ) : null}
          {mode === 'verify' ? (
            <Text
              onPress={() => setMode('sign-in')}
              style={{ color: t.color.muted, textAlign: 'center' }}
            >
              Tilbake til innlogging
            </Text>
          ) : null}
        </Card>
        <Text style={{ color: t.color.dim, textAlign: 'center' }}>
          Samtaler og meldinger lagres sikkert på kontoen.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
