import { normalizeSiteUrl } from '@studium/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button, Txt } from '@/components/ui';
import { parseImported, saveProfile } from '@/lib/profile';
import { space, type, usePalette } from '@/lib/theme';

/** First step for a new student: which university platform to connect to. */
export default function Setup() {
  const c = usePalette();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [json, setJson] = useState('');

  const next = () => {
    try {
      const site = normalizeSiteUrl(url);
      setError(null);
      router.push({ pathname: '/login', params: { setup: site } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const doImport = async () => {
    try {
      const profile = parseImported(json);
      await saveProfile(profile);
      setError(null);
      router.push('/login');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const input = [
    type.body,
    styles.input,
    { color: c.text, backgroundColor: c.surface, borderColor: c.border },
  ];

  return (
    <KeyboardAvoidingView behavior="height" style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled" testID="setup">
        <View style={{ gap: space.sm }}>
          <Txt variant="title">Collega la tua università</Txt>
          <Txt variant="body" color="textMuted">
            Incolla l’indirizzo che apri nel browser per entrare nell’area studenti. Poi accedi come sempre:
            Studium riconosce la piattaforma da solo.
          </Txt>
        </View>

        {!importing ? (
          <View style={{ gap: space.md }}>
            <TextInput
              testID="setup-url"
              value={url}
              onChangeText={setUrl}
              placeholder="https://"
              placeholderTextColor={c.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              inputMode="url"
              returnKeyType="go"
              onSubmitEditing={next}
              style={input}
              accessibilityLabel="Indirizzo della piattaforma studenti"
            />
            {error ? (
              <Txt variant="small" color="danger" testID="setup-error">
                {error}
              </Txt>
            ) : null}
            <Button testID="setup-continue" label="Continua" icon="arrow-right" onPress={next} />
            <Txt variant="caption" color="textMuted">
              Funziona con le piattaforme Chamilo dotate della web app studenti e della relativa API.
              L’accesso avviene sempre sulla pagina ufficiale.
            </Txt>
            <Button
              kind="quiet"
              label="Ho un file di configurazione"
              icon="file-import-outline"
              onPress={() => setImporting(true)}
            />
          </View>
        ) : (
          <View style={{ gap: space.md }}>
            <Txt variant="body">Incolla la configurazione esportata da Studium su un altro telefono.</Txt>
            <TextInput
              testID="setup-json"
              value={json}
              onChangeText={setJson}
              multiline
              placeholder='{"id": …}'
              placeholderTextColor={c.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[input, { minHeight: 160, textAlignVertical: 'top' }]}
            />
            {error ? (
              <Txt variant="small" color="danger">
                {error}
              </Txt>
            ) : null}
            <Button label="Usa questa configurazione" icon="check" onPress={doImport} />
            <Button kind="quiet" label="Inserisci un indirizzo" onPress={() => setImporting(false)} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { padding: space.xl, gap: space.xl, paddingTop: space.xxl },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: space.lg, paddingVertical: 14 },
});
