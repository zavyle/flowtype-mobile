# FlowType AI Handoff

## Current baseline

The latest stable product checkpoint includes AIREC-compatible audio-file import, Android screen-off recording, and durable recovery for completed native recordings. The app is called FlowType and is a mobile Expo project with an Express/tRPC server. Native recordings are speech-optimized AAC files that FlowType copies into its Documents recovery folder before transcription. The app uploads that file through `/api/voice/transcribe-upload` as binary audio instead of a base64 tRPC JSON mutation, then formats and saves a real `TranscriptionSession`. If the upload or transcription fails, the original file remains locally recoverable and **Retry transcription** resends the same audio. Native Android recording uses Expo Audio's microphone foreground service: it stays active while the screen is locked and exposes a persistent system notification with an elapsed timer and native **Stop** action.

The current UI is intentionally honest about the integration boundary: users are told to transfer a file from AIREC to their phone and then import it. The app does not claim direct Bluetooth control or direct inbound Android share handling. This is because the public AIREC information confirms Bluetooth file transfer in the vendor app but does not expose the recorder’s BLE service UUIDs, characteristics, command protocol, SDK, or third-party API.

## Important files

| File | Responsibility |
|---|---|
| `app/(tabs)/index.tsx` | Main Dictate UI, recording states, import action, transcription handoff, session creation |
| `hooks/use-audio-engine.ts` | Native/web recording, microphone permissions, recorder lifecycle, metering, retry details |
| `lib/backgroundRecording.ts` | Testable policy for foreground recording mode and notification Stop handling |
| `lib/audioImport.ts` | Document picker, audio MIME inference, size validation, base64 conversion |
| `lib/pendingRecording.ts` | Protected Documents-folder copy and AsyncStorage metadata for failed-recording recovery |
| `lib/nativeAudioUpload.ts` | Binary Android file uploader and JSON-safe server-response validation |
| `lib/sessionStore.ts` | AsyncStorage session model and persistence; demo sessions are filtered out |
| `server/voiceService.ts` | Upload to managed storage, Whisper transcription, AI formatting, response mapping |
| `server/routers.ts` | tRPC voice procedures: transcription, reformatting, long-session consolidation |
| `app/(tabs)/history.tsx` | Searchable session list, filters, empty state, deletion/copy/share actions |
| `app/session/[id].tsx` | Session detail, raw/formatted/chunks views, editing and reformatting |
| `hardware-integration-findings.md` | Research notes about the AIREC/Voijump recorder family and integration feasibility |
| `todo.md` | Chronological feature and bug checklist; keep completed work marked `[x]` |

## Safe continuation order

First, install dependencies and run `pnpm check`, `pnpm lint`, and `pnpm test`. Then test the app on a physical Android device with a real AIREC-exported WAV file. Confirm that the file picker opens, the import enters a processing state, the server returns transcription, and History contains the imported session. Also start a live recording, lock the screen for at least 30 seconds, then use **Stop** in the persistent Android notification; on return to FlowType, confirm that the audio is transcribed and saved. Notification permission is required for the visible lock-screen Stop action on Android 13+.

After physical-device validation, add an audio playback control to Session Detail for `session.audioUrl` and `chunk.audioUrl`. Next, implement Android share-target intake through a native config plugin or a compatible Expo module; do not describe `expo-sharing` alone as inbound share support because it only shares outward from the app. Finally, investigate direct BLE transfer with the physical recorder present and use a BLE inspection tool to discover services and characteristics. Treat any undocumented protocol as device-specific and avoid destructive firmware or pairing operations.

## Known limitations

The imported-audio picker still has a 35 MB request-oriented safety limit because it uses the legacy JSON/base64 mutation. Native live recordings bypass that limit through binary upload and recovery. The next scaling step is to route imported AIREC files through the same binary endpoint and add server-side chunks for very long multi-hour sessions. Direct AIREC Bluetooth integration is unverified. The web preview can demonstrate the picker UI, but microphone and native file behavior must be confirmed on a physical device.

## Configuration and secrets

Use the project’s managed environment/secrets mechanism for runtime credentials. Never commit `.env` files, managed workspace metadata, database URLs, JWT secrets, owner identifiers, or provider keys. Another AI agent should ask the project owner to configure required secrets in its own environment rather than copying credentials from a prior workspace.

## Definition of done for the next agent

A good next checkpoint should include a real-device import test, playback of the imported recording from Session Detail, regression tests for empty files and oversized files, and a documented decision about whether Android inbound share handling is worth the native configuration effort before BLE reverse-engineering begins.
