import { z } from "zod";

export const userMutedSchema = z.object({
  roomId: z.string().uuid(),
  targetUserId: z.string().uuid(),
  until: z.string().datetime(),
  reason: z.string(),
});

export const userKickedSchema = z.object({
  roomId: z.string().uuid(),
  targetUserId: z.string().uuid(),
  reason: z.string(),
});

export const roomChatDisabledSchema = z.object({
  roomId: z.string().uuid(),
  reason: z.string(),
});

export const accountRestrictedSchema = z.object({
  code: z.string(),
  message: z.string(),
});

