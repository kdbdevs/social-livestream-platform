import type { PrismaClient } from "@prisma/client";

const packages = [
  { id: "00000000-0000-0000-0000-000000000101", name: "Starter Pack", fiatCurrency: "USD", fiatAmount: 199, coinAmount: 2000, sortOrder: 1 },
  { id: "00000000-0000-0000-0000-000000000102", name: "Value Pack", fiatCurrency: "USD", fiatAmount: 499, coinAmount: 5500, sortOrder: 2 },
  { id: "00000000-0000-0000-0000-000000000103", name: "Pro Pack", fiatCurrency: "USD", fiatAmount: 999, coinAmount: 12000, sortOrder: 3 },
] as const;

export async function seedPaymentPackages(prisma: PrismaClient): Promise<void> {
  for (const pkg of packages) {
    await prisma.paymentPackage.upsert({
      where: {
        id: pkg.id,
      },
      update: {
        ...pkg,
        active: true,
      },
      create: {
        ...pkg,
        active: true,
      },
    });
  }
}
