import { z } from "zod";
import { ackFailureSchema, ackSuccessSchema, publicUserSummarySchema, socketErrorSchema } from "./common.js";
import { giftAnimationTierValues } from "@social-livestream/shared-types";

export const sendGiftSchema = z.object({
  roomId: z.string().uuid(),
  giftId: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
  idempotencyKey: z.string().uuid(),
});

export const sendGiftAckSchema = z.union([
  ackSuccessSchema.extend({
    idempotencyKey: z.string().uuid(),
    transactionId: z.string().uuid(),
  }),
  ackFailureSchema.extend({
    idempotencyKey: z.string().uuid().optional(),
  }),
]);

export const giftEventSchema = z.object({
  roomId: z.string().uuid(),
  transactionId: z.string().uuid(),
  sender: publicUserSummarySchema,
  receiver: publicUserSummarySchema,
  gift: z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    coinPrice: z.number().int().nonnegative(),
    animationTier: z.enum(giftAnimationTierValues),
    iconUrl: z.string().url().nullable(),
  }),
  quantity: z.number().int().positive(),
  totalCoin: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export const giftRejectedSchema = z.object({
  roomId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  error: socketErrorSchema,
});

