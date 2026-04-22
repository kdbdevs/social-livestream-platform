import { z } from "zod";
import { ackFailureSchema, ackSuccessSchema } from "./common.js";

export const joinRoomSchema = z.object({
  roomId: z.string().uuid(),
});

export const joinRoomAckSchema = z.union([
  ackSuccessSchema.extend({ roomId: z.string().uuid() }),
  ackFailureSchema,
]);

export const heartbeatSchema = z.object({
  roomId: z.string().uuid(),
  clientTs: z.string().datetime(),
});

export const presenceSnapshotSchema = z.object({
  roomId: z.string().uuid(),
  activeViewerCount: z.number().int().nonnegative(),
  serverTs: z.string().datetime(),
});

