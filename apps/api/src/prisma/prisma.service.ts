import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Runs tenant-owned data access on one database connection and stores the tenant id
   * in a transaction-local PostgreSQL setting. RLS policies read this value, while the
   * explicit organization filters in services remain in place as the first boundary.
   */
  withTenant<T>(
    organizationId: string,
    work: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.current_organization_id', ${organizationId}, true)`;
      return work(transaction);
    });
  }
}
