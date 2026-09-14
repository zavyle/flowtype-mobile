- [x] Custom branding icon generation and app.config.ts update
- [x] Backend tRPC routes: audio upload endpoint, Whisper STT integration, AI text formatting/polishing, and vocabulary prompt injection
- [x] Mobile Audio Recording Engine: microphone permissions, cross-platform audio capture (expo-audio & web fallback), live decibel meter, and rolling chunk manager for >30m sessions
- [x] Waveform visualizer component with responsive animated bars and recording timer
- [x] Long-Session (>30m) manager: chunking, auto-save to AsyncStorage, sleep prevention with expo-keep-awake, and seamless audio stitching
- [x] AI Formatting Styles Engine: Clean Voice, Raw Verbatim, Executive Summary, Bullet Points, Email Draft, Meeting Minutes
- [x] Main Dictation Screen: live recording controls, style selector, interactive transcript preview, quick copy, and export
- [x] History Screen: searchable session list, filter by >30m sessions, duration badges, audio playback preview, and item deletion
- [x] Session Detail Screen: full transcript reader & editor, audio playback with speed controls, and AI re-formatting modal
- [x] Custom Dictionary Screen: add custom vocabulary, names, acronyms, and industry presets
- [x] Settings Screen: 30m+ session configuration, chunk duration, wake-lock toggle, filler word removal, default style, and language selection
- [x] End-to-end verification and visual testing with webdev_take_screenshot
- [x] Final checkpoint and delivery

- [x] Bug: explicit microphone permission prompt is missing on native and web recording paths
- [x] Bug: Dictate flow does not capture spoken audio or produce real transcription for a simple test phrase
- [x] Bug: repeated demo Welcome to FlowType sessions are being persisted into History instead of real captures
- [x] Bug: failed microphone/recording states need visible error feedback and must not create fake sessions
- [x] Verify permission, recording lifecycle, transcription fallback, and clean History behavior on web and native-compatible paths
- [x] Save bug-fix checkpoint and deliver updated build


# Next Improvement Milestone

- [x] Improve dictate screen recording-state clarity with permission, listening, paused, processing, and failure guidance
- [x] Add a visible microphone readiness check before recording begins
- [x] Add real-time capture feedback so users can distinguish silence, active speech, and processing
- [x] Improve no-speech and transcription-failure recovery without saving incomplete sessions
- [x] Preserve and surface long-session progress, chunk status, and recovery state
- [x] Polish History and session detail actions for faster copy, share, playback, and reformatting
- [x] Run regression tests, preview screenshots, and mobile-compatible validation
- [x] Save and deliver the next stable FlowType checkpoint


# Recorder Import Milestone

- [x] Add WAV/MP3/M4A recorder-file picker with safe size and MIME validation
- [x] Send imported audio through the existing Whisper and AI-formatting pipeline
- [x] Save imported recordings as real History sessions with audio and chunk metadata
- [x] Add AIREC transfer instructions and an Import Recorder Audio action
- [x] Verify import UI, regression tests, and mobile preview behavior
- [x] Save and deliver the recorder-import checkpoint


# External Handoff Milestone

- [x] Audit the repository for secrets, generated files, and unpublished credentials before external sharing
- [x] Create continuation documentation for another AI agent, including architecture, current features, known limitations, and next tasks
- [ ] Publish the sanitized FlowType source to GitHub or provide an accessible repository alternative
- [ ] Verify the published repository and deliver its access details

- [ ] Push sanitized FlowType source to `zavyle/Voice-Notes` branch `flowtype-handoff` without modifying `main`
- [ ] Verify the branch URL, latest commit, and handoff documentation on GitHub
