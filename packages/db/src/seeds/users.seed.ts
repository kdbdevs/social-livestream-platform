import type { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { ensureWallets } from "./helpers.js";

export async function seedUsers(prisma: PrismaClient): Promise<void> {
  const passwordHash = await hash("password123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash,
      username: "admin",
    },
    create: {
      email: "admin@example.com",
      username: "admin",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  const approvedHost = await prisma.user.upsert({
    where: { email: "host@example.com" },
    update: {
      role: "HOST",
      status: "ACTIVE",
      passwordHash,
      username: "host01",
    },
    create: {
      email: "host@example.com",
      username: "host01",
      passwordHash,
      role: "HOST",
      status: "ACTIVE",
    },
  });

  await prisma.hostApplication.upsert({
    where: { userId: approvedHost.id },
    update: {
      legalName: "Approved Host",
      displayName: "host01",
      countryCode: "ID",
      status: "APPROVED",
      reviewedByAdminId: admin.id,
      reviewedAt: new Date(),
      notes: "Seed-approved host",
    },
    create: {
      userId: approvedHost.id,
      legalName: "Approved Host",
      displayName: "host01",
      countryCode: "ID",
      status: "APPROVED",
      reviewedByAdminId: admin.id,
      reviewedAt: new Date(),
      notes: "Seed-approved host",
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: "viewer@example.com" },
    update: {
      role: "VIEWER",
      status: "ACTIVE",
      passwordHash,
      username: "viewer01",
    },
    create: {
      email: "viewer@example.com",
      username: "viewer01",
      passwordHash,
      role: "VIEWER",
      status: "ACTIVE",
    },
  });

  await Promise.all([ensureWallets(prisma, admin.id), ensureWallets(prisma, approvedHost.id), ensureWallets(prisma, viewer.id)]);
}

