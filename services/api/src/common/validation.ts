import type { ZodTypeAny, infer as ZodInfer } from "zod";
import { DomainError } from "@social-livestream/domain-core";

export function parseWithSchema<TSchema extends ZodTypeAny>(schema: TSchema, input: unknown): ZodInfer<TSchema> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new DomainError("VALIDATION_ERROR", 400, "Request validation failed.", {
      issues: result.error.flatten(),
    });
  }

  return result.data;
}
