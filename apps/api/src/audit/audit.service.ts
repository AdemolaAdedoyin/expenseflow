import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}
  write(input: { organizationId: string; actorId?: string; entityType: string; entityId: string; action: string; metadata?: Record<string, unknown> }) {
    return this.prisma.auditLog.create({ data: { ...input, metadata: input.metadata as any } });
  }
  list(organizationId: string, entityType?: string, entityId?: string) {
    return this.prisma.auditLog.findMany({ where: { organizationId, ...(entityType && { entityType }), ...(entityId && { entityId }) }, orderBy: { createdAt: 'desc' }, take: 100 });
  }
}
