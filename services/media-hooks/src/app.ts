import Fastify from "fastify";
import { z } from "zod";
import { loadEnv } from "@social-livestream/config";
import { DomainError, isDomainError } from "@social-livestream/domain-core";
import { handleOnPublish, handleOnUnpublish } from "./services/room-liveness.service.js";

const env = loadEnv();

const callbackSchema = z.object({
  streamKey: z.string().uuid().optional(),
  stream: z.string().uuid().optional(),
  bitrateKbps: z.number().int().nonnegative().optional(),
  fps: z.number().int().nonnegative().optional(),
});

function isTrustedLocalAddress(ip: string | undefined): boolean {
  if (!ip) {
    return false;
  }

  return ip === "127.0.0.1" || ip === "::1" || ip.startsWith("::ffff:127.") || ip.startsWith("172.") || ip.startsWith("192.168.") || ip.startsWith("10.");
}

function normalizeStreamKey(input: z.infer<typeof callbackSchema>): string {
  const streamKey = input.streamKey ?? input.stream;

  if (!streamKey) {
    throw new DomainError("INVALID_PAYLOAD", 400, "Callback payload must include stream key.");
  }

  return streamKey;
}

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.addHook("preHandler", async (request) => {
    const secret = request.headers["x-media-hook-secret"];
    const querySecret = (request.query as { secret?: string } | undefined)?.secret;
    const allowLocalDevRequest = env.NODE_ENV !== "production" && isTrustedLocalAddress(request.ip);

    if (secret !== env.MEDIA_HOOK_SECRET && querySecret !== env.MEDIA_HOOK_SECRET && !allowLocalDevRequest) {
      throw new DomainError("UNAUTHORIZED", 401, "Invalid media hook secret.");
    }
  });

  app.setErrorHandler((error, request, reply) => {
    const domainError = isDomainError(error) ? error : error instanceof DomainError ? error : null;

    if (domainError) {
      reply.status(domainError.statusCode).send({
        ok: false,
        error: {
          code: domainError.code,
          message: domainError.message,
          details: domainError.details,
        },
      });
      return;
    }

    request.log.error(error);
    reply.status(500).send({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected media hook error.",
      },
    });
  });

  app.post("/hooks/srs/on-publish", async (request) => {
    const parsed = callbackSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new DomainError("INVALID_PAYLOAD", 400, "Invalid on_publish payload.", {
        issues: parsed.error.flatten(),
      });
    }

    const room = await handleOnPublish({
      streamKey: normalizeStreamKey(parsed.data),
      bitrateKbps: parsed.data.bitrateKbps,
      fps: parsed.data.fps,
    });

    return {
      code: 0,
      roomId: room.id,
      status: room.status,
    };
  });

  app.post("/hooks/srs/on-unpublish", async (request) => {
    const parsed = callbackSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new DomainError("INVALID_PAYLOAD", 400, "Invalid on_unpublish payload.", {
        issues: parsed.error.flatten(),
      });
    }

    const room = await handleOnUnpublish({
      streamKey: normalizeStreamKey(parsed.data),
    });

    return {
      code: 0,
      roomId: room.id,
      status: room.status,
    };
  });

  return app;
}
