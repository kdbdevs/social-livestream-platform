export const apiErrorCodeValues = [
  "UNAUTHORIZED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "USER_BANNED",
  "HOST_NOT_APPROVED",
  "ROOM_NOT_FOUND",
  "CONVERSATION_NOT_FOUND",
  "ROOM_NOT_LIVE",
  "ROOM_NOT_PUBLISHED",
  "ROOM_ALREADY_LIVE",
  "INSUFFICIENT_BALANCE",
  "GIFT_NOT_FOUND",
  "IDEMPOTENCY_CONFLICT",
  "PAYMENT_ORDER_NOT_FOUND",
  "WITHDRAWAL_NOT_ALLOWED",
  "MODERATION_RESTRICTED",
  "HOST_APPLICATION_NOT_FOUND",
  "ROOM_STATE_INVALID",
  "USER_NOT_FOUND",
  "STREAM_KEY_INVALID",
  "CHAT_DISABLED",
  "INVALID_PAYLOAD",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof apiErrorCodeValues)[number];

export class DomainError extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ApiErrorCode, statusCode: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function isDomainError(value: unknown): value is DomainError {
  return value instanceof DomainError;
}
