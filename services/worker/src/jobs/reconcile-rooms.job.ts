import { loadEnv } from "@social-livestream/config";
import { prisma } from "@social-livestream/db";

const env = loadEnv();

export async function reconcileDisconnectedRooms(): Promise<number> {
  const cutoff = new Date(Date.now() - env.ROOM_DISCONNECT_GRACE_SECONDS * 1000);

  const result = await prisma.room.updateMany({
    where: {
      status: "LIVE",
      disconnectedAt: {
        lte: cutoff,
      },
      forceEnded: false,
    },
    data: {
      status: "ENDED",
      endedAt: new Date(),
    },
  });

  if (result.count > 0) {
    await prisma.mediaSession.updateMany({
      where: {
        room: {
          status: "ENDED",
          disconnectedAt: {
            lte: cutoff,
          },
        },
        isActive: true,
      },
      data: {
        isActive: false,
        publishEndedAt: new Date(),
      },
    });
  }

  return result.count;
}

