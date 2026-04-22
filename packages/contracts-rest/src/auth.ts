import { z } from "zod";
import { userRoleValues, userStatusValues } from "@social-livestream/shared-types";

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string().nullable(),
  role: z.enum(userRoleValues),
  status: z.enum(userStatusValues),
  avatarUrl: z.string().url().nullable(),
  createdAt: z.string().datetime(),
});

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  username: z.string().min(3).max(30),
});

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

export const authSuccessSchema = z.object({
  user: userSchema,
  accessToken: z.string(),
});

