import { describe, expect, it } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

function createTestContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: ({
      clearCookie: () => {},
    } as unknown) as TrpcContext["res"],
  };
}

describe("voiceRouter & FlowType AI Services", () => {
  it("consolidateLongSession stitches multiple 30m+ session chunks in order", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const mockChunks = [
      {
        chunkIndex: 0,
        rawText: "First 15 minutes of executive strategy discussion.",
        duration: 900,
        startTime: 0,
        endTime: 900,
      },
      {
        chunkIndex: 1,
        rawText: "Second 15 minutes reviewing system architecture.",
        duration: 900,
        startTime: 900,
        endTime: 1800,
      },
      {
        chunkIndex: 2,
        rawText: "Third 10 minutes discussing Q4 launch milestones.",
        duration: 600,
        startTime: 1800,
        endTime: 2400,
      },
    ];

    const result = await caller.voice.consolidateLongSession({
      chunks: mockChunks,
      style: "raw_verbatim",
    });

    expect(result.totalChunks).toBe(3);
    expect(result.totalDuration).toBe(2400); // 40 minutes (exceeding 30m)
    expect(result.combinedRaw).toContain("First 15 minutes");
    expect(result.combinedRaw).toContain("Second 15 minutes");
    expect(result.combinedRaw).toContain("Third 10 minutes");
  });

  it("reformatTranscript raw_verbatim returns unedited text", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const rawInput = "um like you know we should ship this feature right now";
    const result = await caller.voice.reformatTranscript({
      text: rawInput,
      style: "raw_verbatim",
    });

    expect(result.formattedText).toBe(rawInput);
  });
});
