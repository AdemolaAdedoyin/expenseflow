import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/idempotency/idempotent.decorator';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { Permission } from '../common/permissions/permissions';
import { CreatePolicyDto } from './dto';
import { PoliciesService } from './policies.service';

@ApiTags('policies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('policies')
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Get()
  @RequirePermissions(Permission.POLICY_READ)
  list(@CurrentUser() user: AuthUser) {
    return this.policies.list(user.organizationId);
  }

  @Post()
  @RequirePermissions(Permission.POLICY_MANAGE)
  @Idempotent()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePolicyDto) {
    return this.policies.create(user.organizationId, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.POLICY_MANAGE)
  @Idempotent()
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.policies.remove(user.organizationId, id);
  }
}
