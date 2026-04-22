import type { AuthenticatedUserContext } from "@social-livestream/shared-types";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: AuthenticatedUserContext;
  }
}

