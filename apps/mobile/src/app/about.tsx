import Constants from 'expo-constants';
import { View } from 'react-native';
import { Screen, Section, Txt } from '@/components/ui';
import { space } from '@/lib/theme';

const BLOCKS: { title: string; body: string }[] = [
  {
    title: 'App non ufficiale',
    body: 'Studium è un progetto indipendente e open source, non affiliato né approvato dall’ateneo. Usa il tuo account personale e rispetta il regolamento della tua università.',
  },
  {
    title: 'Sola lettura',
    body: 'Studium legge corsi, lezioni, carriera e avvisi, e non scrive nulla sulla piattaforma. Le chiamate che registrano frequenza o avanzamento sono bloccate nel codice. Per la frequenza si usa il player ufficiale, che la registra mentre guardi; il ripasso nell’app non conta.',
  },
  {
    title: 'Privacy',
    body: 'L’accesso avviene sulla pagina ufficiale: la password non passa da Studium. Sul telefono restano solo il token di sessione, cifrato dal Keystore di Android, i dati in cache e i file che scarichi. Nessuna telemetria, nessun server di terze parti.',
  },
  {
    title: 'Contenuti',
    body: 'Dispense, lezioni e trascrizioni appartengono ai rispettivi autori: sono per il tuo studio personale, non ridistribuirli. Le trascrizioni derivano dai sottotitoli e possono contenere errori.',
  },
];

export default function About() {
  return (
    <Screen>
      {BLOCKS.map((b) => (
        <Section key={b.title} title={b.title}>
          <Txt variant="body">{b.body}</Txt>
        </Section>
      ))}
      <View style={{ gap: space.xs }}>
        <Txt variant="caption" color="textMuted">
          Versione {Constants.expoConfig?.version}. Licenza MIT.
        </Txt>
      </View>
    </Screen>
  );
}
