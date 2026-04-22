import type { RoomStatus } from "@social-livestream/shared-types";
import { DomainError } from "./errors.js";

export function assertDraftRoom(status: RoomStatus): void {
  if (status !== "DRAFT") {
    throw new DomainError("ROOM_STATE_INVALID", 409, "Room metadata can only be edited while draft.");
  }
}

export function assertRoomCanBePublished(status: RoomStatus): void {
  if (status !== "DRAFT") {
    throw new DomainError("ROOM_STATE_INVALID", 409, "Only draft rooms can be published.");
  }
}

export function assertRoomCanBeEndedByHost(status: RoomStatus): void {
  if (status !== "PUBLISHED" && status !== "LIVE") {
    throw new DomainError("ROOM_STATE_INVALID", 409, "Only published or live rooms can be ended.");
  }
}

export function assertRoomCanBeRemovedByHost(status: RoomStatus): void {
  if (status === "PUBLISHED" || status === "LIVE") {
    throw new DomainError("ROOM_STATE_INVALID", 409, "Live or published rooms must be ended before removal.");
  }
}

export function assertRoomCanGoLiveFromMedia(status: RoomStatus, disconnectedAt: Date | null): void {
  if (status === "PUBLISHED") {
    return;
  }

  if (status === "LIVE" && disconnectedAt) {
    return;
  }

  throw new DomainError("ROOM_NOT_PUBLISHED", 409, "Room is not eligible to go live.");
}

export function assertRoomPubliclyVisible(status: RoomStatus): void {
  if (status === "DRAFT" || status === "ARCHIVED") {
    throw new DomainError("ROOM_NOT_FOUND", 404, "Room not found.");
  }
}
