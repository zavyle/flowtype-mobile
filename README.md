# FlowType

FlowType is an Expo SDK 54 mobile voice-dictation workspace inspired by Wispr Flow. It captures speech, transcribes it through the project’s server-side speech service, formats the result into selectable writing styles, and stores real sessions locally for History and Session Detail.

## Current capabilities

The current stable build includes native and web microphone permission handling, real `expo-audio` recording, animated waveform feedback, retryable recording/transcription errors, **Android foreground-service recording that survives a screen lock with a live elapsed notification timer and Stop action**, extended-session settings, Keep Awake during active recording, custom vocabulary, six formatting styles, searchable History, session details with audio playback, and recorder-file import for WAV, MP3, and M4A files. Imported recordings are sent through the existing transcription and formatting pipeline and saved as real sessions with chunk and audio metadata.

The recorder-import path is designed for AIREC-compatible hardware workflows. Transfer the recorder’s exported file to the phone, then either open FlowType and tap **Import Recorder Audio** or choose **Share → FlowType** from Android’s Files app. Direct Bluetooth control is not implemented because the recorder’s proprietary BLE protocol is not publicly documented.

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
3. Lock the screen for at least 30 seconds, then expand the persistent **Recording** notification to verify its elapsed time advances.
4. Tap the **Stop** action in that notification.
5. Unlock FlowType. The recording should be finalized, transcribed, and saved to History. If notification permission was denied, recording still continues, but Android cannot show the lock-screen Stop action until notifications are enabled for FlowType in system settings.

## Android inbound-share test

1. In Android’s Files app, select a WAV, MP3, M4A, or other supported audio file.
2. Tap **Share** and select **FlowType**.
3. FlowType should open on **Dictate**, read the shared file, and begin the normal transcription and formatting flow.
4. The resulting session should be visible in History and use the same stored audio file for Session Detail playback.

## Recommended next milestones

The most useful next implementation is a physical-device test using an AIREC-exported WAV file through both picker and Android Share. After that, add cloud export (Notion, Slack, or Google Docs), server-side chunked uploads for multi-hour recordings, and only then investigate direct Bluetooth transfer with the physical recorder available for protocol inspection.

See [HANDOFF.md](./HANDOFF.md) for continuation instructions and known limitations.
