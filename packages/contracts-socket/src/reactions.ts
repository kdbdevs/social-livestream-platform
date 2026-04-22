import { z } from "zod";
import { ackSuccessSchema } from "./common.js";

export const sendLikeSchema = z.object({
  roomId: z.string().uuid(),
  count: z.number().int().min(1).max(20),
});

export const sendLikeAckSchema = ackSuccessSchema.extend({
  acceptedCount: z.number().int().min(1).max(20),
});

export const likeAggregateSchema = z.object({
  roomId: z.string().uuid(),
  delta: z.number().int().nonnegative(),
  windowMs: z.number().int().positive(),
  totalApprox: z.number().int().nonnegative(),
  serverTs: z.string().datetime(),
});

