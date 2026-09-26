# FlowType

FlowType is an Expo SDK 54 mobile voice-dictation workspace inspired by Wispr Flow. It captures speech, transcribes it through the project’s server-side speech service, formats the result into selectable writing styles, and stores real sessions locally for History and Session Detail.

## Current capabilities

The current stable build includes native and web microphone permission handling, real `expo-audio` recording, animated waveform feedback, retryable recording/transcription errors, **Android foreground-service recording that survives a screen lock with a persistent notification Stop action**, extended-session settings, Keep Awake during active recording, custom vocabulary, six formatting styles, searchable History, session details, and recorder-file import for WAV, MP3, and M4A files. Imported recordings are sent through the existing transcription and formatting pipeline and saved as real sessions with chunk and audio metadata.

The recorder-import path is designed for AIREC-compatible hardware workflows. Transfer the recorder’s exported file to the phone, open FlowType, tap **Import Recorder Audio**, and select the file. Direct Bluetooth control and inbound Android share-target handling are not implemented yet because the recorder’s proprietary BLE protocol is not publicly documented.

## Tech stack

| Area | Technology |
|---|---|
| Mobile UI | Expo SDK 54, React Native 0.81, Expo Router 6, TypeScript |
| Styling | NativeWind 4, shared theme tokens |
| Audio | `expo-audio`, web MediaRecorder fallback, `expo-keep-awake` |
| Local persistence | AsyncStorage session store |
| Server | Express, tRPC, built-in speech transcription and LLM services |
| Validation | TypeScript, Expo lint, Vitest |

## Local development

Install dependencies with `pnpm install`, then start the project with `pnpm dev`. Run `pnpm check`, `pnpm lint`, and `pnpm test` before making a handoff. The main mobile screen is `app/(tabs)/index.tsx`; the audio engine is `hooks/use-audio-engine.ts`; imported-file conversion is `lib/audioImport.ts`; session persistence is `lib/sessionStore.ts`; and the server transcription/formatting implementation is `server/voiceService.ts`.

Do not commit `.env` files, generated runtime metadata, credentials, API keys, or managed-workspace configuration. The repository is intentionally configured to ignore `.project-config.json`, Expo build output, local environment files, and logs.

## Android screen-off recording test

1. Install a freshly built APK (background recording requires a new native build).
2. Start a dictation and allow both microphone and notification permissions when prompted.
3. Lock the screen for at least 30 seconds, then unlock it to confirm the timer is still advancing.
4. Start another dictation, lock the screen, expand the persistent **Recording audio** notification, and tap **Stop**.
5. Unlock FlowType. The recording should be finalized, transcribed, and saved to History. If notification permission was denied, recording still continues, but Android cannot show the lock-screen Stop action until notifications are enabled for FlowType in system settings.

## Recommended next milestones

The most useful next implementation is a physical-device test using an AIREC-exported WAV file. After that, add playback controls for imported sessions, Android share-target intake, and only then investigate direct Bluetooth transfer with the physical recorder available for protocol inspection.

See [HANDOFF.md](./HANDOFF.md) for continuation instructions and known limitations.
