export const userRoleValues = ["VIEWER", "HOST", "ADMIN"] as const;
export type UserRole = (typeof userRoleValues)[number];

export const userStatusValues = ["ACTIVE", "SUSPENDED", "BANNED"] as const;
export type UserStatus = (typeof userStatusValues)[number];

export const hostApplicationStatusValues = ["PENDING", "APPROVED", "REJECTED"] as const;
export type HostApplicationStatus = (typeof hostApplicationStatusValues)[number];

export const roomStatusValues = ["DRAFT", "PUBLISHED", "LIVE", "ENDED", "ARCHIVED"] as const;
export type RoomStatus = (typeof roomStatusValues)[number];

export const currencyTypeValues = ["COIN", "DIAMOND"] as const;
export type CurrencyType = (typeof currencyTypeValues)[number];

export const walletLedgerDirectionValues = ["DEBIT", "CREDIT"] as const;
export type WalletLedgerDirection = (typeof walletLedgerDirectionValues)[number];

export const walletLedgerReferenceTypeValues = [
  "TOPUP",
  "GIFT_SEND",
  "GIFT_RECEIVE",
  "WITHDRAWAL",
  "ADJUSTMENT",
  "REFUND",
  "WITHDRAWAL_REFUND",
  "WITHDRAWAL_HOLD",
] as const;
export type WalletLedgerReferenceType = (typeof walletLedgerReferenceTypeValues)[number];

export const giftAnimationTierValues = ["SMALL", "BIG", "FULLSCREEN"] as const;
export type GiftAnimationTier = (typeof giftAnimationTierValues)[number];

export const auditActorTypeValues = ["USER", "ADMIN", "SYSTEM", "PROVIDER"] as const;
export type AuditActorType = (typeof auditActorTypeValues)[number];

export const auditEntityTypeValues = [
  "USER",
  "HOST_APPLICATION",
  "ROOM",
  "WALLET",
  "WALLET_LEDGER",
  "GIFT_TRANSACTION",
  "REPORT",
  "MODERATION_ACTION",
  "PAYMENT_ORDER",
  "WITHDRAWAL_REQUEST",
  "NOTIFICATION",
  "SYSTEM_CONFIG",
] as const;
export type AuditEntityType = (typeof auditEntityTypeValues)[number];

export const moderationActionTypeValues = [
  "MUTE",
  "KICK",
  "SUSPEND",
  "BAN",
  "FORCE_END_ROOM",
  "CHAT_DISABLE",
  "BALANCE_HOLD",
] as const;
export type ModerationActionType = (typeof moderationActionTypeValues)[number];

