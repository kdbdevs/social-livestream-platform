import { z } from "zod";

export const broadcastHealthSchema = z.object({
  roomId: z.string().uuid(),
  publishStatus: z.enum(["CONNECTING", "LIVE", "RECONNECTING", "FAILED", "ENDED"]),
  networkQuality: z.enum(["GOOD", "MODERATE", "POOR"]),
  bitrateKbps: z.number().int().nonnegative(),
  fps: z.number().int().nonnegative(),
  viewerCount: z.number().int().nonnegative(),
  serverTs: z.string().datetime(),
});

