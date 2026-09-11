import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type AuditInput = {
  organizationId: string;
  actorId?: string;
  entityType: string;
  entityId: string;
  action: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  write(input: AuditInput) {
    return this.prisma.withTenant(input.organizationId, (transaction) =>
      transaction.auditLog.create({
        data: {
          ...input,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
        },
      }),
    );
  }

  list(organizationId: string, entityType?: string, entityId?: string) {
    return this.prisma.withTenant(organizationId, (transaction) =>
      transaction.auditLog.findMany({
        where: {
          organizationId,
          ...(entityType && { entityType }),
          ...(entityId && { entityId }),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }
}
