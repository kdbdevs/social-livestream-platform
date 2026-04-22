import type { Prisma } from "@prisma/client";
import type { AuditActorType, AuditEntityType } from "@social-livestream/shared-types";
import { prisma } from "@social-livestream/db";

interface AuditInput {
  actorType: AuditActorType;
  actorUserId?: string | null;
  actorLabel?: string | null;
  entityType: AuditEntityType;
  entityId: string;
  action: string;
  metadata?: Record<string, unknown>;
}

export async function createAuditLog(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorType: input.actorType,
      actorUserId: input.actorUserId ?? null,
      actorLabel: input.actorLabel ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
