import type { PrismaClient } from "@prisma/client";

const gifts = [
  { code: "ROSE", name: "Rose", coinPrice: 10, diamondReward: 5, animationTier: "SMALL", sortOrder: 1 },
  { code: "COFFEE", name: "Coffee", coinPrice: 50, diamondReward: 25, animationTier: "SMALL", sortOrder: 2 },
  { code: "CAKE", name: "Cake", coinPrice: 200, diamondReward: 100, animationTier: "BIG", sortOrder: 3 },
  { code: "SPORTS_CAR", name: "Sports Car", coinPrice: 1000, diamondReward: 500, animationTier: "FULLSCREEN", sortOrder: 4 },
  { code: "CROWN", name: "Crown", coinPrice: 2500, diamondReward: 1250, animationTier: "FULLSCREEN", sortOrder: 5 },
] as const;

export async function seedGiftCatalog(prisma: PrismaClient): Promise<void> {
  for (const gift of gifts) {
    await prisma.giftCatalogItem.upsert({
      where: { code: gift.code },
      update: {
        ...gift,
        active: true,
      },
      create: {
        ...gift,
        active: true,
      },
    });
  }
}

