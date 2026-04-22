import { z } from "zod";

export const successEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z.record(z.unknown()).optional(),
  });

export const errorEnvelopeSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

export const uuidSchema = z.string().uuid();
export const optionalCursorSchema = z.string().uuid().optional();
export const paginationSchema = z.object({
  cursor: optionalCursorSchema,
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

