import { Injectable } from '@nestjs/common';
import { PolicyAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePolicyDto } from './dto';

export type PolicyEvaluation = {
  autoReject: boolean;
  requireManager: boolean;
  requireFinance: boolean;
  matchedPolicyIds: string[];
};

@Injectable()
export class PoliciesService {
  constructor(private prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.policy.findMany({ where: { organizationId }, orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }] });
  }

  create(organizationId: string, dto: CreatePolicyDto) {
    return this.prisma.policy.create({ data: { organizationId, ...dto } });
  }

  async remove(organizationId: string, id: string) {
    const policy = await this.prisma.policy.findFirstOrThrow({ where: { id, organizationId } });
    return this.prisma.policy.delete({ where: { id: policy.id } });
  }

  async evaluate(organizationId: string, amountCents: number, category: string): Promise<PolicyEvaluation> {
    const policies = await this.prisma.policy.findMany({ where: { organizationId, active: true }, orderBy: { priority: 'asc' } });
    const matched = policies.filter((p) => {
      const categoryMatch = !p.category || p.category.toLowerCase() === category.toLowerCase();
      const minMatch = p.minAmountCents == null || amountCents >= p.minAmountCents;
      const maxMatch = p.maxAmountCents == null || amountCents <= p.maxAmountCents;
      return categoryMatch && minMatch && maxMatch;
    });

    return {
      autoReject: matched.some((p) => p.action === PolicyAction.AUTO_REJECT),
      requireManager: matched.some((p) => p.action === PolicyAction.REQUIRE_MANAGER),
      requireFinance: matched.some((p) => p.action === PolicyAction.REQUIRE_FINANCE),
      matchedPolicyIds: matched.map((p) => p.id),
    };
  }
}
