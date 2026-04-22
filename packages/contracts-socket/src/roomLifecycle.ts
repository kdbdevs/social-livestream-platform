import { z } from "zod";

export const roomLiveSchema = z.object({
  roomId: z.string().uuid(),
  playbackUrl: z.string().url(),
  startedAt: z.string().datetime(),
});

export const roomEndedSchema = z.object({
  roomId: z.string().uuid(),
  endedAt: z.string().datetime(),
  reasonCode: z.enum(["HOST_ENDED", "ADMIN_FORCE_ENDED", "STREAM_TIMEOUT", "POLICY_ENFORCEMENT"]),
});

