import { prisma } from "@social-livestream/db";
import { DomainError } from "@social-livestream/domain-core";

type WalletLedgerQuery = {
  currencyType?: "COIN" | "DIAMOND";
  limit: number;
};

type CreateWithdrawalRequestInput = {
  diamondAmount: number;
  destinationMethodType: "BANK_TRANSFER" | "EWALLET" | "MANUAL";
  destinationDetails: Record<string, string>;
};

function serializeWallet(wallet: { currencyType: "COIN" | "DIAMOND"; balanceAvailable: number; balanceLocked: number }) {
  return {
    currencyType: wallet.currencyType,
    balanceAvailable: wallet.balanceAvailable,
    balanceLocked: wallet.balanceLocked,
  };
}

function serializeWalletLedger(entry: {
  id: string;
  direction: string;
  amount: number;
  balanceAfter: number;
  referenceType: string;
  createdAt: Date;
  wallet: { currencyType: "COIN" | "DIAMOND" };
}) {
  return {
    id: entry.id,
    currencyType: entry.wallet.currencyType,
    direction: entry.direction,
    referenceType: entry.referenceType,
    amount: entry.amount,
    balanceAfter: entry.balanceAfter,
    createdAt: entry.createdAt.toISOString(),
  };
}

function serializeWithdrawal(entry: {
  id: string;
  status: string;
  diamondAmount: number;
  cashAmount: number;
  createdAt: Date;
}) {
  return {
    id: entry.id,
    status: entry.status,
    diamondAmount: entry.diamondAmount,
    cashAmount: entry.cashAmount,
    createdAt: entry.createdAt.toISOString(),
  };
}

async function assertApprovedHost(userId: string): Promise<void> {
  const application = await prisma.hostApplication.findUnique({
    where: {
      userId,
    },
  });

  if (!application || application.status !== "APPROVED") {
    throw new DomainError("HOST_NOT_APPROVED", 403, "Only approved hosts can access withdrawal data.");
  }
}

async function getNumericSystemConfig(key: string, fallbackValue: number): Promise<number> {
  const config = await prisma.systemConfig.findUnique({
    where: { key },
  });

  const rawValue = config?.value;
  const numericValue =
    typeof rawValue === "number"
      ? rawValue
      : typeof rawValue === "string"
        ? Number(rawValue)
        : fallbackValue;

  return Number.isFinite(numericValue) ? numericValue : fallbackValue;
}

export async function getWallets(userId: string) {
  const wallets = await prisma.wallet.findMany({
    where: {
      userId,
    },
    orderBy: [{ currencyType: "asc" }],
  });

  return wallets.map(serializeWallet);
}

export async function getWalletLedger(userId: string, input: WalletLedgerQuery) {
  const entries = await prisma.walletLedger.findMany({
    where: {
      wallet: {
        userId,
        ...(input.currencyType ? { currencyType: input.currencyType } : {}),
      },
    },
    include: {
      wallet: {
        select: {
          currencyType: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: input.limit,
  });

  return entries.map(serializeWalletLedger);
}

export async function getHostWithdrawals(userId: string) {
  await assertApprovedHost(userId);

  const entries = await prisma.withdrawalRequest.findMany({
    where: {
      hostUserId: userId,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  return entries.map(serializeWithdrawal);
}

export async function createWithdrawalRequest(actor: { userId: string }, input: CreateWithdrawalRequestInput) {
  await assertApprovedHost(actor.userId);

  const [minimumDiamond, dailyCapDiamond, conversionRate] = await Promise.all([
    getNumericSystemConfig("withdrawal.min_diamond", 1000),
    getNumericSystemConfig("withdrawal.daily_cap_diamond", 100000),
    getNumericSystemConfig("withdrawal.diamond_to_cash_rate", 1),
  ]);

  if (input.diamondAmount < minimumDiamond) {
    throw new DomainError(
      "WITHDRAWAL_NOT_ALLOWED",
      409,
      `Minimum withdrawal is ${minimumDiamond} diamond.`,
      { minimumDiamond },
    );
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return prisma.$transaction(async (tx) => {
    const diamondWallet = await tx.wallet.findUnique({
      where: {
        userId_currencyType: {
          userId: actor.userId,
          currencyType: "DIAMOND",
        },
      },
    });

    if (!diamondWallet) {
      throw new DomainError("USER_NOT_FOUND", 404, "Diamond wallet not found.");
    }

    if (diamondWallet.balanceAvailable < input.diamondAmount) {
      throw new DomainError("INSUFFICIENT_BALANCE", 409, "Insufficient diamond balance.");
    }

    const dailyAggregate = await tx.withdrawalRequest.aggregate({
      where: {
        hostUserId: actor.userId,
        createdAt: {
          gte: startOfDay,
        },
        status: {
          notIn: ["REJECTED", "FAILED", "CANCELED"],
        },
      },
      _sum: {
        diamondAmount: true,
      },
    });

    const dailyRequestedDiamond = dailyAggregate._sum.diamondAmount ?? 0;

    if (dailyRequestedDiamond + input.diamondAmount > dailyCapDiamond) {
      throw new DomainError(
        "WITHDRAWAL_NOT_ALLOWED",
        409,
        `Daily withdrawal cap is ${dailyCapDiamond} diamond.`,
        { dailyCapDiamond },
      );
    }

    const updatedWallet = await tx.wallet.update({
      where: {
        id: diamondWallet.id,
      },
      data: {
        balanceAvailable: {
          decrement: input.diamondAmount,
        },
        balanceLocked: {
          increment: input.diamondAmount,
        },
      },
    });

    const debitLedger = await tx.walletLedger.create({
      data: {
        walletId: diamondWallet.id,
        direction: "DEBIT",
        amount: input.diamondAmount,
        balanceBefore: diamondWallet.balanceAvailable,
        balanceAfter: updatedWallet.balanceAvailable,
        referenceType: "WITHDRAWAL_HOLD",
        referenceId: diamondWallet.id,
        metadata: {
          destinationMethodType: input.destinationMethodType,
        },
      },
    });

    const withdrawal = await tx.withdrawalRequest.create({
      data: {
        hostUserId: actor.userId,
        diamondAmount: input.diamondAmount,
        cashAmount: input.diamondAmount * conversionRate,
        conversionRateSnapshot: conversionRate,
        destinationMethodType: input.destinationMethodType,
        destinationMaskedDetails: input.destinationDetails,
        status: "REQUESTED",
      },
    });

    await tx.withdrawalLedgerLink.create({
      data: {
        withdrawalRequestId: withdrawal.id,
        walletLedgerDebitId: debitLedger.id,
      },
    });

    await tx.auditLog.create({
      data: {
        actorType: "USER",
        actorUserId: actor.userId,
        entityType: "WITHDRAWAL_REQUEST",
        entityId: withdrawal.id,
        action: "withdrawal.requested",
        metadata: {
          diamondAmount: input.diamondAmount,
          destinationMethodType: input.destinationMethodType,
        },
      },
    });

    return serializeWithdrawal(withdrawal);
  });
}
