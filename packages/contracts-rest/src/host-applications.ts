import { z } from "zod";
import { hostApplicationStatusValues } from "@social-livestream/shared-types";
import { paginationSchema } from "./common.js";

export const createHostApplicationSchema = z.object({
  legalName: z.string().min(1).max(120),
  displayName: z.string().min(1).max(120),
  countryCode: z.string().length(2),
});

export const hostApplicationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  legalName: z.string(),
  displayName: z.string(),
  countryCode: z.string(),
  status: z.enum(hostApplicationStatusValues),
  reviewedByAdminId: z.string().uuid().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const reviewHostApplicationSchema = z.object({
  notes: z.string().min(1).max(500).optional(),
});

export const listHostApplicationsQuerySchema = paginationSchema.extend({
  status: z.enum(hostApplicationStatusValues).optional(),
});

