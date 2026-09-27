# FlowType AI Handoff

## Current baseline

The latest stable product checkpoint includes AIREC-compatible audio-file import, Android screen-off recording, a dedicated **Recovery Vault**, and resumable long-file uploads. The app is called FlowType and is a mobile Expo project with an Express/tRPC server. Native recordings and imported audio are copied into the Documents-backed Recovery Vault before transcription. Files smaller than 18 MB use the proven binary `/api/voice/transcribe-upload` route. Larger files are split into 6 MB chunks and each returned storage key is checkpointed in AsyncStorage. `/api/voice/resumable-uploads/:uploadId/complete` reconstructs those ordered bytes, then calls the normal transcription pipeline. If the upload or transcription fails, the original local file and chunk checkpoint remain recoverable; the **Vault** tab resumes from the first missing chunk. Completed sessions are moved to History and only then is their protected audio deleted. Native Android recording uses Expo Audio's microphone foreground service: it stays active while the screen is locked and exposes a persistent system notification with a native **Stop** action.

The current UI has a safe AIREC connection and recording-list path: **Connect AIREC** on Dictate opens `app/devices.tsx`, requests BLE permissions, scans nearby devices, connects, and discovers GATT services/characteristics. Static analysis of the official AIREC Android package recovered the vendor `getFiles` operation: only when the connected device exposes the verified primary TX `0011202a-2233-4455-6677-8899dfdedddc` (or legacy `0000AE03…`) and RX `0011203a-2233-4455-6677-8899dfdedddc` (or legacy `0000AE02…`) pair does FlowType subscribe and send `55 AA 01 05`. The response stream is buffered across BLE packet boundaries, parses filenames plus signed big-endian file sizes, and stops on vendor completion key `0x06`; failure key `0xFE` leaves the device unchanged. This does **not** start Wi-Fi, download audio, delete a file, alter recorder settings, or use any unverified command. The vendor still switches to a proprietary Wi-Fi/TCP channel for actual bytes, so download must remain unimplemented until the physical recorder has confirmed this list and the observed download session is captured. The existing WAV import and Android Share workflows remain the reliable transfer routes.

## Important files

| File | Responsibility |
|---|---|
| `app/(tabs)/index.tsx` | Main Dictate UI, recording states, import action, transcription handoff; primary Dictate button is intentionally independent of Recovery Vault |
| `app/devices.tsx` | Standalone AIREC BLE scan, safe connection/profile discovery, verified recorder file list, and shareable connection diagnostics |
| `app/(tabs)/recovery.tsx` | Dedicated Recovery Vault list, resume/retry and explicit deletion controls |
| `hooks/use-audio-engine.ts` | Native/web recording, microphone permissions, recorder lifecycle, metering, retry details |
| `lib/backgroundRecording.ts` | Testable policy for foreground recording mode and notification Stop handling |
| `lib/audioImport.ts` | Document picker, audio MIME inference, 180 MB size validation, native no-base64 import path |
| `lib/pendingRecording.ts` | Multi-item protected Documents-folder Recovery Vault and AsyncStorage metadata |
| `lib/resumableUpload.ts` | Pure checkpoint, chunk-range, and progress helpers for multi-part uploads |
| `lib/nativeAudioUpload.ts` | Direct or resumable Android file uploader and JSON-safe server-response validation |
| `lib/airecBle.native.ts` | Native BLE client; scans, connects, discovers services, and performs only the verified non-destructive `getFiles` command |
| `lib/airecFileTransfer.ts` | Exact known AIREC TX/RX pair, `55 AA` frame buffering, filename/size parser, and file-list safety guards |
| `lib/airecBleUtils.ts` | Testable device labels, signal labels, and GATT profile summaries |
| `server/resumableUpload.ts` | Server-side upload ID, chunk-key, and byte-assembly guards |
| `server/_core/index.ts` | `/api/voice/resumable-uploads` chunk-store and completion routes |
| `lib/sessionStore.ts` | AsyncStorage session model and persistence; demo sessions are filtered out |
| `server/voiceService.ts` | Upload to managed storage, Whisper transcription, AI formatting, response mapping |
| `server/routers.ts` | tRPC voice procedures: transcription, reformatting, long-session consolidation |
| `app/(tabs)/history.tsx` | Searchable session list, filters, empty state, deletion/copy/share actions |
| `app/session/[id].tsx` | Session detail, raw/formatted/chunks views, editing and reformatting |
| `hardware-integration-findings.md` | Research notes about the AIREC/Voijump recorder family and integration feasibility |
| `todo.md` | Chronological feature and bug checklist; keep completed work marked `[x]` |

## Safe continuation order

First, install dependencies and run `pnpm check`, `pnpm lint`, and `pnpm test`. Then test the app on a physical Android device with a real AIREC-exported WAV file. Confirm that the file picker opens, the import enters a processing state, the server returns transcription, and History contains the imported session. Also start a live recording, lock the screen for at least 30 seconds, then use **Stop** in the persistent Android notification; on return to FlowType, confirm that the audio is transcribed and saved. Notification permission is required for the visible lock-screen Stop action on Android 13+.

For scalability testing, use an audio file over 18 MB. Interrupt the transfer after at least one chunk finishes, reopen the app, and resume it from **Vault**. Confirm the progress starts from the saved `uploadedChunks` count—not 0—and that the main **Tap to Dictate** action remains available throughout. The server caps reconstructed recordings at 180 MB / 64 chunks as a memory safety guard. The local server chunk route has been smoke-tested end-to-end with a real M4A split into two storage-backed parts and reassembled successfully.

After physical-device validation, use **Connect AIREC** with the physical recorder and press **List recordings on AIREC**. Confirm the names and sizes against the recorder’s actual archive; save the shared diagnostic on a failure. Only after a confirmed file list, observe the official app’s Wi-Fi/TCP download session with an Android network capture or vendor documentation. Add transfer support only for an observed, checksum-validated protocol, with local download staging and no device-side deletion. Treat any undocumented protocol as device-specific and avoid firmware, pairing, or file-deletion operations.

## Known limitations

Long recordings have a tested resumable transfer path but the **complete** server request reconstructs the original binary in server memory before giving it to Whisper. The 180 MB cap keeps this bounded; true streaming transcoding would be a later scaling step beyond that cap. AIREC BLE connection, GATT discovery, and its safe recorder file list are implemented; its Wi-Fi/TCP audio download remains unverified. The web preview can demonstrate the picker UI, but Bluetooth, microphone, Android Storage Access Framework URIs, and recovery uploads must be confirmed on a physical device.

## Configuration and secrets

Use the project’s managed environment/secrets mechanism for runtime credentials. Never commit `.env` files, managed workspace metadata, database URLs, JWT secrets, owner identifiers, or provider keys. Another AI agent should ask the project owner to configure required secrets in its own environment rather than copying credentials from a prior workspace.

## Definition of done for the next agent

A good next checkpoint should include a real-device interrupted-upload/resume test, playback of the imported recording from Session Detail, regression tests for empty and over-limit files, and a documented decision about whether Android inbound share handling is worth the native configuration effort before BLE reverse-engineering begins.
