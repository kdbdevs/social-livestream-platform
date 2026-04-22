import Fastify from "fastify";
import { loadEnv } from "@social-livestream/config";
import { registerErrorHandler } from "./common/errors.js";
import { registerAuthRoutes } from "./modules/auth/auth.routes.js";
import { registerFinanceRoutes } from "./modules/finance/finance.routes.js";
import { registerHostApplicationRoutes } from "./modules/hostApplications/host-applications.routes.js";
import { registerMessageRoutes } from "./modules/messages/messages.routes.js";
import { registerRoomRoutes } from "./modules/rooms/rooms.routes.js";
import { registerSocialRoutes } from "./modules/social/social.routes.js";

export function buildApp() {
  const env = loadEnv();
  const allowedOrigins = env.API_CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);
  const app = Fastify({
    logger: true,
  });

  app.addHook("onRequest", (request, reply, done) => {
    const origin = request.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
      reply.header("Access-Control-Allow-Origin", origin);
      reply.header("Vary", "Origin");
    }

    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

    if (request.method === "OPTIONS") {
      reply.code(204).send();
      return;
    }

    done();
  });

  registerErrorHandler(app);

  app.register(
    async (v1) => {
      await registerAuthRoutes(v1);
      await registerFinanceRoutes(v1);
      await registerHostApplicationRoutes(v1);
      await registerMessageRoutes(v1);
      await registerRoomRoutes(v1);
      await registerSocialRoutes(v1);
    },
    { prefix: "/api/v1" },
  );

  return app;
}
