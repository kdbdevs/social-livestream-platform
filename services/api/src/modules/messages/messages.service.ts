import type { Prisma } from "@prisma/client";
import { prisma } from "@social-livestream/db";
import { DomainError } from "@social-livestream/domain-core";

const participantSelect = {
  id: true,
  username: true,
  avatarUrl: true,
  role: true,
  bio: true,
} as const;

const senderSelect = {
  id: true,
  username: true,
  avatarUrl: true,
  role: true,
} as const;

const directConversationInclude = {
  firstParticipant: {
    select: participantSelect,
  },
  secondParticipant: {
    select: participantSelect,
  },
  messages: {
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1,
    select: {
      id: true,
      senderId: true,
      message: true,
      createdAt: true,
    },
  },
} satisfies Prisma.DirectConversationInclude;

type DirectConversationRecord = Prisma.DirectConversationGetPayload<{
  include: typeof directConversationInclude;
}>;

export async function listDirectConversations(actor: { userId: string }) {
  const conversations = await prisma.directConversation.findMany({
    where: {
      OR: [{ firstParticipantId: actor.userId }, { secondParticipantId: actor.userId }],
    },
    include: directConversationInclude,
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
  });

  const unreadCounts = await Promise.all(
    conversations.map((conversation) => countUnreadMessagesForActor(actor.userId, conversation)),
  );

  return {
    conversations: conversations.map((conversation, index) =>
      serializeConversationThread(actor.userId, conversation, unreadCounts[index] ?? 0),
    ),
  };
}

export async function searchDirectUsers(actor: { userId: string }, input: { query: string; limit: number }) {
  const normalizedQuery = input.query.trim().replace(/^@+/, "");

  const users = await prisma.user.findMany({
    where: {
      id: {
        not: actor.userId,
      },
      status: "ACTIVE",
      OR: [
        {
          username: {
            contains: normalizedQuery,
            mode: "insensitive",
          },
        },
        {
          email: {
            contains: normalizedQuery,
            mode: "insensitive",
          },
        },
      ],
    },
    orderBy: [{ username: "asc" }, { createdAt: "desc" }],
    take: input.limit,
    select: participantSelect,
  });

  return {
    users: users.map((user) => serializeParticipant(user)),
  };
}

export async function createOrGetDirectConversation(
  actor: { userId: string },
  input: { participantUserId: string; initialMessage?: string },
) {
  const pair = normalizeConversationPair(actor.userId, input.participantUserId);
  await assertDirectParticipantExists(input.participantUserId);

  const conversationId = await prisma.$transaction(async (tx) => {
    const conversation = await tx.directConversation.upsert({
      where: {
        firstParticipantId_secondParticipantId: {
          firstParticipantId: pair.firstParticipantId,
          secondParticipantId: pair.secondParticipantId,
        },
      },
      create: {
        firstParticipantId: pair.firstParticipantId,
        secondParticipantId: pair.secondParticipantId,
        firstParticipantReadAt: pair.firstParticipantId === actor.userId ? new Date() : null,
        secondParticipantReadAt: pair.secondParticipantId === actor.userId ? new Date() : null,
      },
      update: {},
      select: {
        id: true,
      },
    });

    if (input.initialMessage?.trim()) {
      const createdMessage = await tx.directMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: actor.userId,
          message: input.initialMessage.trim(),
        },
        select: {
          createdAt: true,
        },
      });

      await tx.directConversation.update({
        where: {
          id: conversation.id,
        },
        data: {
          lastMessageAt: createdMessage.createdAt,
          firstParticipantReadAt: pair.firstParticipantId === actor.userId ? createdMessage.createdAt : undefined,
          secondParticipantReadAt: pair.secondParticipantId === actor.userId ? createdMessage.createdAt : undefined,
        },
      });
    }

    return conversation.id;
  });

  return {
    conversation: await getDirectConversationThread(actor, conversationId),
  };
}

export async function getDirectConversationMessages(
  actor: { userId: string },
  conversationId: string,
  input: { limit: number },
) {
  const conversation = await fetchDirectConversationRecordForActor(actor.userId, conversationId);
  const messages = await prisma.directMessage.findMany({
    where: {
      conversationId,
    },
    include: {
      sender: {
        select: senderSelect,
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: input.limit,
  });
  const unreadCount = await countUnreadMessagesForActor(actor.userId, conversation);

  return {
    conversation: serializeConversationThread(actor.userId, conversation, unreadCount),
    messages: messages.reverse().map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      sender: serializeSender(message.sender),
      message: message.message,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

export async function sendDirectMessage(
  actor: { userId: string },
  conversationId: string,
  input: { message: string },
) {
  const message = await prisma.$transaction(async (tx) => {
    const conversation = await tx.directConversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ firstParticipantId: actor.userId }, { secondParticipantId: actor.userId }],
      },
      select: {
        id: true,
        firstParticipantId: true,
        secondParticipantId: true,
      },
    });

    if (!conversation) {
      throw new DomainError("CONVERSATION_NOT_FOUND", 404, "Conversation not found.");
    }

    const createdMessage = await tx.directMessage.create({
      data: {
        conversationId: conversation.id,
        senderId: actor.userId,
        message: input.message.trim(),
      },
      include: {
        sender: {
          select: senderSelect,
        },
      },
    });

    await tx.directConversation.update({
      where: {
        id: conversation.id,
      },
      data: {
        lastMessageAt: createdMessage.createdAt,
        firstParticipantReadAt: conversation.firstParticipantId === actor.userId ? createdMessage.createdAt : undefined,
        secondParticipantReadAt: conversation.secondParticipantId === actor.userId ? createdMessage.createdAt : undefined,
      },
    });

    return createdMessage;
  });

  return {
    message: {
      id: message.id,
      conversationId: message.conversationId,
      sender: serializeSender(message.sender),
      message: message.message,
      createdAt: message.createdAt.toISOString(),
    },
  };
}

export async function markDirectConversationRead(actor: { userId: string }, conversationId: string) {
  const conversation = await prisma.directConversation.findFirst({
    where: {
      id: conversationId,
      OR: [{ firstParticipantId: actor.userId }, { secondParticipantId: actor.userId }],
    },
    select: {
      id: true,
      firstParticipantId: true,
      secondParticipantId: true,
    },
  });

  if (!conversation) {
    throw new DomainError("CONVERSATION_NOT_FOUND", 404, "Conversation not found.");
  }

  const readAt = new Date();

  await prisma.directConversation.update({
    where: {
      id: conversation.id,
    },
    data: {
      firstParticipantReadAt: conversation.firstParticipantId === actor.userId ? readAt : undefined,
      secondParticipantReadAt: conversation.secondParticipantId === actor.userId ? readAt : undefined,
    },
  });

  return {
    conversationId: conversation.id,
    readAt: readAt.toISOString(),
  };
}

async function getDirectConversationThread(actor: { userId: string }, conversationId: string) {
  const conversation = await fetchDirectConversationRecordForActor(actor.userId, conversationId);
  const unreadCount = await countUnreadMessagesForActor(actor.userId, conversation);
  return serializeConversationThread(actor.userId, conversation, unreadCount);
}

async function fetchDirectConversationRecordForActor(actorUserId: string, conversationId: string) {
  const conversation = await prisma.directConversation.findFirst({
    where: {
      id: conversationId,
      OR: [{ firstParticipantId: actorUserId }, { secondParticipantId: actorUserId }],
    },
    include: directConversationInclude,
  });

  if (!conversation) {
    throw new DomainError("CONVERSATION_NOT_FOUND", 404, "Conversation not found.");
  }

  return conversation;
}

async function countUnreadMessagesForActor(actorUserId: string, conversation: DirectConversationRecord) {
  const readAt = conversation.firstParticipantId === actorUserId
    ? conversation.firstParticipantReadAt
    : conversation.secondParticipantReadAt;

  return prisma.directMessage.count({
    where: {
      conversationId: conversation.id,
      senderId: {
        not: actorUserId,
      },
      createdAt: readAt
        ? {
            gt: readAt,
          }
        : undefined,
    },
  });
}

async function assertDirectParticipantExists(userId: string) {
  const targetUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!targetUser) {
    throw new DomainError("USER_NOT_FOUND", 404, "Target user not found.");
  }

  if (targetUser.status !== "ACTIVE") {
    throw new DomainError("VALIDATION_ERROR", 409, "Target user is not available for private chat.");
  }
}

function normalizeConversationPair(firstUserId: string, secondUserId: string) {
  if (firstUserId === secondUserId) {
    throw new DomainError("VALIDATION_ERROR", 409, "Users cannot start a private chat with themselves.");
  }

  return firstUserId < secondUserId
    ? {
        firstParticipantId: firstUserId,
        secondParticipantId: secondUserId,
      }
    : {
        firstParticipantId: secondUserId,
        secondParticipantId: firstUserId,
      };
}

function serializeConversationThread(actorUserId: string, conversation: DirectConversationRecord, unreadCount: number) {
  const participant = conversation.firstParticipantId === actorUserId
    ? conversation.secondParticipant
    : conversation.firstParticipant;
  const lastMessage = conversation.messages[0];

  return {
    id: conversation.id,
    participant: serializeParticipant(participant),
    lastMessage: lastMessage
      ? {
          id: lastMessage.id,
          senderId: lastMessage.senderId,
          message: lastMessage.message,
          createdAt: lastMessage.createdAt.toISOString(),
        }
      : null,
    unreadCount,
    lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

function serializeParticipant(user: {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  role: "VIEWER" | "HOST" | "ADMIN";
  bio: string | null;
}) {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    role: user.role,
    bio: user.bio,
  };
}

function serializeSender(user: {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  role: "VIEWER" | "HOST" | "ADMIN";
}) {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    role: user.role,
  };
}
