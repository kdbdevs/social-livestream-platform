import type { HostApplicationStatus } from "@social-livestream/shared-types";
import { DomainError } from "./errors.js";

export function assertHostApplicationApprovable(status: HostApplicationStatus): void {
  if (status !== "PENDING") {
    throw new DomainError("ROOM_STATE_INVALID", 409, "Only pending host applications can be approved.");
  }
}

export function assertHostApplicationRejectable(status: HostApplicationStatus): void {
  if (status !== "PENDING") {
    throw new DomainError("ROOM_STATE_INVALID", 409, "Only pending host applications can be rejected.");
  }
}

export function assertCanSubmitHostApplication(currentStatus: HostApplicationStatus | null): void {
  if (currentStatus === "PENDING") {
    throw new DomainError("VALIDATION_ERROR", 409, "A pending host application already exists.");
  }

  if (currentStatus === "APPROVED") {
    throw new DomainError("HOST_NOT_APPROVED", 409, "An approved host application cannot be edited.");
  }
}

