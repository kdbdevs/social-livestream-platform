import { prisma } from "../client.js";
import { seedSystemConfigs } from "./configs.seed.js";
import { seedGiftCatalog } from "./gifts.seed.js";
import { seedPaymentPackages } from "./payments.seed.js";
import { seedUsers } from "./users.seed.js";

async function main(): Promise<void> {
  await seedUsers(prisma);
  await seedGiftCatalog(prisma);
  await seedPaymentPackages(prisma);
  await seedSystemConfigs(prisma);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
