import { z } from "zod";
import { roomStatusValues, userRoleValues } from "@social-livestream/shared-types";
import { paginationSchema } from "./common.js";

export const roomSchema = z.object({
  id: z.string().uuid(),
  hostId: z.string().uuid(),
  title: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),
  coverImageUrl: z.string().url().nullable(),
  category: z.string().nullable(),
  status: z.enum(roomStatusValues),
  chatEnabled: z.boolean(),
  giftEnabled: z.boolean(),
  playbackUrl: z.string().url().nullable(),
  viewerCount: z.number().int().nonnegative(),
  startedAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const roomChatMessageSchema = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid(),
  clientMessageId: z.string().uuid().nullable(),
  sender: z.object({
    id: z.string().uuid(),
    username: z.string().nullable(),
    avatarUrl: z.string().url().nullable(),
    role: z.enum(userRoleValues),
  }),
  message: z.string().min(1).max(200),
  createdAt: z.string().datetime(),
});

export const createRoomSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  coverImageUrl: z.string().url().nullable().optional(),
});

export const updateRoomSchema = z
  .object({
    title: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    category: z.string().max(100).nullable().optional(),
    coverImageUrl: z.string().url().nullable().optional(),
    chatEnabled: z.boolean().optional(),
    giftEnabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one room field must be provided.");

export const roomsQuerySchema = paginationSchema.extend({
  status: z.enum(roomStatusValues).optional(),
});

export const liveRoomsQuerySchema = paginationSchema.extend({
  category: z.string().optional(),
});

export const roomChatHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const roomViewRecordedSchema = z.object({
  roomId: z.string().uuid(),
  watchedAt: z.string().datetime(),
});

export const watchHistoryItemSchema = z.object({
  watchedAt: z.string().datetime(),
  room: roomSchema,
});

export const watchHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const roomSaveStateSchema = z.object({
  roomId: z.string().uuid(),
  saved: z.boolean(),
});

export const savedRoomsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const savedRoomItemSchema = z.object({
  savedAt: z.string().datetime(),
  room: roomSchema,
});

export const forceEndRoomSchema = z.object({
  reason: z.string().min(1).max(500),
});
