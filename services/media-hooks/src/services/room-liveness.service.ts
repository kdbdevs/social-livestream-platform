import { loadEnv } from "@social-livestream/config";
import { prisma } from "@social-livestream/db";
import { assertRoomCanGoLiveFromMedia, DomainError } from "@social-livestream/domain-core";

const env = loadEnv();
const graceTimers = new Map<string, NodeJS.Timeout>();

function buildPlaybackUrl(streamKey: string): string {
  return `${env.PLAYBACK_BASE_URL.replace(/\/$/, "")}/${streamKey}.m3u8`;
}

async function clearGraceTimer(roomId: string): Promise<void> {
  const timer = graceTimers.get(roomId);

  if (timer) {
    clearTimeout(timer);
    graceTimers.delete(roomId);
  }
}

export async function handleOnPublish(input: { streamKey: string; bitrateKbps?: number; fps?: number }) {
  const room = await prisma.room.findUnique({
    where: {
      streamKey: input.streamKey,
    },
  });

  if (!room) {
    throw new DomainError("STREAM_KEY_INVALID", 404, "Stream key is invalid.");
  }

  if (room.forceEnded) {
    throw new DomainError("ROOM_STATE_INVALID", 409, "Room was force-ended and cannot go live.");
  }

  assertRoomCanGoLiveFromMedia(room.status, room.disconnectedAt);

  await clearGraceTimer(room.id);

  const now = new Date();
  const playbackUrl = buildPlaybackUrl(room.streamKey);

  return prisma.$transaction(async (tx) => {
    const updatedRoom = await tx.room.update({
      where: {
        id: room.id,
      },
      data: {
        status: "LIVE",
        startedAt: room.startedAt ?? now,
        disconnectedAt: null,
        endedAt: null,
        playbackUrl,
      },
    });

    await tx.mediaSession.upsert({
      where: {
        id: room.id,
      },
      update: {
        streamKey: room.streamKey,
        publishStartedAt: now,
        publishEndedAt: null,
        isActive: true,
        lastKnownBitrateKbps: input.bitrateKbps ?? null,
        lastKnownFps: input.fps ?? null,
      },
      create: {
        id: room.id,
        roomId: room.id,
        streamKey: room.streamKey,
        publishStartedAt: now,
        isActive: true,
        lastKnownBitrateKbps: input.bitrateKbps ?? null,
        lastKnownFps: input.fps ?? null,
      },
    });

    return updatedRoom;
  });
}

export async function scheduleDisconnectGrace(roomId: string): Promise<void> {
  await clearGraceTimer(roomId);

  const timer = setTimeout(async () => {
    try {
      const room = await prisma.room.findUnique({
        where: {
          id: roomId,
        },
      });

      if (!room || room.status !== "LIVE" || !room.disconnectedAt) {
        graceTimers.delete(roomId);
        return;
      }

      const elapsedSeconds = Math.floor((Date.now() - room.disconnectedAt.getTime()) / 1000);

      if (elapsedSeconds < env.ROOM_DISCONNECT_GRACE_SECONDS) {
        graceTimers.delete(roomId);
        return;
      }

      await prisma.$transaction(async (tx) => {
        await tx.room.update({
          where: {
            id: room.id,
          },
          data: {
            status: "ENDED",
            endedAt: new Date(),
          },
        });

        await tx.mediaSession.updateMany({
          where: {
            roomId: room.id,
            isActive: true,
          },
          data: {
            isActive: false,
            publishEndedAt: new Date(),
          },
        });
      });
    } finally {
      graceTimers.delete(roomId);
    }
  }, env.ROOM_DISCONNECT_GRACE_SECONDS * 1000);

  graceTimers.set(roomId, timer);
}

export async function handleOnUnpublish(input: { streamKey: string }) {
  const room = await prisma.room.findUnique({
    where: {
      streamKey: input.streamKey,
    },
  });

  if (!room) {
    throw new DomainError("STREAM_KEY_INVALID", 404, "Stream key is invalid.");
  }

  const disconnectedAt = new Date();

  const updatedRoom = await prisma.$transaction(async (tx) => {
    const nextRoom = await tx.room.update({
      where: {
        id: room.id,
      },
      data: {
        disconnectedAt,
      },
    });

    await tx.mediaSession.updateMany({
      where: {
        roomId: room.id,
        isActive: true,
      },
      data: {
        isActive: false,
        publishEndedAt: disconnectedAt,
        disconnectCount: {
          increment: 1,
        },
      },
    });

    return nextRoom;
  });

  await scheduleDisconnectGrace(room.id);
  return updatedRoom;
}
