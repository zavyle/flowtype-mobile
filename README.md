# FlowType

FlowType is an Expo SDK 54 mobile voice-dictation workspace inspired by Wispr Flow. It captures speech, transcribes it through the project’s server-side speech service, formats the result into selectable writing styles, and stores real sessions locally for History and Session Detail.

## Current capabilities

The current stable build includes native and web microphone permission handling, real `expo-audio` recording, animated waveform feedback, retryable recording/transcription errors, **Android foreground-service recording that survives a screen lock with a live elapsed notification timer and Stop action**, extended-session settings, Keep Awake during active recording, custom vocabulary, six formatting styles, searchable History, session details with audio playback, and recorder-file import for WAV, MP3, and M4A files. On Android, every finished dictation or imported recorder file is copied into **Recovery Vault** before transcription. Smaller files retain the proven binary-upload path; larger files upload in durable 6 MB chunks, with a checkpoint after each successful chunk. A network loss or app restart can therefore resume at the first missing chunk instead of deleting or retransmitting the whole recording.

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
6. To validate recovery, temporarily disconnect the network after stopping a short recording. FlowType must keep the completed audio safe, without disabling the main Dictate button. Open the **Vault** tab and use **Retry transcription** to process that exact recording after reconnecting.

## Android inbound-share test

1. In Android’s Files app, select a WAV, MP3, M4A, or other supported audio file.
2. Tap **Share** and select **FlowType**.
3. FlowType should open on **Dictate**, read the shared file, and begin the normal transcription and formatting flow.
4. The resulting session should be visible in History and use the same stored audio file for Session Detail playback.

## Recovery Vault and long-upload test

1. Record or import an audio file larger than 18 MB (roughly 75 minutes at the app's speech capture settings).
2. After stopping, confirm it appears in **Vault** while FlowType uploads it.
3. Interrupt Wi-Fi or close the app during the upload. Do **not** delete the Vault item.
4. Reopen FlowType, return to **Vault**, and tap **Resume Upload**. The card reports the saved chunk count and resumes from the first missing chunk.
5. Once transcription succeeds, the completed transcript is moved to History and the protected local copy is automatically removed.

Current guardrails: imports and reconstructed multi-part uploads are limited to **180 MB** (up to 64 chunks). Recovery Vault retains at most 20 protected audio files; only an explicit delete/clear action removes them.

## Recommended next milestones

The most useful next implementation is a physical-device test using an AIREC-exported WAV file through both picker and Android Share. After that, add cloud export (Notion, Slack, or Google Docs), background resumption of chunk transfers where OS policies allow, and only then investigate direct Bluetooth transfer with the physical recorder available for protocol inspection.

See [HANDOFF.md](./HANDOFF.md) for continuation instructions and known limitations.
