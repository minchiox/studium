import { LLM_PRESETS } from '@studium/core';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Button, Screen, Section, Txt } from '@/components/ui';
import { loadAi, removeAi, saveAi } from '@/lib/quiz';
import { fonts, radius, space, usePalette } from '@/lib/theme';

/** Optional AI provider for quizzes: any OpenAI-compatible API, with the student's own key. */
export default function AiSettings() {
  const c = usePalette();
  const [preset, setPreset] = useState<string>('groq');
  const [baseUrl, setBaseUrl] = useState<string>(LLM_PRESETS[0].baseUrl);
  const [model, setModel] = useState<string>(LLM_PRESETS[0].model);
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadAi().then((s) => {
      if (!s) return;
      setPreset(s.preset);
      setBaseUrl(s.baseUrl);
      setModel(s.model);
      setHasKey(s.hasKey);
    });
  }, []);

  const choose = (id: string) => {
    const p = LLM_PRESETS.find((x) => x.id === id);
    setPreset(id);
    if (p && p.id !== 'custom') {
      setBaseUrl(p.baseUrl);
      setModel(p.model);
    }
  };

  const save = async () => {
    setError(null);
    if (!/^https:\/\/[^/\s]+/i.test(baseUrl.trim()))
      return setError('L’indirizzo deve iniziare con https://');
    if (!model.trim()) return setError('Indica il nome del modello.');
    if (!hasKey && !key.trim()) return setError('Inserisci la chiave API.');
    await saveAi({ preset, baseUrl: baseUrl.trim(), model: model.trim() }, key.trim() ? key : undefined);
    router.back();
  };

  const input = [
    styles.input,
    { color: c.text, backgroundColor: c.surface, borderColor: c.border, fontFamily: fonts.ui },
  ];

  return (
    <Screen testID="ai-settings" keyboardShouldPersistTaps="handled">
      <Txt variant="body" color="textMuted">
        I quiz di base sono gratuiti e funzionano offline. Con un provider IA le domande sono più varie e
        ragionate. Studium invia il testo della lezione direttamente al provider che scegli, con la tua
        chiave: nessun nostro server in mezzo.
      </Txt>

      <Section title="Provider">
        <View style={styles.chips}>
          {LLM_PRESETS.map((p) => (
            <Pressable
              key={p.id}
              testID={`ai-preset-${p.id}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: preset === p.id }}
              onPress={() => choose(p.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: preset === p.id ? c.inkSoft : c.surface,
                  borderColor: preset === p.id ? c.ink : c.border,
                },
              ]}
            >
              <Txt variant="small" style={{ color: preset === p.id ? c.ink : c.text }}>
                {p.name}
              </Txt>
            </Pressable>
          ))}
        </View>
      </Section>

      <View style={{ gap: space.sm }}>
        <Txt variant="small" color="textMuted">
          Indirizzo API (compatibile OpenAI)
        </Txt>
        <TextInput
          testID="ai-base-url"
          value={baseUrl}
          onChangeText={setBaseUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://…/v1"
          placeholderTextColor={c.textMuted}
          style={input}
        />
        <Txt variant="small" color="textMuted">
          Modello
        </Txt>
        <TextInput
          testID="ai-model"
          value={model}
          onChangeText={setModel}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={c.textMuted}
          style={input}
        />
        <Txt variant="small" color="textMuted">
          Chiave API {hasKey ? '(salvata: lascia vuoto per non cambiarla)' : ''}
        </Txt>
        <TextInput
          testID="ai-key"
          value={key}
          onChangeText={setKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder={hasKey ? '••••••••' : 'La tua chiave'}
          placeholderTextColor={c.textMuted}
          style={input}
        />
        <Txt variant="caption" color="textMuted">
          La chiave resta nel Keystore del telefono. Controlla sul sito del provider costi e limiti del piano
          che usi.
        </Txt>
      </View>

      {error ? (
        <Txt variant="small" color="danger" testID="ai-error">
          {error}
        </Txt>
      ) : null}
      <View style={{ gap: space.sm }}>
        <Button testID="ai-save" label="Salva" icon="content-save-outline" onPress={() => void save()} />
        {hasKey ? (
          <Button
            kind="quiet"
            label="Disattiva l’IA e cancella la chiave"
            onPress={async () => {
              await removeAi();
              router.back();
            }}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.sm },
  input: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
});
