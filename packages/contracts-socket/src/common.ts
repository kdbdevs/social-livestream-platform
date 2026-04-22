import { z } from "zod";
import { userRoleValues } from "@social-livestream/shared-types";

export const publicUserSummarySchema = z.object({
  id: z.string().uuid(),
  username: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  role: z.enum(userRoleValues),
});

export const socketErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

export const ackSuccessSchema = z.object({
  ok: z.literal(true),
});

export const ackFailureSchema = z.object({
  ok: z.literal(false),
  error: socketErrorSchema,
});

