import type { FastifyInstance } from "fastify";
import { DomainError, isDomainError } from "@social-livestream/domain-core";
import { loadEnv } from "@social-livestream/config";

const env = loadEnv();

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const domainError = isDomainError(error) ? error : error instanceof DomainError ? error : null;
    const unexpectedError = error instanceof Error ? error : null;

    if (domainError) {
      reply.status(domainError.statusCode).send({
        success: false,
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
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error.",
        details:
          env.NODE_ENV === "production"
            ? undefined
            : {
                message: unexpectedError?.message ?? String(error),
                name: unexpectedError?.name ?? "UnknownError",
              },
      },
    });
  });
}
