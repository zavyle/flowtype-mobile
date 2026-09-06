import { storagePut, storageGetSignedUrl } from "./storage";
import { transcribeAudio, WhisperResponse } from "./_core/voiceTranscription";
import { invokeLLM } from "./_core/llm";

export type FormattingStyle =
  | "clean_voice"
  | "raw_verbatim"
  | "executive_summary"
  | "bullet_points"
  | "email_draft"
  | "meeting_minutes";

export interface FormatTranscriptOptions {
  text: string;
  style: FormattingStyle;
  customVocabulary?: string[];
  language?: string;
}

/**
 * Format raw transcribed speech into the desired Wispr Flow-inspired style using the built-in LLM
 */
export async function formatTranscript(options: FormatTranscriptOptions): Promise<string> {
  const { text, style, customVocabulary = [], language = "en" } = options;

  if (!text || text.trim().length === 0) {
    return "";
  }

  if (style === "raw_verbatim") {
    return text.trim();
  }

  const vocabContext =
    customVocabulary.length > 0
      ? `\nIMPORTANT: Pay special attention to these user-defined keywords/names/acronyms and preserve their exact spelling: ${customVocabulary.join(
          ", ",
        )}`
      : "";

  let styleInstruction = "";
  switch (style) {
    case "clean_voice":
      styleInstruction = `
Transform the spoken dictation into natural, polished, and grammatical written text:
- Remove speech filler words (um, uh, ah, like, you know, I mean, etc.)
- Fix false starts, stuttering, and self-corrections (e.g. "let's go to Friday no wait Thursday" -> "let's go to Thursday")
- Keep the user's authentic tone, voice, and first-person perspective intact
- Ensure impeccable punctuation, capitalization, and paragraph breaks
- Do not add new commentary, greetings, or conclusions that weren't spoken
`;
      break;
    case "executive_summary":
      styleInstruction = `
Condense the spoken transcript into a high-impact Executive Summary:
- Start with a one-sentence Core Thesis / Bottom Line Up Front (BLUF)
- Organize key takeaways into concise, high-level points
- Highlight any critical decisions, risks, or next milestones
- Keep the language authoritative, concise, and professional
`;
      break;
    case "bullet_points":
      styleInstruction = `
Convert the spoken content into structured, scannable bullet points:
- Group related concepts under clear bold sub-headers
- Use crisp, action-oriented bullet points
- Highlight key figures, dates, or names in bold where appropriate
`;
      break;
    case "email_draft":
      styleInstruction = `
Structure the spoken thoughts into a professional, ready-to-send email:
- Generate a clear, engaging Subject line at the very top (e.g. "Subject: ...")
- Professional greeting
- Polished body paragraphs conveying all mentioned details cleanly
- Clear call-to-action or next steps
- Sign-off closing
`;
      break;
    case "meeting_minutes":
      styleInstruction = `
Format the audio transcript as comprehensive, structured Meeting Minutes:
- **Topic & Objective**: Brief summary of the meeting/discussion
- **Key Discussion Points**: Detailed breakdown of topics discussed
- **Decisions Reached**: Concrete conclusions agreed upon
- **Action Items**: Checklist with owner (if specified) and deadline/task
`;
      break;
    default:
      styleInstruction = "Polish the transcription for clarity, grammar, and natural flow.";
  }

  try {
    const prompt = `You are FlowType AI, the intelligent voice dictation formatter inspired by Wispr Flow.
Your task is to take spoken speech and format it according to the chosen style while strictly preserving the speaker's true intent.${vocabContext}

Target Language: ${language}
Selected Style: ${style}

Style Guidelines:
${styleInstruction}

Spoken Transcript:
"""
${text}
"""

Return ONLY the formatted result directly. Do not include introductory chat, quotes around the response, or conversational remarks.`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are an expert speech-to-text post-processor and dictation editor. Output only the finished text.",
        },
        { role: "user", content: prompt },
      ],
    });

    const choice = response.choices[0];
    if (choice && choice.message) {
      const content = choice.message.content;
      if (typeof content === "string") {
        return content.trim();
      }
      if (Array.isArray(content) && content[0] && "text" in content[0]) {
        return (content[0] as { text: string }).text.trim();
      }
    }
    return text;
  } catch (error) {
    console.error("[VoiceService] AI formatting error:", error);
    return text; // Graceful fallback to raw text if LLM is unavailable
  }
}

/**
 * Process an audio chunk or full recording: uploads to S3, calls Whisper, formats with AI
 */
export async function processAudioTranscription(params: {
  audioBase64: string;
  mimeType?: string;
  language?: string;
  prompt?: string;
  style?: FormattingStyle;
  customVocabulary?: string[];
}): Promise<{
  rawText: string;
  formattedText: string;
  language: string;
  duration: number;
  audioUrl: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}> {
  const {
    audioBase64,
    mimeType = "audio/webm",
    language = "en",
    prompt,
    style = "clean_voice",
    customVocabulary = [],
  } = params;

  // Convert base64 to buffer
  const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, "");
  const audioBuffer = Buffer.from(cleanBase64, "base64");

  // 1. Save audio to persistent storage via storagePut
  const ext = mimeType.includes("wav")
    ? "wav"
    : mimeType.includes("mp4") || mimeType.includes("m4a")
    ? "m4a"
    : mimeType.includes("mp3")
    ? "mp3"
    : "webm";

  const uploadResult = await storagePut(`voice/recordings/audio_${Date.now()}.${ext}`, audioBuffer, mimeType);

  // 2. Get direct signed URL for Whisper STT
  const directS3Url = await storageGetSignedUrl(uploadResult.key);

  // Build Whisper prompt with vocabulary
  let sttPrompt = prompt || "Transcribe voice dictation accurately.";
  if (customVocabulary.length > 0) {
    sttPrompt += ` Vocabulary: ${customVocabulary.join(", ")}.`;
  }

  // 3. Call Whisper STT
  const whisperResult = await transcribeAudio({
    audioUrl: directS3Url,
    language: language === "auto" ? undefined : language,
    prompt: sttPrompt,
  });

  if ("error" in whisperResult) {
    console.warn("[VoiceService] Whisper returned error:", whisperResult.error);
    throw new Error(`Speech recognition error: ${whisperResult.error} (${whisperResult.details || ""})`);
  }

  const rawText = whisperResult.text || "";

  // 4. Format with chosen Wispr Flow style
  const formattedText = await formatTranscript({
    text: rawText,
    style,
    customVocabulary,
    language,
  });

  const segments = (whisperResult.segments || []).map((s) => ({
    start: s.start,
    end: s.end,
    text: s.text,
  }));

  return {
    rawText,
    formattedText,
    language: whisperResult.language || language,
    duration: whisperResult.duration || 0,
    audioUrl: uploadResult.url,
    segments,
  };
}
