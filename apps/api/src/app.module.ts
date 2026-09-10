import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ApprovalsModule } from './approvals/approvals.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { ObservabilityModule } from './common/observability/observability.module';
import { ExpensesModule } from './expenses/expenses.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OperationsModule } from './operations/operations.module';
import { PoliciesModule } from './policies/policies.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    ObservabilityModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get('REDIS_URL', 'redis://localhost:6379'),
        },
      }),
    }),
    PrismaModule,
    IdempotencyModule,
    AuthModule,
    UsersModule,
    AuditModule,
    NotificationsModule,
    OperationsModule,
    PoliciesModule,
    ApprovalsModule,
    ExpensesModule,
    ReportsModule,
  ],
})
export class AppModule {}
