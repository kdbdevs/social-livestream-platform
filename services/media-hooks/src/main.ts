import { loadEnv } from "@social-livestream/config";
import { buildApp } from "./app.js";

const env = loadEnv();
const app = buildApp();

async function main(): Promise<void> {
  await app.listen({
    host: env.API_HOST,
    port: env.MEDIA_HOOKS_PORT,
  });
}

main().catch((error) => {
  app.log.error(error);
  process.exit(1);
});

