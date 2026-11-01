# Studium per Android

App Expo (SDK 58, React Native 0.88, Hermes, React Compiler) con Expo Router e tab Material native.

## Sviluppo

```bash
npm run mock                         # dalla radice: piattaforma di prova su :4010
npm run go -w @studium/mobile        # Metro + Expo Go sull'emulatore
adb reverse tcp:4010 tcp:4010        # su un telefono vero collegato via USB
```

Il profilo di piattaforma viene iniettato da `app.config.ts`, nell'ordine: `STUDIUM_PROFILE`, poi `profiles/default.json`, poi `profiles/mock.json`. Vedi [`profiles/README.md`](../../profiles/README.md).

## APK installabile

Serve l'Android SDK (`ANDROID_HOME`) con JDK 17+. La prima build scarica Gradle, NDK e CMake.

```bash
STUDIUM_PROFILE=profiles/default.json npm run apk -w @studium/mobile
# → apps/mobile/android/app/build/outputs/apk/release/app-release.apk
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

L'APK di release è firmato con la chiave di debug: va bene per installarlo sul proprio telefono. Per uno store, crea una chiave di upload e firma con EAS (`npx eas-cli build -p android`) o con un `signingConfig` dedicato.

La cartella `android/` è generata (Continuous Native Generation): non va modificata né committata. La configurazione nativa vive in `app.config.ts`.

## Test end-to-end

Lo script `e2e/run.mjs` pilota l'app via adb e uiautomator, senza dipendenze extra. Esegue 17 passi, salva uno screenshot per ognuno in `e2e/artifacts/` e alla fine chiede al mock se l'app ha mai chiamato endpoint di tracciamento o di scrittura.

```bash
npm run e2e -w @studium/mobile       # app in Expo Go (Metro avviato)
npm run e2e:apk -w @studium/mobile   # APK installato, costruito con il profilo mock
```

Per l'emulatore senza finestra (CI): `emulator -avd <nome> -no-window -gpu host -no-audio`. Con `-gpu swiftshader_indirect` l'emulatore può andare in crash su pagine con video: è un limite del renderer software, non dell'app.

## Struttura

```
src/app/            schermate (Expo Router): (tabs)/home, courses, career, notices, more; dettagli
src/components/ui   design system: Txt, Marked (evidenziatore), Group/Row, Progress, Pill, stati
src/lib/auth.tsx    login e rinnovo della sessione tramite la web app (vedi ADR 0002)
src/lib/api.ts      client del core + hook React Query (cache persistita: l'app funziona offline)
src/lib/files.ts    dispense, trascrizioni e allegati sul dispositivo; corpus della ricerca
src/lib/reminders   promemoria locali per gli esami
```
