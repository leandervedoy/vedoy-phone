import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Field, Label, PageTitle } from '../components/ui';
import { theme as t } from '../theme';
import { api } from '../lib/api';

type Line = { id: string; phone_number: string; status: string; capabilities: { voice: boolean } };
type Department = { digit: '1' | '2' | '3'; label: string };
type Config = { number: string; enabled: boolean; greeting: string; departments: Department[] };
const initialDepartments: Department[] = [
  { digit: '1', label: 'Vedoy Studio' },
  { digit: '2', label: 'Vedoy Collective' },
  { digit: '3', label: 'Vedoy Assist' },
];
export default function PbxSettings() {
  const [lines, setLines] = useState<Line[]>([]);
  const [line, setLine] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [greeting, setGreeting] = useState('Velkommen til Vedøy. Velg avdeling.');
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ numbers: Line[] }>('/v1/numbers/mine'),
      api<{ config: Config | null }>('/v1/pbx/config'),
    ]).then(([numbers, settings]) => {
      if (!active) return;
      const valid = numbers.numbers.filter(n => n.status === 'active' && n.capabilities?.voice);
      setLines(valid);
      const config = settings.config;
      setLine(config?.number ?? valid[0]?.phone_number ?? '');
      if (config) {
        setGreeting(config.greeting);
        setEnabled(config.enabled);
        if (config.departments.length === 3 && config.departments.every(d => ['1', '2', '3'].includes(d.digit))) {
          setDepartments(config.departments);
        }
      }
    }).catch(e => { if (active) setNotice(e instanceof Error ? e.message : 'Kunne ikke laste oppsettet.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function save() {
    setSaving(true); setNotice('');
    try {
      await api('/v1/pbx/config', {
        method: 'PUT',
        body: JSON.stringify({ number: line, enabled, greeting, departments }),
      });
      setNotice(enabled ? 'Sentralbord lagret og aktivert.' : 'Oppsett lagret. Sentralbordet er deaktivert.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Kunne ikke lagre.');
    } finally { setSaving(false); }
  }
  return <SafeAreaView style={{ flex: 1, backgroundColor: t.color.bg }}>
    <ScrollView contentContainerStyle={{ padding: 22, gap: 16 }}>
      <Pressable onPress={() => router.back()}><Text style={{ color: t.color.green }}>← Tilbake</Text></Pressable>
      <PageTitle eyebrow="VEDOY PBX" title="Bedriftssentralbord" sub="Konfigurer et automatisk tastemeny-svar på en Voice-aktivert linje." />
      <Card style={{ gap: 14 }}>
        <Label>VELG BEDRIFTSNUMMER</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {lines.map(n => <Pressable key={n.id} onPress={() => setLine(n.phone_number)} style={{
            padding: 11, borderRadius: 12, backgroundColor: line === n.phone_number ? t.color.green : t.color.raised,
          }}><Text style={{ color: line === n.phone_number ? t.color.bg : t.color.text }}>{n.phone_number}</Text></Pressable>)}
        </View>
        {!loading && !lines.length ? <Text style={{ color: t.color.muted }}>
          Ingen aktive Voice-numre i Vedoy Phone ennå. Du kan klargjøre systemet, men trenger et nummer før aktivering.
        </Text> : null}
        <Label>VELKOMSTMELDING</Label>
        <Field value={greeting} onChangeText={setGreeting} placeholder="Velkommen til Vedøy..." />
      </Card>
      <Card style={{ gap: 12 }}>
        <Label>TASTEMENY (DTMF)</Label>
        {departments.map((d, index) => <View key={d.digit} style={{ gap: 5 }}>
          <Text style={{ color: t.color.muted }}>Trykk {d.digit} for:</Text>
          <Field value={d.label} onChangeText={value => setDepartments(current =>
            current.map((row, i) => i === index ? { ...row, label: value } : row)
          )} placeholder={'Avdeling ' + d.digit} />
        </View>)}
        <Text style={{ color: t.color.muted, fontSize: 12, lineHeight: 18 }}>
          MVP: Alle valg ringer foreløpig din innloggede Vedoy Phone-app. Separate ansatte og samtalekøer kommer senere.
        </Text>
      </Card>
      <Card style={{ gap: 14 }}>
        <Pressable onPress={() => setEnabled(v => !v)} accessibilityRole="switch" accessibilityState={{ checked: enabled }}>
          <Text style={{ color: enabled ? t.color.green : t.color.text, fontWeight: '700' }}>
            Automatisk svar: {enabled ? 'PÅ' : 'AV'}
          </Text>
        </Pressable>
        <Button title="Lagre PBX-oppsett" onPress={save} disabled={!line || loading} loading={saving} />
      </Card>
      {!!notice && <Text accessibilityLiveRegion="polite" style={{ color: t.color.text }}>{notice}</Text>}
      <Text style={{ color: t.color.muted, fontSize: 12, lineHeight: 19 }}>
        Dette er en pilot basert på Twilios Voice SDK og IVR-eksempel. Ikke aktiver før webhook, migrering, Voice-støtte og anropstest er kontrollert.
      </Text>
    </ScrollView>
  </SafeAreaView>;
}
