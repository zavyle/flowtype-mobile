# FlowType Mobile App Interface Design Specification

## Overview & Philosophy
FlowType is a next-generation voice dictation and intelligent transcription mobile application modeled closely after Wispr Flow, purpose-built for high-speed voice-to-text, context-aware AI text rewriting, and seamless long-session recordings exceeding 30 minutes (up to multiple hours of continuous dictation, meetings, lectures, and stream-of-consciousness journaling).

The user experience strictly respects Apple Human Interface Guidelines (HIG), featuring a focused portrait layout (9:16 aspect ratio), one-handed thumb ergonomics, fluid haptics, low-latency waveform animations, and a rich palette engineered for both day and night sessions.

---

## Brand & Visual System
- **App Name**: FlowType (Speech-to-Text & Long Dictation)
- **Primary Accent**: Electric Indigo / Violet (`#6366F1` / `#4F46E5`), signaling intelligence, voice precision, and clarity.
- **Recording Active**: Crimson Pulse (`#EF4444`), providing clear awareness when the microphone is hot.
- **Background**:
  - Dark Mode: Deep Obsidian (`#0F1117`), Elevated Cards (`#181B26`), Elevated Border (`#282D3F`)
  - Light Mode: Clean Snow (`#F9FAFB`), Elevated Cards (`#FFFFFF`), Border (`#E5E7EB`)
- **Typography**: Clean SF Pro Display hierarchy, high-contrast monospace timestamps, bold readability for large formatted transcripts.

---

## Screen Architecture

### 1. Home / Dictation Hub (`(tabs)/index.tsx`)
- **Header**: Mode selector pill (Quick Dictate vs. Long Session 30m+), active microphone indicator, and language pill (Auto-detect / English / Spanish / etc.).
- **Live State & Waveform Canvas**:
  - Idle: Friendly prompt, quick suggestions (e.g. "Brainstorm thoughts", "Draft executive email", "Record meeting"), recent snippet preview.
  - Recording: Pulsing dynamic audio waveform bars with live duration clock, chunk indicator (e.g., `Chunk 3 • 34m 12s recorded`), live audio levels, pause/resume, and instant stop & process buttons.
  - Processing: Smooth shimmer animation with step tracker (`Uploading chunk` → `Whisper STT` → `AI Style Polish`).
- **Transcript Result Card**:
  - Rich preview of formatted output.
  - Style Switcher chips (`Clean Voice`, `Raw Verbatim`, `Executive Summary`, `Bullet Points`, `Email Draft`, `Meeting Minutes`).
  - Action row: Quick Copy with feedback, Export (Share / AirDrop / Text file), Edit transcript, and Speak (TTS preview).
- **Sticky Primary Control**:
  - Large tactile Dictate button centered in the bottom thumb zone with tactile haptic feedback.
  - Lock-to-record toggle for extended 30min+ hands-free capture.

### 2. History & Archive (`(tabs)/history.tsx`)
- **Filter Bar**: All, Long Sessions (>30m), Quick Dictations, Bookmarked/Favorites.
- **Search Bar**: Full-text search across transcripts, topics, and custom tags.
- **Session Cards**:
  - Title & auto-generated smart headline.
  - Duration badge (highlighting >30m sessions with a distinct badge), word count, timestamp, and selected style badge.
  - Audio playback bar preview with scrub capability.
  - Context menu: Copy, Re-format in different style, Export, Delete.

### 3. Session Detail & Editor (`app/session/[id].tsx`)
- Full transcript reader and editor with editable Markdown / text.
- Synchronized audio player with 15s skip backward/forward and variable playback speed (1x, 1.25x, 1.5x, 2x).
- AI Re-format Sheet: Change from Clean Voice to Bullet Points, Meeting Minutes, or Slack message at any time.
- Chunk breakdown inspector for long 30m+ sessions with per-segment audio timestamps.

### 4. Custom Dictionary & Vocabulary (`(tabs)/vocabulary.tsx`)
- Add specialized acronyms, company jargon, colleague names, technical terms, and custom phonetic hints.
- Tested against the Whisper and LLM prompts so specialized words are never misspelled.
- Preset packs: Tech & Engineering, Medical, Legal, Business & Finance.

### 5. Settings & Long Session Optimization (`(tabs)/settings.tsx`)
- **Long Session Engine Settings**:
  - Chunk duration preference (5 min, 10 min, 15 min rolling chunks).
  - Screen wake-lock toggle (`expo-keep-awake`) to prevent sleep during 30m+ recordings.
  - Audio quality presets (High fidelity vs Data-saver for multi-hour sessions).
  - Background recording info & safety guidelines.
- **Dictation Behavior**:
  - Default Style profile (Clean Voice, Raw Verbatim, etc.).
  - Auto-punctuation & filler word removal filter ("um", "ah", "like", "you know").
  - Auto-copy to clipboard on recording finish.
  - Primary language & auto-detect mode.

---

## 30min+ Long-Session Architecture
Wispr Flow is popular for instant short dictations, but users hit hard walls when recording long lectures, customer interviews, podcast ideas, or executive meetings. FlowType solves this with:
1. **Adaptive Chunking Engine**: Records in seamless rolling segments, preventing memory overflows or browser/native upload size crashes.
2. **Streaming Whisper STT & Concatenation**: Segments are transcribed in order and merged into a cohesive document with unified timestamps.
3. **Session Auto-Save & Crash Resilience**: Audio buffers and intermediate transcripts are stored in local storage immediately; if the device sleeps or battery dies, zero audio is lost.
4. **Smart Long-Form Synthesis**: A secondary LLM pass consolidates the transcript into structured chapters, key takeaways, and chronological summaries.
