import { z } from "zod";

export const broadcastConfigQuerySchema = z.object({
  roomId: z.string().uuid(),
});

export const broadcastPreflightSchema = z.object({
  roomId: z.string().uuid(),
  platform: z.enum(["WINDOWS", "ANDROID", "IOS"]),
  appVersion: z.string().min(1).max(50),
  network: z.object({
    uploadKbps: z.number().int().nonnegative(),
    latencyMs: z.number().int().nonnegative(),
  }),
});

