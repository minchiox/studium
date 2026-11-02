import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  normalizeSiteUrl,
  type PlatformProfile,
  ProfileValidationError,
  type ProfileViolation,
  profileHosts,
} from '@studium/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button, Callout, Card, Txt } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { parseImported, saveProfile, violationText } from '@/lib/profile';
import { radius, space, type, usePalette } from '@/lib/theme';

const FIELD_LABEL: Record<string, string> = {
  spaUrl: 'Area studenti',
  apiBase: 'API',
  portalUrl: 'Portale',
  mediaHost: 'Video e dispense',
  subtitleHost: 'Sottotitoli',
  logoutUrl: 'Uscita',
};

type ImportState =
  | { kind: 'editing' }
  | { kind: 'confirm'; profile: PlatformProfile }
  | { kind: 'rejected'; violations: readonly ProfileViolation[] };

/** First step for a new student: which university platform to connect to. */
export default function Setup() {
  const c = usePalette();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [json, setJson] = useState('');
  const [state, setState] = useState<ImportState>({ kind: 'editing' });
  const [saving, setSaving] = useState(false);

  const next = () => {
    try {
      const site = normalizeSiteUrl(url);
      setError(null);
      router.push({ pathname: '/login', params: { setup: site } });
    } catch (e) {
      haptics.error();
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Step 1: parse and validate. Nothing is saved yet.
  const check = () => {
    setError(null);
    try {
      const profile = parseImported(json);
      haptics.warning();
      setState({ kind: 'confirm', profile });
    } catch (e) {
      haptics.error();
      if (e instanceof ProfileValidationError) setState({ kind: 'rejected', violations: e.violations });
      else setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Step 2: the student has seen the domains and confirms them.
  const confirm = async (profile: PlatformProfile) => {
    setSaving(true);
    try {
      await saveProfile(profile);
      haptics.success();
      router.push('/login');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => setState({ kind: 'editing' });

  const input = [
    type.body,
    styles.input,
    { color: c.text, backgroundColor: c.surface, borderColor: error ? c.danger : c.border },
  ];

  return (
    <KeyboardAvoidingView behavior="height" style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled" testID="setup">
        <View style={{ gap: space.md }}>
          <View style={[styles.badge, { backgroundColor: c.inkSoft }]}>
            <MaterialCommunityIcons name="school-outline" size={28} color={c.ink} />
          </View>
          <Txt variant="title" accessibilityRole="header">
            Collega la tua università
          </Txt>
          <Txt variant="body" color="textMuted">
            Incolla l’indirizzo che apri nel browser per entrare nell’area studenti. Poi accedi come sempre:
            Studium riconosce la piattaforma da solo.
          </Txt>
        </View>

        {!importing ? (
          <Card>
            <Txt variant="smallStrong" color="textMuted">
              Indirizzo dell’area studenti
            </Txt>
            <TextInput
              testID="setup-url"
              value={url}
              onChangeText={(t) => {
                setUrl(t);
                if (error) setError(null);
              }}
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
              <Txt variant="small" color="danger" testID="setup-error" accessibilityLiveRegion="polite">
                {error}
              </Txt>
            ) : null}
            <Button
              testID="setup-continue"
              label="Continua"
              icon="arrow-right"
              onPress={next}
              disabled={!url.trim()}
            />
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
          </Card>
        ) : state.kind === 'confirm' ? (
          <ConfirmImport
            profile={state.profile}
            saving={saving}
            onConfirm={() => void confirm(state.profile)}
            onCancel={reset}
          />
        ) : (
          <Card>
            <Txt variant="body">Incolla la configurazione esportata da Studium su un altro telefono.</Txt>
            <TextInput
              testID="setup-json"
              value={json}
              onChangeText={(t) => {
                setJson(t);
                if (state.kind === 'rejected') reset();
              }}
              multiline
              placeholder='{"id": …}'
              placeholderTextColor={c.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[input, { minHeight: 160, textAlignVertical: 'top' }]}
            />
            {error ? (
              <Txt variant="small" color="danger" accessibilityLiveRegion="polite">
                {error}
              </Txt>
            ) : null}
            {state.kind === 'rejected' ? <Rejected violations={state.violations} /> : null}
            <Button
              testID="setup-import-check"
              label="Controlla la configurazione"
              icon="shield-search"
              onPress={check}
              disabled={!json.trim()}
            />
            <Button kind="quiet" label="Inserisci un indirizzo" onPress={() => setImporting(false)} />
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Blocked addresses: the configuration is refused and nothing is saved. */
function Rejected({ violations }: { violations: readonly ProfileViolation[] }) {
  return (
    <Callout tone="danger" title="Configurazione rifiutata" testID="setup-import-rejected">
      <Txt variant="small">
        Contiene indirizzi che non appartengono a un’università. Una configurazione così potrebbe inviare la
        tua sessione a terzi: non è stata salvata.
      </Txt>
      {violations.map((v) => (
        <Txt key={`${v.field}:${v.value}`} variant="small" selectable>
          • {v.value} — {violationText(v.reason)}
        </Txt>
      ))}
    </Callout>
  );
}

/** Valid configuration: the student sees every domain the app will trust before anything is saved. */
function ConfirmImport({
  profile,
  saving,
  onConfirm,
  onCancel,
}: {
  profile: PlatformProfile;
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const c = usePalette();
  return (
    <Card testID="setup-import-confirm">
      <Txt variant="heading">{profile.name}</Txt>
      <Callout tone="warning" title="Controlla i domini prima di continuare">
        <Txt variant="small" style={{ color: c.onHighlight }}>
          Studium userà la tua sessione solo con questi domini. Continua solo se sono quelli della tua
          università e se la configurazione viene da una persona di cui ti fidi.
        </Txt>
      </Callout>
      <View style={{ gap: space.sm }}>
        <Txt variant="smallStrong" color="textMuted">
          Domini autorizzati
        </Txt>
        {profile.allowedHostSuffixes.map((s) => (
          <View key={s} style={[styles.domain, { backgroundColor: c.surfaceAlt }]}>
            <MaterialCommunityIcons name="web" size={16} color={c.ink} />
            <Txt variant="bodyStrong" selectable>
              {s}
            </Txt>
          </View>
        ))}
      </View>
      <View style={{ gap: space.xs }}>
        <Txt variant="smallStrong" color="textMuted">
          Indirizzi usati
        </Txt>
        {profileHosts(profile).map(({ field, host }) => (
          <Txt key={field} variant="small" color="textMuted" selectable>
            {FIELD_LABEL[field] ?? field}: {host}
          </Txt>
        ))}
      </View>
      <Button
        testID="setup-import-confirm-button"
        label="Sono i domini della mia università"
        icon="check"
        busy={saving}
        onPress={onConfirm}
      />
      <Button kind="quiet" label="Annulla" onPress={onCancel} />
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { padding: space.xl, gap: space.xl, paddingTop: space.xxl },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 48,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  domain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
  },
});
