# FlowType AI Handoff

## Current baseline

The latest stable product checkpoint is the recorder-import milestone. The app is called FlowType and is a mobile Expo project with an Express/tRPC server. The latest implementation adds AIREC-compatible audio-file import for WAV, MP3, and M4A files, validates the selected file and rejects imports above 35 MB, converts the file to base64, calls `voice.transcribeAudioChunk`, formats the transcription using the selected style, and saves a real `TranscriptionSession` with one completed `AudioChunk`.

The current UI is intentionally honest about the integration boundary: users are told to transfer a file from AIREC to their phone and then import it. The app does not claim direct Bluetooth control or direct inbound Android share handling. This is because the public AIREC information confirms Bluetooth file transfer in the vendor app but does not expose the recorder’s BLE service UUIDs, characteristics, command protocol, SDK, or third-party API.

## Important files

| File | Responsibility |
|---|---|
| `app/(tabs)/index.tsx` | Main Dictate UI, recording states, import action, transcription handoff, session creation |
| `hooks/use-audio-engine.ts` | Native/web recording, microphone permissions, recorder lifecycle, metering, retry details |
| `lib/audioImport.ts` | Document picker, audio MIME inference, size validation, base64 conversion |
| `lib/sessionStore.ts` | AsyncStorage session model and persistence; demo sessions are filtered out |
| `server/voiceService.ts` | Upload to managed storage, Whisper transcription, AI formatting, response mapping |
| `server/routers.ts` | tRPC voice procedures: transcription, reformatting, long-session consolidation |
| `app/(tabs)/history.tsx` | Searchable session list, filters, empty state, deletion/copy/share actions |
| `app/session/[id].tsx` | Session detail, raw/formatted/chunks views, editing and reformatting |
| `hardware-integration-findings.md` | Research notes about the AIREC/Voijump recorder family and integration feasibility |
| `todo.md` | Chronological feature and bug checklist; keep completed work marked `[x]` |

## Safe continuation order

First, install dependencies and run `pnpm check`, `pnpm lint`, and `pnpm test`. Then test the app on a physical Android device with a real AIREC-exported WAV file. Confirm that the file picker opens, the import enters a processing state, the server returns transcription, and History contains the imported session. If the import fails, inspect the server logs and payload size before changing the transcription service.

After physical-device validation, add an audio playback control to Session Detail for `session.audioUrl` and `chunk.audioUrl`. Next, implement Android share-target intake through a native config plugin or a compatible Expo module; do not describe `expo-sharing` alone as inbound share support because it only shares outward from the app. Finally, investigate direct BLE transfer with the physical recorder present and use a BLE inspection tool to discover services and characteristics. Treat any undocumented protocol as device-specific and avoid destructive firmware or pairing operations.

## Known limitations

The current imported-audio path has a 35 MB request-oriented safety limit because the existing tRPC JSON body limit is 50 MB and base64 expands the payload. Longer recordings should eventually use multipart upload or server-side chunked transfer rather than sending one large JSON mutation. Direct AIREC Bluetooth integration is unverified. The existing session detail UI stores audio URLs but may still need dedicated playback controls for imported recordings. The web preview can demonstrate the picker UI, but microphone and native file behavior must be confirmed on a physical device.

## Configuration and secrets

Use the project’s managed environment/secrets mechanism for runtime credentials. Never commit `.env` files, managed workspace metadata, database URLs, JWT secrets, owner identifiers, or provider keys. Another AI agent should ask the project owner to configure required secrets in its own environment rather than copying credentials from a prior workspace.

## Definition of done for the next agent

A good next checkpoint should include a real-device import test, playback of the imported recording from Session Detail, regression tests for empty files and oversized files, and a documented decision about whether Android inbound share handling is worth the native configuration effort before BLE reverse-engineering begins.
