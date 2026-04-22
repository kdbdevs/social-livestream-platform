import { z } from "zod";
import { userRoleValues, userStatusValues } from "@social-livestream/shared-types";

const notificationChannelValues = ["PUSH", "EMAIL", "IN_APP"] as const;

export const userSettingsProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string().nullable(),
  role: z.enum(userRoleValues),
  status: z.enum(userStatusValues),
  avatarUrl: z.string().url().nullable(),
  bio: z.string().nullable(),
  countryCode: z.string().length(2).nullable(),
  createdAt: z.string().datetime(),
  lastLoginAt: z.string().datetime().nullable(),
});

export const notificationPreferencesSchema = z.object({
  hostLive: z.boolean(),
  paymentSuccess: z.boolean(),
  withdrawalStatus: z.boolean(),
  moderationAlerts: z.boolean(),
  preferredChannel: z.enum(notificationChannelValues),
});

export const accountSettingsSchema = z.object({
  profile: userSettingsProfileSchema,
  notifications: notificationPreferencesSchema,
});

export const updateProfileRequestSchema = z.object({
  username: z.string().min(3).max(30),
  avatarUrl: z.string().url().nullable(),
  bio: z.string().max(280).nullable(),
  countryCode: z.string().length(2).nullable(),
});

export const updateNotificationPreferencesRequestSchema = notificationPreferencesSchema;

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(8).max(72),
  newPassword: z.string().min(8).max(72),
});
