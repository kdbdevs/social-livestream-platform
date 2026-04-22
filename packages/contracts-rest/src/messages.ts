import { z } from "zod";
import { userRoleValues } from "@social-livestream/shared-types";

export const directParticipantSchema = z.object({
  id: z.string().uuid(),
  username: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  role: z.enum(userRoleValues),
  bio: z.string().nullable(),
});

export const directConversationPreviewSchema = z.object({
  id: z.string().uuid(),
  senderId: z.string().uuid(),
  message: z.string().max(1000),
  createdAt: z.string().datetime(),
});

export const directConversationThreadSchema = z.object({
  id: z.string().uuid(),
  participant: directParticipantSchema,
  lastMessage: directConversationPreviewSchema.nullable(),
  unreadCount: z.number().int().min(0),
  lastMessageAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const directConversationListSchema = z.object({
  conversations: z.array(directConversationThreadSchema),
});

export const directMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  sender: directParticipantSchema.pick({
    id: true,
    username: true,
    avatarUrl: true,
    role: true,
  }),
  message: z.string().max(1000),
  createdAt: z.string().datetime(),
});

export const directConversationMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const directConversationMessagesSchema = z.object({
  conversation: directConversationThreadSchema,
  messages: z.array(directMessageSchema),
});

export const createDirectConversationRequestSchema = z.object({
  participantUserId: z.string().uuid(),
  initialMessage: z.string().trim().min(1).max(1000).optional(),
});

export const sendDirectMessageRequestSchema = z.object({
  message: z.string().trim().min(1).max(1000),
});

export const directUserSearchQuerySchema = z.object({
  query: z.string().trim().min(1).max(80),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export const directUserSearchResultSchema = z.object({
  users: z.array(directParticipantSchema),
});
