import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Card, Button, PageTitle, Label } from '../components/ui';
import { theme as t } from '../theme';
import { api } from '../lib/api';

type FileItem = {
  uri: string;
  name: string;
  type: string;
  kind: 'identity' | 'address_proof';
};

export default function Kyc() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ikke sendt');

  useEffect(() => {
    api<{ submissions: { status: string }[] }>('/v1/kyc/status')
      .then(result => {
        const latest = result.submissions[0]?.status;
        if (latest) setStatus(latest === 'pending' ? 'Venter på godkjenning' : latest);
      })
      .catch(() => {});
  }, []);

  async function pick(kind: FileItem['kind'], camera = false) {
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Kameratilgang nødvendig');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
      if (!result.canceled) {
        setFiles(current => [...current, {
          uri: result.assets[0].uri,
          name: `document-${Date.now()}.jpg`,
          type: 'image/jpeg',
          kind,
        }]);
      }
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled) {
      setFiles(current => [...current, {
        uri: result.assets[0].uri,
        name: result.assets[0].name,
        type: result.assets[0].mimeType || 'application/pdf',
        kind,
      }]);
    }
  }

  async function submit() {
    setBusy(true);
    try {
      const documents: { path: string; kind: FileItem['kind'] }[] = [];
      for (const file of files) {
        const response = await fetch(file.uri);
        if (!response.ok) throw new Error(`Kunne ikke lese filen ${file.name}.`);
        const blob = await response.blob();
        if (blob.size === 0) throw new Error(`${file.name} er tom.`);
        if (blob.size > 10 * 1024 * 1024) throw new Error('Hver fil må være under 10 MB.');
        const uploaded = await api<{ path: string }>('/v1/kyc/documents', {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: blob,
        });
        documents.push({ path: uploaded.path, kind: file.kind });
      }

      await api('/v1/kyc/submissions', {
        method: 'POST',
        body: JSON.stringify({ documents }),
      });
      setStatus('Venter på godkjenning');
      setFiles([]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Innsending feilet');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.color.bg }}>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 15 }}>
        <PageTitle
          eyebrow="IDENTITET"
          title="Bekreft profilen"
          sub="Dokumentkrav avhenger av land og nummertype. Last opp kun det som trengs for ditt valg."
        />
        <Card>
          <Label>STATUS</Label>
          <Text style={{ color: t.color.green, fontWeight: '800', fontSize: 18, marginTop: 9 }}>{status}</Text>
        </Card>
        <Button title="Ta bilde av ID" secondary onPress={() => void pick('identity', true)} />
        <Button title="Velg ID-fil" secondary onPress={() => void pick('identity')} />
        <Button title="Ta bilde av adressebevis" secondary onPress={() => void pick('address_proof', true)} />
        <Button title="Velg adressebevis" secondary onPress={() => void pick('address_proof')} />
        {files.map(file => (
          <Text key={file.uri} style={{ color: t.color.muted }}>
            ↗ {file.kind === 'identity' ? 'ID' : 'Adressebevis'} · {file.name}
          </Text>
        ))}
        <Button
          title="Send til gjennomgang"
          onPress={() => void submit()}
          loading={busy}
          disabled={!files.length}
        />
        <Text style={{ color: t.color.dim, fontSize: 12, lineHeight: 18 }}>
          Dokumenter lastes opp til privat Neon Object Storage. De deles kun med behandlingen av nummerkravet
          i henhold til Vedøys personvernregler.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
