import { afterEach, describe, expect, it, vi } from "vitest";
import { transcribeAudio } from "../server/_core/voiceTranscription";

describe("transcribeAudio upload format handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes an aliased WAV MIME and uses the signed URL extension", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockImplementation(async (input, init) => {
      if (init?.method === "POST") {
        const formData = init.body as FormData;
        const file = formData.get("file") as File;
        expect(file.name).toBe("audio.wav");
        expect(file.type).toBe("audio/wav");
        return new Response(
          JSON.stringify({
            task: "transcribe",
            language: "en",
            duration: 1,
            text: "testing testing",
            segments: [],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      expect(String(input)).toBe("https://storage.example/recording.wav");
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "audio/x-wav" },
      });
    });

    const result = await transcribeAudio({
      audioUrl: "https://storage.example/recording.wav",
    });

    expect(result).toMatchObject({ text: "testing testing", language: "en" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects unsupported CAF files before posting to the transcription API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "audio/x-caf" },
      }),
    );

    const result = await transcribeAudio({
      audioUrl: "https://storage.example/recording.caf",
    });

    expect(result).toMatchObject({
      error: "Invalid audio file format",
      code: "INVALID_FORMAT",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
