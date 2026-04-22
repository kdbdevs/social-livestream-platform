import type { PrismaClient } from "@prisma/client";

export async function ensureWallets(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.wallet.upsert({
    where: {
      userId_currencyType: {
        userId,
        currencyType: "COIN",
      },
    },
    update: {},
    create: {
      userId,
      currencyType: "COIN",
      balanceAvailable: 0,
    },
  });

  await prisma.wallet.upsert({
    where: {
      userId_currencyType: {
        userId,
        currencyType: "DIAMOND",
      },
    },
    update: {},
    create: {
      userId,
      currencyType: "DIAMOND",
      balanceAvailable: 0,
    },
  });

  await prisma.notificationPreference.upsert({
    where: {
      userId,
    },
    update: {},
    create: {
      userId,
    },
  });
}

