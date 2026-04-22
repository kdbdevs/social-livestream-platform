import type { HostApplication, Room, User } from "@prisma/client";
import type { HostApplicationView, RoomView, UserView } from "@social-livestream/shared-types";

export function serializeUser(user: User): UserView {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}

export function serializeHostApplication(application: HostApplication): HostApplicationView {
  return {
    id: application.id,
    userId: application.userId,
    legalName: application.legalName,
    displayName: application.displayName,
    countryCode: application.countryCode,
    status: application.status,
    reviewedByAdminId: application.reviewedByAdminId,
    reviewedAt: application.reviewedAt?.toISOString() ?? null,
    notes: application.notes,
    createdAt: application.createdAt.toISOString(),
  };
}

export function serializeRoom(room: Room, viewerCount = 0): RoomView {
  return {
    id: room.id,
    hostId: room.hostId,
    title: room.title,
    description: room.description,
    coverImageUrl: room.coverImageUrl,
    category: room.category,
    status: room.status,
    chatEnabled: room.chatEnabled,
    giftEnabled: room.giftEnabled,
    playbackUrl: room.playbackUrl,
    viewerCount,
    startedAt: room.startedAt?.toISOString() ?? null,
    endedAt: room.endedAt?.toISOString() ?? null,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  };
}

