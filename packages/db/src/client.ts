import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

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

const envPath = findRepoEnvPath(dirname(fileURLToPath(import.meta.url)));
if (envPath) {
  process.loadEnvFile(envPath);
}

declare global {
  // eslint-disable-next-line no-var
  var __livestreamPrisma__: PrismaClient | undefined;
}

export const prisma =
  globalThis.__livestreamPrisma__ ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__livestreamPrisma__ = prisma;
}
