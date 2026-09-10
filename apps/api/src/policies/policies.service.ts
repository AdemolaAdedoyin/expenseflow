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
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.withTenant(organizationId, (transaction) =>
      transaction.policy.findMany({
        where: { organizationId },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      }),
    );
  }

  create(organizationId: string, dto: CreatePolicyDto) {
    return this.prisma.withTenant(organizationId, (transaction) =>
      transaction.policy.create({ data: { organizationId, ...dto } }),
    );
  }

  remove(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (transaction) => {
      const policy = await transaction.policy.findFirstOrThrow({
        where: { id, organizationId },
      });
      return transaction.policy.delete({ where: { id: policy.id } });
    });
  }

  async evaluate(
    organizationId: string,
    amountCents: number,
    category: string,
  ): Promise<PolicyEvaluation> {
    const policies = await this.prisma.withTenant(organizationId, (transaction) =>
      transaction.policy.findMany({
        where: { organizationId, active: true },
        orderBy: { priority: 'asc' },
      }),
    );

    const matched = policies.filter((policy) => {
      const categoryMatch =
        !policy.category || policy.category.toLowerCase() === category.toLowerCase();
      const minMatch = policy.minAmountCents == null || amountCents >= policy.minAmountCents;
      const maxMatch = policy.maxAmountCents == null || amountCents <= policy.maxAmountCents;
      return categoryMatch && minMatch && maxMatch;
    });

    return {
      autoReject: matched.some((policy) => policy.action === PolicyAction.AUTO_REJECT),
      requireManager: matched.some(
        (policy) => policy.action === PolicyAction.REQUIRE_MANAGER,
      ),
      requireFinance: matched.some(
        (policy) => policy.action === PolicyAction.REQUIRE_FINANCE,
      ),
      matchedPolicyIds: matched.map((policy) => policy.id),
    };
  }
}
