import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Idempotent } from '../common/idempotency/idempotent.decorator';
import { CreatePolicyDto } from './dto';
import { PoliciesService } from './policies.service';

@ApiTags('policies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('policies')
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.policies.list(user.organizationId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.FINANCE)
  @Idempotent()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePolicyDto) {
    return this.policies.create(user.organizationId, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.FINANCE)
  @Idempotent()
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.policies.remove(user.organizationId, id);
  }
}
