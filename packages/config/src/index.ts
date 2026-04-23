import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

function findRepoEnvPath(startDir: string): string | null {
  let currentDir = startDir;

  while (true) {
    const candidatePath = join(currentDir, ".env");
    if (existsSync(candidatePath)) {
      return candidatePath;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

export function ensureRepoEnvLoaded(): void {
  const envPath = findRepoEnvPath(dirname(fileURLToPath(import.meta.url)));

  if (envPath) {
    process.loadEnvFile(envPath);
  }
}

ensureRepoEnvLoaded();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("1h"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(3000),
  API_CORS_ORIGIN: z.string().default("http://localhost:5173,http://localhost:5175"),
  API_CORS_ORIGIN_PATTERNS: z.string().default(""),
  MEDIA_HOOKS_PORT: z.coerce.number().int().positive().default(3001),
  WORKER_PORT: z.coerce.number().int().positive().default(3002),
  MEDIA_HOOK_SECRET: z.string().min(16),
  RTMP_INGEST_URL: z.string().min(1),
  PLAYBACK_BASE_URL: z.string().url(),
  ROOM_DISCONNECT_GRACE_SECONDS: z.coerce.number().int().positive().default(30),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(env);
}
