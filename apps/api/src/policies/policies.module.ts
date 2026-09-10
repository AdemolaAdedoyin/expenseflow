import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';
@Module({ controllers: [PoliciesController], providers: [PoliciesService, RolesGuard], exports: [PoliciesService] })
export class PoliciesModule {}
