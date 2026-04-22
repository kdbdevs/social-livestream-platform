import { z } from "zod";
import { roomStatusValues, userRoleValues } from "@social-livestream/shared-types";

export const followStateSchema = z.object({
  userId: z.string().uuid(),
  following: z.boolean(),
});

export const followingLiveRoomSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  category: z.string().nullable(),
  status: z.enum(roomStatusValues),
  coverImageUrl: z.string().url().nullable(),
  startedAt: z.string().datetime().nullable(),
});

export const followedUserSchema = z.object({
  id: z.string().uuid(),
  username: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  role: z.enum(userRoleValues),
  bio: z.string().nullable(),
  followedAt: z.string().datetime(),
  liveRoom: followingLiveRoomSchema.nullable(),
});

export const followingListSchema = z.object({
  users: z.array(followedUserSchema),
});
