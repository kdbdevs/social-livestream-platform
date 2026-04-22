import { randomUUID } from "node:crypto";
import { loadEnv } from "@social-livestream/config";
import { prisma } from "@social-livestream/db";
import {
  assertDraftRoom,
  assertRoomCanBeRemovedByHost,
  assertRoomCanBeEndedByHost,
  assertRoomCanBePublished,
  assertRoomPubliclyVisible,
  DomainError,
} from "@social-livestream/domain-core";
import { createAuditLog } from "../audit/audit.service.js";
import { serializeRoom } from "../../common/serialization.js";

const env = loadEnv();

async function assertApprovedHost(userId: string): Promise<void> {
  const application = await prisma.hostApplication.findUnique({
    where: {
      userId,
    },
  });

  if (!application || application.status !== "APPROVED") {
    throw new DomainError("HOST_NOT_APPROVED", 403, "Only approved hosts can manage rooms.");
  }
}

function buildPlaybackUrl(streamKey: string): string {
  return `${env.PLAYBACK_BASE_URL.replace(/\/$/, "")}/${streamKey}.m3u8`;
}

function resolvePlaybackUrl(input: { streamKey: string; playbackUrl: string | null; status: "DRAFT" | "PUBLISHED" | "LIVE" | "ENDED" | "ARCHIVED" }): string | null {
  if (input.status === "PUBLISHED" || input.status === "LIVE") {
    return buildPlaybackUrl(input.streamKey);
  }

  return input.playbackUrl;
}

export async function createRoom(actor: { userId: string }, input: { title: string; description?: string | null; category?: string | null; coverImageUrl?: string | null }) {
  await assertApprovedHost(actor.userId);

  const room = await prisma.room.create({
    data: {
      hostId: actor.userId,
      title: input.title,
      description: input.description ?? null,
      category: input.category ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
      streamKey: randomUUID(),
      status: "DRAFT",
      chatEnabled: true,
      giftEnabled: true,
    },
  });

  return serializeRoom(room);
}

export async function listMyRooms(userId: string, input: { status?: "DRAFT" | "PUBLISHED" | "LIVE" | "ENDED" | "ARCHIVED"; cursor?: string; limit: number }) {
  await assertApprovedHost(userId);

  const records = await prisma.room.findMany({
    where: {
      hostId: userId,
      status: input.status ?? {
        not: "ARCHIVED",
      },
    },
    take: input.limit + 1,
    skip: input.cursor ? 1 : 0,
    cursor: input.cursor ? { id: input.cursor } : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  const hasMore = records.length > input.limit;
  const items = hasMore ? records.slice(0, input.limit) : records;

  return {
    rooms: items.map((room) => serializeRoom({ ...room, playbackUrl: resolvePlaybackUrl(room) })),
    nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
  };
}

export async function listLiveRooms(input: { category?: string; cursor?: string; limit: number }) {
  const records = await prisma.room.findMany({
    where: {
      status: {
        in: ["PUBLISHED", "LIVE"],
      },
      category: input.category,
    },
    take: Math.max(input.limit + 5, 25),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  const sorted = records
    .sort((left, right) => {
      if (left.status === right.status) {
        return right.createdAt.getTime() - left.createdAt.getTime();
      }

      return left.status === "LIVE" ? -1 : 1;
    });

  const startIndex = input.cursor ? sorted.findIndex((room) => room.id === input.cursor) + 1 : 0;
  const paged = sorted.slice(startIndex, startIndex + input.limit + 1);
  const hasMore = paged.length > input.limit;
  const items = hasMore ? paged.slice(0, input.limit) : paged;

  return {
    rooms: items.map((room) => serializeRoom({ ...room, playbackUrl: resolvePlaybackUrl(room) })),
    nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
  };
}

export async function getRoomById(roomId: string, actor?: { userId: string; role: string }) {
  const room = await prisma.room.findUnique({
    where: {
      id: roomId,
    },
  });

  if (!room) {
    throw new DomainError("ROOM_NOT_FOUND", 404, "Room not found.");
  }

  if (room.status === "DRAFT" || room.status === "ARCHIVED") {
    const canAccessPrivateRoom = actor && (actor.role === "ADMIN" || actor.userId === room.hostId);

    if (!canAccessPrivateRoom) {
      assertRoomPubliclyVisible(room.status);
    }
  }

  return serializeRoom({ ...room, playbackUrl: resolvePlaybackUrl(room) });
}

export async function recordRoomView(actor: { userId: string; role: string }, roomId: string) {
  const room = await prisma.room.findUnique({
    where: {
      id: roomId,
    },
  });

  if (!room) {
    throw new DomainError("ROOM_NOT_FOUND", 404, "Room not found.");
  }

  if (room.status === "DRAFT" || room.status === "ARCHIVED") {
    const canAccessPrivateRoom = actor.role === "ADMIN" || actor.userId === room.hostId;

    if (!canAccessPrivateRoom) {
      assertRoomPubliclyVisible(room.status);
    }
  }

  await createAuditLog({
    actorType: "USER",
    actorUserId: actor.userId,
    entityType: "ROOM",
    entityId: room.id,
    action: "room.viewed",
    metadata: {
      roomStatus: room.status,
      hostId: room.hostId,
    },
  });

  return {
    roomId: room.id,
    watchedAt: new Date().toISOString(),
  };
}

export async function getRoomSaveState(actor: { userId: string; role: string }, roomId: string) {
  await assertRoomAccessibleForUser(actor, roomId);

  const latest = await prisma.auditLog.findFirst({
    where: {
      actorType: "USER",
      actorUserId: actor.userId,
      entityType: "ROOM",
      entityId: roomId,
      action: {
        in: ["room.saved", "room.unsaved"],
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  return {
    roomId,
    saved: latest?.action === "room.saved",
  };
}

export async function saveRoom(actor: { userId: string; role: string }, roomId: string) {
  await assertRoomAccessibleForUser(actor, roomId);
  const currentState = await getRoomSaveState(actor, roomId);

  if (!currentState.saved) {
    await createAuditLog({
      actorType: "USER",
      actorUserId: actor.userId,
      entityType: "ROOM",
      entityId: roomId,
      action: "room.saved",
    });
  }

  return {
    roomId,
    saved: true,
  };
}

export async function unsaveRoom(actor: { userId: string; role: string }, roomId: string) {
  await assertRoomAccessibleForUser(actor, roomId);
  const currentState = await getRoomSaveState(actor, roomId);

  if (currentState.saved) {
    await createAuditLog({
      actorType: "USER",
      actorUserId: actor.userId,
      entityType: "ROOM",
      entityId: roomId,
      action: "room.unsaved",
    });
  }

  return {
    roomId,
    saved: false,
  };
}

export async function getWatchHistory(actor: { userId: string }, input: { limit: number }) {
  const logs = await prisma.auditLog.findMany({
    where: {
      actorType: "USER",
      actorUserId: actor.userId,
      entityType: "ROOM",
      action: "room.viewed",
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.max(input.limit * 5, 50),
  });

  const latestWatchByRoomId = new Map<string, Date>();

  for (const log of logs) {
    if (!latestWatchByRoomId.has(log.entityId)) {
      latestWatchByRoomId.set(log.entityId, log.createdAt);
    }
  }

  const roomIds = Array.from(latestWatchByRoomId.keys()).slice(0, input.limit);

  if (!roomIds.length) {
    return {
      items: [],
    };
  }

  const rooms = await prisma.room.findMany({
    where: {
      id: {
        in: roomIds,
      },
    },
  });

  const roomById = new Map(rooms.map((room) => [room.id, room]));

  return {
    items: roomIds
      .map((roomId) => {
        const room = roomById.get(roomId);
        const watchedAt = latestWatchByRoomId.get(roomId);

        if (!room || !watchedAt) {
          return null;
        }

        return {
          watchedAt: watchedAt.toISOString(),
          room: serializeRoom({ ...room, playbackUrl: resolvePlaybackUrl(room) }),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
  };
}

export async function getSavedRooms(actor: { userId: string }, input: { limit: number }) {
  const logs = await prisma.auditLog.findMany({
    where: {
      actorType: "USER",
      actorUserId: actor.userId,
      entityType: "ROOM",
      action: {
        in: ["room.saved", "room.unsaved"],
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.max(input.limit * 10, 100),
  });

  const latestActionByRoomId = new Map<string, { action: string; createdAt: Date }>();

  for (const log of logs) {
    if (!latestActionByRoomId.has(log.entityId)) {
      latestActionByRoomId.set(log.entityId, {
        action: log.action,
        createdAt: log.createdAt,
      });
    }
  }

  const savedRoomIds = Array.from(latestActionByRoomId.entries())
    .filter(([, value]) => value.action === "room.saved")
    .slice(0, input.limit)
    .map(([roomId]) => roomId);

  if (!savedRoomIds.length) {
    return {
      items: [],
    };
  }

  const rooms = await prisma.room.findMany({
    where: {
      id: {
        in: savedRoomIds,
      },
    },
  });

  const roomById = new Map(rooms.map((room) => [room.id, room]));

  return {
    items: savedRoomIds
      .map((roomId) => {
        const room = roomById.get(roomId);
        const latest = latestActionByRoomId.get(roomId);

        if (!room || !latest) {
          return null;
        }

        return {
          savedAt: latest.createdAt.toISOString(),
          room: serializeRoom({ ...room, playbackUrl: resolvePlaybackUrl(room) }),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
  };
}

export async function getRoomChatHistory(roomId: string, input: { limit: number }) {
  const room = await prisma.room.findUnique({
    where: {
      id: roomId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!room) {
    throw new DomainError("ROOM_NOT_FOUND", 404, "Room not found.");
  }

  if (room.status === "DRAFT" || room.status === "ARCHIVED") {
    assertRoomPubliclyVisible(room.status);
  }

  const records = await prisma.chatMessage.findMany({
    where: {
      roomId,
      isBlocked: false,
    },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          role: true,
        },
      },
    },
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: input.limit,
  });

  return records
    .reverse()
    .map((message) => ({
      id: message.id,
      roomId: message.roomId,
      clientMessageId: message.clientMessageId,
      sender: {
        id: message.sender.id,
        username: message.sender.username,
        avatarUrl: message.sender.avatarUrl,
        role: message.sender.role,
      },
      message: message.message,
      createdAt: message.createdAt.toISOString(),
    }));
}

export async function updateRoom(actor: { userId: string }, roomId: string, input: Partial<{ title: string; description: string | null; category: string | null; coverImageUrl: string | null; chatEnabled: boolean; giftEnabled: boolean }>) {
  const room = await prisma.room.findUnique({
    where: {
      id: roomId,
    },
  });

  if (!room || room.hostId !== actor.userId) {
    throw new DomainError("ROOM_NOT_FOUND", 404, "Room not found.");
  }

  assertDraftRoom(room.status);

  const updatedRoom = await prisma.room.update({
    where: {
      id: room.id,
    },
    data: {
      title: input.title ?? room.title,
      description: input.description === undefined ? room.description : input.description,
      category: input.category === undefined ? room.category : input.category,
      coverImageUrl: input.coverImageUrl === undefined ? room.coverImageUrl : input.coverImageUrl,
      chatEnabled: input.chatEnabled ?? room.chatEnabled,
      giftEnabled: input.giftEnabled ?? room.giftEnabled,
    },
  });

  return serializeRoom(updatedRoom);
}

export async function publishRoom(actor: { userId: string }, roomId: string) {
  await assertApprovedHost(actor.userId);

  const room = await prisma.room.findUnique({
    where: {
      id: roomId,
    },
  });

  if (!room || room.hostId !== actor.userId) {
    throw new DomainError("ROOM_NOT_FOUND", 404, "Room not found.");
  }

  assertRoomCanBePublished(room.status);

  const existingLiveRoom = await prisma.room.findFirst({
    where: {
      hostId: actor.userId,
      status: "LIVE",
      id: {
        not: room.id,
      },
    },
  });

  if (existingLiveRoom) {
    throw new DomainError("ROOM_ALREADY_LIVE", 409, "Host already has a live room.");
  }

  return prisma.room.update({
    where: {
      id: room.id,
    },
    data: {
      status: "PUBLISHED",
      endedAt: null,
      forceEnded: false,
      forceEndReason: null,
      playbackUrl: buildPlaybackUrl(room.streamKey),
    },
  });
}

export async function endRoom(actor: { userId: string }, roomId: string) {
  const room = await prisma.room.findUnique({
    where: {
      id: roomId,
    },
  });

  if (!room || room.hostId !== actor.userId) {
    throw new DomainError("ROOM_NOT_FOUND", 404, "Room not found.");
  }

  assertRoomCanBeEndedByHost(room.status);

  return prisma.room.update({
    where: {
      id: room.id,
    },
    data: {
      status: "ENDED",
      endedAt: new Date(),
      disconnectedAt: null,
    },
  });
}

export async function removeRoom(actor: { userId: string }, roomId: string) {
  const room = await prisma.room.findUnique({
    where: {
      id: roomId,
    },
  });

  if (!room || room.hostId !== actor.userId) {
    throw new DomainError("ROOM_NOT_FOUND", 404, "Room not found.");
  }

  assertRoomCanBeRemovedByHost(room.status);

  const giftCount = await prisma.giftTransaction.count({
    where: {
      roomId: room.id,
    },
  });

  if (giftCount > 0) {
    const archived = await prisma.room.update({
      where: {
        id: room.id,
      },
      data: {
        status: "ARCHIVED",
      },
    });

    return {
      room: serializeRoom({ ...archived, playbackUrl: resolvePlaybackUrl(archived) }),
      outcome: "ARCHIVED" as const,
    };
  }

  await prisma.room.delete({
    where: {
      id: room.id,
    },
  });

  return {
    room: serializeRoom({ ...room, playbackUrl: resolvePlaybackUrl(room) }),
    outcome: "DELETED" as const,
  };
}

export async function forceEndRoom(admin: { userId: string }, roomId: string, reason: string) {
  const room = await prisma.room.findUnique({
    where: {
      id: roomId,
    },
  });

  if (!room) {
    throw new DomainError("ROOM_NOT_FOUND", 404, "Room not found.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.room.update({
      where: {
        id: room.id,
      },
      data: {
        status: "ENDED",
        forceEnded: true,
        forceEndReason: reason,
        endedAt: new Date(),
        disconnectedAt: null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorType: "ADMIN",
        actorUserId: admin.userId,
        entityType: "ROOM",
        entityId: room.id,
        action: "room.force_ended",
        metadata: {
          reason,
          previousStatus: room.status,
        },
      },
    });

    return updated;
  });
}

export async function getBroadcastConfig(actor: { userId: string }, roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
  });

  if (!room || room.hostId !== actor.userId) {
    throw new DomainError("ROOM_NOT_FOUND", 404, "Room not found.");
  }

  await assertApprovedHost(actor.userId);

  return {
    roomId: room.id,
    ingestUrl: env.RTMP_INGEST_URL,
    streamKey: room.streamKey,
    playbackUrl: buildPlaybackUrl(room.streamKey),
    roomStatus: room.status,
  };
}

export async function preflightBroadcast(
  actor: { userId: string },
  input: { roomId: string; platform: "WINDOWS" | "ANDROID" | "IOS"; appVersion: string; network: { uploadKbps: number; latencyMs: number } },
) {
  const room = await prisma.room.findUnique({
    where: { id: input.roomId },
  });

  if (!room || room.hostId !== actor.userId) {
    throw new DomainError("ROOM_NOT_FOUND", 404, "Room not found.");
  }

  if (room.status !== "PUBLISHED") {
    throw new DomainError("ROOM_NOT_PUBLISHED", 409, "Room must be published before broadcast start.");
  }

  const warnings: string[] = [];
  let allowed = true;

  if (input.network.uploadKbps < 1200) {
    allowed = false;
    warnings.push("UPLOAD_TOO_LOW");
  } else if (input.network.uploadKbps < 2000) {
    warnings.push("UPLOAD_AT_RISK");
  }

  if (input.network.latencyMs > 150) {
    warnings.push("HIGH_LATENCY");
  }

  return { allowed, warnings };
}

export async function getLiveSummary(actor: { userId: string }, roomId: string) {
  const room = await prisma.room.findUnique({
    where: {
      id: roomId,
    },
  });

  if (!room || room.hostId !== actor.userId) {
    throw new DomainError("ROOM_NOT_FOUND", 404, "Room not found.");
  }

  const summary = await prisma.giftTransaction.aggregate({
    where: {
      roomId: room.id,
      receiverId: actor.userId,
      status: "SUCCESS",
    },
    _sum: {
      totalDiamond: true,
    },
    _count: {
      _all: true,
    },
  });

  const durationSeconds =
    room.startedAt && room.endedAt ? Math.max(0, Math.floor((room.endedAt.getTime() - room.startedAt.getTime()) / 1000)) : 0;

  return {
    roomId: room.id,
    durationSeconds,
    peakViewers: 0,
    totalDiamond: summary._sum.totalDiamond ?? 0,
    giftCount: summary._count._all,
  };
}

async function assertRoomAccessibleForUser(actor: { userId: string; role: string }, roomId: string) {
  const room = await prisma.room.findUnique({
    where: {
      id: roomId,
    },
  });

  if (!room) {
    throw new DomainError("ROOM_NOT_FOUND", 404, "Room not found.");
  }

  if (room.status === "DRAFT" || room.status === "ARCHIVED") {
    const canAccessPrivateRoom = actor.role === "ADMIN" || actor.userId === room.hostId;

    if (!canAccessPrivateRoom) {
      assertRoomPubliclyVisible(room.status);
    }
  }

  return room;
}
