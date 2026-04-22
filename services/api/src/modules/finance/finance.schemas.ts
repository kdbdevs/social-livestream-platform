import { z } from "zod";
import { currencyTypeValues } from "@social-livestream/shared-types";

const destinationMethodTypeValues = ["BANK_TRANSFER", "EWALLET", "MANUAL"] as const;

export const walletLedgerQuerySchema = z.object({
  currencyType: z.enum(currencyTypeValues).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const createWithdrawalRequestSchema = z.object({
  diamondAmount: z.coerce.number().int().positive(),
  destinationMethodType: z.enum(destinationMethodTypeValues),
  destinationDetails: z.record(z.string(), z.string().trim().min(1)).default({}),
});
