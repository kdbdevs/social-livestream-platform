import type { FastifyRequest } from "fastify";
import type { JwtPayload } from "jsonwebtoken";
import jwt from "jsonwebtoken";
import { assertActiveForInteractiveAction, assertAllowedToLogin, assertRole, DomainError } from "@social-livestream/domain-core";
import { prisma } from "@social-livestream/db";
import { loadEnv } from "@social-livestream/config";
import type { AuthenticatedUserContext, UserRole } from "@social-livestream/shared-types";

const env = loadEnv();

interface AccessTokenPayload extends JwtPayload {
  sub: string;
  role: UserRole;
  tokenVersion: number;
}

export async function authenticateRequest(request: FastifyRequest): Promise<AuthenticatedUserContext> {
  if (request.currentUser) {
    return request.currentUser;
  }

  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    throw new DomainError("UNAUTHORIZED", 401, "Missing bearer token.");
  }

  const token = authorization.slice("Bearer ".length).trim();

  let payload: AccessTokenPayload;

  try {
    payload = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
  } catch {
    throw new DomainError("UNAUTHORIZED", 401, "Invalid or expired token.");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: payload.sub,
    },
  });

  if (!user) {
    throw new DomainError("UNAUTHORIZED", 401, "Session user not found.");
  }

  if (payload.tokenVersion !== user.tokenVersion) {
    throw new DomainError("UNAUTHORIZED", 401, "Session has been invalidated.");
  }

  assertAllowedToLogin(user.status);

  const actor: AuthenticatedUserContext = {
    userId: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    tokenVersion: user.tokenVersion,
  };

  request.currentUser = actor;
  return actor;
}

export async function requireActiveUser(request: FastifyRequest): Promise<AuthenticatedUserContext> {
  const actor = await authenticateRequest(request);
  assertActiveForInteractiveAction(actor.status);
  return actor;
}

export async function requireRoles(request: FastifyRequest, roles: UserRole[], requireActive = true): Promise<AuthenticatedUserContext> {
  const actor = requireActive ? await requireActiveUser(request) : await authenticateRequest(request);
  assertRole(actor, roles);
  return actor;
}

export function signAccessToken(payload: { userId: string; role: UserRole; tokenVersion: number }): string {
  const expiresIn = env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"];

  return jwt.sign(
    {
      sub: payload.userId,
      role: payload.role,
      tokenVersion: payload.tokenVersion,
    },
    env.JWT_SECRET,
    {
      expiresIn,
    },
  );
}
