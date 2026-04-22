import type { FastifyInstance } from "fastify";
import { createWithdrawalRequestSchema, walletLedgerQuerySchema } from "./finance.schemas.js";
import {
  createWithdrawalRequest,
  getHostWithdrawals,
  getWalletLedger,
  getWallets,
} from "./finance.service.js";
import { requireActiveUser } from "../../common/auth.js";
import { successResponse } from "../../common/http.js";
import { parseWithSchema } from "../../common/validation.js";

export async function registerFinanceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/wallets/me", async (request) => {
    const actor = await requireActiveUser(request);
    const wallets = await getWallets(actor.userId);
    return successResponse({ wallets });
  });

  app.get("/wallets/me/ledger", async (request) => {
    const actor = await requireActiveUser(request);
    const query = parseWithSchema(walletLedgerQuerySchema, request.query);
    const entries = await getWalletLedger(actor.userId, query);
    return successResponse({ entries });
  });

  app.get("/withdrawals/me", async (request) => {
    const actor = await requireActiveUser(request);
    const requests = await getHostWithdrawals(actor.userId);
    return successResponse({ requests });
  });

  app.post("/withdrawals/requests", async (request, reply) => {
    const actor = await requireActiveUser(request);
    const body = parseWithSchema(createWithdrawalRequestSchema, request.body);
    const withdrawal = await createWithdrawalRequest(actor, body);
    reply.status(201).send(successResponse(withdrawal));
  });
}
