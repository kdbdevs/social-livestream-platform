import { z } from "zod";
import { ackFailureSchema, ackSuccessSchema, publicUserSummarySchema, socketErrorSchema } from "./common.js";

export const sendChatSchema = z.object({
  roomId: z.string().uuid(),
  clientMessageId: z.string().uuid(),
  message: z.string().min(1).max(200),
});

export const sendChatAckSchema = z.union([
  ackSuccessSchema.extend({ clientMessageId: z.string().uuid() }),
  ackFailureSchema.extend({ clientMessageId: z.string().uuid().optional() }),
]);

export const chatMessageSchema = z.object({
  roomId: z.string().uuid(),
  messageId: z.string().uuid(),
  clientMessageId: z.string().uuid(),
  sender: publicUserSummarySchema,
  message: z.string().max(200),
  createdAt: z.string().datetime(),
});

export const chatRejectedSchema = z.object({
  roomId: z.string().uuid(),
  clientMessageId: z.string().uuid(),
  error: socketErrorSchema,
});

