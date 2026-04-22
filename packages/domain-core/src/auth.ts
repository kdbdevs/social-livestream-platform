import type { AuthenticatedUserContext, UserRole, UserStatus } from "@social-livestream/shared-types";
import { DomainError } from "./errors.js";

export function assertRole(actor: AuthenticatedUserContext, roles: UserRole[]): void {
  if (!roles.includes(actor.role)) {
    throw new DomainError("FORBIDDEN", 403, "You are not allowed to perform this action.");
  }
}

export function assertActiveForInteractiveAction(status: UserStatus): void {
  if (status === "BANNED") {
    throw new DomainError("USER_BANNED", 403, "Your account is restricted.");
  }

  if (status !== "ACTIVE") {
    throw new DomainError("MODERATION_RESTRICTED", 403, "Interactive actions are disabled for this account.");
  }
}

export function assertAllowedToLogin(status: UserStatus): void {
  if (status === "BANNED") {
    throw new DomainError("USER_BANNED", 403, "Banned user cannot login.");
  }
}

