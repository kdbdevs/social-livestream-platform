import { prisma } from "@social-livestream/db";
import { DomainError } from "@social-livestream/domain-core";

async function assertFollowTargetExists(targetUserId: string): Promise<void> {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });

  if (!targetUser) {
    throw new DomainError("USER_NOT_FOUND", 404, "Target user not found.");
  }
}

function assertNotSelfFollow(actorUserId: string, targetUserId: string): void {
  if (actorUserId === targetUserId) {
    throw new DomainError("VALIDATION_ERROR", 409, "Users cannot follow themselves.");
  }
}

export async function getUserFollowState(actor: { userId: string }, targetUserId: string) {
  assertNotSelfFollow(actor.userId, targetUserId);
  await assertFollowTargetExists(targetUserId);

  const follow = await prisma.hostFollow.findUnique({
    where: {
      viewerId_hostId: {
        viewerId: actor.userId,
        hostId: targetUserId,
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  return {
    userId: targetUserId,
    following: follow?.status === "ACTIVE",
  };
}

export async function listFollowedUsers(actor: { userId: string }) {
  const follows = await prisma.hostFollow.findMany({
    where: {
      viewerId: actor.userId,
      status: "ACTIVE",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      createdAt: true,
      host: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          role: true,
          bio: true,
        },
      },
    },
  });

  const hostIds = follows.map((follow) => follow.host.id);
  const activeRooms = hostIds.length
    ? await prisma.room.findMany({
        where: {
          hostId: { in: hostIds },
          status: { in: ["LIVE", "PUBLISHED"] },
        },
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          hostId: true,
          title: true,
          category: true,
          status: true,
          coverImageUrl: true,
          startedAt: true,
        },
      })
    : [];

  const preferredRoomByHostId = new Map<string, (typeof activeRooms)[number]>();

  for (const room of activeRooms) {
    const currentRoom = preferredRoomByHostId.get(room.hostId);

    if (!currentRoom) {
      preferredRoomByHostId.set(room.hostId, room);
      continue;
    }

    if (currentRoom.status !== "LIVE" && room.status === "LIVE") {
      preferredRoomByHostId.set(room.hostId, room);
    }
  }

  return {
    users: follows.map((follow) => {
      const liveRoom = preferredRoomByHostId.get(follow.host.id);

      return {
        id: follow.host.id,
        username: follow.host.username,
        avatarUrl: follow.host.avatarUrl,
        role: follow.host.role,
        bio: follow.host.bio,
        followedAt: follow.createdAt.toISOString(),
        liveRoom: liveRoom
          ? {
              id: liveRoom.id,
              title: liveRoom.title,
              category: liveRoom.category,
              status: liveRoom.status,
              coverImageUrl: liveRoom.coverImageUrl,
              startedAt: liveRoom.startedAt?.toISOString() ?? null,
            }
          : null,
      };
    }),
  };
}

export async function followUser(actor: { userId: string }, targetUserId: string) {
  assertNotSelfFollow(actor.userId, targetUserId);
  await assertFollowTargetExists(targetUserId);

  await prisma.hostFollow.upsert({
    where: {
      viewerId_hostId: {
        viewerId: actor.userId,
        hostId: targetUserId,
      },
    },
    create: {
      viewerId: actor.userId,
      hostId: targetUserId,
      status: "ACTIVE",
    },
    update: {
      status: "ACTIVE",
    },
  });

  return {
    userId: targetUserId,
    following: true,
  };
}

export async function unfollowUser(actor: { userId: string }, targetUserId: string) {
  assertNotSelfFollow(actor.userId, targetUserId);
  await assertFollowTargetExists(targetUserId);

  await prisma.hostFollow.deleteMany({
    where: {
      viewerId: actor.userId,
      hostId: targetUserId,
    },
  });

  return {
    userId: targetUserId,
    following: false,
  };
}
