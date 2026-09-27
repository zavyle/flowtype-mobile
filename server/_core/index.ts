import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { processAudioTranscriptionBuffer, type FormattingStyle } from "../voiceService";

const FORMATTING_STYLES = new Set<FormattingStyle>([
  "clean_voice",
  "raw_verbatim",
  "executive_summary",
  "bullet_points",
  "email_draft",
  "meeting_minutes",
]);

function parseVocabulary(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Native recordings are uploaded as binary rather than a JSON/base64 tRPC
  // payload. This keeps multi-hour voice notes under the gateway limit and
  // allows Android's file uploader to keep working after the screen locks.
  app.post(
    "/api/voice/transcribe-upload",
    express.raw({ type: ["audio/*", "application/octet-stream"], limit: "64mb" }),
    async (req, res) => {
      const mimeType = req.headers["content-type"]?.split(";", 1)[0] || "audio/m4a";
      const language = typeof req.query.language === "string" ? req.query.language : "auto";
      const requestedStyle = typeof req.query.style === "string" ? req.query.style : "clean_voice";
      const style = FORMATTING_STYLES.has(requestedStyle as FormattingStyle)
        ? (requestedStyle as FormattingStyle)
        : "clean_voice";

      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: { code: "EMPTY_AUDIO", message: "No audio data was uploaded." } });
        return;
      }

      try {
        const result = await processAudioTranscriptionBuffer({
          audioBuffer: req.body,
          mimeType,
          language,
          style,
          customVocabulary: parseVocabulary(req.query.vocabulary),
        });
        res.json(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Voice transcription failed.";
        console.error("[NativeAudioUpload] transcription failed:", error);
        res.status(502).json({ error: { code: "TRANSCRIPTION_FAILED", message } });
      }
    },
  );

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
