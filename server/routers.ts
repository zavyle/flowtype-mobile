import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

import { z } from "zod";
import { processAudioTranscription, formatTranscript, FormattingStyle } from "./voiceService";

const formattingStyleSchema = z.enum([
  "clean_voice",
  "raw_verbatim",
  "executive_summary",
  "bullet_points",
  "email_draft",
  "meeting_minutes",
]);

export const voiceRouter = router({
  transcribeAudioChunk: publicProcedure
    .input(
      z.object({
        audioBase64: z.string(),
        mimeType: z.string().optional().default("audio/webm"),
        language: z.string().optional().default("en"),
        prompt: z.string().optional(),
        style: formattingStyleSchema.optional().default("clean_voice"),
        customVocabulary: z.array(z.string()).optional().default([]),
      }),
    )
    .mutation(async ({ input }) => {
      return await processAudioTranscription(input);
    }),

  reformatTranscript: publicProcedure
    .input(
      z.object({
        text: z.string(),
        style: formattingStyleSchema,
        customVocabulary: z.array(z.string()).optional().default([]),
        language: z.string().optional().default("en"),
      }),
    )
    .mutation(async ({ input }) => {
      const formatted = await formatTranscript({
        text: input.text,
        style: input.style as FormattingStyle,
        customVocabulary: input.customVocabulary,
        language: input.language,
      });
      return { formattedText: formatted };
    }),

  consolidateLongSession: publicProcedure
    .input(
      z.object({
        chunks: z.array(
          z.object({
            chunkIndex: z.number(),
            rawText: z.string(),
            duration: z.number(),
            startTime: z.number(),
            endTime: z.number(),
          }),
        ),
        style: formattingStyleSchema.default("clean_voice"),
        customVocabulary: z.array(z.string()).optional().default([]),
        language: z.string().optional().default("en"),
      }),
    )
    .mutation(async ({ input }) => {
      const combinedRaw = input.chunks
        .sort((a, b) => a.chunkIndex - b.chunkIndex)
        .map((c) => c.rawText)
        .filter(Boolean)
        .join(" ");

      const formatted = await formatTranscript({
        text: combinedRaw,
        style: input.style as FormattingStyle,
        customVocabulary: input.customVocabulary,
        language: input.language,
      });

      const totalDuration = input.chunks.reduce((sum, c) => sum + (c.duration || 0), 0);

      return {
        combinedRaw,
        formattedText: formatted,
        totalDuration,
        totalChunks: input.chunks.length,
      };
    }),
});

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  voice: voiceRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
