import Fastify from "fastify";
import { loadEnv } from "@social-livestream/config";
import { registerErrorHandler } from "./common/errors.js";
import { registerAuthRoutes } from "./modules/auth/auth.routes.js";
import { registerFinanceRoutes } from "./modules/finance/finance.routes.js";
import { registerHostApplicationRoutes } from "./modules/hostApplications/host-applications.routes.js";
import { registerMessageRoutes } from "./modules/messages/messages.routes.js";
import { registerRoomRoutes } from "./modules/rooms/rooms.routes.js";
import { registerSocialRoutes } from "./modules/social/social.routes.js";

function splitEnvList(value: string): string[] {
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function defaultOriginPort(origin: URL): string {
  if (origin.port) {
    return origin.port;
  }

  return origin.protocol === "https:" ? "443" : origin.protocol === "http:" ? "80" : "";
}

function matchesOriginPattern(originValue: string, patternValue: string): boolean {
  try {
    const origin = new URL(originValue);
    const pattern = new URL(patternValue);

    if (origin.protocol !== pattern.protocol) {
      return false;
    }

    if (defaultOriginPort(origin) !== defaultOriginPort(pattern)) {
      return false;
    }

    if (pattern.hostname.startsWith("*.")) {
      const suffix = pattern.hostname.slice(1);
      const bareDomain = suffix.slice(1);
      return origin.hostname.endsWith(suffix) && origin.hostname !== bareDomain;
    }

    return origin.hostname === pattern.hostname;
  } catch {
    return false;
  }
}

function isOriginAllowed(origin: string, allowedOrigins: string[], allowedOriginPatterns: string[]): boolean {
  return allowedOrigins.includes(origin) || allowedOriginPatterns.some((pattern) => matchesOriginPattern(origin, pattern));
}

export function buildApp() {
  const env = loadEnv();
  const allowedOrigins = splitEnvList(env.API_CORS_ORIGIN);
  const allowedOriginPatterns = splitEnvList(env.API_CORS_ORIGIN_PATTERNS);
  const app = Fastify({
    logger: true,
  });

  app.addHook("onRequest", (request, reply, done) => {
    const origin = request.headers.origin;
    const originAllowed = origin ? isOriginAllowed(origin, allowedOrigins, allowedOriginPatterns) : false;
    const requestedHeaders = request.headers["access-control-request-headers"];

    if (origin && originAllowed) {
      reply.header("Access-Control-Allow-Origin", origin);
      reply.header("Vary", "Origin, Access-Control-Request-Headers");
      reply.header("Access-Control-Max-Age", "86400");
    }

    reply.header("Access-Control-Allow-Headers", requestedHeaders ?? "Content-Type, Authorization");
    reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

    if (request.method === "OPTIONS") {
      if (origin && !originAllowed) {
        reply.code(403).send({
          success: false,
          error: {
            code: "CORS_ORIGIN_NOT_ALLOWED",
            message: "Origin is not allowed.",
          },
        });
        return;
      }

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
