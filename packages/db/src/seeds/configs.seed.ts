import type { PrismaClient } from "@prisma/client";

const configs = [
  {
    key: "economy.host_share_bps",
    value: 5000,
    description: "Host diamond share in basis points for gift settlement.",
  },
  {
    key: "economy.platform_share_bps",
    value: 5000,
    description: "Platform share in basis points for gift settlement.",
  },
  {
    key: "withdrawal.min_diamond",
    value: 1000,
    description: "Minimum diamond threshold for withdrawal.",
  },
  {
    key: "withdrawal.daily_cap_diamond",
    value: 100000,
    description: "Daily withdrawal cap in diamonds.",
  },
  {
    key: "withdrawal.diamond_to_cash_rate",
    value: 1,
    description: "Conversion rate snapshot seed value.",
  },
  {
    key: "moderation.banned_words",
    value: [],
    description: "Seed banned words list pointer/config.",
  },
];

export async function seedSystemConfigs(prisma: PrismaClient): Promise<void> {
  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {
        value: config.value,
        description: config.description,
      },
      create: config,
    });
  }
}

