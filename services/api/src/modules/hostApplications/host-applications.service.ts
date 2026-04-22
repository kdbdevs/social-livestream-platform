import { prisma } from "@social-livestream/db";
import {
  assertCanSubmitHostApplication,
  assertHostApplicationApprovable,
  assertHostApplicationRejectable,
  DomainError,
} from "@social-livestream/domain-core";
import { serializeHostApplication } from "../../common/serialization.js";

export async function submitHostApplication(
  actor: { userId: string },
  input: { legalName: string; displayName: string; countryCode: string },
) {
  const existing = await prisma.hostApplication.findUnique({
    where: {
      userId: actor.userId,
    },
  });

  assertCanSubmitHostApplication(existing?.status ?? null);

  const application = existing
    ? await prisma.hostApplication.update({
        where: {
          userId: actor.userId,
        },
        data: {
          legalName: input.legalName,
          displayName: input.displayName,
          countryCode: input.countryCode,
          status: "PENDING",
          reviewedByAdminId: null,
          reviewedAt: null,
          notes: null,
        },
      })
    : await prisma.hostApplication.create({
        data: {
          userId: actor.userId,
          legalName: input.legalName,
          displayName: input.displayName,
          countryCode: input.countryCode,
          status: "PENDING",
        },
      });

  return serializeHostApplication(application);
}

export async function getMyHostApplication(userId: string) {
  const application = await prisma.hostApplication.findUnique({
    where: {
      userId,
    },
  });

  return application ? serializeHostApplication(application) : null;
}

export async function listHostApplications(input: { status?: "PENDING" | "APPROVED" | "REJECTED"; cursor?: string; limit: number }) {
  const records = await prisma.hostApplication.findMany({
    where: input.status ? { status: input.status } : undefined,
    take: input.limit + 1,
    skip: input.cursor ? 1 : 0,
    cursor: input.cursor ? { id: input.cursor } : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  const hasMore = records.length > input.limit;
  const items = hasMore ? records.slice(0, input.limit) : records;

  return {
    applications: items.map(serializeHostApplication),
    nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
  };
}

export async function approveHostApplication(adminActor: { userId: string }, applicationId: string, notes?: string) {
  const application = await prisma.hostApplication.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new DomainError("HOST_APPLICATION_NOT_FOUND", 404, "Host application not found.");
  }

  assertHostApplicationApprovable(application.status);

  const result = await prisma.$transaction(async (tx) => {
    const updatedApplication = await tx.hostApplication.update({
      where: {
        id: applicationId,
      },
      data: {
        status: "APPROVED",
        reviewedByAdminId: adminActor.userId,
        reviewedAt: new Date(),
        notes: notes ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorType: "ADMIN",
        actorUserId: adminActor.userId,
        entityType: "HOST_APPLICATION",
        entityId: updatedApplication.id,
        action: "host_application.approved",
        metadata: {
          userId: application.userId,
          notes: notes ?? null,
        },
      },
    });

    return updatedApplication;
  });

  return serializeHostApplication(result);
}

export async function rejectHostApplication(adminActor: { userId: string }, applicationId: string, notes?: string) {
  const application = await prisma.hostApplication.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new DomainError("HOST_APPLICATION_NOT_FOUND", 404, "Host application not found.");
  }

  assertHostApplicationRejectable(application.status);

  const result = await prisma.$transaction(async (tx) => {
    const updatedApplication = await tx.hostApplication.update({
      where: {
        id: applicationId,
      },
      data: {
        status: "REJECTED",
        reviewedByAdminId: adminActor.userId,
        reviewedAt: new Date(),
        notes: notes ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorType: "ADMIN",
        actorUserId: adminActor.userId,
        entityType: "HOST_APPLICATION",
        entityId: updatedApplication.id,
        action: "host_application.rejected",
        metadata: {
          userId: application.userId,
          notes: notes ?? null,
        },
      },
    });

    return updatedApplication;
  });

  return serializeHostApplication(result);
}
